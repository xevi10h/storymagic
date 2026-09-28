// Shot specs — the structured description of one illustration (camera, action,
// setting, light, who is in frame). Produced by the Book Plan (book-plan.ts →
// planToShotList). The LLM never writes an image prompt and never describes how
// the child or the recurring cast look: image-prompts.ts assembles every prompt
// deterministically from these fields + the frozen Character Bible.

import { SCENE_LAYOUT_PAIRS } from "@/components/book-viewer/types";

export type ShotScale = "close" | "medium" | "wide";
/** Print frame of an image: square page, landscape band (split layouts), two-page panorama, cover, the hero portrait page, or the adventure map spread (pp. 28–29). */
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

/** Frame of a scene image from the print layout (never from the LLM). */
export function frameForScene(sceneNumber: number): ShotFrame {
  const layout = SCENE_LAYOUT_PAIRS[(sceneNumber - 1) % SCENE_LAYOUT_PAIRS.length][0];
  if (layout === "spread_left") return "panorama";
  if (layout === "split_top" || layout === "split_bottom" || layout === "illustration_text") return "landscape";
  return "square";
}
