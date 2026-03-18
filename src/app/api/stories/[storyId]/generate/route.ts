import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateArchitect, expandScenes, reviewAndRefineStory, type StoryInput } from "@/lib/ai/story-generator";
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
    .update({ status: "generating", updated_at: new Date().toISOString() })
    .eq("id", storyId)
    .eq("user_id", user.id)
    .eq("status", "draft")
    .select("*, characters(*)");

  if (claimError || !claimedStories || claimedStories.length === 0) {
    // ── Stuck-status recovery ────────────────────────────────────────────────
    // Claim failed — maybe the story is stuck in "generating" from a previous
    // crashed attempt.  Check if it's been stuck for >10 min and auto-recover.
    // This only runs when claim fails (rare), not on every request.
    const STUCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
    const { data: stuckStory } = await supabase
      .from("stories")
      .select("id, updated_at")
      .eq("id", storyId)
      .eq("user_id", user.id)
      .eq("status", "generating")
      .single();

    if (stuckStory) {
      const updatedAt = new Date(stuckStory.updated_at).getTime();
      if (Date.now() - updatedAt > STUCK_TIMEOUT_MS) {
        console.warn(`[Generate] Recovering stuck story ${storyId} — was generating since ${stuckStory.updated_at}`);
        await supabase.from("stories").update({ status: "draft" }).eq("id", storyId);
        return NextResponse.json(
          { error: "Story was stuck — recovered to draft. Please retry." },
          { status: 409 },
        );
      }
    }

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

    // ══════════════════════════════════════════════════════════════════════════
    // OPTIMIZED PIPELINE — overlaps expansion with illustration generation
    //
    //   Phase 1: Architect + Style Creation    (parallel, ~15s)
    //   Phase 2: Expansion + Cover + Previews  (parallel, ~15-20s)
    //   Phase 3: Upload + Save                 (sequential, ~5s)
    //
    // KEY INSIGHT: Illustrations only need the architect's imagePrompt,
    // NOT the expanded scene text.  So we start them immediately after
    // the architect completes, in parallel with expansion.
    // ══════════════════════════════════════════════════════════════════════════

    const styleIdFromStory: string | null = (story as { recraft_style_id?: string }).recraft_style_id ?? null;

    // ── Phase 1: Architect + Style resolution IN PARALLEL ───────────────────
    console.log(`[Generate] Phase 1: Architect + style in parallel... [${elapsed(routeStart)}]`);

    const [architectResult, resolvedStyleId] = await Promise.all([
      generateArchitect(input),
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

    // Mock mode shortcut — return immediately
    if (architectResult.isMock && architectResult.mockStory) {
      const generatedStory = architectResult.mockStory;
      console.log(`[Generate] Mock mode — saving and finishing [${elapsed(routeStart)}]`);
      await supabase.from("stories").update({
        generated_text: JSON.parse(JSON.stringify(generatedStory)),
        title: generatedStory.titleOptions[0] ?? generatedStory.bookTitle,
        pdf_url: null,
      }).eq("id", storyId);

      // Insert mock illustration rows
      const mockIllRows = generatedStory.scenes.map((scene, index) => ({
        story_id: storyId,
        scene_number: scene.sceneNumber,
        prompt_used: scene.imagePrompt,
        image_url: getMockIllustrationUrl(index),
        status: "ready" as const,
      }));
      const secondaryScenes = getSecondaryScenes(input.age);
      const mockSecRows = generatedStory.scenes
        .filter((scene) => secondaryScenes.includes(scene.sceneNumber))
        .map((scene, index) => ({
          story_id: storyId,
          scene_number: scene.sceneNumber + 12,
          prompt_used: buildSecondaryPrompt(scene.imagePrompt, scene.title, characterRef, index),
          image_url: getMockSecondaryIllustrationUrl(scene.sceneNumber - 1),
          status: "ready" as const,
        }));
      await supabase.from("story_illustrations").delete().eq("story_id", storyId);
      await supabase.from("story_illustrations").insert([...mockIllRows, ...mockSecRows]);
      await supabase.from("stories").update({
        cover_image_url: getMockCoverUrl(),
        character_portrait_url: character.avatar_url || getMockPortraitUrl(),
        status: "ready",
      }).eq("id", storyId);

      return NextResponse.json({
        status: "ready",
        bookTitle: generatedStory.titleOptions[0] ?? generatedStory.bookTitle,
        titleOptions: generatedStory.titleOptions,
        scenesCount: generatedStory.scenes.length,
        previewIllustrations: generatedStory.scenes.length,
        coverGenerated: true,
        illustrations: { total: generatedStory.scenes.length, recraft: 0, mock: generatedStory.scenes.length },
      });
    }

    const { architect, ageConfig } = architectResult;
    console.log(`[Generate] Phase 1 done — "${architect.bookTitle}", styleId=${styleId ? styleId.slice(0, 8) + "..." : "null"} [${elapsed(routeStart)}]`);

    // Extract illustration prompts + sizes from the architect (available NOW, before expansion)
    const previewPrompts = architect.scenes
      .slice(0, PREVIEW_ILLUSTRATION_COUNT)
      .map((s) => s.imagePrompt);
    const previewSizes = architect.scenes
      .slice(0, PREVIEW_ILLUSTRATION_COUNT)
      .map((s) => {
        const pair = SCENE_LAYOUT_PAIRS[(s.sceneNumber - 1) % SCENE_LAYOUT_PAIRS.length];
        return LAYOUT_IMAGE_SIZE[pair[0]] || "1024x1024";
      });

    // ── Phase 2: Expansion + Cover + Preview illustrations IN PARALLEL ──────
    // This is the KEY optimization: expansion and illustrations don't depend
    // on each other.  Illustrations need imagePrompt (from architect).
    // Expansion needs scene briefs (from architect).  Both are ready now.
    console.log(`[Generate] Phase 2: Expansion(${architect.scenes.length}) + Cover + ${PREVIEW_ILLUSTRATION_COUNT} previews — ALL IN PARALLEL [${elapsed(routeStart)}]`);

    const [generatedStory, coverResult, previewIllustrations] = await Promise.all([
      // A) Scene expansion (12 parallel LLM calls inside)
      expandScenes(architect, input, ageConfig),

      // B) Cover illustration
      (async (): Promise<string | null> => {
        if (!hasRecraft) return null;
        try {
          const genderColor = getGenderColorDirective(input.gender);
          const coverColorAnchor = buildColorAnchor(charDescInput);
          const coverPromptFromArchitect = architect.coverImagePrompt || `${characterRef} in a triumphant hero pose, cinematic children's book cover`;
          let coverPrompt = `The protagonist: ${characterRef}. ${coverPromptFromArchitect} Children's book illustration, soft warm palette, gentle natural lighting, no text in image.${genderColor ? ` ${genderColor}` : ""}${coverColorAnchor ? ` ${coverColorAnchor}` : ""}`;
          if (coverPrompt.length > 1000) coverPrompt = coverPrompt.slice(0, 999) + "…";
          const coverControls = buildRecraftControls(charDescInput, { isPortrait: false });
          const coverUrl = await generateWithRetry(coverPrompt, recraftApiToken!, {
            ...(styleId ? { styleId } : {}),
            controls: coverControls,
          });
          return await uploadCoverFromUrl(supabase, storyId, coverUrl);
        } catch (coverError) {
          // Billing errors must propagate — don't swallow them silently
          if (coverError instanceof Error && coverError.message.startsWith("RECRAFT_NO_CREDITS")) throw coverError;
          console.error("[Generate] Cover failed (non-fatal):", coverError);
          return null;
        }
      })(),

      // C) Preview illustrations (batched Recraft calls)
      generateIllustrationsForStory(previewPrompts, characterRef, {
        styleId,
        childAge: input.age,
        gender: input.gender,
        imageSizes: previewSizes,
        characterInput: charDescInput,
      }),
    ]);

    const persistedCoverUrl = coverResult;
    console.log(`[Generate] Phase 2 done — cover=${!!persistedCoverUrl}, previews=${previewIllustrations.length} [${elapsed(routeStart)}]`);

    // ── Phase 3: Editorial review + Illustration uploads (IN PARALLEL) ───────
    // The editorial review reads all 12 scene texts in a single LLM call and applies
    // targeted fixes for narrative coherence, illustration-text alignment, and
    // age-appropriateness. Running it in parallel with uploads adds zero latency.
    console.log(`[Generate] Phase 3: Editorial review + uploads in parallel [${elapsed(routeStart)}]`);

    const [refinedStory, finalPreviewIllustrations] = await Promise.all([
      // A) Editorial review — single LLM call over the full manuscript
      reviewAndRefineStory(generatedStory, input, ageConfig),

      // B) Upload illustrations to permanent Supabase Storage.
      // CRITICAL: If upload fails after 2 attempts, throw instead of storing the
      // temporary Recraft URL — those expire after ~24h, breaking the book.
      Promise.all(
        previewIllustrations.map(async (ill, index) => {
          if (ill.provider !== "recraft") return ill;
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              const permanentUrl = await uploadIllustrationFromUrl(supabase, storyId, index + 1, ill.imageUrl);
              return { ...ill, imageUrl: permanentUrl };
            } catch (uploadError) {
              if (attempt === 0) {
                console.warn(`[Storage] Upload attempt 1 failed for scene ${index + 1}, retrying...`);
                await new Promise((r) => setTimeout(r, 1000));
              } else {
                throw new Error(`Failed to persist illustration for scene ${index + 1} after 2 attempts: ${uploadError instanceof Error ? uploadError.message : "Unknown"}`);
              }
            }
          }
          return ill;
        }),
      ),
    ]);
    console.log(`[Generate] Phase 3 done — ${refinedStory.scenes.length} scenes refined, uploads complete [${elapsed(routeStart)}]`);

    // Portrait: reuse existing
    let persistedPortraitUrl: string | null = character.avatar_url || null;

    // ── Phase 4: Save refined text to DB ─────────────────────────────────────
    const { error: textSaveError } = await supabase
      .from("stories")
      .update({
        generated_text: JSON.parse(JSON.stringify(refinedStory)),
        title: refinedStory.titleOptions[0] ?? refinedStory.bookTitle,
        pdf_url: null,
      })
      .eq("id", storyId);

    if (textSaveError) {
      throw new Error(`Failed to save story text: ${textSaveError.message}`);
    }
    console.log(`[Generate] Refined text saved to DB [${elapsed(routeStart)}]`);

    // ── Phase 5: Insert illustration rows ────────────────────────────────────
    const { error: deleteError } = await supabase
      .from("story_illustrations")
      .delete()
      .eq("story_id", storyId);
    if (deleteError) throw new Error(`Failed to delete old illustrations: ${deleteError.message}`);

    // Use refinedStory scenes — imagePrompts may have been updated by editorial review.
    // Updated prompts for pending scenes ensure secondary illustrations align with text.
    const illustrationRows = refinedStory.scenes.map((scene, index) => {
      const isPreview = index < PREVIEW_ILLUSTRATION_COUNT;
      return {
        story_id: storyId,
        scene_number: scene.sceneNumber,
        prompt_used: scene.imagePrompt,
        image_url: isPreview ? finalPreviewIllustrations[index].imageUrl : null,
        status: isPreview ? ("ready" as const) : ("pending" as const),
      };
    });

    const secondaryScenes = getSecondaryScenes(input.age);
    const secondaryRows = refinedStory.scenes
      .filter((scene) => secondaryScenes.includes(scene.sceneNumber))
      .map((scene, index) => {
        // Extract the first sentence of expanded text for better secondary illustration context.
        const firstSentence = scene.text
          ? scene.text.split(/(?<=[.!?])\s+/)[0]?.trim()
          : undefined;
        const secondaryPrompt = buildSecondaryPrompt(scene.imagePrompt, scene.title, characterRef, index, firstSentence);
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
    // Only overwrite cover/portrait/style if we actually have new values —
    // avoid nullifying a previously generated cover when cover generation fails.
    const finalStatus = "preview"; // mock mode is handled early
    const finalUpdate: Record<string, unknown> = { status: finalStatus };
    if (persistedCoverUrl) finalUpdate.cover_image_url = persistedCoverUrl;
    if (persistedPortraitUrl) finalUpdate.character_portrait_url = persistedPortraitUrl;
    if (styleId) finalUpdate.recraft_style_id = styleId;

    const { error: finalUpdateError } = await supabase
      .from("stories")
      .update(finalUpdate)
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
