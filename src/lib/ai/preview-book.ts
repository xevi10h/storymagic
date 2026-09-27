// Preview generation (pre-purchase): story text + the first scenes + cover with
// the fast preview model, and the frozen image plan the final book is rendered
// from after purchase.
//
//   Book Plan (caller: generateArchitect) → text + cast + shots (no LLM here)
//   → preview character sheet(s) → first N scenes + cover (parallel) → save
//
// Used by POST /api/stories/[id]/generate and scripts/generate-test-book.mts.

import type { SupabaseClient } from "@supabase/supabase-js";
import { expandScenes, type ArchitectResult, type StoryInput } from "./story-generator";
import { planToShotList, planToVisualCast } from "./book-plan";
import { buildCharacterBible, type CharacterDescriptionInput } from "./character-description";
import { frameForScene } from "./scene-screenplay";
import {
  loadReference,
  renderSheets,
  renderShot,
  shotFor,
  stageConfig,
  type BookImageAssets,
  type BookImagePlan,
  type ImageReference,
  type SheetRefs,
} from "./book-images";
import { buildScenePrompt } from "./image-prompts";
import { uploadGeneratedImage } from "@/lib/supabase/storage";
import { PREVIEW_ILLUSTRATION_COUNT } from "@/lib/pricing";
import { ProviderUnavailableError } from "@/lib/fulfilment/provider-errors";

export interface PreviewResult {
  bookTitle: string;
  titleOptions: string[];
  scenesCount: number;
  previewIllustrations: number;
  coverGenerated: boolean;
  costUsd: number;
  seconds: number;
}

export interface PreviewArgs {
  /** Client for story rows (the route passes the user's RLS client) */
  db: SupabaseClient;
  /** Service-role client for storage uploads */
  storage: SupabaseClient;
  storyId: string;
  input: StoryInput;
  architect: ArchitectResult;
  /** Approved avatar portrait (characters.avatar_url) */
  avatarUrl: string | null;
  /** Optional real photo of the child (future feature) — facial likeness only */
  photoUrl?: string | null;
  /** Traits the UI does not collect yet (glasses, freckles) */
  extraTraits?: Pick<CharacterDescriptionInput, "glasses" | "freckles">;
}

/** Reference from a stored URL, or null when it is missing / not a raster image (e.g. old DiceBear SVG avatars). */
export async function optionalReference(url: string | null | undefined, what: string): Promise<ImageReference | null> {
  if (!url || !/^https?:\/\//.test(url) || /\.svg(\?|$)|\/svg\?/.test(url)) return null;
  try {
    return await loadReference(url);
  } catch (err) {
    console.warn(`[Preview] ${what} unavailable (${err instanceof Error ? err.message : String(err)}) — continuing without it`);
    return null;
  }
}

export async function generatePreviewBook(args: PreviewArgs): Promise<PreviewResult> {
  const started = Date.now();
  const t = () => `${((Date.now() - started) / 1000).toFixed(1)}s`;
  const { storyId, input } = args;
  const { architect, plan: bookPlan } = args.architect;
  if (!bookPlan) throw new Error("Preview needs the Book Plan (generateArchitect result without `plan`)");
  let costUsd = 0;
  const folder = `${storyId}/preview`;

  // Text, cast and shots all come from the one Book Plan (story-generator / book-plan.ts).
  const story = await expandScenes(architect, input);
  const visual = planToVisualCast(bookPlan);
  const shotList = planToShotList(bookPlan, frameForScene, visual);

  const bible = buildCharacterBible({ ...input, ...args.extraTraits }, args.photoUrl ?? null);
  const [avatar, photo] = await Promise.all([optionalReference(args.avatarUrl, "avatar"), optionalReference(args.photoUrl, "photo")]);
  const plan: BookImagePlan = {
    version: 1,
    engine: "openai",
    bible,
    cast: visual.cast,
    world: visual.world,
    shots: shotList.shots,
    cover: shotList.cover,
    avatarUrl: args.avatarUrl,
  };

  // 1. Character sheet(s) — the first reference of every scene.
  const sheets = await renderSheets(plan, "preview", { avatar, photo }, { label: `story ${storyId}` });
  costUsd += sheets.main.costUsd + (sheets.extra?.costUsd ?? 0);
  console.log(`[Preview] sheet ready (cast [${plan.cast.map((c) => c.id).join(", ")}]) [${t()}]`);

  const [mainUrl, extraUrl] = await Promise.all([
    uploadGeneratedImage(args.storage, folder, "sheet", sheets.main.image, sheets.main.mime),
    sheets.extra ? uploadGeneratedImage(args.storage, folder, "sheet-extra", sheets.extra.image, sheets.extra.mime) : Promise.resolve(null),
  ]);
  const refs: SheetRefs = {
    sheet: { data: sheets.main.image, mime: sheets.main.mime },
    extraSheet: sheets.extra ? { data: sheets.extra.image, mime: sheets.extra.mime } : null,
    photo,
  };

  // 2. First scenes + cover, all in parallel (each only conditioned on the sheet).
  const previewScenes = architect.scenes.slice(0, PREVIEW_ILLUSTRATION_COUNT).map((s) => s.sceneNumber);
  const targets = [...previewScenes, 0];
  const results = await Promise.allSettled(
    targets.map(async (n) => {
      const result = await renderShot(plan, shotFor(plan, n), "preview", refs, { label: `story ${storyId} ${n === 0 ? "cover" : `scene ${n}`}` });
      const url = await uploadGeneratedImage(args.storage, folder, n === 0 ? "cover" : `scene-${n}`, result.image, result.mime);
      return { n, url, cost: result.costUsd };
    }),
  );
  const urls = new Map<number, string>();
  for (const [i, r] of results.entries()) {
    if (r.status === "fulfilled") {
      urls.set(r.value.n, r.value.url);
      costUsd += r.value.cost;
    } else {
      // Outages must surface (the route maps them to 503); single failures degrade.
      if (r.reason instanceof ProviderUnavailableError) throw r.reason;
      console.error(`[Preview] ${targets[i] === 0 ? "cover" : `scene ${targets[i]}`} failed:`, r.reason instanceof Error ? r.reason.message : r.reason);
    }
  }
  const renderedScenes = previewScenes.filter((n) => urls.has(n));
  if (renderedScenes.length === 0) throw new Error("No preview scene could be rendered");
  console.log(`[Preview] ${renderedScenes.length}/${previewScenes.length} scenes + cover=${urls.has(0)} [${t()}]`);

  // 3. Save: text + frozen image plan + preview sheet, then illustration rows.
  const assets: BookImageAssets = { preview: { mainUrl, extraUrl, model: stageConfig("preview").model, createdAt: new Date().toISOString() } };
  const storyToSave = { ...story, imagePlan: plan, imageAssets: assets, illustrationProvider: "openai" as const };
  const { error: textErr } = await args.db
    .from("stories")
    .update({
      generated_text: JSON.parse(JSON.stringify(storyToSave)),
      title: story.titleOptions[0] ?? story.bookTitle,
      pdf_url: null,
    })
    .eq("id", storyId);
  if (textErr) throw new Error(`Failed to save story text: ${textErr.message}`);

  const { error: deleteErr } = await args.db.from("story_illustrations").delete().eq("story_id", storyId);
  if (deleteErr) throw new Error(`Failed to delete old illustrations: ${deleteErr.message}`);
  const rows = story.scenes.map((scene) => {
    const url = urls.get(scene.sceneNumber) ?? null;
    const shot = plan.shots.find((s) => s.sceneNumber === scene.sceneNumber);
    return {
      story_id: storyId,
      scene_number: scene.sceneNumber,
      prompt_used: shot ? buildScenePrompt(plan, shot, [{ kind: "sheet", names: [] }]) : scene.imagePrompt,
      image_url: url,
      status: url ? ("ready" as const) : ("pending" as const),
    };
  });
  const { error: insertErr } = await args.db.from("story_illustrations").insert(rows);
  if (insertErr) throw new Error(`Failed to insert illustrations: ${insertErr.message}`);

  const finalUpdate: Record<string, unknown> = { status: "preview" };
  if (urls.has(0)) finalUpdate.cover_image_url = urls.get(0);
  if (args.avatarUrl) finalUpdate.character_portrait_url = args.avatarUrl;
  const { error: finalErr } = await args.db.from("stories").update(finalUpdate).eq("id", storyId);
  if (finalErr) throw new Error(`Failed to finalize preview: ${finalErr.message}`);

  const seconds = (Date.now() - started) / 1000;
  console.log(`[Preview] story ${storyId} done in ${seconds.toFixed(0)}s — images $${costUsd.toFixed(3)}`);
  return {
    bookTitle: story.titleOptions[0] ?? story.bookTitle,
    titleOptions: story.titleOptions,
    scenesCount: story.scenes.length,
    previewIllustrations: renderedScenes.length,
    coverGenerated: urls.has(0),
    costUsd,
    seconds,
  };
}
