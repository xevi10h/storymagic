import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateStory, type StoryInput } from "@/lib/ai/story-generator";
import { generateIllustrationsForStory, buildCharacterReference } from "@/lib/ai/illustrations";
import { uploadIllustrationFromUrl } from "@/lib/supabase/storage";
import { getAvatarUrl } from "@/lib/avatar-library";
import { STORY_TEMPLATES } from "@/lib/create-store";
import { PREVIEW_ILLUSTRATION_COUNT } from "@/lib/pricing";

// Preview mode: text (12 scenes) + 4 illustrations — much faster than full generation
export const maxDuration = 120;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  const { storyId } = await params;

  // Validate storyId is a valid UUID to prevent path traversal in Storage
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(storyId)) {
    return NextResponse.json({ error: "Invalid story ID" }, { status: 400 });
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Atomic claim: only transition draft → generating in a single query
  // This prevents race conditions from double-clicks or concurrent requests
  const { data: claimedStories, error: claimError } = await supabase
    .from("stories")
    .update({ status: "generating" })
    .eq("id", storyId)
    .eq("user_id", user.id)
    .eq("status", "draft")
    .select("*, characters(*)");

  if (claimError || !claimedStories || claimedStories.length === 0) {
    return NextResponse.json(
      { error: "Story not found or already generated" },
      { status: 400 }
    );
  }

  const story = claimedStories[0];

  try {
    const character = story.characters;
    const template = STORY_TEMPLATES.find((t) => t.id === story.template_id);

    const input: StoryInput = {
      childName: character.name,
      gender: character.gender as "boy" | "girl" | "neutral",
      age: character.age,
      city: character.city || "",
      interests: character.interests || [],
      specialTrait: character.special_trait || undefined,
      favoriteCompanion: character.favorite_companion || undefined,
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

    // 1. Generate ALL story text (12 scenes) — text is cheap (~$0.05)
    const generatedStory = await generateStory(input);

    // 2. Generate only PREVIEW illustrations (first N scenes)
    // This saves ~60% on illustration costs for non-converting users
    const previewPrompts = generatedStory.scenes
      .slice(0, PREVIEW_ILLUSTRATION_COUNT)
      .map((s) => s.imagePrompt);

    const previewIllustrations = await generateIllustrationsForStory(
      previewPrompts,
      characterRef,
      avatarUrl,
    );

    // 3. Persist preview images to Supabase Storage (retry once before falling back)
    const finalPreviewIllustrations = await Promise.all(
      previewIllustrations.map(async (ill, index) => {
        if (ill.provider !== "recraft") return ill;

        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const permanentUrl = await uploadIllustrationFromUrl(
              supabase,
              storyId,
              index + 1,
              ill.imageUrl,
            );
            return { ...ill, imageUrl: permanentUrl };
          } catch (uploadError) {
            if (attempt === 0) {
              console.warn(`[Storage] Upload attempt 1 failed for scene ${index + 1}, retrying...`);
              await new Promise((r) => setTimeout(r, 1000));
            } else {
              console.error(`[Storage] Failed to persist scene ${index + 1} after 2 attempts:`, uploadError);
              // CDN URLs expire — this is a degraded state but we continue to avoid blocking the user
              return ill;
            }
          }
        }
        return ill;
      }),
    );

    // 4. Save generated text + title, mark as preview (not ready)
    const { error: updateError } = await supabase
      .from("stories")
      .update({
        generated_text: JSON.parse(JSON.stringify(generatedStory)),
        title: generatedStory.bookTitle,
        status: "preview",
        pdf_url: null,
      })
      .eq("id", storyId);

    if (updateError) {
      throw new Error(`Failed to save story: ${updateError.message}`);
    }

    // 5. Insert ALL 12 illustration rows — 4 ready + 8 pending
    const { error: deleteError } = await supabase.from("story_illustrations").delete().eq("story_id", storyId);
    if (deleteError) {
      throw new Error(`Failed to delete old illustrations: ${deleteError.message}`);
    }

    const illustrationRows = generatedStory.scenes.map((scene, index) => {
      const isPreview = index < PREVIEW_ILLUSTRATION_COUNT;
      return {
        story_id: storyId,
        scene_number: scene.sceneNumber,
        prompt_used: scene.imagePrompt,
        image_url: isPreview ? finalPreviewIllustrations[index].imageUrl : null,
        status: isPreview ? ("ready" as const) : ("pending" as const),
      };
    });

    const { error: insertError } = await supabase.from("story_illustrations").insert(illustrationRows);
    if (insertError) {
      throw new Error(`Failed to insert illustrations: ${insertError.message}`);
    }

    const recraftCount = finalPreviewIllustrations.filter((i) => i.provider === "recraft").length;
    const mockCount = finalPreviewIllustrations.filter((i) => i.provider === "mock").length;

    return NextResponse.json({
      status: "preview",
      bookTitle: generatedStory.bookTitle,
      scenesCount: generatedStory.scenes.length,
      previewIllustrations: PREVIEW_ILLUSTRATION_COUNT,
      illustrations: {
        total: finalPreviewIllustrations.length,
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
