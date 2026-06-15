import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { generateIllustrationsForStory, generateIllustrationsWithFlux, buildCharacterReference } from "@/lib/ai/illustrations";
import { generateFlux2 } from "@/lib/ai/flux2";
import { judgeIllustrations } from "@/lib/ai/qa-judge";
import type { Screenplay } from "@/lib/ai/scene-screenplay";
import type { AssetReference } from "@/lib/ai/visual-assets";
import { SCENE_LAYOUT_PAIRS, LAYOUT_IMAGE_SIZE } from "@/components/book-viewer/types";
import {
  uploadIllustrationFromUrl,
  uploadPortraitFromUrl,
  uploadBookPdf,
  uploadInteriorPdf,
  uploadCoverSpreadPdf,
  getSignedPdfUrlForGelato,
} from "@/lib/supabase/storage";
import { getMockIllustrationUrl } from "@/lib/ai/mock-story";
import { renderBookPdf, renderInteriorPdf, type BookPdfInput } from "@/lib/pdf/book-template";
import { buildCoverSpreadFromBook } from "@/lib/pdf/cover-spread";
import { getTheme } from "@/lib/pdf/theme";
import { prefetchAllIllustrations, prefetchImageAsDataUri } from "@/lib/pdf/prefetch";
import { createPrintOrder } from "@/lib/gelato/orders";
import { getCoverDimensions } from "@/lib/gelato/catalog";
import { notifyOrderEmail } from "@/lib/email/notify-order";
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

  // Rate limit: max 3 completions per 5 minutes
  if (user) {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    const rl = await checkRateLimit(user.id, "complete_story");
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds ?? 300) } },
      );
    }
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

    // Detect if story was generated with the FLUX pipeline (screenplay present)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const generatedTextAny = story.generated_text as any;
    const useFlux = !!generatedTextAny?.fluxScreenplay;

    if (useFlux) {
      // ── FLUX Kontext completion pipeline ───────────────────────────────
      console.log("[Complete][FLUX] Using FLUX Kontext pipeline");

      // Per-stage image model: the FINAL book uses the PREMIUM model (default
      // BFL flux-2-flex) for maximum consistency/quality — cost/time don't matter
      // here (already paid, generated in the background). Override via env.
      const finalModel = process.env.FINAL_IMAGE_PROVIDER
        ? { provider: process.env.FINAL_IMAGE_PROVIDER, falModel: process.env.FINAL_FAL_MODEL }
        : undefined;

      // 1. Load references from Supabase Storage URLs → base64
      const fluxRefs = generatedTextAny.fluxReferences as { assetId: string; storageUrl: string }[];
      const screenplay = generatedTextAny.fluxScreenplay as Screenplay;

      const assetReferences: AssetReference[] = await Promise.all(
        fluxRefs.map(async (ref) => {
          try {
            const response = await fetch(ref.storageUrl);
            const buffer = Buffer.from(await response.arrayBuffer());
            return { assetId: ref.assetId, base64: buffer.toString("base64"), storageUrl: ref.storageUrl };
          } catch {
            return { assetId: ref.assetId, base64: "", storageUrl: ref.storageUrl };
          }
        })
      );

      // 2. Decide which scenes to generate now.
      // In two-speed mode the preview scenes were a CHEAP/FAST taster (different
      // model) — regenerate ALL 12 here with the PREMIUM model so the delivered
      // book is uniformly perfect. Otherwise just fill the pending (non-preview) ones.
      const twoSpeed = !!process.env.PREVIEW_IMAGE_PROVIDER;
      const { data: pendingIlls } = await supabase
        .from("story_illustrations")
        .select("scene_number")
        .eq("story_id", storyId)
        .eq("status", "pending");
      const pendingSceneNumbers = twoSpeed
        ? screenplay.scenes.map((s) => s.sceneNumber).filter((n) => n <= 12)
        : (pendingIlls || []).map(i => i.scene_number).filter(n => n <= 12);

      if (pendingSceneNumbers.length > 0) {
        console.log(`[Complete][FLUX] Generating ${pendingSceneNumbers.length} remaining scenes: [${pendingSceneNumbers.join(", ")}]`);

        // 3. Generate remaining illustrations
        const newIllustrations = await generateIllustrationsWithFlux(
          screenplay, assetReferences, { sceneNumbers: pendingSceneNumbers, imageModel: finalModel }
        );

        // 4. Upload to Supabase Storage
        for (let i = 0; i < newIllustrations.length; i++) {
          const ill = newIllustrations[i];
          const sceneNum = pendingSceneNumbers[i];
          if (ill.provider === "flux") {
            const permanentUrl = await uploadIllustrationFromUrl(supabase, storyId, sceneNum, ill.imageUrl);
            await supabase.from("story_illustrations")
              .update({ image_url: permanentUrl, status: "ready" })
              .eq("story_id", storyId)
              .eq("scene_number", sceneNum);
          }
        }
      }

      // 5. Get ALL illustrations for QA
      const { data: allIlls } = await supabase
        .from("story_illustrations")
        .select("scene_number, image_url")
        .eq("story_id", storyId)
        .lte("scene_number", 12)
        .eq("status", "ready")
        .order("scene_number");

      // Build characterRef for QA judge
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

      // 6+7. QA judge → regenerate failing scenes → RE-JUDGE. Closed loop, max 2 regen passes.
      const loadReady = async () => {
        const { data } = await supabase
          .from("story_illustrations")
          .select("scene_number, image_url")
          .eq("story_id", storyId).lte("scene_number", 12).eq("status", "ready").order("scene_number");
        return (data || []).map(i => ({ sceneNumber: i.scene_number, imageUrl: i.image_url! }));
      };

      const MAX_REGEN_PASSES = 2;
      let qaResult = await judgeIllustrations(
        (allIlls || []).map(i => ({ sceneNumber: i.scene_number, imageUrl: i.image_url! })),
        assetReferences, screenplay, characterRef, 1,
      );
      if (qaResult.skipped) {
        // Book is going to print/PDF without any QA review — make it auditable.
        console.error(`[Complete][FLUX2] ⚠️ QA was SKIPPED for story ${storyId} — shipping UNREVIEWED. Check GEMINI_API_KEY / quota.`);
      }

      for (let pass = 1; pass <= MAX_REGEN_PASSES && qaResult.scenesToRegenerate.length > 0; pass++) {
        const failing = qaResult.scenesToRegenerate;
        console.log(`[Complete][FLUX2] QA pass ${pass}: regenerating scenes [${failing.join(", ")}]`);

        // Escalate: fold the judge's per-scene suggestion + a strict-consistency nudge
        // into the failing scenes' prompts so the retry changes strategy, not just reroll.
        const escalated: Screenplay = {
          ...screenplay,
          scenes: screenplay.scenes.map((s) => {
            if (!failing.includes(s.sceneNumber)) return s;
            const v = qaResult.verdicts.find((x) => x.sceneNumber === s.sceneNumber);
            const hint = v?.suggestion ? ` ${v.suggestion}` : "";
            return { ...s, fluxPrompt: `${s.fluxPrompt}${hint} Strictly match the reference sheets: same faces, colors, outfit, location and props.` };
          }),
        };

        const regenResults = await generateIllustrationsWithFlux(escalated, assetReferences, { sceneNumbers: failing, imageModel: finalModel });
        for (let i = 0; i < regenResults.length; i++) {
          const ill = regenResults[i];
          const sceneNum = failing[i];
          if (ill.provider === "flux") {
            const url = await uploadIllustrationFromUrl(supabase, storyId, sceneNum, ill.imageUrl);
            await supabase.from("story_illustrations")
              .update({ image_url: url, status: "ready" })
              .eq("story_id", storyId).eq("scene_number", sceneNum);
          }
        }

        // Re-judge to confirm the regen actually fixed it (closes the loop).
        qaResult = await judgeIllustrations(await loadReady(), assetReferences, screenplay, characterRef, pass + 1);
      }
      if (qaResult.scenesToRegenerate.length > 0) {
        console.warn(`[Complete][FLUX2] ${qaResult.scenesToRegenerate.length} scene(s) still below threshold after ${MAX_REGEN_PASSES} passes: [${qaResult.scenesToRegenerate.join(", ")}]`);
      }

      // 8. Generate portrait with protagonist reference
      const protagonistRef = assetReferences.find(r => r.assetId === "protagonist");
      if (protagonistRef?.base64) {
        try {
          const portrait = await generateFlux2(
            `Close-up portrait of the same character from the reference image, from chest up, warm friendly smile, soft warm lighting, simple clean background. Children's book watercolor illustration. No text, no signature.`,
            { inputImages: [protagonistRef.base64], aspectRatio: "3:4", provider: finalModel?.provider, falModel: finalModel?.falModel }
          );
          const portraitUrl = await uploadPortraitFromUrl(supabase, storyId, portrait.url);
          await supabase.from("stories").update({ character_portrait_url: portraitUrl }).eq("id", storyId);
        } catch (err) {
          console.error("[Complete] Portrait generation failed (non-fatal):", err);
        }
      }

      // 9. Update status
      await supabase.from("stories").update({ status: "ready", pdf_url: null }).eq("id", storyId);

    } else {
      // ── Recraft completion pipeline (unchanged) ────────────────────────

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
    }

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

    const character = story.characters as {
      name: string; age: number; gender: string;
      city?: string; interests?: string[];
      favorite_color?: string; favorite_companion?: string;
      future_dream?: string;
    };

    // Pre-fetch cover image + portrait as base64 data URIs for @react-pdf
    const [coverImageUrl, portraitUrl] = await Promise.all([
      story.cover_image_url ? prefetchImageAsDataUri(story.cover_image_url) : null,
      story.character_portrait_url ? prefetchImageAsDataUri(story.character_portrait_url) : null,
    ]);

    const pdfInput: BookPdfInput = {
      story: generatedText,
      templateId: story.template_id,
      characterName: character.name,
      characterAge: character.age,
      characterGender: character.gender,
      characterCity: character.city,
      favoriteColor: character.favorite_color,
      favoriteCompanion: character.favorite_companion,
      futureDream: character.future_dream,
      dedicationText: story.dedication_text,
      senderName: story.sender_name,
      storyId,
      coverImageUrl,
      portraitUrl,
      illustrations: prefetchedIllustrations,
      locale: (story as Record<string, unknown>).locale as string | undefined,
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

    // 4. Render full book + interior PDFs
    // Full book is rendered first because we extract the cover spread from it (actual pages)
    console.log("[Gelato] Rendering full book + interior PDFs...");
    const [fullBookBuffer, interiorBuffer] = await Promise.all([
      renderBookPdf(pdfInput),       // full 32-page book — for user download + cover extraction
      renderInteriorPdf(pdfInput),   // pages 2–31 — Gelato "inside" file
    ]);

    // 5. Build cover spread from actual book pages using pdf-lib
    // Embeds page 0 (front cover) and last page (back cover) with a spine strip
    const theme = getTheme(story.template_id, character.gender, character.favorite_color ?? undefined);
    console.log("[Gelato] Building cover spread from book pages (pdf-lib)...");
    const coverSpreadBuffer = await buildCoverSpreadFromBook({
      fullBookBuffer,
      coverWidthMm: coverDims.coverWidthMm,
      coverHeightMm: coverDims.coverHeightMm,
      spineWidthMm: coverDims.spineWidthMm,
      bookTitle: generatedText.bookTitle,
      spineColor: theme.coverGradientStart,
    });

    // 6. Upload all three PDFs to Supabase
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

    // 7. Generate 7-day signed URLs for Gelato to fetch both files
    const [interiorSignedUrl, coverSignedUrl] = await Promise.all([
      getSignedPdfUrlForGelato(supabase, interiorPath),
      getSignedPdfUrlForGelato(supabase, coverPath),
    ]);

    // 8. Build customer address for Phase 2 (direct shipping)
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

    // 9. Submit print order to Gelato with both files
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

    // 10. Update order → "producing" and story → "ordered"
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

    // 11. Notify customer the book is now in production. The Gelato "created"
    // webhook will see the order already at "producing" and skip a duplicate email.
    await notifyOrderEmail({
      supabase,
      event: "in_production",
      storyId,
      userId: ownerId,
      email: ownerEmail || undefined, // auth user: scoped client has no auth.admin
    });

  } catch (gelatoError) {
    // Non-fatal: story is "ready", customer can still download their PDF.
    // Order stays at "paid" for manual review / retry.
    console.error("[Gelato] Failed to submit print order:", gelatoError);
  }
}
