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
import { toServerFetchUrl } from "@/lib/storage/illustration-urls";

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
}

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
//   landscape 2432×1904 → 297 dpi on the 78%-height split band (same 1.28:1 ratio, no crop)
//   panorama  3840×1920 → ~235 dpi over both pages (model max width; soft-dpi warning only)
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
    sheet: "1536x1024",
    portrait: "1024x1024",
  },
  final: {
    square: "2432x2432",
    landscape: "2432x1904",
    panorama: "3840x1920",
    cover: "2672x2912",
    sheet: "2400x1600",
    portrait: "1024x1024",
  },
};

export function sizeFor(stage: "preview" | "final", key: SizeKey): string {
  return SIZES[stage][key];
}

// ── References ───────────────────────────────────────────────────────────────

/** Download a stored image as a reference (illustration ref / our own storage URL). */
export async function loadReference(url: string): Promise<ImageReference> {
  const res = await fetch(await toServerFetchUrl(url), { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Reference download failed (${res.status}): ${url.slice(0, 120)}`);
  const mime = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim();
  return { data: Buffer.from(await res.arrayBuffer()), mime: mime === "image/png" || mime === "image/webp" ? mime : "image/jpeg" };
}

export interface SheetRefs {
  sheet: ImageReference;
  extraSheet: ImageReference | null;
  // No photo: scenes/cover/repairs are conditioned on the sheet(s) only.
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

/** Reference list for one shot: sheet first, then the extra sheet if needed. */
function shotReferences(plan: BookImagePlan, shot: ShotSpec, refs: SheetRefs): { images: ImageReference[]; roles: ReferenceRole[] } {
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

/** One scene (sceneNumber 1–12) or the cover (plan.cover). */
export async function renderShot(
  plan: BookImagePlan,
  shot: ShotSpec,
  stage: "preview" | "final",
  refs: SheetRefs,
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
  plan: BookImagePlan,
  shot: ShotSpec,
  stage: "preview" | "final",
  refs: SheetRefs,
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

/** Shot for a scene number (1–12) or 0 = cover. */
export function shotFor(plan: BookImagePlan, sceneNumber: number): ShotSpec {
  if (sceneNumber === 0) return plan.cover;
  const shot = plan.shots.find((s) => s.sceneNumber === sceneNumber);
  if (!shot) throw new Error(`No shot for scene ${sceneNumber}`);
  return shot;
}
