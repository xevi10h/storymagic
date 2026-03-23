import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { generateIllustrationsForStory, buildCharacterReference } from "@/lib/ai/illustrations";
import { SCENE_LAYOUT_PAIRS, LAYOUT_IMAGE_SIZE } from "@/components/book-viewer/types";
import {
  uploadIllustrationFromUrl,
  uploadBookPdf,
  uploadInteriorPdf,
  uploadCoverSpreadPdf,
  getSignedPdfUrlForGelato,
} from "@/lib/supabase/storage";
import { getMockIllustrationUrl } from "@/lib/ai/mock-story";
import { renderBookPdf, renderInteriorPdf, renderCoverSpreadPdf, type BookPdfInput } from "@/lib/pdf/book-template";
import { prefetchAllIllustrations, prefetchImageAsDataUri } from "@/lib/pdf/prefetch";
import { createPrintOrder } from "@/lib/gelato/orders";
import { getCoverDimensions } from "@/lib/gelato/catalog";
import type { GeneratedStory } from "@/lib/ai/story-generator";

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Missing Supabase service config");
  return createSupabaseAdmin<Database>(url, serviceKey);
}

// Remaining illustrations (up to 8) + PDF generation + Gelato API call
export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  const { storyId } = await params;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(storyId)) {
    return NextResponse.json({ error: "Invalid story ID" }, { status: 400 });
  }

  // Try user session first, fall back to service role for guest users
  // Guest users are identified by having a paid order for this story
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();

  let supabase: ReturnType<typeof createServiceClient>;

  if (user) {
    // Authenticated user — use their scoped client
    supabase = userSupabase as unknown as ReturnType<typeof createServiceClient>;
  } else {
    // Guest user — verify they have a paid order for this story
    const adminClient = createServiceClient();
    const { data: paidOrderCheck } = await adminClient
      .from("orders")
      .select("id")
      .eq("story_id", storyId)
      .eq("status", "paid")
      .limit(1)
      .single();

    if (!paidOrderCheck) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    supabase = adminClient;
  }

  // Verify story exists (scoped to user if authenticated)
  let storyQuery = supabase
    .from("stories")
    .select("*, characters(*)")
    .eq("id", storyId);

  if (user) storyQuery = storyQuery.eq("user_id", user.id);

  const { data: story, error: storyError } = await storyQuery.single();

  if (storyError || !story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  // MOCK MODE: fill any pending illustrations and mark ready — runs regardless of current
  // story status so the dev bypass always works even if status is already "ready".
  // Safety: NEVER allow mock mode when Stripe is in live mode (production safeguard)
  const isMockMode = process.env.MOCK_MODE === "true" && process.env.STRIPE_ENVIRONMENT !== "live";
  if (isMockMode) {
    const { data: pendingIlls } = await supabase
      .from("story_illustrations")
      .select("scene_number")
      .eq("story_id", storyId)
      .eq("status", "pending")
      .order("scene_number");

    if (pendingIlls && pendingIlls.length > 0) {
      await Promise.all(
        pendingIlls.map((ill) =>
          supabase
            .from("story_illustrations")
            .update({ image_url: getMockIllustrationUrl(ill.scene_number - 1), status: "ready" })
            .eq("story_id", storyId)
            .eq("scene_number", ill.scene_number)
        )
      );
    }

    await supabase
      .from("stories")
      .update({ status: "ready", pdf_url: null })
      .eq("id", storyId);

    return NextResponse.json({ status: "ready" });
  }

  // If already ordered or shipped, return success (idempotent)
  if (story.status === "ready" || story.status === "ordered" || story.status === "shipped") {
    return NextResponse.json({ status: story.status });
  }

  // Only preview or completing stories can be completed
  if (story.status !== "preview" && story.status !== "completing") {
    return NextResponse.json(
      { error: "Story is not in a completable state" },
      { status: 400 }
    );
  }

  // Verify there is a paid order for this story
  let paidOrderQuery = supabase
    .from("orders")
    .select("id, status, format, shipping_name, shipping_address, addons")
    .eq("story_id", storyId)
    .eq("status", "paid")
    .limit(1);

  if (user) paidOrderQuery = paidOrderQuery.eq("user_id", user.id);

  const { data: paidOrder } = await paidOrderQuery.single();

  if (!paidOrder) {
    return NextResponse.json(
      { error: "No paid order found for this story" },
      { status: 402 }
    );
  }

  // Atomic transition: preview → completing
  if (story.status === "preview") {
    const { error: claimError } = await supabase
      .from("stories")
      .update({ status: "completing" })
      .eq("id", storyId)
      .eq("status", "preview");

    if (claimError) {
      console.error("[Complete] Failed to claim story:", claimError);
      return NextResponse.json(
        { error: "Failed to start completion", details: claimError.message },
        { status: 500 }
      );
    }
  }

  try {
    const character = story.characters;
    const rawGeneratedText = story.generated_text as unknown as GeneratedStory;

    if (!rawGeneratedText?.scenes?.length) {
      throw new Error("Story has no generated text");
    }

    // User-chosen title overrides the AI-generated one
    const generatedText: GeneratedStory = story.title
      ? { ...rawGeneratedText, bookTitle: story.title as string }
      : rawGeneratedText;

    // Get pending illustrations (scenes without images)
    const { data: pendingIllustrations } = await supabase
      .from("story_illustrations")
      .select("scene_number, prompt_used")
      .eq("story_id", storyId)
      .eq("status", "pending")
      .order("scene_number");

    if (pendingIllustrations && pendingIllustrations.length > 0) {
      const charDescInput = {
        gender: character.gender as "boy" | "girl" | "neutral",
        age: character.age,
        skinTone: character.skin_tone,
        hairColor: character.hair_color,
        eyeColor: character.eye_color || undefined,
        hairstyle: character.hairstyle || undefined,
        childName: character.name,
        interests: character.interests || [],
      };
      const characterRef = buildCharacterReference(charDescInput);

      const remainingPrompts = pendingIllustrations.map((ill) => ill.prompt_used);

      // Compute per-image sizes: primary illustrations use layout-specific sizes,
      // secondary illustrations (scene_number > 12) always use square
      const remainingSizes = pendingIllustrations.map((ill) => {
        if (ill.scene_number > 12) return "1820x1024"; // secondary illustrations — landscape for illustration_text pages
        const pair = SCENE_LAYOUT_PAIRS[(ill.scene_number - 1) % SCENE_LAYOUT_PAIRS.length];
        return LAYOUT_IMAGE_SIZE[pair[0]] || "1024x1024";
      });

      // Reuse the same Recraft style_id created during initial generation
      // so remaining illustrations match the cover + preview scenes exactly
      const storedStyleId = (story as { recraft_style_id?: string }).recraft_style_id ?? null;

      const illustrations = await generateIllustrationsForStory(
        remainingPrompts,
        characterRef,
        {
          styleId: storedStyleId,
          childAge: character.age,
          gender: character.gender,
          imageSizes: remainingSizes,
          characterInput: charDescInput,
        },
      );

      // Persist to Supabase Storage (retry once before falling back)
      const persistedIllustrations = await Promise.all(
        illustrations.map(async (ill, index) => {
          const sceneNumber = pendingIllustrations[index].scene_number;
          if (ill.provider !== "recraft") return { ...ill, sceneNumber };

          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              const permanentUrl = await uploadIllustrationFromUrl(
                supabase,
                storyId,
                sceneNumber,
                ill.imageUrl,
              );
              return { ...ill, imageUrl: permanentUrl, sceneNumber };
            } catch (uploadError) {
              if (attempt === 0) {
                console.warn(`[Storage] Upload attempt 1 failed for scene ${sceneNumber}, retrying...`);
                await new Promise((r) => setTimeout(r, 1000));
              } else {
                // Throw instead of storing temp Recraft URL — it expires after ~24h
                throw new Error(`Failed to persist scene ${sceneNumber} after 2 attempts: ${uploadError instanceof Error ? uploadError.message : "Unknown"}`);
              }
            }
          }
          throw new Error(`Unreachable: upload loop for scene ${sceneNumber}`);
        }),
      );

      // Update all illustration rows in parallel (was serial — 200ms×N round-trips)
      await Promise.all(
        persistedIllustrations.map((ill) =>
          supabase
            .from("story_illustrations")
            .update({ image_url: ill.imageUrl, status: "ready" })
            .eq("story_id", storyId)
            .eq("scene_number", ill.sceneNumber)
        )
      );
    }

    // Mark story as ready, clear PDF cache
    await supabase
      .from("stories")
      .update({ status: "ready", pdf_url: null })
      .eq("id", storyId);

    // ── PDF generation + Gelato submission ──────────────────────────────
    // Only for physical formats (softcover / hardcover). Digital PDFs skip Gelato.
    const isPhysical =
      paidOrder.format === "softcover" || paidOrder.format === "hardcover";

    if (isPhysical) {
      const ownerId = user?.id ?? story.user_id;
      const ownerEmail = user?.email ?? "";
      await submitToGelato({ supabase, ownerId, ownerEmail, story, generatedText, storyId, paidOrder });
    } else {
      // Digital order — mark as producing (fulfilled digitally, no print needed)
      await supabase
        .from("orders")
        .update({ status: "producing" })
        .eq("id", paidOrder.id);
    }

    return NextResponse.json({ status: "ready" });
  } catch (error) {
    // Revert to preview (text + 4 preview illustrations are preserved)
    await supabase
      .from("stories")
      .update({ status: "preview" })
      .eq("id", storyId);

    console.error("Story completion failed:", error);
    return NextResponse.json(
      {
        error: "Completion failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ── Gelato submission ────────────────────────────────────────────────────────

interface GelatoSubmitParams {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  ownerId: string;
  ownerEmail: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  story: any;
  generatedText: GeneratedStory;
  storyId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  paidOrder: any;
}

async function submitToGelato({
  supabase,
  ownerId,
  ownerEmail,
  story,
  generatedText,
  storyId,
  paidOrder,
}: GelatoSubmitParams): Promise<void> {
  try {
    // 1. Fetch all illustrations
    const { data: allIllustrations } = await supabase
      .from("story_illustrations")
      .select("scene_number, image_url")
      .eq("story_id", storyId)
      .order("scene_number");

    const illustrationRefs = (allIllustrations ?? []).map(
      (ill: { scene_number: number; image_url: string | null }) => ({
        sceneNumber: ill.scene_number,
        imageUrl: ill.image_url,
      }),
    );

    // 2. Pre-fetch images as base64 data URIs for @react-pdf
    console.log(`[Gelato] Pre-fetching ${illustrationRefs.length} illustrations...`);
    const prefetchedIllustrations = await prefetchAllIllustrations(illustrationRefs);

    const character = story.characters as { name: string; age: number };

    // Pre-fetch cover image as base64 data URI
    const coverImageUrl = story.cover_image_url
      ? await prefetchImageAsDataUri(story.cover_image_url)
      : null;

    const pdfInput: BookPdfInput = {
      story: generatedText,
      templateId: story.template_id,
      characterName: character.name,
      characterAge: character.age,
      dedicationText: story.dedication_text,
      senderName: story.sender_name,
      storyId,
      coverImageUrl,
      illustrations: prefetchedIllustrations,
    };

    // 3. Get cover dimensions from Gelato (spine width depends on page count + paper)
    const productUid = process.env[
      paidOrder.format === "hardcover"
        ? "GELATO_PRODUCT_UID_HARDCOVER"
        : "GELATO_PRODUCT_UID_SOFTCOVER"
    ];

    if (!productUid) throw new Error("Gelato product UID not configured");

    console.log("[Gelato] Fetching cover dimensions...");
    const coverDims = await getCoverDimensions(productUid, 30);

    // 4. Render both PDFs in parallel
    console.log("[Gelato] Rendering interior + cover spread PDFs...");
    const [fullBookBuffer, interiorBuffer, coverSpreadBuffer] = await Promise.all([
      renderBookPdf(pdfInput),          // full book — for user download
      renderInteriorPdf(pdfInput),       // pages 2–31 — Gelato "inside" file
      renderCoverSpreadPdf(             // cover spread — Gelato "default" file
        pdfInput,
        coverDims.coverWidthMm,
        coverDims.coverHeightMm,
        coverDims.spineWidthMm,
      ),
    ]);

    // 5. Upload all three PDFs to Supabase
    const [fullBookPath, interiorPath, coverPath] = await Promise.all([
      uploadBookPdf(supabase, ownerId, storyId, fullBookBuffer),
      uploadInteriorPdf(supabase, ownerId, storyId, interiorBuffer),
      uploadCoverSpreadPdf(supabase, ownerId, storyId, coverSpreadBuffer),
    ]);

    // Persist full-book path for user-facing downloads
    await supabase
      .from("stories")
      .update({ pdf_url: fullBookPath })
      .eq("id", storyId);

    // 6. Generate 7-day signed URLs for Gelato to fetch both files
    const [interiorSignedUrl, coverSignedUrl] = await Promise.all([
      getSignedPdfUrlForGelato(supabase, interiorPath),
      getSignedPdfUrlForGelato(supabase, coverPath),
    ]);

    // 7. Build customer address for Phase 2 (direct shipping)
    let customerAddress = undefined;
    if (process.env.GELATO_FULFILLMENT_MODE === "direct" && paidOrder.shipping_address) {
      const addr = paidOrder.shipping_address as {
        line1?: string; line2?: string; city?: string;
        state?: string; postal_code?: string; country?: string;
      };
      const [firstName, ...rest] = (paidOrder.shipping_name ?? "").split(" ");
      customerAddress = {
        firstName: firstName ?? "",
        lastName: rest.join(" "),
        addressLine1: addr.line1 ?? "",
        addressLine2: addr.line2 ?? undefined,
        city: addr.city ?? "",
        state: addr.state ?? undefined,
        postCode: addr.postal_code ?? "",
        country: addr.country ?? "ES",
        email: ownerEmail,
      };
    }

    // 8. Submit print order to Gelato with both files
    // extra_copy addon = 2 copies total (1 original + 1 extra)
    const orderAddons: string[] = Array.isArray(paidOrder.addons) ? paidOrder.addons : [];
    const quantity = orderAddons.includes("extra_copy") ? 2 : 1;
    console.log(`[Gelato] Submitting order — story ${storyId}, format: ${paidOrder.format}, quantity: ${quantity}...`);
    const gelatoOrder = await createPrintOrder({
      orderReferenceId: `meapica-${paidOrder.id}`,
      storyId,
      format: paidOrder.format as "softcover" | "hardcover",
      interiorPdfUrl: interiorSignedUrl,
      coverSpreadPdfUrl: coverSignedUrl,
      shippingAddress: customerAddress,
      quantity,
    });

    console.log(`[Gelato] Order created: ${gelatoOrder.id} (${gelatoOrder.fulfillmentStatus})`);

    // 9. Update order → "producing" and story → "ordered"
    await Promise.all([
      supabase
        .from("orders")
        .update({ status: "producing", gelato_order_id: gelatoOrder.id })
        .eq("id", paidOrder.id),
      supabase
        .from("stories")
        .update({ status: "ordered" })
        .eq("id", storyId),
    ]);

  } catch (gelatoError) {
    // Non-fatal: story is "ready", customer can still download their PDF.
    // Order stays at "paid" for manual review / retry.
    console.error("[Gelato] Failed to submit print order:", gelatoError);
  }
}
