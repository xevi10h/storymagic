// Preview generation (pre-purchase): story text + the first scenes + cover with
// the fast preview model, and the frozen image plan the final book is rendered
// from after purchase.
//
// Streaming layout ("split" sheets, 2026-09-27):
//
//   t=0  child sheet ─────────────┐   (or reused from POST /api/characters/prepare,
//        Book Plan (streaming) ─┐ │    rendered while the parent picked the world)
//          cast complete ───────┼─┼─► companion sheet ─┐
//          cover shot ──────────┼─┴──────────────────── ┴─► cover image  → preview_progress
//          scene 1..3 shots ────┘                        ─► scene images → preview_progress
//        plan done → reconcile (re-render anything the final plan changed) → save
//
// Every shot is conditioned on the child sheet AND the companion sheet (when the
// book has companions): no image is ever drawn without a sheet of everyone in it.
//
// Used by POST /api/stories/[id]/generate (streaming) and, through
// generatePreviewBook (no streaming), by scripts/generate-test-book.mts.

import type { SupabaseClient } from "@supabase/supabase-js";
import { expandScenes, type ArchitectResult, type StoryInput } from "./story-generator";
import {
  castDescription,
  planToShotList,
  planToVisualCast,
  toShotSpec,
  VISUAL_MAX_CAST,
  VISUAL_MAX_WORLD,
  type BookPlanDraft,
  type BookPlanProgress,
  type PlanShot,
} from "./book-plan";
import { buildCharacterBible, type CharacterBible, type CharacterDescriptionInput } from "./character-description";
import { frameForScene } from "./scene-screenplay";
import {
  loadAvatarReference,
  renderChildSheet,
  renderCompanionSheet,
  renderShot,
  shotPrompt,
  stageConfig,
  type BookImageAssets,
  type BookImagePlan,
  type ImageReference,
  type SheetPlan,
  type SplitSheetRefs,
} from "./book-images";
import type { CastMember, VisualCast } from "./visual-assets";
import { uploadGeneratedImage } from "@/lib/supabase/storage";
import { PREVIEW_ILLUSTRATION_COUNT } from "@/lib/pricing";
import { ProviderUnavailableError } from "@/lib/fulfilment/provider-errors";

// ── Public types ─────────────────────────────────────────────────────────────

/**
 * stories.preview_progress — what the generating screen can show while the
 * preview is still being made. Written incrementally; only images that match
 * the Book Plan as currently known are listed (a Book Plan retry can replace
 * an URL). `index` is the scene number (1-based); `total` = preview scenes.
 * "Urls" are illustration refs (object paths in the PRIVATE bucket): the story
 * GET signs them for the owner before they reach the browser.
 */
export interface PreviewProgress {
  coverUrl?: string;
  scenes: { index: number; url: string }[];
  total: number;
}

export interface StoredSheet {
  ref: ImageReference;
  url: string;
}

/** Stores one rendered image and returns its permanent URL. */
export type PreviewUploader = (name: string, image: Buffer, mime: string) => Promise<string>;

/** Timing instrumentation (scripts/bench-preview.mjs, route logs). */
export interface PreviewEvent {
  type: "child-sheet" | "companion-sheet" | "cover" | "scene" | "plan-progress";
  detail: string;
  /** ms since the session started */
  at: number;
  costUsd?: number;
}

export interface PreviewResult {
  bookTitle: string;
  titleOptions: string[];
  scenesCount: number;
  previewIllustrations: number;
  coverGenerated: boolean;
  costUsd: number;
  seconds: number;
  progress: PreviewProgress;
}

export interface PreviewSessionArgs {
  storyId: string;
  input: StoryInput;
  /** Approved avatar: the caller's own portrait path or a pre-rendered avatar asset URL (never user-controlled hosts) */
  avatarUrl: string | null;
  // No photo: the preview is built ONLY from the avatar + generated sheets (the
  // child's photo is deleted right after the avatar / prepared child sheet exist).
  /** Traits outside the core Bible input (glasses, freckles) */
  extraTraits?: Pick<CharacterDescriptionInput, "glasses" | "freckles">;
  /** Already-loaded face anchor (skips downloading avatarUrl) */
  anchors?: { avatar: ImageReference | null };
  /**
   * Child sheet rendered ahead of time (POST /api/characters/prepare). Resolve
   * null when there is none or it does not match this child: the session then
   * renders one itself (still in parallel with the Book Plan).
   */
  preparedChildSheet?: (bible: CharacterBible) => Promise<StoredSheet | null>;
  upload: PreviewUploader;
  /** Incremental preview_progress snapshots (never awaited, must not throw). */
  onProgress?: (progress: PreviewProgress) => void;
  onEvent?: (event: PreviewEvent) => void;
}

// ── Keys (dedup across Book Plan progress reports and retries) ───────────────

type BibleSource = Pick<BookPlanDraft, "cast" | "world">;

interface CompanionEntry {
  key: string;
  members: CastMember[];
  promise: Promise<StoredSheet>;
}

interface RenderEntry {
  key: string;
  /** Companion sheet this render waits for (a failed sheet fails the render) */
  companion: CompanionEntry | null;
  promise: Promise<{ url: string; prompt: string }>;
}

function companionKey(members: CastMember[]): string {
  return JSON.stringify(members.map((m) => [m.id, m.name, m.description]));
}

/**
 * Identity of a render: the normalised plan shot + how everyone in it looks.
 * Same key ⇒ the already-rendered image is valid for the final plan.
 */
function shotKey(n: number, shot: PlanShot, src: BibleSource, moment?: string): string {
  const cast = shot.castIds.map((id) => src.cast.find((c) => c.id === id)).filter(Boolean).map((c) => [c!.id, c!.name, c!.label, c!.gender, c!.visual]);
  const world = shot.worldIds.map((id) => src.world.find((w) => w.id === id)).filter(Boolean).map((w) => [w!.id, w!.name, w!.label, w!.visual]);
  return JSON.stringify({ n, shot, moment: moment ?? null, cast, world });
}

/** Visual cast from a partial plan: recurrence is unknown yet, so keep the plan's cast in order. */
function provisionalVisual(p: BookPlanProgress): VisualCast {
  return {
    cast: p.cast.slice(0, VISUAL_MAX_CAST).map((c) => ({ id: c.id, name: c.name, label: c.label, kind: c.kind, description: castDescription(c), scenes: [] })),
    world: p.world.slice(0, VISUAL_MAX_WORLD).map((w) => ({ id: w.id, name: w.name, label: w.label, kind: w.kind, description: w.visual, scenes: [] })),
  };
}

/** Every final companion was drawn identically on the given sheet. */
function sheetCovers(drawn: CastMember[], needed: CastMember[]): boolean {
  return needed.every((n) => drawn.some((d) => d.id === n.id && d.name === n.name && d.description === n.description));
}

function quiet(p: Promise<unknown>): void {
  p.catch(() => {});
}

function describe(n: number): string {
  return n === 0 ? "cover" : `scene ${n}`;
}

// ── Session ──────────────────────────────────────────────────────────────────

export class PreviewSession {
  readonly bible: CharacterBible;
  readonly previewScenes: number[];
  private readonly args: PreviewSessionArgs;
  private readonly started = Date.now();
  private readonly childSheet: Promise<StoredSheet>;
  private companion: CompanionEntry | null = null;
  private readonly renders = new Map<number, RenderEntry>();
  private progress: PreviewProgress;
  private costUsd = 0;
  private disposed = false;

  constructor(args: PreviewSessionArgs) {
    this.args = args;
    this.bible = buildCharacterBible({ ...args.input, ...args.extraTraits });
    this.previewScenes = Array.from({ length: PREVIEW_ILLUSTRATION_COUNT }, (_, i) => i + 1);
    this.progress = { scenes: [], total: this.previewScenes.length };
    // Starts immediately: the child sheet never depends on the Book Plan.
    this.childSheet = this.resolveChildSheet();
    quiet(this.childSheet);
  }

  private ms(): number {
    return Date.now() - this.started;
  }

  private emit(type: PreviewEvent["type"], detail: string, costUsd?: number): void {
    console.log(`[Preview] ${type}: ${detail} [${(this.ms() / 1000).toFixed(1)}s]`);
    try {
      this.args.onEvent?.({ type, detail, at: this.ms(), costUsd });
    } catch {
      // instrumentation only
    }
  }

  private label(what: string): string {
    return `story ${this.args.storyId} ${what}`;
  }

  private async resolveChildSheet(): Promise<StoredSheet> {
    if (this.args.preparedChildSheet) {
      const prepared = await this.args.preparedChildSheet(this.bible).catch((err) => {
        console.warn(`[Preview] prepared child sheet unavailable (${err instanceof Error ? err.message : err}) — rendering one`);
        return null;
      });
      if (prepared) {
        this.emit("child-sheet", "reused from character prep");
        return prepared;
      }
    }
    // Only now (the prepared sheet already carries it): a missing avatar fails the
    // preview instead of drawing a child the parent never approved.
    const anchors = this.args.anchors ?? { avatar: await loadAvatarReference(this.args.avatarUrl) };
    const r = await renderChildSheet(this.bible, "preview", anchors, { label: this.label("") });
    this.costUsd += r.costUsd;
    const url = await this.args.upload("sheet-child", r.image, r.mime);
    this.emit("child-sheet", "rendered", r.costUsd);
    return { ref: { data: r.image, mime: r.mime }, url };
  }

  private startCompanion(members: CastMember[]): CompanionEntry {
    const entry: CompanionEntry = {
      key: companionKey(members),
      members,
      promise: (async () => {
        const r = await renderCompanionSheet(members, "preview", { label: this.label("") });
        this.costUsd += r.costUsd;
        const url = await this.args.upload("sheet-companions", r.image, r.mime);
        this.emit("companion-sheet", `[${members.map((m) => m.id).join(", ")}]`, r.costUsd);
        return { ref: { data: r.image, mime: r.mime }, url };
      })(),
    };
    quiet(entry.promise);
    this.companion = entry;
    return entry;
  }

  private startRender(n: number, key: string, plan: SheetPlan, shot: ReturnType<typeof toShotSpec>, companion: CompanionEntry | null): RenderEntry {
    // The render publishes only if it is still the current one for this target
    // when it finishes (a newer plan may have superseded it meanwhile).
    const self: { entry?: RenderEntry } = {};
    const entry: RenderEntry = {
      key,
      companion,
      promise: (async () => {
        const [child, comp] = await Promise.all([this.childSheet, companion ? companion.promise : Promise.resolve(null)]);
        // A prepared child sheet already carries the photo likeness; the photo itself is deleted by then.
        const refs: SplitSheetRefs = {
          childSheet: child.ref,
          companions: comp && companion ? { sheet: comp.ref, members: companion.members } : null,
        };
        const r = await renderShot(plan, shot, "preview", refs, { label: this.label(describe(n)) });
        this.costUsd += r.costUsd;
        const url = await this.args.upload(n === 0 ? "cover" : `scene-${n}`, r.image, r.mime);
        const current = this.renders.get(n) === self.entry;
        if (current) this.publish(n, url);
        this.emit(n === 0 ? "cover" : "scene", `${describe(n)}${current ? "" : " (superseded)"}`, r.costUsd);
        return { url, prompt: shotPrompt(plan, shot, refs) };
      })(),
    };
    self.entry = entry;
    quiet(entry.promise);
    this.renders.set(n, entry);
    return entry;
  }

  private publish(n: number, url: string): void {
    if (this.disposed) return;
    if (n === 0) this.progress.coverUrl = url;
    else {
      this.progress.scenes = [...this.progress.scenes.filter((s) => s.index !== n), { index: n, url }].sort((a, b) => a.index - b.index);
    }
    this.notify();
  }

  private notify(): void {
    try {
      this.args.onProgress?.({ ...this.progress, scenes: [...this.progress.scenes] });
    } catch (err) {
      console.warn("[Preview] onProgress threw (ignored):", err instanceof Error ? err.message : err);
    }
  }

  /** Book Plan streaming hook: pass to generateArchitect({ onProgress }). Idempotent. */
  readonly onPlanProgress = (p: BookPlanProgress): void => {
    if (this.disposed) return;
    try {
      this.emit("plan-progress", `cast=${p.cast.length} cover=${!!p.cover} scenes=${p.scenes.length}`);
      const visual = provisionalVisual(p);
      if (visual.cast.length === 0) this.companion = null;
      else if (this.companion?.key !== companionKey(visual.cast)) this.startCompanion(visual.cast);
      const plan: SheetPlan = { bible: this.bible, cast: visual.cast, world: visual.world };
      const targets: [number, PlanShot, string | undefined][] = [];
      if (p.cover) targets.push([0, p.cover, undefined]);
      for (const s of p.scenes) if (this.previewScenes.includes(s.sceneNumber)) targets.push([s.sceneNumber, s.shot, s.illustratedMoment]);
      for (const [n, shot, moment] of targets) {
        const key = shotKey(n, shot, p, moment);
        if (this.renders.get(n)?.key === key) continue;
        this.startRender(n, key, plan, toShotSpec(p, shot, n, n === 0 ? "cover" : frameForScene(n), visual, moment), this.companion);
      }
    } catch (err) {
      console.warn("[Preview] early render scheduling failed (the final pass will render):", err instanceof Error ? err.message : err);
    }
  };

  /** Stop publishing progress (the route failed); in-flight renders finish unobserved. */
  dispose(): void {
    this.disposed = true;
  }

  /**
   * Reconcile with the final Book Plan: reuse every early render whose shot is
   * unchanged, render the rest, then (with `db`) save exactly like before.
   */
  async finish(result: ArchitectResult, save?: { db: SupabaseClient }): Promise<PreviewResult> {
    const { storyId, input } = this.args;
    const { architect, plan: bookPlan } = result;
    if (!bookPlan) throw new Error("Preview needs the Book Plan (generateArchitect result without `plan`)");

    const story = await expandScenes(architect, input);
    const visual = planToVisualCast(bookPlan);
    const shotList = planToShotList(bookPlan, frameForScene, visual);
    const plan: BookImagePlan = {
      version: 1,
      engine: "openai",
      bible: this.bible,
      cast: visual.cast,
      world: visual.world,
      shots: shotList.shots,
      cover: shotList.cover,
      avatarUrl: this.args.avatarUrl,
    };

    // A missing sheet is fatal (no scene may be drawn without one).
    const child = await this.childSheet;

    // Companion sheet for the final cast: reuse the streamed one when it drew
    // every final companion identically and did not fail.
    let companion: CompanionEntry | null = null;
    const early = this.companion;
    const earlyOk = early ? await early.promise.then(() => true, () => false) : false;
    if (early && earlyOk && sheetCovers(early.members, visual.cast)) companion = early;
    else if (visual.cast.length > 0) {
      if (early) console.warn(`[Preview] companion sheet re-rendered for the final cast (${earlyOk ? "cast changed" : "early render failed"})`);
      companion = this.startCompanion(visual.cast);
    }
    const companionSheet = companion ? await companion.promise : null;

    const targets = [...this.previewScenes, 0];
    for (const n of targets) {
      const planScene = n === 0 ? undefined : bookPlan.scenes.find((s) => s.sceneNumber === n);
      const planShot = n === 0 ? bookPlan.cover : planScene?.shot;
      if (!planShot) continue;
      const key = shotKey(n, planShot, bookPlan, planScene?.illustratedMoment);
      const existing = this.renders.get(n);
      // Renders that waited on a failed companion sheet are known-failed: redo them.
      const doomed = !!existing?.companion && existing.companion === early && !earlyOk;
      if (existing?.key === key && !doomed) continue;
      if (existing) console.warn(`[Preview] ${describe(n)} ${doomed ? "lost its companion sheet" : "changed in the final plan"} — re-rendering`);
      const plannedShot = n === 0 ? plan.cover : plan.shots.find((s) => s.sceneNumber === n)!;
      this.startRender(n, key, plan, plannedShot, companion);
    }

    const settled = await Promise.allSettled(targets.map((n) => this.renders.get(n)?.promise ?? Promise.reject(new Error(`no shot for ${describe(n)}`))));
    const urls = new Map<number, string>();
    const prompts = new Map<number, string>();
    for (const [i, r] of settled.entries()) {
      const n = targets[i];
      if (r.status === "fulfilled") {
        urls.set(n, r.value.url);
        prompts.set(n, r.value.prompt);
      } else {
        // Outages must surface (the route maps them to 503); single failures degrade.
        if (r.reason instanceof ProviderUnavailableError) throw r.reason;
        console.error(`[Preview] ${describe(n)} failed:`, r.reason instanceof Error ? r.reason.message : r.reason);
      }
    }
    const renderedScenes = this.previewScenes.filter((n) => urls.has(n));
    if (renderedScenes.length === 0) throw new Error("No preview scene could be rendered");

    // Final snapshot: exactly the images that match the saved plan.
    this.progress = {
      ...(urls.has(0) ? { coverUrl: urls.get(0) } : {}),
      scenes: renderedScenes.map((n) => ({ index: n, url: urls.get(n)! })),
      total: this.previewScenes.length,
    };
    this.notify();

    if (save) {
      const finalRefs: SplitSheetRefs = {
        childSheet: child.ref,
        companions: companionSheet && companion ? { sheet: companionSheet.ref, members: companion.members } : null,
      };
      const assets: BookImageAssets = {
        preview: {
          layout: "split",
          mainUrl: child.url,
          extraUrl: companionSheet?.url ?? null,
          model: stageConfig("preview").model,
          createdAt: new Date().toISOString(),
        },
      };
      await savePreview(save.db, storyId, story, plan, assets, urls, (n) => {
        const shot = plan.shots.find((s) => s.sceneNumber === n);
        return prompts.get(n) ?? (shot ? shotPrompt(plan, shot, finalRefs) : null);
      }, this.args.avatarUrl);
    }

    const seconds = (Date.now() - this.started) / 1000;
    console.log(`[Preview] story ${storyId} done in ${seconds.toFixed(0)}s — images $${this.costUsd.toFixed(3)}`);
    return {
      bookTitle: story.titleOptions[0] ?? story.bookTitle,
      titleOptions: story.titleOptions,
      scenesCount: story.scenes.length,
      previewIllustrations: renderedScenes.length,
      coverGenerated: urls.has(0),
      costUsd: this.costUsd,
      seconds,
      progress: this.progress,
    };
  }
}

export function startPreviewSession(args: PreviewSessionArgs): PreviewSession {
  return new PreviewSession(args);
}

// ── Save (text + frozen image plan + illustration rows) ──────────────────────

async function savePreview(
  db: SupabaseClient,
  storyId: string,
  story: Awaited<ReturnType<typeof expandScenes>>,
  plan: BookImagePlan,
  assets: BookImageAssets,
  urls: Map<number, string>,
  promptFor: (sceneNumber: number) => string | null,
  avatarUrl: string | null,
): Promise<void> {
  const storyToSave = { ...story, imagePlan: plan, imageAssets: assets, illustrationProvider: "openai" as const };
  const { error: textErr } = await db
    .from("stories")
    .update({
      generated_text: JSON.parse(JSON.stringify(storyToSave)),
      title: story.titleOptions[0] ?? story.bookTitle,
      pdf_url: null,
    })
    .eq("id", storyId);
  if (textErr) throw new Error(`Failed to save story text: ${textErr.message}`);

  const { error: deleteErr } = await db.from("story_illustrations").delete().eq("story_id", storyId);
  if (deleteErr) throw new Error(`Failed to delete old illustrations: ${deleteErr.message}`);
  const rows = story.scenes.map((scene) => {
    const url = urls.get(scene.sceneNumber) ?? null;
    return {
      story_id: storyId,
      scene_number: scene.sceneNumber,
      prompt_used: promptFor(scene.sceneNumber) ?? scene.imagePrompt,
      image_url: url,
      status: url ? ("ready" as const) : ("pending" as const),
    };
  });
  const { error: insertErr } = await db.from("story_illustrations").insert(rows);
  if (insertErr) throw new Error(`Failed to insert illustrations: ${insertErr.message}`);

  const finalUpdate: Record<string, unknown> = { status: "preview" };
  if (urls.has(0)) finalUpdate.cover_image_url = urls.get(0);
  if (avatarUrl) finalUpdate.character_portrait_url = avatarUrl;
  const { error: finalErr } = await db.from("stories").update(finalUpdate).eq("id", storyId);
  if (finalErr) throw new Error(`Failed to finalize preview: ${finalErr.message}`);
}

// ── Non-streaming entry (scripts) ────────────────────────────────────────────

export interface PreviewArgs {
  /** Client for story rows (service role: clients have no write grant on stories) */
  db: SupabaseClient;
  /** Service-role client for storage uploads */
  storage: SupabaseClient;
  storyId: string;
  input: StoryInput;
  architect: ArchitectResult;
  /** Approved avatar portrait (characters.avatar_url) */
  avatarUrl: string | null;
  /** Traits outside the core Bible input (glasses, freckles) */
  extraTraits?: Pick<CharacterDescriptionInput, "glasses" | "freckles">;
}

/** Preview after the Book Plan is complete (no streaming): same pipeline, same save. */
export async function generatePreviewBook(args: PreviewArgs): Promise<PreviewResult> {
  const session = startPreviewSession({
    storyId: args.storyId,
    input: args.input,
    avatarUrl: args.avatarUrl,
    extraTraits: args.extraTraits,
    upload: (name, image, mime) => uploadGeneratedImage(args.storage, `${args.storyId}/preview`, name, image, mime),
  });
  return session.finish(args.architect, { db: args.db });
}
