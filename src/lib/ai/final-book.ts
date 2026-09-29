// Final book images (post-purchase), resumable.
//
//   final character sheet(s) → 12 scenes + print-size cover + hero portrait + adventure map
//   (parallel, sheet-only refs; the map's game is decided first, adventure-map.ts)
//   → QA judge (sheet + scene text) on scenes, cover, hero and map → repair failing images by EDITING them → done
//
// Every finished unit is handed to the caller's store immediately (the
// fulfilment pipeline turns each call into a DB checkpoint), and nothing is
// started without enough time left, so a run can stop at any point and the next
// run continues from the saved state. The preview's sheet and images are never
// reused: the final run renders its own sheet with the final model.

import type { GeneratedStory } from "./story-generator";
import {
  HERO_SHOT,
  MAP_SHOT,
  finalRenderStage,
  loadAvatarReference,
  loadReference,
  renderSheets,
  renderShot,
  repairShot,
  shotFor,
  stageConfig,
  type BookImageAssets,
  type BookImagePlan,
  type SheetRefs,
} from "./book-images";
import { buildScenePrompt } from "./image-prompts";
import { buildMapGame, mapChecklist, type MapGame } from "./adventure-map";
import { failsQa, judgeScenes, type QAResult, type QAScene, type QAVerdict } from "./qa-judge";
import { CHILD_ID } from "./visual-assets";
import { uploadGeneratedImage } from "@/lib/supabase/storage";
import { classifyProviderError, ProviderUnavailableError } from "@/lib/fulfilment/provider-errors";
import type { SupabaseClient } from "@supabase/supabase-js";

const PROVIDER = "openai";
export const COVER = 0;

// ── Time budget ──────────────────────────────────────────────────────────────

/** 2400×1600 high sheet measured ~60–90 s. */
const SHEET_MIN_MS = 150_000;
/** A final scene takes ~60 s (2432²) to ~120 s (3840×1920); per-call timeout is 240 s. */
const SCENE_START_MIN_MS = 130_000;
/** Judge (~10 s measured, anatomy crops in parallel) + edit of the failing images (~60 s). */
const QA_PASS_MIN_MS = 120_000;
/** Kept between the last awaited call and the caller's hard deadline. */
const SAFETY_MS = 15_000;
const MAX_REPAIR_PASSES = 2;

// ── Contract with the caller ─────────────────────────────────────────────────

export interface FinalBookState {
  storyId: string;
  plan: BookImagePlan;
  assets: BookImageAssets;
  /** Scene text for the QA judge (and the map's game) */
  story: GeneratedStory;
  /** Book language (stories.locale) — the map's game labels; falls back to the Book Plan's */
  locale?: string;
  /** Child's name as printed — the map's game; falls back to the Book Plan's */
  childName?: string;
  /** Scenes (1–12) that already have a FINAL render → their stored URL */
  finalScenes: Map<number, string>;
  qaPass: number;
  qaDone: boolean;
}

export interface FinalBookStore {
  saveAssets(assets: BookImageAssets): Promise<void>;
  saveScene(sceneNumber: number, url: string, prompt: string, renderStage: string): Promise<void>;
  /** The cover URL and the assets that reference it, in ONE write (a crash between two writes re-renders or re-repairs it). */
  saveCover(url: string, assets: BookImageAssets): Promise<void>;
  saveQaPass(pass: number): Promise<void>;
  saveQaDone(result: QAResult | null): Promise<void>;
  /** QA could not run — the book ships unreviewed (operator alert). */
  onQaSkipped(reason: string): Promise<void>;
}

export interface FinalBookProgress {
  /** true = every image is final and QA is done */
  done: boolean;
  costUsd: number;
  rendered: number[];
  repaired: number[];
  qa: QAResult | null;
}

interface Ctx {
  state: FinalBookState;
  store: FinalBookStore;
  storage: SupabaseClient;
  deadline: number;
  costUsd: number;
  refs?: SheetRefs;
  /** Asset checkpoints run one at a time (cover + hero finish concurrently). */
  assetsWrite: Promise<void>;
}

const remaining = (ctx: Ctx) => ctx.deadline - Date.now();
const callDeadline = (ctx: Ctx) => ctx.deadline - SAFETY_MS;
const folder = (ctx: Ctx) => `${ctx.state.storyId}/final`;
export const shotName = (n: number) => (n === COVER ? "cover" : n === HERO_SHOT ? "hero" : n === MAP_SHOT ? "map" : `scene ${n}`);
const fileName = (n: number) => (n >= 1 ? `scene-${n}` : shotName(n));
/** Shot of any final image (the map's shot is built from its stored game). */
const shotOf = (state: FinalBookState, n: number) => shotFor(state.plan, n, state.assets.mapGame);
const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * Advance the final images as far as the deadline allows.
 * Throws ProviderUnavailableError on outages (auth/billing) and the first
 * persistent render error after an in-run retry; returns done=false when it
 * simply ran out of time.
 */
export async function advanceFinalImages(args: {
  state: FinalBookState;
  store: FinalBookStore;
  storage: SupabaseClient;
  deadline: number;
}): Promise<FinalBookProgress> {
  const ctx: Ctx = { ...args, costUsd: 0, assetsWrite: Promise.resolve() };
  const progress: FinalBookProgress = { done: false, costUsd: 0, rendered: [], repaired: [], qa: null };
  try {
    if (!(await ensureSheets(ctx))) return progress;
    if (!(await renderMissing(ctx, progress))) return progress;
    if (!(await runQa(ctx, progress))) return progress;
    progress.done = true;
    return progress;
  } finally {
    progress.costUsd = ctx.costUsd;
  }
}

// ── Sheets ───────────────────────────────────────────────────────────────────

async function ensureSheets(ctx: Ctx): Promise<boolean> {
  const { state } = ctx;
  // Avatar + sheets only — never the child's photo (deleted ≤ 24 h after upload).
  const existing = state.assets.final;
  if (existing) {
    const [sheet, extraSheet] = await Promise.all([loadReference(existing.mainUrl), existing.extraUrl ? loadReference(existing.extraUrl) : Promise.resolve(null)]);
    ctx.refs = { sheet, extraSheet };
    return true;
  }
  if (remaining(ctx) < SHEET_MIN_MS) return false;

  // Throws when the approved avatar exists but cannot be loaded: this run fails and the next one retries.
  const avatar = await loadAvatarReference(state.plan.avatarUrl);
  const sheets = await renderSheets(state.plan, "final", { avatar }, { label: `story ${state.storyId}`, deadline: callDeadline(ctx) });
  ctx.costUsd += sheets.main.costUsd + (sheets.extra?.costUsd ?? 0);
  const [mainUrl, extraUrl] = await Promise.all([
    uploadGeneratedImage(ctx.storage, folder(ctx), "sheet", sheets.main.image, sheets.main.mime),
    sheets.extra ? uploadGeneratedImage(ctx.storage, folder(ctx), "sheet-extra", sheets.extra.image, sheets.extra.mime) : Promise.resolve(null),
  ]);
  state.assets = { ...state.assets, final: { mainUrl, extraUrl, model: stageConfig("final").model, createdAt: new Date().toISOString() } };
  await saveAssets(ctx);
  ctx.refs = {
    sheet: { data: sheets.main.image, mime: sheets.main.mime },
    extraSheet: sheets.extra ? { data: sheets.extra.image, mime: sheets.extra.mime } : null,
  };
  return true;
}

// ── Scenes + cover ───────────────────────────────────────────────────────────

/** Checkpoint `state.assets` (with the cover URL when it changed), serialised so a slower write never lands last with stale assets. */
function saveAssets(ctx: Ctx, coverUrl?: string): Promise<void> {
  const write = ctx.assetsWrite.then(() => (coverUrl ? ctx.store.saveCover(coverUrl, ctx.state.assets) : ctx.store.saveAssets(ctx.state.assets)));
  ctx.assetsWrite = write.catch(() => undefined);
  return write;
}

/** Stored final image of a scene (1–12), the cover or the hero portrait. */
function finalUrl(state: FinalBookState, n: number): string | undefined {
  if (n === COVER) return state.assets.finalCover?.url;
  if (n === HERO_SHOT) return state.assets.finalHero?.url;
  if (n === MAP_SHOT) return state.assets.finalMap?.url;
  return state.finalScenes.get(n);
}

/** Checkpoint a finished final image (first render or repair). */
async function saveFinal(ctx: Ctx, n: number, url: string, model: string, prompt: string): Promise<void> {
  const { state } = ctx;
  const asset = { url, model, createdAt: new Date().toISOString() };
  if (n === HERO_SHOT) {
    state.assets = { ...state.assets, finalHero: asset };
    await saveAssets(ctx);
  } else if (n === MAP_SHOT) {
    state.assets = { ...state.assets, finalMap: asset };
    await saveAssets(ctx);
  } else if (n === COVER) {
    state.assets = { ...state.assets, finalCover: asset };
    await saveAssets(ctx, url);
  } else {
    await ctx.store.saveScene(n, url, prompt, finalRenderStage());
    state.finalScenes.set(n, url);
  }
}

/** The map's game, decided (and checkpointed) once, before the map is painted. */
async function ensureMapGame(ctx: Ctx): Promise<MapGame> {
  const { state } = ctx;
  if (state.assets.mapGame) return state.assets.mapGame;
  const bookPlan = state.story.bookPlan;
  const { game, costUsd } = await buildMapGame({
    plan: state.plan,
    story: state.story,
    locale: state.locale ?? bookPlan?.locale ?? "es",
    age: state.plan.bible.age,
    childName: state.childName ?? bookPlan?.childName ?? "",
    label: `story ${state.storyId}`,
  });
  ctx.costUsd += costUsd;
  state.assets = { ...state.assets, mapGame: game };
  await saveAssets(ctx);
  return game;
}

async function renderOne(ctx: Ctx, n: number): Promise<void> {
  const { state } = ctx;
  const refs = ctx.refs as SheetRefs;
  if (n === MAP_SHOT) await ensureMapGame(ctx);
  const shot = shotOf(state, n);
  const label = `story ${state.storyId} ${shotName(n)}`;
  const result = await renderShot(state.plan, shot, "final", refs, { label, deadline: callDeadline(ctx) });
  ctx.costUsd += result.costUsd;
  const url = await uploadGeneratedImage(ctx.storage, folder(ctx), fileName(n), result.image, result.mime);
  await saveFinal(ctx, n, url, result.model, buildScenePrompt(state.plan, shot, [{ kind: "sheet", names: [] }]));
}

/**
 * Runs `tasks` concurrently (the OpenAI client caps in-flight calls). One
 * failure never stops the others; provider outages stop new starts.
 */
async function runTasks(ctx: Ctx, tasks: number[], work: (n: number) => Promise<void>): Promise<{ done: number[]; failed: Map<number, unknown>; stoppedEarly: boolean }> {
  const done: number[] = [];
  const failed = new Map<number, unknown>();
  let stoppedEarly = false;
  let outage = false;
  await Promise.all(
    tasks.map(async (n) => {
      if (outage) return;
      if (remaining(ctx) < SCENE_START_MIN_MS) {
        stoppedEarly = true;
        return;
      }
      try {
        await work(n);
        done.push(n);
      } catch (err) {
        const typed = classifyProviderError(err, PROVIDER);
        if (typed) outage = true;
        failed.set(n, typed ?? err);
        console.error(`[Final images] story ${ctx.state.storyId} ${shotName(n)} failed: ${errorMessage(err)}`);
      }
    }),
  );
  return { done, failed, stoppedEarly };
}

function firstError(failed: Map<number, unknown>): unknown {
  const all = [...failed.values()];
  return all.find((e) => e instanceof ProviderUnavailableError) ?? all[0];
}

async function renderMissing(ctx: Ctx, progress: FinalBookProgress): Promise<boolean> {
  const { state } = ctx;
  let todo = state.plan.shots.map((s) => s.sceneNumber).filter((n) => !state.finalScenes.has(n));
  if (!state.assets.finalCover) todo.push(COVER);
  if (!state.assets.finalHero) todo.push(HERO_SHOT);
  if (!state.assets.finalMap) todo.push(MAP_SHOT);
  if (todo.length === 0) return true;

  console.log(`[Final images] story ${state.storyId}: rendering [${todo.map(shotName).join(", ")}] with ${stageConfig("final").model}`);
  // One in-run retry for scenes that failed with an ordinary error.
  for (let round = 1; round <= 2; round++) {
    const { done, failed, stoppedEarly } = await runTasks(ctx, todo, (n) => renderOne(ctx, n));
    progress.rendered.push(...done);
    const err = firstError(failed);
    if (err instanceof ProviderUnavailableError) throw err;
    if (stoppedEarly) return false;
    if (failed.size === 0) return true;
    if (round === 2) throw err;
    todo = [...failed.keys()];
  }
  return false;
}

// ── QA + repair ──────────────────────────────────────────────────────────────

function label(plan: BookImagePlan, id: string): string {
  if (id === CHILD_ID) return "THE CHILD";
  return plan.cast.find((c) => c.id === id)?.name.toUpperCase() ?? id;
}

export function qaSceneFor(plan: BookImagePlan, story: GeneratedStory, sceneNumber: number, imageUrl: string, mapGame?: MapGame): QAScene {
  const shot = shotFor(plan, sceneNumber, mapGame);
  // The cover and the hero portrait have no page text: the shot brief (with the page's own rules) is what they must show.
  const scene = sceneNumber >= 1 ? story.scenes.find((s) => s.sceneNumber === sceneNumber) : undefined;
  const page =
    sceneNumber === COVER
      ? "The BOOK COVER (the title is added later in print; the picture itself has no text). "
      : sceneNumber === HERO_SHOT
        ? "The portrait page of the child (the name is added later in print; the picture itself has no text). "
        : sceneNumber === MAP_SHOT
          ? "The ADVENTURE MAP double page at the end of the book (a search-and-find panel is printed later over its right quarter; the picture itself has no text). "
          : "";
  const rule =
    sceneNumber === HERO_SHOT
      ? " THE CHILD is the only figure in the picture: no other people, animals or creatures, not even tiny ones in the background."
      : sceneNumber === MAP_SHOT && mapGame
        ? ` The reader is asked to FIND each of these, so each must be clearly visible and recognisable in the picture: ${mapChecklist(plan, mapGame)}. Any one missing or unrecognisable → coherenceScore at most 5, and the fix must add it on open ground. Double page: nothing important on the vertical centre line (the fold). Place names, labels or letters (even on a compass) → hardFail. Figures are small on a map: judge the child's identity by hair, skin tone and outfit colours, not facial detail.`
        : "";
  const presentIds = shot.cast;
  return {
    sceneNumber,
    imageUrl,
    text: scene ? `${scene.title}. ${scene.text}` : "",
    shot: `${page}${shot.camera}. ${shot.action} Setting: ${shot.setting}. Light: ${shot.light}.${shot.frame === "panorama" ? " (Double-page panorama; nothing important on the vertical centre line.)" : ""}${rule}`,
    present: presentIds.map((id) => label(plan, id)),
    // The cover may show any of the book's characters (a story character on it is never a defect).
    absent:
      sceneNumber === COVER
        ? []
        : [CHILD_ID, ...plan.cast.map((c) => c.id)].filter((id) => !presentIds.includes(id)).map((id) => label(plan, id)),
  };
}

export function qaCharacters(plan: BookImagePlan): string {
  return [`THE CHILD: ${plan.bible.description}.`, ...plan.cast.map((c) => `${c.name.toUpperCase()}: ${c.description}`)].join("\n");
}

/** Stored verdicts that still describe the image on the page (same URL). */
function currentVerdicts(state: FinalBookState, shots: number[]): { judged: QAVerdict[]; unjudged: number[] } {
  const stored = state.assets.qaVerdicts ?? {};
  const judged: QAVerdict[] = [];
  const unjudged: number[] = [];
  for (const n of shots) {
    const url = finalUrl(state, n);
    if (!url) continue;
    const v = stored[String(n)];
    if (v && v.url === url) judged.push(v);
    else unjudged.push(n);
  }
  return { judged, unjudged };
}

function summarise(verdicts: QAVerdict[], iterationNumber: number): QAResult {
  const overallScore = verdicts.length ? Math.round((verdicts.reduce((s, v) => s + v.score, 0) / verdicts.length) * 10) / 10 : 0;
  return { overallScore, verdicts, scenesToRegenerate: verdicts.filter(failsQa).map((v) => v.sceneNumber), iterationNumber };
}

async function runQa(ctx: Ctx, progress: FinalBookProgress): Promise<boolean> {
  const { state } = ctx;
  if (state.qaDone) return true;
  const refs = ctx.refs as SheetRefs;
  const shots = [...state.plan.shots.map((s) => s.sceneNumber), COVER, HERO_SHOT, MAP_SHOT];
  // Every verdict is checkpointed in imageAssets.qaVerdicts together with the URL
  // it judged, so only images WITHOUT a verdict for their current URL are judged:
  // all of them the first time, then the repaired ones. A resumed run (the
  // previous one ran out of time between the judgement and the repair) repairs
  // what was already judged failing instead of re-rolling the judgement.

  for (;;) {
    if (remaining(ctx) < QA_PASS_MIN_MS) return false;
    const { unjudged } = currentVerdicts(state, shots);
    if (unjudged.length > 0) {
      const scenes = unjudged.map((n) => qaSceneFor(state.plan, state.story, n, finalUrl(state, n) as string, state.assets.mapGame));
      const qa = await judgeScenes({ scenes, sheet: refs.sheet.data, characters: qaCharacters(state.plan), iterationNumber: state.qaPass + 1 });
      if (qa.skipped) {
        progress.qa = qa;
        console.error(`[Final images] ⚠️ QA SKIPPED for story ${state.storyId} (${qa.skipReason}) — book ships UNREVIEWED`);
        await ctx.store.onQaSkipped(qa.skipReason ?? "unknown");
        break;
      }
      const judgedAt = new Date().toISOString();
      const stored = { ...(state.assets.qaVerdicts ?? {}) };
      for (const v of qa.verdicts) {
        const url = scenes.find((s) => s.sceneNumber === v.sceneNumber)?.imageUrl;
        if (url) stored[String(v.sceneNumber)] = { ...v, url, judgedAt };
      }
      state.assets = { ...state.assets, qaVerdicts: stored };
      await saveAssets(ctx);
    }

    // Images whose individual review failed have no verdict: they are not repaired (never blocks the book).
    const { judged } = currentVerdicts(state, shots);
    progress.qa = summarise(judged, state.qaPass + 1);
    const failing = judged.filter(failsQa);
    for (const v of failing) console.log(`[QA] ${shotName(v.sceneNumber)}: ${v.score}/${v.consistencyScore}/${v.coherenceScore}${v.hardFail ? " HARD" : ""} — ${v.issues.join("; ")} → ${v.fix}`);
    if (failing.length === 0) break;
    if (state.qaPass >= MAX_REPAIR_PASSES) {
      console.warn(`[Final images] story ${state.storyId}: [${failing.map((v) => shotName(v.sceneNumber)).join(", ")}] still below the bar after ${MAX_REPAIR_PASSES} repair passes`);
      break;
    }

    const byScene = new Map(failing.map((v) => [v.sceneNumber, v]));
    const { done, failed, stoppedEarly } = await runTasks(ctx, [...byScene.keys()], async (n) => {
      const v = byScene.get(n);
      const current = finalUrl(state, n);
      if (!v || !current) return;
      const fix = v.fix.trim() || v.issues.join("; ") || "Match the character sheet exactly";
      const shot = shotOf(state, n);
      const result = await repairShot(state.plan, shot, "final", refs, await loadReference(current), fix, {
        label: `story ${state.storyId} ${shotName(n)}`,
        deadline: callDeadline(ctx),
      });
      ctx.costUsd += result.costUsd;
      const url = await uploadGeneratedImage(ctx.storage, folder(ctx), `${fileName(n)}-fix${state.qaPass + 1}`, result.image, result.mime);
      await saveFinal(ctx, n, url, result.model, `${buildScenePrompt(state.plan, shot, [{ kind: "sheet", names: [] }])}\n\nREPAIR: ${fix}`);
    });
    progress.repaired.push(...done);
    const err = firstError(failed);
    // An outage stops the run; ordinary repair failures keep the (final-quality) previous image.
    if (err instanceof ProviderUnavailableError) throw err;
    if (stoppedEarly) return false; // the stored verdicts make the next run repair exactly these

    state.qaPass += 1;
    await ctx.store.saveQaPass(state.qaPass);
    // Nothing was edited (every repair failed): judging again would only re-read the same verdicts.
    if (done.length === 0) break;
  }

  state.qaDone = true;
  await ctx.store.saveQaDone(progress.qa);
  return true;
}
