import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import sharp from "sharp";
import { renderBookPdf, type BookPdfInput } from "@/lib/pdf/book-template";
import { uploadBookPdf, getSignedPdfUrl } from "@/lib/supabase/storage";
import type { GeneratedStory } from "@/lib/ai/story-generator";

// ── Image pre-fetching ──────────────────────────────────────────────────
// Two critical issues with @react-pdf and external images:
// 1. @react-pdf silently fails fetching many external URLs
// 2. @react-pdf does NOT support WebP — only PNG and JPEG
// We pre-fetch all images, convert WebP → PNG via sharp, and pass
// base64 data URIs to the renderer.

async function prefetchImageAsDataUri(
  url: string,
  timeoutMs = 15000,
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!response.ok) {
      console.warn(`[PDF] Image fetch failed (${response.status}): ${url}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const rawBuffer = Buffer.from(await response.arrayBuffer());

    // @react-pdf only supports PNG and JPEG — convert anything else
    const needsConversion = contentType.includes("webp") ||
      contentType.includes("avif") ||
      contentType.includes("svg") ||
      (!contentType.includes("png") && !contentType.includes("jpeg") && !contentType.includes("jpg"));

    let finalBuffer: Buffer;
    let finalType: string;

    if (needsConversion) {
      console.log(`[PDF] Converting ${contentType} → image/png`);
      finalBuffer = await sharp(rawBuffer).png().toBuffer();
      finalType = "image/png";
    } else {
      finalBuffer = rawBuffer;
      finalType = contentType;
    }

    const base64 = finalBuffer.toString("base64");
    return `data:${finalType};base64,${base64}`;
  } catch (error) {
    console.warn(`[PDF] Image fetch error for ${url}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

async function prefetchAllIllustrations(
  illustrations: { sceneNumber: number; imageUrl: string | null }[],
): Promise<{ sceneNumber: number; imageUrl: string | null }[]> {
  const results = await Promise.allSettled(
    illustrations.map(async (ill) => {
      if (!ill.imageUrl) return ill;

      const dataUri = await prefetchImageAsDataUri(ill.imageUrl);
      if (dataUri) {
        console.log(`[PDF] Scene ${ill.sceneNumber}: image pre-fetched (${(dataUri.length / 1024).toFixed(0)} KB)`);
      } else {
        console.warn(`[PDF] Scene ${ill.sceneNumber}: image NOT available, will render placeholder`);
      }

      return { sceneNumber: ill.sceneNumber, imageUrl: dataUri };
    }),
  );

  return results.map((r, i) =>
    r.status === "fulfilled" ? r.value : illustrations[i],
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  const { storyId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: story, error } = await supabase
    .from("stories")
    .select("*, characters(*), story_illustrations(*)")
    .eq("id", storyId)
    .eq("user_id", user.id)
    .single();

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

  // Check for ?force=true to regenerate the PDF
  const url = new URL(request.url);
  const forceRegenerate = url.searchParams.get("force") === "true";

  // If we have a cached PDF and aren't forcing regeneration, serve it
  if (story.pdf_url && !forceRegenerate) {
    try {
      const signedUrl = await getSignedPdfUrl(supabase, story.pdf_url);
      return NextResponse.redirect(signedUrl);
    } catch {
      console.warn("[PDF] Cached PDF not found in storage, regenerating...");
    }
  }

  // Build PDF input
  const character = story.characters as unknown as {
    name: string;
    age: number;
  };

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
    story: generatedText,
    templateId: story.template_id,
    characterName: character.name,
    characterAge: character.age,
    dedicationText: story.dedication_text,
    senderName: story.sender_name,
    illustrations: prefetchedIllustrations,
  };

  try {
    const buffer = await renderBookPdf(pdfInput);

    // Upload to Supabase Storage for persistence
    let storagePath: string | null = null;
    try {
      storagePath = await uploadBookPdf(supabase, user.id, storyId, buffer);

      await supabase
        .from("stories")
        .update({ pdf_url: storagePath })
        .eq("id", storyId);
    } catch (uploadError) {
      console.warn("[PDF] Failed to persist PDF to storage:", uploadError);
    }

    // Return the PDF directly
    const safeTitle = generatedText.bookTitle
      .replace(/[^a-zA-Z0-9áéíóúñüÁÉÍÓÚÑÜ\s-]/g, "")
      .replace(/\s+/g, "-")
      .toLowerCase()
      .slice(0, 60);

    const filename = `${safeTitle}-meapica.pdf`;
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
