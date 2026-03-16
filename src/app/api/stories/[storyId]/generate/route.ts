import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateStory, type StoryInput } from "@/lib/ai/story-generator";
import {
  generateIllustrationsForStory,
  buildCharacterReference,
  buildSecondaryPrompt,
  createStyleFromAvatar,
  generateWithRetry,
  getSecondaryScenes,
  getGenderColorDirective,
} from "@/lib/ai/illustrations";
import { buildColorAnchor, buildRecraftControls } from "@/lib/ai/character-description";
import { uploadIllustrationFromUrl, uploadCoverFromUrl } from "@/lib/supabase/storage";
import { getMockIllustrationUrl, getMockCoverUrl, getMockPortraitUrl, getMockSecondaryIllustrationUrl } from "@/lib/ai/mock-story";
import { STORY_TEMPLATES } from "@/lib/create-store";
import { PREVIEW_ILLUSTRATION_COUNT } from "@/lib/pricing";
import { SCENE_LAYOUT_PAIRS, LAYOUT_IMAGE_SIZE } from "@/components/book-viewer/types";

// Architect (~15s) + expansion+illustrations in parallel (~15s) + uploads (~5s) = ~35s typical
export const maxDuration = 300;

function elapsed(start: number): string {
  return `${((Date.now() - start) / 1000).toFixed(1)}s`;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  const routeStart = Date.now();
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

  // Atomic claim: only transition draft → generating
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
      favoriteFood: character.favorite_food || undefined,
      futureDream: character.future_dream || undefined,
      hairColor: character.hair_color,
      eyeColor: character.eye_color || undefined,
      skinTone: character.skin_tone,
      hairstyle: character.hairstyle || undefined,
      templateId: story.template_id,
      templateTitle: template?.title || story.template_id,
      creationMode: story.creation_mode as "solo" | "juntos",
      decisions: (story.story_decisions as Record<string, unknown>) || {},
      dedication: story.dedication_text || undefined,
      senderName: story.sender_name || undefined,
      endingChoice: story.ending_choice || undefined,
      endingNote: (story.story_decisions as Record<string, unknown>)?.endingNote as string | undefined,
      locale: story.locale || "es",
    };

    const charDescInput = {
      gender: input.gender,
      age: input.age,
      skinTone: input.skinTone,
      hairColor: input.hairColor,
      eyeColor: input.eyeColor,
      hairstyle: input.hairstyle,
      childName: input.childName,
      interests: input.interests,
    };
    const characterRef = buildCharacterReference(charDescInput);

    const mockMode = process.env.MOCK_MODE === "true";
    const recraftApiToken = process.env.RECRAFT_API_TOKEN?.trim();
    const hasRecraft = !mockMode && recraftApiToken && !recraftApiToken.includes("your_");

    // ── Phase 1: Story text + style resolution IN PARALLEL ───────────────────
    // generateStory internally does: architect (GPT-5.4) → parallel expansion (gpt-5-mini × 12)
    // Meanwhile we resolve the Recraft style_id (if needed) — no reason to wait.
    console.log(`[Generate] Starting text generation + style resolution in parallel... [${elapsed(routeStart)}]`);

    const styleIdFromStory: string | null = (story as { recraft_style_id?: string }).recraft_style_id ?? null;

    const [generatedStory, resolvedStyleId] = await Promise.all([
      generateStory(input),
      (async (): Promise<string | null> => {
        if (styleIdFromStory) return styleIdFromStory;
        if (!hasRecraft || !character.avatar_url) return null;
        try {
          return await createStyleFromAvatar(character.avatar_url, recraftApiToken!);
        } catch (err) {
          console.warn("[Generate] Style creation failed (non-fatal):", err);
          return null;
        }
      })(),
    ]);

    const styleId = resolvedStyleId;
    console.log(`[Generate] Text done (${generatedStory.scenes.length} scenes), styleId=${styleId ? styleId.slice(0, 8) + "..." : "null"} [${elapsed(routeStart)}]`);

    // ── Phase 2: Save text immediately (client shows title picker) ───────────
    const { error: textSaveError } = await supabase
      .from("stories")
      .update({
        generated_text: JSON.parse(JSON.stringify(generatedStory)),
        title: generatedStory.titleOptions[0] ?? generatedStory.bookTitle,
        pdf_url: null,
      })
      .eq("id", storyId);

    if (textSaveError) {
      throw new Error(`Failed to save story text: ${textSaveError.message}`);
    }
    console.log(`[Generate] Text saved to DB [${elapsed(routeStart)}]`);

    // ── Phase 3: Portrait (reuse existing) ───────────────────────────────────
    let persistedPortraitUrl: string | null = character.avatar_url || null;
    if (!persistedPortraitUrl && mockMode) {
      persistedPortraitUrl = getMockPortraitUrl();
    }

    // ── Phase 4: Cover + preview illustrations IN PARALLEL ───────────────────
    console.log(`[Generate] Starting cover + ${PREVIEW_ILLUSTRATION_COUNT} previews in parallel... [${elapsed(routeStart)}]`);

    const previewPrompts = generatedStory.scenes
      .slice(0, PREVIEW_ILLUSTRATION_COUNT)
      .map((s) => s.imagePrompt);

    // Compute per-image sizes from layout pairs (each scene's primary illustration
    // needs the correct aspect ratio for its layout — landscape for splits, panoramic for spreads)
    const previewSizes = generatedStory.scenes
      .slice(0, PREVIEW_ILLUSTRATION_COUNT)
      .map((s) => {
        const pair = SCENE_LAYOUT_PAIRS[(s.sceneNumber - 1) % SCENE_LAYOUT_PAIRS.length];
        return LAYOUT_IMAGE_SIZE[pair[0]] || "1024x1024";
      });

    const [coverResult, previewIllustrations] = await Promise.all([
      // Cover
      (async (): Promise<string | null> => {
        if (mockMode || !hasRecraft) return mockMode ? getMockCoverUrl() : null;
        try {
          const genderColor = getGenderColorDirective(input.gender);
          const coverColorAnchor = buildColorAnchor(charDescInput);
          let coverPrompt = `The protagonist: ${characterRef}. ${generatedStory.coverImagePrompt} Children's book illustration, soft warm palette, gentle natural lighting, no text in image.${genderColor ? ` ${genderColor}` : ""}${coverColorAnchor ? ` ${coverColorAnchor}` : ""}`;
          if (coverPrompt.length > 1000) coverPrompt = coverPrompt.slice(0, 999) + "…";
          const coverControls = buildRecraftControls(charDescInput, { isPortrait: false });
          const coverUrl = await generateWithRetry(coverPrompt, recraftApiToken!, {
            ...(styleId ? { styleId } : {}),
            controls: coverControls,
          });
          return await uploadCoverFromUrl(supabase, storyId, coverUrl);
        } catch (coverError) {
          console.error("[Generate] Cover failed (non-fatal):", coverError);
          return null;
        }
      })(),
      // Preview illustrations with correct sizes per layout
      generateIllustrationsForStory(previewPrompts, characterRef, {
        styleId,
        childAge: input.age,
        gender: input.gender,
        imageSizes: previewSizes,
        characterInput: charDescInput,
      }),
    ]);

    const persistedCoverUrl = coverResult;
    console.log(`[Generate] Illustrations done: cover=${!!persistedCoverUrl}, previews=${previewIllustrations.length} [${elapsed(routeStart)}]`);

    // ── Phase 5: Upload illustrations to storage ─────────────────────────────
    const finalPreviewIllustrations = await Promise.all(
      previewIllustrations.map(async (ill, index) => {
        if (ill.provider !== "recraft") return ill;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const permanentUrl = await uploadIllustrationFromUrl(supabase, storyId, index + 1, ill.imageUrl);
            return { ...ill, imageUrl: permanentUrl };
          } catch (uploadError) {
            if (attempt === 0) {
              await new Promise((r) => setTimeout(r, 1000));
            } else {
              console.error(`[Storage] Failed scene ${index + 1}:`, uploadError);
              return ill;
            }
          }
        }
        return ill;
      }),
    );
    console.log(`[Generate] Uploads done [${elapsed(routeStart)}]`);

    // ── Phase 6: Insert illustration rows ────────────────────────────────────
    const { error: deleteError } = await supabase
      .from("story_illustrations")
      .delete()
      .eq("story_id", storyId);
    if (deleteError) throw new Error(`Failed to delete old illustrations: ${deleteError.message}`);

    const illustrationRows = generatedStory.scenes.map((scene, index) => {
      const isPreview = index < PREVIEW_ILLUSTRATION_COUNT;
      if (mockMode) {
        return {
          story_id: storyId,
          scene_number: scene.sceneNumber,
          prompt_used: scene.imagePrompt,
          image_url: getMockIllustrationUrl(index),
          status: "ready" as const,
        };
      }
      return {
        story_id: storyId,
        scene_number: scene.sceneNumber,
        prompt_used: scene.imagePrompt,
        image_url: isPreview ? finalPreviewIllustrations[index].imageUrl : null,
        status: isPreview ? ("ready" as const) : ("pending" as const),
      };
    });

    const secondaryScenes = getSecondaryScenes(input.age);
    const secondaryRows = generatedStory.scenes
      .filter((scene) => secondaryScenes.includes(scene.sceneNumber))
      .map((scene, index) => {
        const secondaryPrompt = buildSecondaryPrompt(scene.imagePrompt, scene.title, characterRef, index);
        if (mockMode) {
          return {
            story_id: storyId,
            scene_number: scene.sceneNumber + 12,
            prompt_used: secondaryPrompt,
            image_url: getMockSecondaryIllustrationUrl(scene.sceneNumber - 1),
            status: "ready" as const,
          };
        }
        return {
          story_id: storyId,
          scene_number: scene.sceneNumber + 12,
          prompt_used: secondaryPrompt,
          image_url: null,
          status: "pending" as const,
        };
      });

    const { error: insertError } = await supabase
      .from("story_illustrations")
      .insert([...illustrationRows, ...secondaryRows]);
    if (insertError) throw new Error(`Failed to insert illustrations: ${insertError.message}`);

    // ── Phase 7: Final status ────────────────────────────────────────────────
    const finalStatus = mockMode ? "ready" : "preview";
    const { error: finalUpdateError } = await supabase
      .from("stories")
      .update({
        cover_image_url: persistedCoverUrl,
        character_portrait_url: persistedPortraitUrl,
        recraft_style_id: styleId,
        status: finalStatus,
      })
      .eq("id", storyId);

    if (finalUpdateError) throw new Error(`Failed to finalize: ${finalUpdateError.message}`);

    const recraftCount = finalPreviewIllustrations.filter((i) => i.provider === "recraft").length;
    const mockCount = finalPreviewIllustrations.filter((i) => i.provider === "mock").length;

    if (mockCount > 0) {
      console.error(`[Generate] WARNING: ${mockCount}/${PREVIEW_ILLUSTRATION_COUNT} illustrations fell back to MOCK — Recraft API calls failed`);
    }
    console.log(`[Generate] DONE — ${finalStatus}, cover=${!!persistedCoverUrl}, recraft=${recraftCount}, mock=${mockCount} [${elapsed(routeStart)}]`);

    return NextResponse.json({
      status: finalStatus,
      bookTitle: generatedStory.titleOptions[0] ?? generatedStory.bookTitle,
      titleOptions: generatedStory.titleOptions,
      scenesCount: generatedStory.scenes.length,
      previewIllustrations: mockMode ? generatedStory.scenes.length : PREVIEW_ILLUSTRATION_COUNT,
      coverGenerated: !!persistedCoverUrl,
      illustrations: { total: finalPreviewIllustrations.length, recraft: recraftCount, mock: mockCount },
    });
  } catch (error) {
    await supabase.from("stories").update({ status: "draft" }).eq("id", storyId);
    console.error(`[Generate] FAILED after ${elapsed(routeStart)}:`, error);
    return NextResponse.json(
      { error: "Generation failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
