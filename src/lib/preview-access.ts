// Paywall: what a story shows before it is bought. The ONE definition shared by
// the preview UI (book-pages.ts slices the same scenes), the preview generator
// (pricing.ts PREVIEW_ILLUSTRATION_COUNT) and every API that returns book content.
//
// Unpaid story → the free preview only:
//   - cover, title, title options, synopsis (printed back cover in the buy panel),
//     dedication, and every chapter TITLE (the "what's still to come" teaser page);
//   - the first FREE_PREVIEW_SCENES scenes in full (text + their illustrations);
//   - every other scene keeps its slot (same array length and numbering, so the UI
//     renders its locked state unchanged) with empty text, no image, no prompt;
//   - no final message, no image prompts, no Book Plan / image plan internals.
// Purchased (a live paid order) or showcase → the row as stored.
//
// Pure and dependency-free (type-only imports), so it runs in the browser, on the
// server and under `node --experimental-strip-types src/lib/preview-access.check.mjs`.
// The paid-order lookup lives in story-purchase.ts (server-only).

import type { GeneratedScene } from "@/lib/ai/story-generator";

/** Scenes shown in full in the free preview (also the scenes the preview illustrates). */
export const FREE_PREVIEW_SCENES = 3;

/** Secondary illustrations are stored as scene_number + 12 (book-pages.ts, fulfilment). */
export const SECONDARY_ILLUSTRATION_OFFSET = 12;

/** Order statuses that mean "this story was bought" (refunded / cancelled / pending do not). */
export const PAID_ORDER_STATUSES = ["paid", "producing", "shipped", "delivered"] as const;

type SceneLike = Pick<GeneratedScene, "sceneNumber"> & Partial<GeneratedScene>;

/**
 * scene_number values whose content is free: the first FREE_PREVIEW_SCENES scenes in
 * book order (the same slice toPreviewPages shows) and their secondary illustrations.
 */
export function freeSceneNumbers(scenes: readonly SceneLike[] | null | undefined): Set<number> {
  const free = new Set<number>();
  for (const s of (Array.isArray(scenes) ? scenes : []).slice(0, FREE_PREVIEW_SCENES)) {
    if (typeof s?.sceneNumber !== "number") continue;
    free.add(s.sceneNumber);
    free.add(s.sceneNumber + SECONDARY_ILLUSTRATION_OFFSET);
  }
  return free;
}

/**
 * The generated story as an unpaid viewer may see it. Whitelist: anything not
 * listed here (bookPlan, imageAssets, future fields) never leaves the server.
 */
export function redactGeneratedStory(generated: unknown): Record<string, unknown> | null {
  if (!generated || typeof generated !== "object" || Array.isArray(generated)) return null;
  const g = generated as Record<string, unknown>;
  const scenes = (Array.isArray(g.scenes) ? g.scenes : []) as SceneLike[];
  return {
    bookTitle: g.bookTitle ?? "",
    titleOptions: Array.isArray(g.titleOptions) ? g.titleOptions : [],
    synopsis: g.synopsis ?? "",
    dedication: g.dedication ?? "",
    ...(g.dedicationSource !== undefined ? { dedicationSource: g.dedicationSource } : {}),
    coverImagePrompt: "",
    finalMessage: "",
    scenes: scenes.map((s, i) => ({
      sceneNumber: s.sceneNumber,
      type: s.type ?? "scene",
      title: s.title ?? "",
      text: i < FREE_PREVIEW_SCENES ? (s.text ?? "") : "",
      imagePrompt: "",
    })),
    // Presence only: the preview page tells previews of removed engines (no frozen
    // plan, cannot be bought) by this key. The plan itself describes every scene.
    ...(g.imagePlan ? { imagePlan: {} } : {}),
  };
}

export interface RedactableStoryRow {
  generated_text?: unknown;
  story_illustrations?: { scene_number: number; image_url?: string | null; prompt_used?: string | null }[] | null;
  preview_progress?: unknown;
}

/**
 * A story row for its viewer: unchanged when `purchased`, otherwise redacted to the
 * free preview (see header). Returns a new object; never mutates the input.
 * Call BEFORE signing image refs, so locked scenes are never signed.
 */
export function redactStoryForViewer<T extends RedactableStoryRow>(row: T, purchased: boolean): T {
  if (purchased) return row;
  const scenes = (row.generated_text as { scenes?: SceneLike[] } | null | undefined)?.scenes;
  const free = freeSceneNumbers(scenes);
  const out: T = { ...row };
  if ("generated_text" in row) out.generated_text = redactGeneratedStory(row.generated_text);
  if (Array.isArray(row.story_illustrations)) {
    out.story_illustrations = row.story_illustrations.map((ill) => ({
      ...ill,
      ...("prompt_used" in ill ? { prompt_used: null } : {}),
      ...(free.has(ill.scene_number) ? {} : { image_url: null }),
    }));
  }
  if ("preview_progress" in row) out.preview_progress = redactPreviewProgress(row.preview_progress);
  return out;
}

/**
 * stories.preview_progress ({ coverUrl?, scenes: [{ index, url }], total }): keep the
 * cover and the free scenes only (index = scene number, 1-based). The preview only
 * ever paints the free scenes; this is defence in depth.
 */
export function redactPreviewProgress(progress: unknown): unknown {
  if (!progress || typeof progress !== "object" || Array.isArray(progress)) return progress ?? null;
  const p = progress as { scenes?: unknown };
  if (!Array.isArray(p.scenes)) return progress;
  return {
    ...progress,
    scenes: p.scenes.filter(
      (s) => !!s && typeof s === "object" && typeof (s as { index?: unknown }).index === "number" && (s as { index: number }).index >= 1 && (s as { index: number }).index <= FREE_PREVIEW_SCENES,
    ),
  };
}

/**
 * Image refs of a story an unpaid owner may have signed: the cover, the portrait and
 * the free scenes' illustrations (incl. the streaming preview's progress refs).
 * Used by POST /api/illustrations/sign so it cannot sign locked scenes.
 */
export function freeImageRefs(row: {
  cover_image_url?: string | null;
  character_portrait_url?: string | null;
  generated_text?: unknown;
  story_illustrations?: { scene_number: number; image_url?: string | null }[] | null;
  preview_progress?: unknown;
}): Set<string> {
  const refs = new Set<string>();
  const add = (ref: unknown) => {
    if (typeof ref === "string" && ref) refs.add(ref);
  };
  add(row.cover_image_url);
  add(row.character_portrait_url);
  const free = freeSceneNumbers((row.generated_text as { scenes?: SceneLike[] } | null | undefined)?.scenes);
  for (const ill of row.story_illustrations ?? []) if (free.has(ill.scene_number)) add(ill.image_url);
  const progress = redactPreviewProgress(row.preview_progress) as { coverUrl?: unknown; scenes?: { url?: unknown }[] } | null;
  if (progress && typeof progress === "object") {
    add(progress.coverUrl);
    for (const s of progress.scenes ?? []) add(s?.url);
  }
  return refs;
}
