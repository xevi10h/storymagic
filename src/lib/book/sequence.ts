/**
 * The printed book's page sequence — the ONE place that decides which page comes where.
 * Pure (no fonts), so the PDF planner (src/lib/pdf/layout.ts planInteriorPages, which adds
 * fitted type on top) and the web viewer (src/lib/book-pages.ts) build the same book.
 *
 * Gelato photobook = [cover] [pastedown] [30 inner pages] [pastedown] — Teo's book (order
 * 34d619c2). Inner page 1 is a RIGHT-hand page, spreads are (2,3) … (28,29):
 *
 *   p1        Title + dedication                          (right, alone)
 *   p2–p25    12 scenes: illustration LEFT ↔ text RIGHT    (each scene = one spread)
 *             panoramic scenes: spread_left p(even) + spread_right p(odd)
 *   p26 · p27 Final "The End" ↔ About the reader (hero portrait)
 *   p28 · p29 Adventure map spread + search-and-find panel (books without a map:
 *             patterned endpaper spread)
 *   p30       Colophon                                    (left, alone)
 *
 * Reading order of the whole book (digital PDF and web viewer, 34 pages):
 *   cover · endpaper · p1–p30 · endpaper · back cover
 */

import type { GeneratedScene } from "@/lib/ai/story-generator";

export const INTERIOR_PAGE_COUNT = 30;
/** Pages in the Gelato "inside" file: front pastedown + 30 inner pages + back pastedown. */
export const INSIDE_FILE_PAGE_COUNT = INTERIOR_PAGE_COUNT + 2;
export const SCENE_COUNT = 12;
/** Secondary illustration of scene N is stored as scene N + 12 */
export const SECONDARY_SCENE_OFFSET = 12;
/** Cover + front endpaper precede inner page 1 in the reading order. */
export const PAGES_BEFORE_INTERIOR = 2;

// ── Layout vocabulary (PDF + web) ─────────────────────────────────────────

export type IllustrationLayout = "immersive" | "split_top" | "split_bottom" | "full_illustration";
export type SceneLayout = IllustrationLayout | "spread";

/**
 * Every illustration page prints full bleed (split layouts used to hold a 78 % art band over
 * a cream strip repeating the scene title — retired 2026-09-29). The names are kept because
 * they still decide whether the art may carry the scene title and the image frame of each
 * scene (scene-screenplay frameForScene).
 */
export const SCENE_LAYOUTS: SceneLayout[] = [
  "immersive", // 1 dramatic opening
  "split_top", // 2 world building
  "spread", // 3 first adventure — panorama
  "full_illustration", // 4 new encounter
  "split_bottom", // 5 meeting ally
  "immersive", // 6 exploring wonders
  "split_top", // 7 first test
  "spread", // 8 climactic moment — panorama
  "full_illustration", // 9 big obstacle
  "immersive", // 10 darkest moment
  "split_bottom", // 11 breakthrough
  "immersive", // 12 resolution
];

export function sceneLayoutOf(sceneNumber: number): SceneLayout {
  return SCENE_LAYOUTS[(sceneNumber - 1 + SCENE_LAYOUTS.length) % SCENE_LAYOUTS.length];
}

/** Text pages cycle galeria → pergamino → ventana over the non-bridge scenes; bridges are puente. */
export type TextVariant = "galeria" | "pergamino" | "ventana" | "puente";
export const TEXT_CYCLE: Exclude<TextVariant, "puente">[] = ["galeria", "pergamino", "ventana"];

// ── Sequence ──────────────────────────────────────────────────────────────

interface Slot {
  /** 1-based inner page number */
  pageNumber: number;
  side: "left" | "right";
}

export type SequencedPage = Slot &
  (
    | { kind: "title-dedication" }
    | {
        kind: "illustration";
        scene: GeneratedScene;
        layout: IllustrationLayout;
        /**
         * The scene title may be drawn over the art: only when the facing page has no heading of
         * its own (a bridge, or text under a secondary illustration) and never on full_illustration.
         * A title is printed once per spread, never twice.
         */
        artTitle: boolean;
      }
    | { kind: "spread"; half: "left" | "right"; scene: GeneratedScene }
    | { kind: "text"; scene: GeneratedScene; variant: TextVariant }
    | { kind: "illustration-text"; scene: GeneratedScene; secondarySceneNumber: number }
    | { kind: "final" }
    | { kind: "about-reader" }
    | { kind: "map"; half: "left" | "right" }
    | { kind: "endpaper" }
    | { kind: "colophon" }
  );

export interface SequenceInput {
  scenes: GeneratedScene[];
  /** Scene numbers (1–24) that have a usable image */
  availableImages: ReadonlySet<number>;
  /** The adventure map (image + game) is available → pp. 28–29 are the map spread */
  hasMap: boolean;
  /**
   * Whether a scene's text still fits under its secondary illustration. The PDF planner answers
   * with real font metrics; without it (a web fallback) every available secondary is used.
   */
  secondaryFits?: (scene: GeneratedScene) => boolean;
}

const sideOf = (pageNumber: number): Slot["side"] => (pageNumber % 2 === 0 ? "left" : "right");

/** The 30 inner pages, in order (fewer only when the story does not have 12 scenes). */
export function sequenceInterior(input: SequenceInput): SequencedPage[] {
  const pages: SequencedPage[] = [];
  const slot = (pageNumber: number): Slot => ({ pageNumber, side: sideOf(pageNumber) });

  pages.push({ ...slot(1), kind: "title-dedication" });

  let textIndex = 0;
  input.scenes.slice(0, SCENE_COUNT).forEach((scene, i) => {
    const left = 2 + i * 2;
    const right = left + 1;
    const layout = SCENE_LAYOUTS[i];
    const isBridge = scene.type === "bridge";

    if (layout === "spread") {
      pages.push({ ...slot(left), kind: "spread", half: "left", scene });
      pages.push({ ...slot(right), kind: "spread", half: "right", scene });
      if (!isBridge) textIndex++;
      return;
    }

    const art: Extract<SequencedPage, { kind: "illustration" }> = { ...slot(left), kind: "illustration", scene, layout, artTitle: false };
    pages.push(art);
    const titleable = layout !== "full_illustration";

    if (isBridge) {
      art.artTitle = titleable;
      pages.push({ ...slot(right), kind: "text", scene, variant: "puente" });
      return;
    }

    const variant = TEXT_CYCLE[textIndex % TEXT_CYCLE.length];
    textIndex++;

    const secondary = scene.sceneNumber + SECONDARY_SCENE_OFFSET;
    if (input.availableImages.has(secondary) && (input.secondaryFits?.(scene) ?? true)) {
      art.artTitle = titleable;
      pages.push({ ...slot(right), kind: "illustration-text", scene, secondarySceneNumber: secondary });
      return;
    }
    // The text page carries the scene title: never repeat it on the facing art.
    pages.push({ ...slot(right), kind: "text", scene, variant });
  });

  const closingStart = 2 + SCENE_COUNT * 2; // 26
  pages.push({ ...slot(closingStart), kind: "final" });
  pages.push({ ...slot(closingStart + 1), kind: "about-reader" });
  if (input.hasMap) {
    pages.push({ ...slot(closingStart + 2), kind: "map", half: "left" });
    pages.push({ ...slot(closingStart + 3), kind: "map", half: "right" });
  } else {
    pages.push({ ...slot(closingStart + 2), kind: "endpaper" });
    pages.push({ ...slot(closingStart + 3), kind: "endpaper" });
  }
  pages.push({ ...slot(closingStart + 4), kind: "colophon" });
  return pages;
}
