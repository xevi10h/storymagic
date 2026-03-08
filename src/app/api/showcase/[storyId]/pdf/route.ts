import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { renderBookPdf, type BookPdfInput } from "@/lib/pdf/book-template";
import type { Database } from "@/lib/database.types";
import type { GeneratedStory } from "@/lib/ai/story-generator";

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

  if (story.status !== "ready") {
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

  const pdfInput: BookPdfInput = {
    story: generatedText,
    templateId: story.template_id,
    characterName: character.name,
    characterAge: character.age,
    dedicationText: story.dedication_text,
    senderName: story.sender_name,
    storyId,
    coverImageUrl: story.cover_image_url ?? null,
    illustrations,
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
