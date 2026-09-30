// Shot specs — the structured description of one illustration (camera, action,
// setting, light, who is in frame). Produced by the Book Plan (book-plan.ts →
// planToShotList). The LLM never writes an image prompt and never describes how
// the child or the recurring cast look: image-prompts.ts assembles every prompt
// deterministically from these fields + the frozen Character Bible.

import { sceneLayoutOf } from "@/lib/book/sequence";

export type ShotScale = "close" | "medium" | "wide";
/** Print frame of an image: square page, landscape (text under a secondary illustration), two-page panorama, cover, the hero portrait page, or the adventure map spread (pp. 28–29). */
export type ShotFrame = "square" | "landscape" | "panorama" | "cover" | "hero" | "map";

export interface ShotSpec {
  /** 1–12; 0 = cover; negative = back-matter shots (book-images HERO_SHOT, MAP_SHOT) */
  sceneNumber: number;
  frame: ShotFrame;
  /** Camera angle + framing, e.g. "low-angle medium shot" */
  camera: string;
  shotScale: ShotScale;
  /** The single key moment: what the characters present do */
  action: string;
  /**
   * The Book Plan's illustratedMoment: the instant of the page text the picture
   * shows, incl. states the action may not repeat ("Bruma sleeps"). Absent on
   * plans frozen before 2026-09-30.
   */
  moment?: string;
  /** Full background environment */
  setting: string;
  /** Light, time of day, mood */
  light: string;
  /** Ids of recurring characters in frame: "child" and/or cast ids */
  cast: string[];
  /** Ids of recurring locations/objects in frame */
  world: string[];
}

export interface ShotList {
  shots: ShotSpec[];
  cover: ShotSpec;
}

/**
 * Frame of a scene image from the print layout (never from the LLM). Every non-panorama
 * scene prints full bleed on a square page (src/lib/pdf/layout.ts — split layouts print
 * full page since 2026-09-29), so split scenes render square too (src/lib/book/sequence.ts).
 */
export function frameForScene(sceneNumber: number): ShotFrame {
  return sceneLayoutOf(sceneNumber) === "spread" ? "panorama" : "square";
}
