// Book image engine (OpenAI gpt-image-2.5) — the only way images are made.
//
// Two stages with opposite incentives (docs/generation-pipeline.md):
//   preview  gpt-image-2.5-flare  · medium · ~1–2 MP   (everyone, pre-purchase)
//   final    gpt-image-2.5-sunburst · high · print size (paid books only)
//
// Consistency recipe (2026-09 bake-off, ported 1:1):
//   1. Immutable Character Bible → one canonical description (character-description.ts)
//   2. One character sheet per stage, the FIRST reference of every scene + cover
//   3. Deterministic prompts from structured shot specs (image-prompts.ts)
//   4. Every scene rendered independently from the sheet (parallel, no chaining)
//
// Pure engine: no database access. Callers store the returned buffers
// (uploadGeneratedImage → object path in the private bucket) — provider URLs are
// never involved. Stored refs are downloaded via signed URLs (loadReference).

import { buildCharacterBible, type CharacterBible, type CharacterDescriptionInput } from "./character-description";
import {
  buildChildSheetPrompt,
  buildCompanionSheetPrompt,
  buildExtraSheetPrompt,
  buildMainSheetPrompt,
  buildPortraitPrompt,
  buildRepairPrompt,
  buildScenePrompt,
  extraSheetCast,
  mainSheetCast,
  type ReferenceRole,
} from "./image-prompts";
import { generateOpenAIImage, type ImageQuality, type ImageReference, type OpenAIImageResult } from "./openai-image";
import type { ShotFrame, ShotSpec } from "./scene-screenplay";
import type { CastMember, WorldAsset } from "./visual-assets";
import { MAP_SHOT, mapShot, type MapGame } from "./adventure-map";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { toServerFetchUrl } from "@/lib/storage/illustration-urls";
import { isIllustrationRef } from "@/lib/storage/illustration-refs";
import { avatarAssetUrl, isAvatarAssetPath } from "@/lib/character-look";
import { describeError, fetchWithRetry } from "./net-retry";
import type { QAVerdict } from "./qa-judge";

export { buildCharacterBible, type CharacterBible, type CharacterDescriptionInput };
export type { ImageReference, OpenAIImageResult };

// ── Persisted plan (stories.generated_text.imagePlan) ────────────────────────

/** Frozen at preview time; the final book renders from exactly this. */
export interface BookImagePlan {
  version: 1;
  engine: "openai";
  bible: CharacterBible;
  cast: CastMember[];
  world: WorldAsset[];
  shots: ShotSpec[];
  cover: ShotSpec;
  /** The avatar portrait the parent approved (reference for the sheets) */
  avatarUrl: string | null;
}

export interface SheetSet {
  /**
   * "combined" (default, final book): mainUrl = child + 2 companions, extraUrl = companions 3–5.
   * "split" (streaming preview): mainUrl = child-only sheet, extraUrl = companion sheet.
   */
  layout?: "combined" | "split";
  mainUrl: string;
  extraUrl: string | null;
  model: string;
  createdAt: string;
}

/** stories.generated_text.imageAssets — stored sheet/cover URLs per stage. */
export interface BookImageAssets {
  preview?: SheetSet;
  final?: SheetSet;
  finalCover?: { url: string; model: string; createdAt: string };
  /** Print-size portrait of the child for the "about the reader" page */
  finalHero?: { url: string; model: string; createdAt: string };
  /** Adventure map spread (pp. 28–29), painted from `mapGame` */
  finalMap?: { url: string; model: string; createdAt: string };
  /** The map's search-and-find game (book language), decided before the map is painted */
  mapGame?: MapGame;
  /**
   * QA judge verdicts of the final images, keyed by shot number ("1"…"12", "0"
   * cover, "-1" hero, "-2" map). Each is valid only for the exact image `url` it
   * judged: a resumed run reuses it instead of re-rolling the judgement of an
   * unchanged image, and a repaired image (new url) is judged afresh.
   */
  qaVerdicts?: Record<string, StoredQaVerdict>;
}

export type StoredQaVerdict = QAVerdict & { url: string; judgedAt: string };

// ── Stage configuration (env) ────────────────────────────────────────────────

export type ImageStage = "preview" | "final" | "portrait";

export interface StageConfig {
  provider: "openai";
  model: string;
  quality: ImageQuality;
}

const QUALITIES: readonly ImageQuality[] = ["low", "medium", "high", "xhigh", "max", "auto"];
const DEFAULTS: Record<ImageStage, { model: string; quality: ImageQuality }> = {
  preview: { model: "gpt-image-2.5-flare", quality: "medium" },
  final: { model: "gpt-image-2.5-sunburst", quality: "high" },
  portrait: { model: "gpt-image-2.5-flare", quality: "medium" },
};
const warned = new Set<string>();

export function stageConfig(stage: ImageStage): StageConfig {
  const prefix = stage.toUpperCase();
  const provider = process.env[`${prefix}_IMAGE_PROVIDER`]?.trim();
  if (provider && provider !== "openai" && !warned.has(prefix)) {
    warned.add(prefix);
    console.warn(`[Image engine] ${prefix}_IMAGE_PROVIDER="${provider}" is not supported any more — using openai. Remove or set it to "openai".`);
  }
  const quality = process.env[`${prefix}_IMAGE_QUALITY`]?.trim() as ImageQuality | undefined;
  return {
    provider: "openai",
    model: process.env[`${prefix}_IMAGE_MODEL`]?.trim() || DEFAULTS[stage].model,
    quality: quality && QUALITIES.includes(quality) ? quality : DEFAULTS[stage].quality,
  };
}

/** story_illustrations.render_stage for final renders, e.g. "final:openai:gpt-image-2.5-sunburst". */
export function finalRenderStage(): string {
  return `final:openai:${stageConfig("final").model}`;
}

// ── Sizes (multiples of 16, ≤ 3840/edge, ≤ 8,294,400 px) ─────────────────────
//
// Final sizes are print sizes (src/lib/pdf: 208 mm bleed page, 408×208 mm panorama):
//   square    2432×2432 → 297 dpi on a full page
//   landscape 2432×1904 → 1.28:1; no current scene frame asks for it (frameForScene: split
//                         scenes print full bleed and render square since 2026-09-29). Kept
//                         for "illustration_text" frames; the print band (42 % height) cover-crops it
//   panorama  3840×1920 → ~235 dpi over both pages (model max width; soft-dpi warning only)
//   hero      2432×2432 → 297 dpi on the full-bleed "about the reader" page (p27)
//   map       3840×1920 → ~235 dpi over the adventure-map spread (pp. 28–29), like a panorama
//   cover     2672×2912 → 300 dpi over the hardcover front art box (226×246 mm incl. wrap),
//                         ~334 dpi on softcover
//   sheet     2400×1600 (3:2, two rows of figures)

type SizeKey = ShotFrame | "sheet" | "portrait";

const SIZES: Record<"preview" | "final", Record<SizeKey, string>> = {
  preview: {
    square: "1024x1024",
    landscape: "1296x1008",
    panorama: "2048x1024",
    cover: "1248x1360",
    hero: "1024x1024",
    map: "2048x1024",
    sheet: "1536x1024",
    portrait: "1024x1024",
  },
  final: {
    square: "2432x2432",
    landscape: "2432x1904",
    panorama: "3840x1920",
    cover: "2672x2912",
    hero: "2432x2432",
    map: "3840x1920",
    sheet: "2400x1600",
    portrait: "1024x1024",
  },
};

export function sizeFor(stage: "preview" | "final", key: SizeKey): string {
  return SIZES[stage][key];
}

// ── References ───────────────────────────────────────────────────────────────

const referenceMime = (mime: string): string => (mime === "image/png" || mime === "image/webp" ? mime : "image/jpeg");

/**
 * Download a stored image as a reference (illustration ref / our own storage URL).
 * Transient failures (connectivity, timeouts, 429/5xx) are retried; anything that
 * still fails throws — callers never get a silently missing reference.
 */
export async function loadReference(url: string): Promise<ImageReference> {
  const res = await fetchWithRetry(await toServerFetchUrl(url), { timeoutMs: 30_000, label: `reference ${url.slice(0, 120)}` });
  if (!res.ok) throw new Error(`Reference download failed (${res.status}): ${url.slice(0, 120)}`);
  const mime = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim();
  return { data: Buffer.from(await res.arrayBuffer()), mime: referenceMime(mime) };
}

/** "/images/avatar/…" of a pre-rendered avatar asset, given its path or its absolute URL on our site. */
function avatarAssetPathOf(ref: string): string | null {
  const m = ref.match(/^(?:https?:\/\/[^/?#]+)?(\/images\/avatar\/[^?#]+)$/);
  return m && isAvatarAssetPath(m[1]) ? m[1] : null;
}

/**
 * The avatar the parent approved — the face anchor of every character sheet.
 *
 *   null   the story has no raster avatar (none chosen, or a legacy DiceBear SVG):
 *          the sheet is drawn from the Character Bible alone, as it always was.
 *   throws the avatar exists but could not be loaded after retries. Never
 *          "continue without it": a sheet without the anchor draws a child that
 *          need not match the one the parent approved. The caller's step fails
 *          and its own retry machinery (preview → draft + retry button, fulfilment
 *          → next run) tries again.
 *
 * Pre-rendered avatar assets (/images/avatar/…, shipped in /public) are read
 * from disk when the files are present (local dev, self-hosted): no dependency on
 * NEXT_PUBLIC_SITE_URL being reachable or already serving the latest assets. On
 * Vercel /public is not in the function bundle, so they are downloaded from the
 * site URL (avatarAssetUrl — never a request-derived host).
 */
export async function loadAvatarReference(ref: string | null | undefined): Promise<ImageReference | null> {
  if (!ref) return null;
  if (/\.svg(\?|$)|\/svg\?/.test(ref)) return null;
  const assetPath = avatarAssetPathOf(ref);
  if (assetPath) {
    const file = path.join(process.cwd(), "public", assetPath);
    try {
      const data = await readFile(file);
      const ext = path.extname(assetPath).slice(1);
      return { data, mime: referenceMime(ext === "jpg" ? "image/jpeg" : `image/${ext}`) };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") console.warn(`[Avatar] ${assetPath}: local read failed (${describeError(err)}) — downloading`);
    }
  } else if (!/^https?:\/\//.test(ref) && !isIllustrationRef(ref)) {
    // Not a URL, not a stored portrait, not an avatar asset: nothing we could ever load.
    console.warn(`[Avatar] unsupported avatar ref "${ref.slice(0, 80)}" — sheet drawn from the Bible only`);
    return null;
  }
  const url = assetPath ? (avatarAssetUrl(assetPath) as string) : ref;
  try {
    return await loadReference(url);
  } catch (err) {
    throw new Error(`Approved avatar unavailable (${url.slice(0, 120)}): ${describeError(err)}`, { cause: err });
  }
}

/** Combined layout (final book): main sheet = child + 2 companions, extra sheet = companions 3–5. */
export interface SheetRefs {
  sheet: ImageReference;
  extraSheet: ImageReference | null;
  // No photo: scenes/cover/repairs are conditioned on the sheet(s) only.
}

/**
 * Split layout (streaming preview): the child sheet is rendered before the Book
 * Plan exists (from the Bible + avatar), the companion sheet as soon as the plan's
 * cast is known. Every shot gets BOTH (child + companions, like the main sheet
 * of the combined layout): no scene is ever drawn without a sheet.
 */
export interface SplitSheetRefs {
  childSheet: ImageReference;
  /** null only when the book has no recurring companion */
  companions: { sheet: ImageReference; members: CastMember[] } | null;
  // No photo (privacy): a child sheet rendered from the photo already carries the likeness.
}

export type ShotRefs = SheetRefs | SplitSheetRefs;

function isSplit(refs: ShotRefs): refs is SplitSheetRefs {
  return "childSheet" in refs;
}

interface CallOptions {
  label: string;
  deadline?: number;
}

/** What the sheets need: who is drawn, not the shots. */
export type SheetPlan = Pick<BookImagePlan, "bible" | "cast" | "world">;

function planCast(plan: SheetPlan) {
  return { bible: plan.bible, cast: plan.cast, world: plan.world };
}

/**
 * Reference list for one shot.
 *   combined: main sheet, extra sheet (only when an extra-sheet member is in frame)
 *   split:    child sheet, companion sheet (always, when the book has companions)
 */
function shotReferences(plan: SheetPlan, shot: ShotSpec, refs: ShotRefs): { images: ImageReference[]; roles: ReferenceRole[] } {
  if (isSplit(refs)) {
    const images: ImageReference[] = [refs.childSheet];
    const roles: ReferenceRole[] = [{ kind: "child-sheet" }];
    if (refs.companions) {
      images.push(refs.companions.sheet);
      roles.push({ kind: "companion-sheet", names: refs.companions.members.map((m) => m.name.toUpperCase()) });
    }
    return { images, roles };
  }
  const images: ImageReference[] = [refs.sheet];
  const roles: ReferenceRole[] = [{ kind: "sheet", names: mainSheetCast(plan).map((m) => m.name.toUpperCase()) }];
  const extras = extraSheetCast(plan).filter((m) => shot.cast.includes(m.id));
  if (refs.extraSheet && extras.length > 0) {
    images.push(refs.extraSheet);
    roles.push({ kind: "extra-sheet", names: extraSheetCast(plan).map((m) => m.name.toUpperCase()) });
  }
  return { images, roles };
}

// ── Renders ──────────────────────────────────────────────────────────────────

export interface RenderedSheets {
  main: OpenAIImageResult;
  extra: OpenAIImageResult | null;
}

/**
 * The character sheet(s) for a stage. The avatar the parent approved anchors the
 * child's face; the Bible text defines everything else. `photo` is only for the
 * early child sheet rendered while the photo still exists (creation flow); the
 * preview/final book pipelines never pass it.
 */
export async function renderSheets(
  plan: SheetPlan,
  stage: "preview" | "final",
  anchors: { avatar: ImageReference | null; photo?: ImageReference | null },
  opts: CallOptions,
): Promise<RenderedSheets> {
  const cfg = stageConfig(stage);
  const images: ImageReference[] = [];
  const roles: ReferenceRole[] = [];
  if (anchors.avatar) {
    images.push(anchors.avatar);
    roles.push({ kind: "portrait" });
  }
  if (anchors.photo) {
    images.push(anchors.photo);
    roles.push({ kind: "photo" });
  }
  const extraNeeded = extraSheetCast(plan).length > 0;
  const [main, extra] = await Promise.all([
    generateOpenAIImage({
      model: cfg.model,
      quality: cfg.quality,
      size: sizeFor(stage, "sheet"),
      prompt: buildMainSheetPrompt(planCast(plan), roles),
      references: images,
      label: `${opts.label} ${stage} sheet`,
      deadline: opts.deadline,
    }),
    extraNeeded
      ? generateOpenAIImage({
          model: cfg.model,
          quality: cfg.quality,
          size: sizeFor(stage, "sheet"),
          prompt: buildExtraSheetPrompt(planCast(plan)),
          label: `${opts.label} ${stage} extra sheet`,
          deadline: opts.deadline,
        })
      : Promise.resolve(null),
  ]);
  return { main, extra };
}

/**
 * Split layout, part 1: the child alone (four views + four expressions). Needs
 * only the Character Bible + face anchors, so it can run before the Book Plan.
 * `photo` only from POST /api/characters/prepare (deleted right after this render).
 */
export async function renderChildSheet(
  bible: CharacterBible,
  stage: "preview" | "final",
  anchors: { avatar: ImageReference | null; photo?: ImageReference | null },
  opts: CallOptions,
): Promise<OpenAIImageResult> {
  const cfg = stageConfig(stage);
  const images: ImageReference[] = [];
  const roles: ReferenceRole[] = [];
  if (anchors.avatar) {
    images.push(anchors.avatar);
    roles.push({ kind: "portrait" });
  }
  if (anchors.photo) {
    images.push(anchors.photo);
    roles.push({ kind: "photo" });
  }
  return generateOpenAIImage({
    model: cfg.model,
    quality: cfg.quality,
    size: sizeFor(stage, "sheet"),
    prompt: buildChildSheetPrompt(bible, roles),
    references: images,
    label: `${opts.label} ${stage} child sheet`,
    deadline: opts.deadline,
  });
}

/** Split layout, part 2: the book's recurring companions (front + side view each). */
export async function renderCompanionSheet(
  members: CastMember[],
  stage: "preview" | "final",
  opts: CallOptions,
): Promise<OpenAIImageResult> {
  if (members.length === 0) throw new Error("renderCompanionSheet needs at least one companion");
  const cfg = stageConfig(stage);
  return generateOpenAIImage({
    model: cfg.model,
    quality: cfg.quality,
    size: sizeFor(stage, "sheet"),
    prompt: buildCompanionSheetPrompt(members),
    label: `${opts.label} ${stage} companion sheet`,
    deadline: opts.deadline,
  });
}

/** The exact scene prompt a render with these refs uses (stored as story_illustrations.prompt_used). */
export function shotPrompt(plan: SheetPlan, shot: ShotSpec, refs: ShotRefs): string {
  return buildScenePrompt(planCast(plan), shot, shotReferences(plan, shot, refs).roles);
}

/** One scene (sceneNumber 1–12) or the cover (plan.cover). */
export async function renderShot(
  plan: SheetPlan,
  shot: ShotSpec,
  stage: "preview" | "final",
  refs: ShotRefs,
  opts: CallOptions,
): Promise<OpenAIImageResult> {
  const cfg = stageConfig(stage);
  const { images, roles } = shotReferences(plan, shot, refs);
  return generateOpenAIImage({
    model: cfg.model,
    quality: cfg.quality,
    size: sizeFor(stage, shot.frame),
    prompt: buildScenePrompt(planCast(plan), shot, roles),
    references: images,
    label: opts.label,
    deadline: opts.deadline,
  });
}

/** Correct a failing render by EDITING it (failing image + sheet as refs), not re-rolling. */
export async function repairShot(
  plan: SheetPlan,
  shot: ShotSpec,
  stage: "preview" | "final",
  refs: ShotRefs,
  failing: ImageReference,
  fix: string,
  opts: CallOptions,
): Promise<OpenAIImageResult> {
  const cfg = stageConfig(stage);
  const base = shotReferences(plan, shot, refs);
  const images = [failing, ...base.images];
  const roles: ReferenceRole[] = [{ kind: "fix" }, ...base.roles];
  return generateOpenAIImage({
    model: cfg.model,
    quality: cfg.quality,
    size: sizeFor(stage, shot.frame),
    prompt: buildRepairPrompt(planCast(plan), shot, roles, fix),
    references: images,
    label: `${opts.label} repair`,
    deadline: opts.deadline,
  });
}

/** Avatar portrait for character creation (same Bible string as the book). */
export async function renderPortrait(bible: CharacterBible, photo: ImageReference | null, opts: CallOptions): Promise<OpenAIImageResult> {
  const cfg = stageConfig("portrait");
  const roles: ReferenceRole[] = photo ? [{ kind: "photo" }] : [];
  return generateOpenAIImage({
    model: cfg.model,
    quality: cfg.quality,
    size: sizeFor("preview", "portrait"),
    prompt: buildPortraitPrompt(bible, roles),
    references: photo ? [photo] : [],
    label: opts.label,
    deadline: opts.deadline,
  });
}

/**
 * The "about the reader" portrait (page 27): the child alone, derived from the
 * frozen cover shot so it needs no LLM call and matches the book's world.
 */
export function heroShot(plan: BookImagePlan): ShotSpec {
  return {
    sceneNumber: HERO_SHOT,
    frame: "hero",
    camera: "Eye-level waist-up portrait, the child in the right half of the frame, facing the viewer",
    shotScale: "medium",
    action: "The child looks straight at the viewer with a warm, proud, happy smile, relaxed and natural, as if posing for a treasured portrait",
    setting: "A soft, simplified, gently out-of-focus background from the book's world (the places listed below), painted lightly so the child stands out",
    light: "Warm, soft, flattering light on the child's face",
    cast: ["child"],
    world: plan.cover.world,
  };
}

/** Shot number of the hero portrait (never a scene: scenes are 1–12, cover 0). */
export const HERO_SHOT = -1;

export { MAP_SHOT };

/** Shot for a scene number (1–12), 0 = cover, HERO_SHOT, or MAP_SHOT (needs the map's game). */
export function shotFor(plan: BookImagePlan, sceneNumber: number, mapGame?: MapGame): ShotSpec {
  if (sceneNumber === HERO_SHOT) return heroShot(plan);
  if (sceneNumber === MAP_SHOT) {
    if (!mapGame) throw new Error("The map shot needs its game (imageAssets.mapGame)");
    return mapShot(plan, mapGame);
  }
  if (sceneNumber === 0) return plan.cover;
  const shot = plan.shots.find((s) => s.sceneNumber === sceneNumber);
  if (!shot) throw new Error(`No shot for scene ${sceneNumber}`);
  return shot;
}
