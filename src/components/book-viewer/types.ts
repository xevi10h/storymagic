import type { GeneratedScene } from "@/lib/ai/story-generator";

/**
 * Scene page layouts — designed for a 200×200mm square book.
 * Each layout type specifies how illustration + text are arranged on the page
 * AND what image size Recraft should generate to avoid cropping.
 *
 *   immersive         — full-bleed square image + text overlaid at bottom (1024×1024)
 *   split_top         — landscape image top ~55%, text below (1820×1024)
 *   split_bottom      — text top, landscape image bottom ~55% (1820×1024)
 *   full_illustration  — image fills entire page, scene badge only (1024×1024)
 *   text_only          — decorated text page, no illustration
 *   spread_left        — left half of a panoramic double-page spread (2048×1024)
 *   spread_right       — right half of same panoramic image (no separate generation)
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
 * Recraft V3 image size for each layout that generates an illustration.
 * Sizes chosen to match the aspect ratio of the image container within a square page,
 * so `object-cover` causes minimal or zero cropping.
 *
 * Container ratios (square page = 1:1):
 *   immersive / full_illustration: 100% × 100% → 1:1
 *   split_top / split_bottom:      100% × 78%  → 1.28:1
 *   illustration_text:              100% × 56%  → 1.79:1
 *   spread_left/right:              200% × 100% → 2:1
 */
export const LAYOUT_IMAGE_SIZE: Partial<Record<ScenePageLayout, string>> = {
  immersive: "1024x1024",        // 1:1 — full square page, zero crop
  split_top: "1280x1024",        // 5:4 (1.25:1) — matches 78% height container (1.28:1), minimal crop
  split_bottom: "1280x1024",     // 5:4 (1.25:1) — matches 78% height container (1.28:1), minimal crop
  full_illustration: "1024x1024", // 1:1 — full square page, zero crop
  illustration_text: "1820x1024", // ~16:9 (1.78:1) — matches 56% height container (1.79:1), minimal crop
  spread_left: "2048x1024",      // 2:1 — panoramic spanning two square pages, zero crop
  // spread_right: uses same image as spread_left
  // text_only: no image
};

/**
 * Layout pairs for each of the 12 scenes.
 * pair[0] = primary page (gets illustration), pair[1] = secondary page.
 *
 * Variety pattern inspired by real children's books:
 * - Immersive for emotional/dramatic beats
 * - Splits for world-building and dialogue scenes
 * - Full illustration for visual-only moments
 * - Spreads for the two most impactful scenes (adventure opening + climax)
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
    }
  | { type: "final"; message: string; characterName: string }
  | {
      type: "hero_card";
      characterName: string;
      age: number;
      city: string | null;
      gender: string;
      interests: string[];
      specialTrait: string | null;
      favoriteCompanion: string | null;
      favoriteFood: string | null;
      futureDream: string | null;
      avatarUrl: string | null;
      portraitUrl: string | null;
      templateId: string;
    }
  | { type: "colophon"; storyId: string }
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
  currentPage: number;
  onPageChange: (pageIndex: number) => void;
}
