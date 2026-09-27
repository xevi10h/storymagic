import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { generateArchitect, type StoryInput } from "@/lib/ai/story-generator";
import { generatePreviewBook } from "@/lib/ai/preview-book";
import { getMockIllustrationUrl, getMockCoverUrl, getMockPortraitUrl, getMockSecondaryIllustrationUrl, getSecondaryScenes } from "@/lib/ai/mock-story";
import { isProviderUnavailableError } from "@/lib/fulfilment/provider-errors";
import { STORY_TEMPLATES } from "@/lib/create-store";

// Architect (~25 s) + visual cast (~20 s) + [sheet ∥ shot list ∥ text] (~60 s) + 3 scenes + cover (~20 s)
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

  // Rate limit: max 3 generations per 5 minutes
  const { checkRateLimit } = await import("@/lib/rate-limit");
  const rl = await checkRateLimit(user.id, "generate_story");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a few minutes." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds ?? 300) } },
    );
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
      favoriteColor: character.favorite_color || undefined,
      favoriteCompanion: character.favorite_companion || undefined,
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

    console.log(`[Generate] Architect... [${elapsed(routeStart)}]`);
    const architectResult = await generateArchitect(input);

    // Mock mode shortcut (MOCK_MODE=true, local dev only) — placeholder images, no AI calls.
    if (architectResult.isMock && architectResult.mockStory) {
      const generatedStory = architectResult.mockStory;
      console.log(`[Generate] Mock mode — saving and finishing [${elapsed(routeStart)}]`);
      await supabase.from("stories").update({
        generated_text: JSON.parse(JSON.stringify(generatedStory)),
        title: generatedStory.titleOptions[0] ?? generatedStory.bookTitle,
        pdf_url: null,
      }).eq("id", storyId);

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
        .map((scene) => ({
          story_id: storyId,
          scene_number: scene.sceneNumber + 12,
          prompt_used: "mock",
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
      });
    }

    // Storage uploads use the service role (versioned paths under {storyId}/);
    // ownership was established by the claim above.
    const storage = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const result = await generatePreviewBook({
      db: supabase,
      storage,
      storyId,
      input,
      architect: architectResult,
      avatarUrl: character.avatar_url,
    });
    console.log(`[Generate] DONE — preview in ${elapsed(routeStart)}, images $${result.costUsd.toFixed(3)}`);

    return NextResponse.json({
      status: "preview",
      bookTitle: result.bookTitle,
      titleOptions: result.titleOptions,
      scenesCount: result.scenesCount,
      previewIllustrations: result.previewIllustrations,
      coverGenerated: result.coverGenerated,
    });
  } catch (error) {
    await supabase.from("stories").update({ status: "draft" }).eq("id", storyId);
    console.error(`[Generate] FAILED after ${elapsed(routeStart)}:`, error);
    // Never leak provider/backend error text to the client.
    if (isProviderUnavailableError(error)) {
      return NextResponse.json({ error: "provider_unavailable" }, { status: 503 });
    }
    return NextResponse.json({ error: "generation_failed" }, { status: 500 });
  }
}
