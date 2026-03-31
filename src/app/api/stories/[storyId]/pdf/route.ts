import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { renderBookPdf, type BookPdfInput } from "@/lib/pdf/book-template";
import { uploadBookPdf, getSignedPdfUrl } from "@/lib/supabase/storage";
import { prefetchAllIllustrations, prefetchImageAsDataUri } from "@/lib/pdf/prefetch";
import type { GeneratedStory } from "@/lib/ai/story-generator";
import type { Database } from "@/lib/database.types";

export const maxDuration = 60;

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Missing Supabase service config");
  return createSupabaseAdmin<Database>(url, serviceKey);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  const { storyId } = await params;

  // Rate limit: max 5 PDF generations per minute
  const userSupabaseForRL = await createClient();
  const { data: { user: rlUser } } = await userSupabaseForRL.auth.getUser();
  if (rlUser) {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    const rl = await checkRateLimit(rlUser.id, "generate_pdf");
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds ?? 60) } },
      );
    }
  }

  // Try user session first, fall back to service role for guest users
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();

  let supabase: ReturnType<typeof createServiceClient>;

  if (user) {
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

  // Query story (scoped to user if authenticated)
  let storyQuery = supabase
    .from("stories")
    .select("*, characters(*), story_illustrations(*)")
    .eq("id", storyId);

  if (user) storyQuery = storyQuery.eq("user_id", user.id);

  const { data: story, error } = await storyQuery.single();

  if (error || !story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  if (story.status !== "ready" && story.status !== "ordered") {
    return NextResponse.json(
      { error: "Story is not ready yet" },
      { status: 400 }
    );
  }

  const generatedText = story.generated_text as unknown as GeneratedStory;
  if (!generatedText?.bookTitle || !generatedText?.scenes?.length) {
    return NextResponse.json(
      { error: "Story has no generated content" },
      { status: 400 }
    );
  }

  // User-chosen title (from the title picker) overrides the AI-generated one
  const effectiveStory: GeneratedStory = story.title
    ? { ...generatedText, bookTitle: story.title as string }
    : generatedText;

  // Build safe filename from book title
  const safeTitle = effectiveStory.bookTitle
    .replace(/[^a-zA-Z0-9áéíóúñüÁÉÍÓÚÑÜ\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 60);
  const filename = `${safeTitle}-meapica.pdf`;

  // Check for ?force=true to regenerate the PDF
  const url = new URL(request.url);
  const forceRegenerate = url.searchParams.get("force") === "true";

  // If we have a cached PDF and aren't forcing regeneration, serve it
  if (story.pdf_url && !forceRegenerate) {
    try {
      const signedUrl = await getSignedPdfUrl(
        supabase as unknown as Awaited<ReturnType<typeof createClient>>,
        story.pdf_url,
      );
      // Proxy the PDF instead of redirecting (avoids CORS issues with fetch())
      const pdfRes = await fetch(signedUrl);
      if (pdfRes.ok) {
        const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());
        return new Response(pdfBytes, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Content-Length": pdfBytes.byteLength.toString(),
            "Cache-Control": "private, max-age=3600",
          },
        });
      }
    } catch {
      console.warn("[PDF] Cached PDF not found in storage, regenerating...");
    }
  }

  // Build PDF input
  const character = story.characters as unknown as {
    name: string;
    age: number;
    gender: string;
    city: string | null;
    interests: string[] | null;
    favorite_color: string | null;
    favorite_companion: string | null;
    future_dream: string | null;
    avatar_url: string | null;
  };

  // Pre-fetch cover and portrait images as base64 data URIs
  const [coverImageUrl, portraitUrl] = await Promise.all([
    story.cover_image_url ? prefetchImageAsDataUri(story.cover_image_url) : null,
    story.character_portrait_url ? prefetchImageAsDataUri(story.character_portrait_url) : null,
  ]);

  const illustrations = (
    story.story_illustrations as unknown as {
      scene_number: number;
      image_url: string | null;
    }[]
  ).map((ill) => ({
    sceneNumber: ill.scene_number,
    imageUrl: ill.image_url,
  }));

  // Pre-fetch all illustration images as base64 data URIs
  // This is critical: @react-pdf's Image component silently fails with
  // many external URLs (Supabase Storage, CDNs with redirects, etc.)
  console.log(`[PDF] Pre-fetching ${illustrations.length} illustration images...`);
  const prefetchedIllustrations = await prefetchAllIllustrations(illustrations);

  const pdfInput: BookPdfInput = {
    story: effectiveStory,
    templateId: story.template_id,
    characterName: character.name,
    characterAge: character.age,
    dedicationText: story.dedication_text,
    senderName: story.sender_name,
    storyId,
    coverImageUrl,
    illustrations: prefetchedIllustrations,
    locale: (story as Record<string, unknown>).locale as string | undefined,
    portraitUrl,
    characterGender: character.gender,
    characterCity: character.city,
    characterInterests: character.interests ?? [],
    favoriteColor: character.favorite_color,
    favoriteCompanion: character.favorite_companion,
    futureDream: character.future_dream,
  };

  try {
    const buffer = await renderBookPdf(pdfInput);

    // Upload to Supabase Storage for caching — retry once before giving up
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const storagePath = await uploadBookPdf(
          supabase as unknown as Awaited<ReturnType<typeof createClient>>,
          user?.id ?? "guest",
          storyId,
          buffer,
        );

        await supabase
          .from("stories")
          .update({ pdf_url: storagePath })
          .eq("id", storyId);
        break; // success
      } catch (uploadError) {
        if (attempt === 0) {
          console.warn("[PDF] Upload attempt 1 failed, retrying...", uploadError);
          await new Promise((r) => setTimeout(r, 1000));
        } else {
          // Non-fatal: PDF is still returned to user, just won't be cached
          console.error("[PDF] Failed to persist PDF after 2 attempts:", uploadError);
        }
      }
    }

    // Return the PDF directly
    const bytes = new Uint8Array(buffer);

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": bytes.byteLength.toString(),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (renderError) {
    console.error("PDF render error:", renderError);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
