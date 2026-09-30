import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { renderBookPdf, type BookPdfInput } from "@/lib/pdf/book-template";
import { prefetchAllIllustrations, prefetchImageAsDataUri } from "@/lib/pdf/prefetch";
import type { Database } from "@/lib/database.types";
import type { GeneratedStory } from "@/lib/ai/story-generator";
import { toShowcaseUrl } from "@/lib/storage/illustration-refs";
import { SHOWCASE_STATUSES } from "@/lib/showcase";
import type { BookImageAssets } from "@/lib/ai/book-images";

type ShowcaseImageAssets = Pick<BookImageAssets, "finalHero" | "finalMap" | "mapGame">;

function createPublicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storyId: string }> },
) {
  const { storyId } = await params;
  const supabase = createPublicClient();

  // Only serve PDFs for showcase stories
  const { data: story, error } = await supabase
    .from("stories")
    .select("*, characters(*), story_illustrations(*)")
    .eq("id", storyId)
    .eq("is_showcase", true)
    .single();

  if (error || !story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  if (!SHOWCASE_STATUSES.includes(story.status)) {
    return NextResponse.json(
      { error: "Story is not ready" },
      { status: 400 },
    );
  }

  const generatedText = story.generated_text as unknown as GeneratedStory;
  if (!generatedText?.bookTitle || !generatedText?.scenes?.length) {
    return NextResponse.json(
      { error: "Story has no generated content" },
      { status: 400 },
    );
  }

  const character = story.characters as unknown as {
    name: string;
    age: number;
    gender?: string;
    city?: string;
    favorite_color?: string;
    favorite_companion?: string;
    future_dream?: string;
    interests?: string[] | null;
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const rows = story.story_illustrations as unknown as { scene_number: number; image_url: string | null; status: string }[];

  // Same pages as the customer's book (src/lib/fulfilment/pipeline.ts buildPdfInput): page 27 is the
  // print-size hero portrait (cover art for books finished before it existed), pages 28–29 the adventure map.
  // Images are pre-fetched as data URIs like the pipeline's: the renderer needs their pixel size to
  // place them (cover-fit) — and the map spread is only printed when its image decodes.
  const assets = (story.generated_text as unknown as { imageAssets?: ShowcaseImageAssets } | null)?.imageAssets;
  const heroUrl = assets?.finalHero?.url ? toShowcaseUrl(assets.finalHero.url, supabaseUrl) : null;
  const mapUrl = assets?.finalMap?.url && assets.mapGame ? toShowcaseUrl(assets.finalMap.url, supabaseUrl) : null;
  const coverUrl = toShowcaseUrl(story.cover_image_url, supabaseUrl);
  const [illustrations, coverImageUrl, heroImageUrl, mapImageUrl] = await Promise.all([
    // Public `showcase` bucket mirror — children's originals are private. Only ready images (as the viewer).
    prefetchAllIllustrations(
      rows.filter((r) => r.status === "ready" && r.image_url).map((r) => ({ sceneNumber: r.scene_number, imageUrl: toShowcaseUrl(r.image_url, supabaseUrl) })),
    ),
    coverUrl ? prefetchImageAsDataUri(coverUrl) : Promise.resolve(null),
    heroUrl ? prefetchImageAsDataUri(heroUrl) : Promise.resolve(null),
    mapUrl ? prefetchImageAsDataUri(mapUrl) : Promise.resolve(null),
  ]);

  const pdfInput: BookPdfInput = {
    // An edited title replaces the generated one, as in the customer's book
    story: story.title ? { ...generatedText, bookTitle: story.title } : generatedText,
    templateId: story.template_id,
    characterName: character.name,
    characterAge: character.age,
    characterGender: character.gender as "boy" | "girl" | undefined,
    characterCity: character.city ?? undefined,
    characterInterests: character.interests ?? [],
    favoriteColor: character.favorite_color ?? undefined,
    favoriteCompanion: character.favorite_companion ?? undefined,
    futureDream: character.future_dream ?? undefined,
    dedicationText: story.dedication_text,
    senderName: story.sender_name,
    storyId,
    coverImageUrl,
    portraitUrl: heroImageUrl ?? coverImageUrl,
    mapImageUrl,
    mapGame: mapImageUrl ? (assets?.mapGame ?? null) : null,
    illustrations,
    locale: (story as Record<string, unknown>).locale as string | undefined,
  };

  try {
    // Digital (trim-size) edition — the same file a customer downloads, never the bleed print file
    const buffer = await renderBookPdf(pdfInput, undefined, { edition: "digital" });

    const safeTitle = generatedText.bookTitle
      .replace(/[^a-zA-Z0-9áéíóúñüÁÉÍÓÚÑÜ\s-]/g, "")
      .replace(/\s+/g, "-")
      .toLowerCase()
      .slice(0, 60);

    const filename = `${safeTitle}-meapica-sample.pdf`;
    const bytes = new Uint8Array(buffer);

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": bytes.byteLength.toString(),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (renderError) {
    console.error("[Showcase PDF] Render error:", renderError);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 },
    );
  }
}
