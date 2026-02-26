import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateStory, type StoryInput } from "@/lib/ai/story-generator";
import { generateIllustrationsForStory, buildCharacterReference } from "@/lib/ai/illustrations";
import { uploadIllustrationFromUrl } from "@/lib/supabase/storage";
import { getAvatarUrl } from "@/lib/avatar-library";
import { STORY_TEMPLATES } from "@/lib/create-store";

export async function POST(
  _request: Request,
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
      hairColor: character.hair_color,
      skinTone: character.skin_tone,
      hairstyle: character.hairstyle || undefined,
      templateId: story.template_id,
      templateTitle: template?.title || story.template_id,
      creationMode: story.creation_mode as "solo" | "juntos",
      decisions: (story.story_decisions as Record<string, unknown>) || {},
      dedication: story.dedication_text || undefined,
      senderName: story.sender_name || undefined,
      endingChoice: story.ending_choice || undefined,
    };

    const characterRef = buildCharacterReference({
      gender: input.gender,
      age: input.age,
      skinTone: input.skinTone,
      hairColor: input.hairColor,
      hairstyle: input.hairstyle,
      childName: input.childName,
      interests: input.interests,
    });

    // Get avatar URL for Recraft style reference
    const avatarUrl = character.avatar_url || getAvatarUrl({
      name: character.name,
      gender: character.gender as "boy" | "girl" | "neutral",
      age: character.age,
      hairColor: character.hair_color,
      skinTone: character.skin_tone,
      hairstyle: character.hairstyle || "short",
      city: character.city || "",
      interests: character.interests || [],
      specialTrait: character.special_trait || "",
      favoriteCompanion: character.favorite_companion || "",
    });

    // 1. Generate story text (12 scenes)
    const generatedStory = await generateStory(input);

    // 2. Generate illustrations with avatar style reference
    const illustrations = await generateIllustrationsForStory(
      generatedStory.scenes.map((s) => s.imagePrompt),
      characterRef,
      avatarUrl,
    );

    // 3. Persist Recraft images to Supabase Storage for permanent URLs
    const persistedIllustrations = await Promise.allSettled(
      illustrations.map(async (ill, index) => {
        if (ill.provider === "recraft") {
          try {
            const permanentUrl = await uploadIllustrationFromUrl(
              supabase,
              storyId,
              index + 1,
              ill.imageUrl,
            );
            return { ...ill, imageUrl: permanentUrl };
          } catch (uploadError) {
            console.warn(`[Storage] Failed to persist scene ${index + 1}, using Recraft CDN:`, uploadError);
            return ill;
          }
        }
        return ill;
      }),
    );

    const finalIllustrations = persistedIllustrations.map((result, index) =>
      result.status === "fulfilled" ? result.value : illustrations[index],
    );

    // 4. Save generated text + title + clear any stale PDF cache
    await supabase
      .from("stories")
      .update({
        generated_text: JSON.parse(JSON.stringify(generatedStory)),
        title: generatedStory.bookTitle,
        status: "ready",
        pdf_url: null,
      })
      .eq("id", storyId);

    // 5. Save illustrations to story_illustrations table
    const illustrationRows = generatedStory.scenes.map((scene, index) => ({
      story_id: storyId,
      scene_number: scene.sceneNumber,
      prompt_used: scene.imagePrompt,
      image_url: finalIllustrations[index].imageUrl,
      status: "ready" as const,
    }));

    await supabase.from("story_illustrations").insert(illustrationRows);

    const recraftCount = finalIllustrations.filter((i) => i.provider === "recraft").length;
    const mockCount = finalIllustrations.filter((i) => i.provider === "mock").length;

    return NextResponse.json({
      status: "ready",
      bookTitle: generatedStory.bookTitle,
      scenesCount: generatedStory.scenes.length,
      illustrations: {
        total: finalIllustrations.length,
        recraft: recraftCount,
        mock: mockCount,
      },
    });
  } catch (error) {
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
