import { NextResponse } from "next/server";
import { renderBookPdf, type BookPdfInput } from "@/lib/pdf/book-template";
import type { GeneratedStory } from "@/lib/ai/story-generator";
import { toShowcaseUrl } from "@/lib/storage/illustration-refs";
import { SHOWCASE_STATUSES, showcaseReadClient } from "@/lib/showcase";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storyId: string }> },
) {
  const { storyId } = await params;
  const supabase = showcaseReadClient();

  // Only serve PDFs for showcase stories
  const { data: story, error } = await supabase
    .from("stories")
    // Explicit whitelist: this runs with the service role.
    .select(
      "id, template_id, generated_text, dedication_text, sender_name, status, cover_image_url, character_portrait_url, locale, characters (name, age, gender, city, favorite_color, favorite_companion, future_dream), story_illustrations (scene_number, image_url)",
    )
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
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const illustrations = (
    story.story_illustrations as unknown as {
      scene_number: number;
      image_url: string | null;
    }[]
  ).map((ill) => ({
    sceneNumber: ill.scene_number,
    // Public `showcase` bucket mirror — children's originals are private.
    imageUrl: toShowcaseUrl(ill.image_url, supabaseUrl),
  }));

  const pdfInput: BookPdfInput = {
    story: generatedText,
    templateId: story.template_id,
    characterName: character.name,
    characterAge: character.age,
    characterGender: character.gender as "boy" | "girl" | undefined,
    characterCity: character.city ?? undefined,
    favoriteColor: character.favorite_color ?? undefined,
    favoriteCompanion: character.favorite_companion ?? undefined,
    futureDream: character.future_dream ?? undefined,
    dedicationText: story.dedication_text,
    senderName: story.sender_name,
    storyId,
    coverImageUrl: toShowcaseUrl(story.cover_image_url, supabaseUrl),
    portraitUrl: toShowcaseUrl(story.character_portrait_url, supabaseUrl),
    illustrations,
    locale: (story as Record<string, unknown>).locale as string | undefined,
  };

  try {
    const buffer = await renderBookPdf(pdfInput);

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
