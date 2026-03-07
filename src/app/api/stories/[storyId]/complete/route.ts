import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateIllustrationsForStory, buildCharacterReference } from "@/lib/ai/illustrations";
import { uploadIllustrationFromUrl } from "@/lib/supabase/storage";
import { getAvatarUrl } from "@/lib/avatar-library";
import type { GeneratedStory } from "@/lib/ai/story-generator";

// Remaining 8 illustrations + uploads
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

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify story belongs to user and is in preview status
  const { data: story, error: storyError } = await supabase
    .from("stories")
    .select("*, characters(*)")
    .eq("id", storyId)
    .eq("user_id", user.id)
    .single();

  if (storyError || !story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  // If already ready or completed, return success (idempotent)
  if (story.status === "ready" || story.status === "ordered") {
    return NextResponse.json({ status: story.status });
  }

  // Only preview or completing stories can be completed
  if (story.status !== "preview" && story.status !== "completing") {
    return NextResponse.json(
      { error: "Story is not in a completable state" },
      { status: 400 }
    );
  }

  // Verify user has a paid order for this story
  const { data: paidOrder } = await supabase
    .from("orders")
    .select("id, status")
    .eq("story_id", storyId)
    .eq("user_id", user.id)
    .eq("status", "paid")
    .limit(1)
    .single();

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
      return NextResponse.json(
        { error: "Failed to start completion" },
        { status: 500 }
      );
    }
  }

  try {
    const character = story.characters;
    const generatedText = story.generated_text as unknown as GeneratedStory;

    if (!generatedText?.scenes?.length) {
      throw new Error("Story has no generated text");
    }

    // Get pending illustrations (scenes without images)
    const { data: pendingIllustrations } = await supabase
      .from("story_illustrations")
      .select("scene_number, prompt_used")
      .eq("story_id", storyId)
      .eq("status", "pending")
      .order("scene_number");

    if (!pendingIllustrations || pendingIllustrations.length === 0) {
      // All illustrations already generated — mark as ready
      await supabase
        .from("stories")
        .update({ status: "ready", pdf_url: null })
        .eq("id", storyId);

      return NextResponse.json({ status: "ready" });
    }

    const characterRef = buildCharacterReference({
      gender: character.gender as "boy" | "girl" | "neutral",
      age: character.age,
      skinTone: character.skin_tone,
      hairColor: character.hair_color,
      hairstyle: character.hairstyle || undefined,
      childName: character.name,
      interests: character.interests || [],
    });

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

    // Generate remaining illustrations
    const remainingPrompts = pendingIllustrations.map((ill) => ill.prompt_used);

    const illustrations = await generateIllustrationsForStory(
      remainingPrompts,
      characterRef,
      avatarUrl,
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
              console.error(`[Storage] Failed to persist scene ${sceneNumber} after 2 attempts:`, uploadError);
              return { ...ill, sceneNumber };
            }
          }
        }
        return { ...ill, sceneNumber };
      }),
    );

    // Update each illustration row
    for (const ill of persistedIllustrations) {
      await supabase
        .from("story_illustrations")
        .update({
          image_url: ill.imageUrl,
          status: "ready",
        })
        .eq("story_id", storyId)
        .eq("scene_number", ill.sceneNumber);
    }

    // Mark story as ready, clear PDF cache
    await supabase
      .from("stories")
      .update({ status: "ready", pdf_url: null })
      .eq("id", storyId);

    // Mark order as completed
    await supabase
      .from("orders")
      .update({ status: "completed" })
      .eq("id", paidOrder.id);

    return NextResponse.json({ status: "ready" });
  } catch (error) {
    // Revert to preview (not draft — text + 4 illustrations are preserved)
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
