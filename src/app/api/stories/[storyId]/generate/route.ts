import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateStory, type StoryInput } from "@/lib/ai/gemini";
import { getIllustrationsForStory } from "@/lib/ai/illustrations";
import { STORY_TEMPLATES } from "@/lib/create-store";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  const { storyId } = await params;
  const supabase = await createClient();

  // Verify authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch the story with character data
  const { data: story, error: storyError } = await supabase
    .from("stories")
    .select("*, characters(*)")
    .eq("id", storyId)
    .eq("user_id", user.id)
    .single();

  if (storyError || !story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  if (story.status !== "draft") {
    return NextResponse.json(
      { error: "Story already generated or in progress" },
      { status: 400 }
    );
  }

  // Mark story as generating
  await supabase
    .from("stories")
    .update({ status: "generating" })
    .eq("id", storyId);

  try {
    const character = story.characters;
    const template = STORY_TEMPLATES.find((t) => t.id === story.template_id);

    const input: StoryInput = {
      childName: character.name,
      gender: character.gender as "boy" | "girl" | "neutral",
      age: character.age,
      city: character.city || "",
      interests: character.interests || [],
      templateId: story.template_id,
      templateTitle: template?.title || story.template_id,
      creationMode: story.creation_mode as "solo" | "juntos",
      decisions: (story.story_decisions as Record<string, unknown>) || {},
      dedication: story.dedication_text || undefined,
      senderName: story.sender_name || undefined,
      endingChoice: story.ending_choice as "banquet" | "stars" | undefined,
    };

    // Generate story text with Gemini 3 Flash
    const generatedStory = await generateStory(input);

    // Get mock illustrations (will be real AI images later)
    const illustrations = getIllustrationsForStory(
      story.template_id,
      generatedStory.scenes.map((s) => s.imagePrompt)
    );

    // Save generated text to story
    await supabase
      .from("stories")
      .update({
        generated_text: JSON.parse(JSON.stringify(generatedStory)),
        status: "ready",
      })
      .eq("id", storyId);

    // Save illustrations to story_illustrations table
    const illustrationRows = generatedStory.scenes.map((scene, index) => ({
      story_id: storyId,
      scene_number: scene.sceneNumber,
      prompt_used: scene.imagePrompt,
      image_url: illustrations[index].imageUrl,
      status: "ready" as const,
    }));

    await supabase.from("story_illustrations").insert(illustrationRows);

    return NextResponse.json({
      status: "ready",
      bookTitle: generatedStory.bookTitle,
      scenesCount: generatedStory.scenes.length,
    });
  } catch (error) {
    // Mark story as draft again so user can retry
    await supabase
      .from("stories")
      .update({ status: "draft" })
      .eq("id", storyId);

    console.error("Story generation failed:", error);
    return NextResponse.json(
      {
        error: "Generation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
