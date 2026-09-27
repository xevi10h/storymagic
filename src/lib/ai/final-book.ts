// Final book images (post-purchase), resumable.
//
//   final character sheet(s) → 12 scenes + print-size cover (parallel, sheet-only refs)
//   → QA judge (sheet + scene text) → repair failing scenes by EDITING them → done
//
// Every finished unit is handed to the caller's store immediately (the
// fulfilment pipeline turns each call into a DB checkpoint), and nothing is
// started without enough time left, so a run can stop at any point and the next
// run continues from the saved state. The preview's sheet and images are never
// reused: the final run renders its own sheet with the final model.

import type { GeneratedStory } from "./story-generator";
import {
  finalRenderStage,
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
import { failsQa, judgeScenes, type QAResult, type QAScene } from "./qa-judge";
import { optionalReference } from "./preview-book";
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
/** Judge (~10 s measured) + edit of the failing scenes (~60 s). */
const QA_PASS_MIN_MS = 120_000;
/** Kept between the last awaited call and the caller's hard deadline. */
const SAFETY_MS = 15_000;
const MAX_REPAIR_PASSES = 2;

// ── Contract with the caller ─────────────────────────────────────────────────

export interface FinalBookState {
  storyId: string;
  plan: BookImagePlan;
  assets: BookImageAssets;
  /** Scene text for the QA judge */
  story: GeneratedStory;
  /** Scenes (1–12) that already have a FINAL render → their stored URL */
  finalScenes: Map<number, string>;
  qaPass: number;
  qaDone: boolean;
}

export interface FinalBookStore {
  saveAssets(assets: BookImageAssets): Promise<void>;
  saveScene(sceneNumber: number, url: string, prompt: string, renderStage: string): Promise<void>;
  saveCover(url: string): Promise<void>;
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
}

const remaining = (ctx: Ctx) => ctx.deadline - Date.now();
const callDeadline = (ctx: Ctx) => ctx.deadline - SAFETY_MS;
const folder = (ctx: Ctx) => `${ctx.state.storyId}/final`;
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
  const ctx: Ctx = { ...args, costUsd: 0 };
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

  const avatar = await optionalReference(state.plan.avatarUrl, "avatar");
  const sheets = await renderSheets(state.plan, "final", { avatar }, { label: `story ${state.storyId}`, deadline: callDeadline(ctx) });
  ctx.costUsd += sheets.main.costUsd + (sheets.extra?.costUsd ?? 0);
  const [mainUrl, extraUrl] = await Promise.all([
    uploadGeneratedImage(ctx.storage, folder(ctx), "sheet", sheets.main.image, sheets.main.mime),
    sheets.extra ? uploadGeneratedImage(ctx.storage, folder(ctx), "sheet-extra", sheets.extra.image, sheets.extra.mime) : Promise.resolve(null),
  ]);
  state.assets = { ...state.assets, final: { mainUrl, extraUrl, model: stageConfig("final").model, createdAt: new Date().toISOString() } };
  await ctx.store.saveAssets(state.assets);
  ctx.refs = {
    sheet: { data: sheets.main.image, mime: sheets.main.mime },
    extraSheet: sheets.extra ? { data: sheets.extra.image, mime: sheets.extra.mime } : null,
  };
  return true;
}

// ── Scenes + cover ───────────────────────────────────────────────────────────

async function renderOne(ctx: Ctx, n: number): Promise<void> {
  const { state } = ctx;
  const refs = ctx.refs as SheetRefs;
  const shot = shotFor(state.plan, n);
  const label = `story ${state.storyId} ${n === COVER ? "cover" : `scene ${n}`}`;
  const result = await renderShot(state.plan, shot, "final", refs, { label, deadline: callDeadline(ctx) });
  ctx.costUsd += result.costUsd;
  const url = await uploadGeneratedImage(ctx.storage, folder(ctx), n === COVER ? "cover" : `scene-${n}`, result.image, result.mime);
  if (n === COVER) {
    state.assets = { ...state.assets, finalCover: { url, model: result.model, createdAt: new Date().toISOString() } };
    await ctx.store.saveCover(url);
    await ctx.store.saveAssets(state.assets);
  } else {
    await ctx.store.saveScene(n, url, buildScenePrompt(state.plan, shot, [{ kind: "sheet", names: [] }]), finalRenderStage());
    state.finalScenes.set(n, url);
  }
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
        console.error(`[Final images] story ${ctx.state.storyId} ${n === COVER ? "cover" : `scene ${n}`} failed: ${errorMessage(err)}`);
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
  if (todo.length === 0) return true;

  console.log(`[Final images] story ${state.storyId}: rendering [${todo.map((n) => (n === COVER ? "cover" : n)).join(", ")}] with ${stageConfig("final").model}`);
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

export function qaSceneFor(plan: BookImagePlan, story: GeneratedStory, sceneNumber: number, imageUrl: string): QAScene {
  const shot = shotFor(plan, sceneNumber);
  const scene = story.scenes.find((s) => s.sceneNumber === sceneNumber);
  const presentIds = shot.cast;
  return {
    sceneNumber,
    imageUrl,
    text: scene ? `${scene.title}. ${scene.text}` : "",
    shot: `${shot.camera}. ${shot.action} Setting: ${shot.setting}. Light: ${shot.light}.${shot.frame === "panorama" ? " (Double-page panorama; nothing important on the vertical centre line.)" : ""}`,
    present: presentIds.map((id) => label(plan, id)),
    absent: [CHILD_ID, ...plan.cast.map((c) => c.id)].filter((id) => !presentIds.includes(id)).map((id) => label(plan, id)),
  };
}

export function qaCharacters(plan: BookImagePlan): string {
  return [`THE CHILD: ${plan.bible.description}.`, ...plan.cast.map((c) => `${c.name.toUpperCase()}: ${c.description}`)].join("\n");
}

async function runQa(ctx: Ctx, progress: FinalBookProgress): Promise<boolean> {
  const { state } = ctx;
  if (state.qaDone) return true;
  const refs = ctx.refs as SheetRefs;
  // First judgement covers every scene; after a repair pass only the edited scenes are re-judged.
  let toJudge: Set<number> | null = null;

  for (;;) {
    if (remaining(ctx) < QA_PASS_MIN_MS) return false;
    const scenes = [...state.finalScenes.entries()]
      .filter(([n]) => !toJudge || toJudge.has(n))
      .sort((a, b) => a[0] - b[0])
      .map(([n, url]) => qaSceneFor(state.plan, state.story, n, url));
    const qa = await judgeScenes({ scenes, sheet: refs.sheet.data, characters: qaCharacters(state.plan), iterationNumber: state.qaPass + 1 });
    progress.qa = qa;
    if (qa.skipped) {
      console.error(`[Final images] ⚠️ QA SKIPPED for story ${state.storyId} (${qa.skipReason}) — book ships UNREVIEWED`);
      await ctx.store.onQaSkipped(qa.skipReason ?? "unknown");
      break;
    }
    for (const v of qa.verdicts.filter(failsQa)) console.log(`[QA] scene ${v.sceneNumber}: ${v.score}/${v.consistencyScore}/${v.coherenceScore}${v.hardFail ? " HARD" : ""} — ${v.issues.join("; ")} → ${v.fix}`);
    const failing = qa.verdicts.filter(failsQa);
    if (failing.length === 0) break;
    if (state.qaPass >= MAX_REPAIR_PASSES) {
      console.warn(`[Final images] story ${state.storyId}: scenes [${failing.map((v) => v.sceneNumber).join(", ")}] still below the bar after ${MAX_REPAIR_PASSES} repair passes`);
      break;
    }

    const byScene = new Map(failing.map((v) => [v.sceneNumber, v]));
    const { done, failed, stoppedEarly } = await runTasks(ctx, [...byScene.keys()], async (n) => {
      const v = byScene.get(n);
      const current = state.finalScenes.get(n);
      if (!v || !current) return;
      const fix = v.fix.trim() || v.issues.join("; ") || "Match the character sheet exactly";
      const shot = shotFor(state.plan, n);
      const result = await repairShot(state.plan, shot, "final", refs, await loadReference(current), fix, {
        label: `story ${state.storyId} scene ${n}`,
        deadline: callDeadline(ctx),
      });
      ctx.costUsd += result.costUsd;
      const url = await uploadGeneratedImage(ctx.storage, folder(ctx), `scene-${n}-fix${state.qaPass + 1}`, result.image, result.mime);
      await ctx.store.saveScene(n, url, `${buildScenePrompt(state.plan, shot, [{ kind: "sheet", names: [] }])}\n\nREPAIR: ${fix}`, finalRenderStage());
      state.finalScenes.set(n, url);
    });
    progress.repaired.push(...done);
    const err = firstError(failed);
    // An outage stops the run; ordinary repair failures keep the (final-quality) previous image.
    if (err instanceof ProviderUnavailableError) throw err;
    if (stoppedEarly) return false; // redo this pass next run

    state.qaPass += 1;
    await ctx.store.saveQaPass(state.qaPass);
    toJudge = new Set(done);
    if (toJudge.size === 0) break;
  }

  state.qaDone = true;
  await ctx.store.saveQaDone(progress.qa);
  return true;
}
