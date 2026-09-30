import type { ReactNode } from "react";
import type { GeneratedScene } from "@/lib/ai/story-generator";

/**
 * Scene page layouts — a 200×200 mm square book, mirroring the print template
 * (src/lib/pdf/layout.ts, same layout names).
 *
 *   immersive / split_top / split_bottom / full_illustration
 *                      — full-bleed illustration page. Print retired the split band
 *                        (art over a cream title strip) on 2026-09-29: the split names only
 *                        survive for the rotation and for whether the art may carry the
 *                        scene title (see artCarriesTitle). New books render these square;
 *                        older books have 1.28:1 art that is cover-cropped (centred).
 *   text_only          — decorated text page (galeria / pergamino / ventana / puente)
 *   illustration_text  — secondary illustration band + body text (no title)
 *   spread_left/right  — the two halves of a panoramic double-page spread (2:1 art)
 */
export type ScenePageLayout =
  | "immersive"
  | "split_top"
  | "split_bottom"
  | "full_illustration"
  | "text_only"
  | "illustration_text"
  | "spread_left"
  | "spread_right";

/**
 * Spread type for text pages — mirrors the PDF editorial cycling system.
 * Text pages cycle through galeria → pergamino → ventana for scenes,
 * and always use "puente" for bridge transitions.
 */
export type SpreadType = "galeria" | "pergamino" | "ventana" | "puente";

const SPREAD_CYCLE: ("galeria" | "pergamino" | "ventana")[] = [
  "galeria", "pergamino", "ventana",
];

/** Returns the spread type for a scene's text page, matching the PDF cycling. */
export function getSpreadType(sceneType: string, sceneOnlyIndex: number): SpreadType {
  if (sceneType === "bridge") return "puente";
  return SPREAD_CYCLE[sceneOnlyIndex % SPREAD_CYCLE.length];
}

/**
 * Layout pairs for each of the 12 scenes.
 * pair[0] = primary page (gets illustration), pair[1] = secondary page.
 *
 * Must stay in step with SCENE_LAYOUTS in src/lib/pdf/layout.ts (print) — the image
 * frame (scene-screenplay frameForScene) and the viewer both read this table.
 */
export const SCENE_LAYOUT_PAIRS: [ScenePageLayout, ScenePageLayout][] = [
  ["immersive", "text_only"],           // Scene 1: dramatic opening
  ["split_top", "text_only"],           // Scene 2: world building
  ["spread_left", "spread_right"],      // Scene 3: first adventure — panorama!
  ["full_illustration", "text_only"],   // Scene 4: new encounter — visual impact
  ["split_bottom", "text_only"],        // Scene 5: meeting ally
  ["immersive", "text_only"],           // Scene 6: exploring wonders
  ["split_top", "text_only"],           // Scene 7: first test
  ["spread_left", "spread_right"],      // Scene 8: climactic moment — panorama!
  ["full_illustration", "text_only"],   // Scene 9: big obstacle — visual impact
  ["immersive", "text_only"],           // Scene 10: darkest moment
  ["split_bottom", "text_only"],        // Scene 11: breakthrough
  ["immersive", "text_only"],           // Scene 12: resolution / homecoming
];

/**
 * Whether a full-bleed illustration page carries the scene title over the art — the
 * print rule (src/lib/pdf/layout.ts planInteriorPages, IllustrationPage) replicated here
 * because layout.ts pulls in @react-pdf font measuring and cannot ship to the browser:
 * a title is shown once per spread, so the art carries it only when the facing page has
 * no heading of its own (a bridge page or text under a secondary illustration), and
 * full_illustration pages are always pure art. Panoramas keep their own title (spread_left).
 */
export function artCarriesTitle(
  layout: ScenePageLayout,
  facing: { layout: ScenePageLayout; spreadType?: SpreadType },
): boolean {
  if (layout !== "immersive" && layout !== "split_top" && layout !== "split_bottom") return false;
  return facing.layout === "illustration_text" || (facing.layout === "text_only" && facing.spreadType === "puente");
}

/**
 * 3-act structure mapped to the 12 content slots.
 * Act boundaries are consistent across all age configs:
 *   Act I  (Introduction): scenes 1-3
 *   Act II (Conflict):     scenes 4-9
 *   Act III (Resolution):  scenes 10-12
 *
 * Only the first scene of each act carries the label.
 */
export function getActLabel(sceneNumber: number): string | undefined {
  if (sceneNumber === 1) return "I";
  if (sceneNumber === 4) return "II";
  if (sceneNumber === 10) return "III";
  return undefined;
}

export type BookPage =
  | { type: "cover"; title: string; characterName: string; templateId: string; imageUrl?: string | null }
  | { type: "endpaper"; templateId: string }
  | { type: "title_page"; title: string; characterName: string; templateId: string }
  | { type: "dedication"; text: string; senderName: string | null }
  | { type: "title_dedication"; title: string; characterName: string; templateId: string; dedicationText: string; senderName: string | null }
  | {
      type: "scene";
      scene: GeneratedScene;
      imageUrl: string | null;
      locked: boolean;
      layout: ScenePageLayout;
      actLabel?: string;
      characterAge: number;
      spreadType?: SpreadType;
      /** Full-bleed art only: draw the scene title over the art (artCarriesTitle). */
      artTitle?: boolean;
    }
  | { type: "final"; message: string; characterName: string }
  | {
      type: "hero_card";
      characterName: string;
      age: number;
      city: string | null;
      gender: string;
      interests: string[];
      favoriteColor: string | null;
      favoriteCompanion: string | null;
      futureDream: string | null;
      avatarUrl: string | null;
      portraitUrl: string | null;
      templateId: string;
    }
  | { type: "colophon"; storyId: string }
  /** Preview end, left: the chapters still to come over blurred art from the book. */
  | { type: "teaser_chapters"; chapters: string[]; firstChapter: number; characterName: string; imageUrl: string | null }
  /** Preview end, right: the printed book (mockup of the real cover) with price and CTA. */
  | {
      type: "teaser_order";
      title: string;
      characterName: string;
      coverUrl: string | null;
      format: "hardcover" | "softcover" | "pdf";
      /** Formatted lowest printed price, e.g. "34,90 €" */
      priceFrom: string;
    }
  | {
      type: "back";
      title: string;
      characterName: string;
      synopsis: string;
      coverImageUrl: string | null;
      templateId: string;
      storyId: string;
    };

/**
 * Returns the real book page number (1-based) for a scene page at a given index.
 * Header pages (cover, endpaper, title) don't get numbers.
 * Scene pages are numbered sequentially starting from 1.
 */
export function getBookPageNumber(pages: BookPage[], index: number): number {
  let num = 0;
  for (let i = 0; i <= index; i++) {
    if (pages[i].type === "scene") num++;
  }
  return num;
}

export interface BookViewerProps {
  pages: BookPage[];
  templateId: string;
  /** Character gender — influences color palette tinting */
  gender?: string;
  /** Child's favorite color hex — overrides accent palette */
  favoriteColor?: string;
  currentPage: number;
  onPageChange: (pageIndex: number) => void;
  /** Preview only: ✎ buttons on the cover (title) and dedication pages. */
  onEdit?: (target: "cover" | "dedication") => void;
  /** Preview only: the teaser_order page's CTA (scrolls to the formats). */
  onOrder?: () => void;
  /** Hide the "2–3 / 11" page count under the book (the preview shows "3 de 12 escenas" instead). */
  hidePageCount?: boolean;
  /** Extra buttons in the row under the book, next to "Ampliar" (e.g. Compartir). */
  actions?: ReactNode;
}
