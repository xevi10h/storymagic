/**
 * Interior page plan — the single source of truth for page order, facing
 * pages, image boxes and fitted type sizes. Used by the PDF template AND by
 * validatePrintableBook, so what is validated is exactly what is printed.
 *
 * Gelato photobook = [cover] [blank endpaper] [30 inner pages] [blank endpaper].
 * Inner page 1 is therefore a RIGHT-hand page, and spreads are (2,3) … (28,29):
 * even page = left, odd page = right, page 30 = left facing the back endpaper.
 *
 *   p1        Title + dedication                          (right, alone)
 *   p2–p25    12 scenes: illustration LEFT ↔ text RIGHT    (each scene = one spread)
 *             panoramic scenes: spread_left p(even) + spread_right p(odd)
 *   p26 · p27 Final "The End" ↔ About the reader
 *   p28 · p29 Adventure map spread + search-and-find panel (books without a map:
 *             patterned endpaper spread)
 *   p30       Colophon                                    (left, alone)
 */

import type { GeneratedScene, GeneratedStory } from "@/lib/ai/story-generator";
import type { MapGame, MapGameBand } from "@/lib/ai/adventure-map";
import { BOOK, getPdfTextConfig, type PdfTextConfig } from "./theme";
import { MM_TO_PT } from "./images";
import { countLines, fitText, sanitizePrintText, type FitResult } from "./text";
import type { FontVariant } from "./fonts";

export const INTERIOR_PAGE_COUNT = 30;
export const SCENE_COUNT = 12;
/** Secondary illustration of scene N is stored as scene N + 12 */
export const SECONDARY_SCENE_OFFSET = 12;

// ── Layout vocabulary (same names as the web viewer) ──────────────────────

export type IllustrationLayout = "immersive" | "split_top" | "split_bottom" | "full_illustration";
type SceneLayout = IllustrationLayout | "spread";

const SCENE_LAYOUTS: SceneLayout[] = [
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

export type TextVariant = "galeria" | "pergamino" | "ventana" | "puente";
const TEXT_CYCLE: TextVariant[] = ["galeria", "pergamino", "ventana"];

export function getActLabel(sceneNumber: number): string | undefined {
  if (sceneNumber === 1) return "I";
  if (sceneNumber === 4) return "II";
  if (sceneNumber === 10) return "III";
  return undefined;
}

// ── Geometry (pt) — shared by template + validator ───────────────────────

const W = BOOK.pageWidth;
const H = BOOK.pageHeight;
const M = BOOK.contentMargin; // 19 mm from page edge = 15 mm inside trim

export const GEOMETRY = {
  pageWidth: W,
  pageHeight: H,
  margin: M,
  /** Split layouts: image share of the page height */
  splitImageHeight: H * 0.78,
  /** Illustration + text page: image height */
  illTextImageHeight: H * 0.42,
  /**
   * Panorama: the image covers both pages' outer bleeds + both trims (4 + 200 + 200 + 4 mm).
   * Each page shows a 208 mm window; the right page starts 200 mm in, so the 4 mm gutter
   * bleeds overlap and the art is continuous across the fold.
   */
  spreadWidth: (4 + 200 + 200 + 4) * MM_TO_PT,
  spreadRightOffset: 200 * MM_TO_PT,
  /** Text pages: fixed text column */
  textColumnWidth: 440,
  textInnerHeight: H - 2 * M,
  /** Title over artwork */
  overlayTextWidth: W - 2 * M,
  /** Longest body text drawn in white over a gradient (≈ 6 lines); longer → paper panel */
  maxGradientTextHeight: H * 0.26,
  /**
   * Adventure map game panel (right page, p29). The map prompt keeps the RIGHT QUARTER of the
   * image free (image-prompts MAP_RULES): the panel starts 5 mm inside that zone and ends at
   * the text safe margin. 408 mm × 0.75 − 200 mm + 5 mm = 111 mm from the right page's edge.
   */
  mapPanelLeft: ((4 + 200 + 200 + 4) * 0.75 - 200 + 5) * MM_TO_PT,
  mapPanelWidth: W - M - ((4 + 200 + 200 + 4) * 0.75 - 200 + 5) * MM_TO_PT,
} as const;

export type ImageRole = "scene" | "spread";

/** An image box on a page: where the illustration of `sceneNumber` is drawn. */
export interface ImageBox {
  sceneNumber: number;
  boxWidth: number;
  boxHeight: number;
  /** Horizontal window offset inside the (wider) box — panoramas only */
  windowLeft: number;
}

// ── Page plan types ──────────────────────────────────────────────────────

export interface FittedType {
  fontSize: number;
  leading: number;
}

interface PageBase {
  /** 1-based inner page number */
  pageNumber: number;
  side: "left" | "right";
}

export type PlannedPage = PageBase &
  (
    | {
        kind: "title-dedication";
        title: string;
        titleType: FittedType;
        dedication: string;
        dedicationType: FittedType;
        sender: string | null;
      }
    | { kind: "illustration"; scene: GeneratedScene; layout: IllustrationLayout; image: ImageBox; titleType: FittedType }
    | {
        kind: "spread";
        half: "left" | "right";
        scene: GeneratedScene;
        image: ImageBox;
        /** left half: scene title; right half: body text */
        overlay: { text: string; type: FittedType; role: "title" | "body"; mode: "gradient" | "panel"; blockHeight: number };
      }
    | { kind: "text"; scene: GeneratedScene; variant: TextVariant; body: string; titleType: FittedType; bodyType: FittedType }
    | { kind: "illustration-text"; scene: GeneratedScene; image: ImageBox; body: string; bodyType: FittedType }
    | { kind: "final"; message: string; messageType: FittedType }
    | { kind: "about-reader" }
    /** Adventure map spread; the game panel is drawn on the right half */
    | { kind: "map"; half: "left" | "right"; panel: MapPanel | null }
    | { kind: "endpaper" }
    | { kind: "colophon" }
  );

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export const PANEL_PADDING = 16;
export const ILL_TEXT_WIDTH = 460;

export interface PlanIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  pageNumber?: number;
}

export interface InteriorPlan {
  pages: PlannedPage[];
  issues: PlanIssue[];
}

// ── Adventure map panel ──────────────────────────────────────────────────

/** Locale strings for the panel (resolved by the template's pdfT). */
export interface MapPanelStrings {
  kicker: string;
  /** "Where is…?" (2–4) or "Seek and find" (5–12) */
  title: string;
  /** Generic "follow the trail" line, when the game has none of its own */
  trail: string;
  questions: string;
  answers: string;
}

export interface MapPanel {
  band: MapGameBand;
  kicker: string;
  title: string;
  items: string[];
  trail: string | null;
  questionsTitle: string;
  questions: string[];
  /** One line, printed upside down under the questions */
  answers: string | null;
  /** Multiplies every MAP_PANEL size so the panel fits the page */
  scale: number;
  height: number;
}

/** Panel metrics — shared by the planner (fitting) and the template (drawing). */
export const MAP_PANEL = {
  padding: 16,
  kicker: 6.5,
  kickerGap: 6,
  titleGap: 8,
  dividerGap: 10,
  sectionGap: 12,
  itemLeading: 1.3,
  noteLeading: 1.4,
  sizes: {
    little: { title: 22, item: 16, itemGap: 11, dot: 13, note: 0, qTitle: 0, question: 0, answer: 0 },
    middle: { title: 18, item: 13, itemGap: 7, dot: 10, note: 10.5, qTitle: 0, question: 0, answer: 0 },
    big: { title: 16, item: 11, itemGap: 4.5, dot: 8.5, note: 0, qTitle: 12.5, question: 9.5, answer: 6.8 },
  },
} as const;

const MAP_FONT = {
  title: { role: "display", weight: 600 } as FontVariant,
  item: { role: "body", weight: 600 } as FontVariant,
  note: { role: "body", italic: true } as FontVariant,
  question: { role: "body" } as FontVariant,
} as const;

/** Capitalise the first letter of a list label ("el cohete" → "El cohete"). */
function capitalise(label: string): string {
  return label.charAt(0).toLocaleUpperCase() + label.slice(1);
}

/** Height of the panel content at `scale` (same stack as MapGamePanel in book-template.tsx). */
export function mapPanelHeight(p: Omit<MapPanel, "scale" | "height">, scale: number): number {
  const z = MAP_PANEL.sizes[p.band];
  const inner = GEOMETRY.mapPanelWidth - 2 * MAP_PANEL.padding;
  const lines = (text: string, size: number, width: number, font: FontVariant) => countLines(text, size, width, font);
  let h = 2 * MAP_PANEL.padding;
  h += MAP_PANEL.kicker * 1.3 + MAP_PANEL.kickerGap;
  h += lines(p.title, z.title * scale, inner, MAP_FONT.title) * z.title * scale * 1.2 + MAP_PANEL.titleGap;
  h += 1 + MAP_PANEL.dividerGap; // divider
  const itemW = inner - z.dot * scale - 7;
  for (const item of p.items) {
    h += Math.max(z.dot * scale, lines(item, z.item * scale, itemW, MAP_FONT.item) * z.item * scale * MAP_PANEL.itemLeading) + z.itemGap * scale;
  }
  if (p.trail) h += MAP_PANEL.sectionGap + lines(p.trail, z.note * scale, inner - 18, MAP_FONT.note) * z.note * scale * MAP_PANEL.noteLeading;
  if (p.questions.length) {
    h += MAP_PANEL.sectionGap + 1 + MAP_PANEL.dividerGap;
    h += z.qTitle * scale * 1.2 + 6;
    const qW = inner - 14 * scale;
    for (const q of p.questions) h += lines(q, z.question * scale, qW, MAP_FONT.question) * z.question * scale * MAP_PANEL.noteLeading + 4;
  }
  if (p.answers) h += MAP_PANEL.sectionGap + lines(p.answers, z.answer * scale, inner, MAP_FONT.question) * z.answer * scale * MAP_PANEL.noteLeading;
  return h;
}

function planMapPanel(game: MapGame, strings: MapPanelStrings, issues: PlanIssue[]): MapPanel {
  const band = game.band;
  const label = (s: string) => sanitizePrintText(s);
  const base: Omit<MapPanel, "scale" | "height"> = {
    band,
    kicker: strings.kicker,
    title: strings.title,
    // 2–4: labels complete the title "Where is…?"; 5–12: a checklist starts upper-case
    items: game.items.map((it) => (band === "little" ? label(it.label) : capitalise(label(it.label)))),
    trail: band === "middle" ? label(game.trailLine) || strings.trail : null,
    questionsTitle: strings.questions,
    questions: band === "big" ? game.questions.map((q) => label(q.question)) : [],
    answers:
      band === "big" && game.questions.length
        ? // No-break spaces inside each answer: a line may only break between answers (numbers separate them)
          `${strings.answers}: ${game.questions.map((q, i) => `${i + 1}.\u00A0${label(q.answer).replace(/ /g, "\u00A0")}`).join("\u00A0\u00A0 ")}`
        : null,
  };
  const maxHeight = H - 2 * M;
  for (let scale = 1; scale >= 0.7 - 1e-6; scale -= 0.05) {
    const height = mapPanelHeight(base, scale);
    if (height <= maxHeight) return { ...base, scale, height };
  }
  issues.push({ severity: "error", code: "text_overflow", message: "Adventure map game does not fit its panel", pageNumber: 29 });
  return { ...base, scale: 0.7, height: maxHeight };
}

export interface PlanInput {
  story: GeneratedStory;
  characterAge: number;
  /** Parent's verbatim dedication (stories.dedication_text). Falls back to the generated one. */
  dedicationText: string | null;
  senderName: string | null;
  /** Scene numbers (1–24) that have a usable image */
  availableImages: Set<number>;
  /** Adventure map game — only when its map image decodes; null → patterned endpaper spread */
  map?: { game: MapGame; strings: MapPanelStrings } | null;
}

// ── Fitting helpers ──────────────────────────────────────────────────────

function lineCapHeight(maxLines: number, size: number, leading: number): number {
  return maxLines * size * leading + 0.5;
}

function toType(r: FitResult): FittedType {
  return { fontSize: r.fontSize, leading: r.leading };
}

/**
 * Body limits per age: preferred size from the age config. The floor (−15 %, 0.25 pt
 * steps) is only a last-resort safety net so a book always prints; the Book Plan's
 * budgets + print-fit repair keep real books at the band size, and any shrink beyond
 * BODY_SHRINK_WARN_PT is reported as a `body_type_shrunk` warning.
 */
function bodyLimits(tc: PdfTextConfig) {
  return { max: tc.body, min: Math.max(9, Math.round(tc.body * 0.85 * 4) / 4), leading: tc.bodyLeading, minLeading: 1.35 };
}

/** Shrink below the band's body size that is still invisible (fitter works in 0.25 pt steps). */
export const BODY_SHRINK_WARN_PT = 0.6;

/** Height a text page's fixed chrome takes (title handled separately). */
const TEXT_PAGE_CHROME = {
  titleGap: 12, // title → divider
  divider: 12 + 12, // divider + gap to body (galeria/ventana) ≈ rule + gap (pergamino)
  bottomOrnament: 14 + 24,
} as const;

// ── Planner ──────────────────────────────────────────────────────────────

/**
 * Builds the 30-page interior. Requires fonts loaded (ensurePdfFontsLoaded).
 * Never throws for content problems — they are returned as issues so the
 * validator can report all of them at once.
 */
export function planInteriorPages(input: PlanInput): InteriorPlan {
  const { story } = input;
  const tc = getPdfTextConfig(input.characterAge);
  const body = bodyLimits(tc);
  const issues: PlanIssue[] = [];
  const pages: PlannedPage[] = [];
  const push = (p: DistributiveOmit<PlannedPage, "side">) => {
    const side: PageBase["side"] = p.pageNumber % 2 === 0 ? "left" : "right";
    pages.push({ ...p, side } as PlannedPage);
  };

  // p1 — title + dedication (verbatim when the parent wrote one)
  const title = sanitizePrintText(story.bookTitle);
  const verbatim = input.dedicationText?.trim();
  const dedication = sanitizePrintText(verbatim ? verbatim : story.dedication ?? "");
  if (!dedication) {
    issues.push({ severity: "warning", code: "dedication_missing", message: "No dedication at all — title page printed without one", pageNumber: 1 });
  } else if (!verbatim) {
    issues.push({ severity: "warning", code: "dedication_generated", message: "No parent dedication — printing the generated one", pageNumber: 1 });
  }
  const titleFit = fitText({
    text: title,
    variant: { role: "display", weight: 600 },
    width: GEOMETRY.textColumnWidth,
    height: lineCapHeight(3, 26, 1.3),
    maxSize: 26,
    minSize: 17,
    leading: 1.3,
    minLeading: 1.2,
  });
  if (!titleFit.fits) issues.push({ severity: "error", code: "text_overflow", message: "Book title too long for the title page", pageNumber: 1 });
  // Dedication box: what is left after logo, title, divider, subtitle, name, heart, sender, stars
  const dedicationHeight = GEOMETRY.textInnerHeight - 30 - titleFit.height - 30 - 16 - 26 - 44 - (input.senderName ? 22 : 0) - 48;
  const dedicationFit = fitText({
    text: dedication,
    variant: { role: "body", italic: true },
    width: BOOK.trimWidth * 0.62,
    height: dedicationHeight,
    maxSize: 12,
    minSize: 8.5,
    leading: 1.8,
    minLeading: 1.4,
  });
  if (!dedicationFit.fits) {
    issues.push({ severity: "error", code: "text_overflow", message: `Dedication too long to print (${dedication.length} chars)`, pageNumber: 1 });
  }
  push({
    kind: "title-dedication",
    pageNumber: 1,
    title,
    titleType: toType(titleFit),
    dedication,
    dedicationType: toType(dedicationFit),
    sender: input.senderName ? sanitizePrintText(input.senderName) : null,
  });

  // p2–p25 — one spread per scene
  if (story.scenes.length !== SCENE_COUNT) {
    issues.push({ severity: "error", code: "scene_count", message: `Story has ${story.scenes.length} scenes, print layout needs ${SCENE_COUNT}` });
  }
  let textIndex = 0;
  story.scenes.slice(0, SCENE_COUNT).forEach((scene, i) => {
    const left = 2 + i * 2;
    const right = left + 1;
    const layout = SCENE_LAYOUTS[i];
    const isBridge = scene.type === "bridge";
    const sceneTitle = sanitizePrintText(scene.title);
    const sceneText = sanitizePrintText(scene.text);

    if (!input.availableImages.has(scene.sceneNumber)) {
      issues.push({ severity: "error", code: "missing_illustration", message: `Scene ${scene.sceneNumber} has no illustration`, pageNumber: left });
    }

    const overlayTitleFit = fitText({
      text: sceneTitle,
      variant: { role: "display", weight: 600 },
      width: GEOMETRY.overlayTextWidth,
      height: lineCapHeight(2, 20, 1.25),
      maxSize: 20,
      minSize: 13,
      leading: 1.25,
      minLeading: 1.15,
    });
    if (!overlayTitleFit.fits) issues.push({ severity: "error", code: "text_overflow", message: `Scene ${scene.sceneNumber} title too long`, pageNumber: left });

    if (layout === "spread") {
      const image: ImageBox = { sceneNumber: scene.sceneNumber, boxWidth: GEOMETRY.spreadWidth, boxHeight: H, windowLeft: 0 };
      push({
        kind: "spread",
        pageNumber: left,
        half: "left",
        scene,
        image,
        overlay: { text: sceneTitle, type: toType(overlayTitleFit), role: "title", mode: "gradient", blockHeight: overlayTitleFit.height },
      });
      // Body over the right half: white text on the viewer's dark gradient only while it is short
      // (the gradient must stay dark behind every line); longer text goes on a readable paper panel.
      const bodyW = GEOMETRY.overlayTextWidth;
      // Gradient text only at the band's body size (never shrunk to stay on the gradient).
      const gradientFit = fitText({ text: sceneText, variant: { role: "body" }, width: bodyW, height: GEOMETRY.maxGradientTextHeight, maxSize: body.max, minSize: body.max, leading: body.leading, minLeading: body.leading });
      let overlay: { type: FittedType; mode: "gradient" | "panel"; blockHeight: number };
      if (gradientFit.fits) {
        overlay = { type: toType(gradientFit), mode: "gradient", blockHeight: gradientFit.height };
      } else {
        const panelFit = fitText({ text: sceneText, variant: { role: "body" }, width: bodyW - 2 * PANEL_PADDING, height: H - 2 * M - 2 * PANEL_PADDING - 40, maxSize: body.max, minSize: body.min, leading: body.leading, minLeading: body.minLeading });
        if (!panelFit.fits) issues.push({ severity: "error", code: "text_overflow", message: `Scene ${scene.sceneNumber} text does not fit the panorama page`, pageNumber: right });
        overlay = { type: toType(panelFit), mode: "panel", blockHeight: panelFit.height };
      }
      push({
        kind: "spread",
        pageNumber: right,
        half: "right",
        scene,
        image: { ...image, windowLeft: GEOMETRY.spreadRightOffset },
        overlay: { text: sceneText, role: "body", ...overlay },
      });
      if (!isBridge) textIndex++;
      return;
    }

    push({
      kind: "illustration",
      pageNumber: left,
      scene,
      layout,
      image: {
        sceneNumber: scene.sceneNumber,
        boxWidth: W,
        boxHeight: layout === "split_top" || layout === "split_bottom" ? GEOMETRY.splitImageHeight : H,
        windowLeft: 0,
      },
      titleType: toType(overlayTitleFit),
    });

    if (isBridge) {
      const bridgeFit = fitText({
        text: sceneText,
        variant: { role: "display", weight: 600 },
        width: BOOK.trimWidth * 0.7,
        height: GEOMETRY.textInnerHeight - 60 - 2 * 28 - 20,
        maxSize: tc.bridgeText,
        minSize: 13,
        leading: 1.5,
        minLeading: 1.3,
      });
      if (!bridgeFit.fits) issues.push({ severity: "error", code: "text_overflow", message: `Bridge ${scene.sceneNumber} text too long`, pageNumber: right });
      push({ kind: "text", pageNumber: right, scene, variant: "puente", body: sceneText, titleType: toType(overlayTitleFit), bodyType: toType(bridgeFit) });
      return;
    }

    const variant = TEXT_CYCLE[textIndex % TEXT_CYCLE.length];
    textIndex++;

    // Secondary illustration + text, when the text still fits comfortably under the image
    const secondary = scene.sceneNumber + SECONDARY_SCENE_OFFSET;
    if (input.availableImages.has(secondary)) {
      const illTextFit = fitText({
        text: sceneText,
        variant: { role: "body" },
        width: ILL_TEXT_WIDTH,
        height: H - GEOMETRY.illTextImageHeight - 8 - M - 36,
        maxSize: body.max,
        minSize: Math.max(body.min, body.max - 1.5),
        leading: body.leading,
        minLeading: Math.max(body.minLeading, body.leading - 0.25),
      });
      if (illTextFit.fits) {
        push({
          kind: "illustration-text",
          pageNumber: right,
          scene,
          image: { sceneNumber: secondary, boxWidth: W, boxHeight: GEOMETRY.illTextImageHeight, windowLeft: 0 },
          body: sceneText,
          bodyType: toType(illTextFit),
        });
        return;
      }
      issues.push({ severity: "warning", code: "secondary_image_dropped", message: `Scene ${scene.sceneNumber}: text too long for the secondary illustration, using a full text page`, pageNumber: right });
    }

    const titleType = fitText({
      text: sceneTitle,
      variant: { role: "display", weight: 600 },
      width: GEOMETRY.textColumnWidth,
      height: lineCapHeight(2, tc.title, 1.3),
      maxSize: tc.title,
      minSize: 13,
      leading: 1.3,
      minLeading: 1.2,
    });
    if (!titleType.fits) issues.push({ severity: "error", code: "text_overflow", message: `Scene ${scene.sceneNumber} title too long`, pageNumber: right });
    const dropCapWidth = variant === "ventana" ? tc.dropCap * 0.9 + 6 : 0;
    const bodyFit = fitText({
      text: sceneText,
      variant: { role: "body" },
      width: GEOMETRY.textColumnWidth - dropCapWidth,
      height: GEOMETRY.textInnerHeight - titleType.height - TEXT_PAGE_CHROME.titleGap - TEXT_PAGE_CHROME.divider - TEXT_PAGE_CHROME.bottomOrnament,
      maxSize: body.max,
      minSize: body.min,
      leading: body.leading,
      minLeading: body.minLeading,
    });
    if (!bodyFit.fits) {
      issues.push({ severity: "error", code: "text_overflow", message: `Scene ${scene.sceneNumber} text too long (${sceneText.split(/\s+/).length} words) even at ${body.min}pt`, pageNumber: right });
    }
    push({ kind: "text", pageNumber: right, scene, variant, body: sceneText, titleType: toType(titleType), bodyType: toType(bodyFit) });
  });

  const bodyType = harmonizeBodyType(pages);
  if (bodyType && bodyType.fontSize < tc.body - BODY_SHRINK_WARN_PT) {
    issues.push({ severity: "warning", code: "body_type_shrunk", message: `Body text set at ${bodyType.fontSize}pt instead of the age band's ${tc.body}pt (the longest page does not fit at full size)` });
  }

  // p26–p30 — closing pages
  const message = sanitizePrintText(story.finalMessage ?? "");
  const messageFit = fitText({
    text: message,
    variant: { role: "display", weight: 600 },
    width: BOOK.trimWidth * 0.7,
    height: GEOMETRY.textInnerHeight - 40 - 40 - 20 - 50 - 30 - 20,
    maxSize: 16,
    minSize: 10,
    leading: 1.5,
    minLeading: 1.3,
  });
  if (!messageFit.fits) issues.push({ severity: "error", code: "text_overflow", message: "Final message too long" });
  const closingStart = 2 + SCENE_COUNT * 2; // 26
  push({ kind: "final", pageNumber: closingStart, message, messageType: toType(messageFit) });
  push({ kind: "about-reader", pageNumber: closingStart + 1 });
  if (input.map) {
    push({ kind: "map", pageNumber: closingStart + 2, half: "left", panel: null });
    push({ kind: "map", pageNumber: closingStart + 3, half: "right", panel: planMapPanel(input.map.game, input.map.strings, issues) });
  } else {
    push({ kind: "endpaper", pageNumber: closingStart + 2 });
    push({ kind: "endpaper", pageNumber: closingStart + 3 });
  }
  push({ kind: "colophon", pageNumber: closingStart + 4 });

  if (pages.length !== INTERIOR_PAGE_COUNT) {
    issues.push({ severity: "error", code: "page_count", message: `Interior has ${pages.length} pages, Gelato product needs ${INTERIOR_PAGE_COUNT}` });
  }
  // Every panorama must start on a left (even) page
  for (const p of pages) {
    if (p.kind === "spread" && (p.half === "left") !== (p.side === "left")) {
      issues.push({ severity: "error", code: "spread_parity", message: `Panorama half "${p.half}" landed on a ${p.side} page`, pageNumber: p.pageNumber });
    }
  }

  return { pages, issues };
}

/**
 * One body size per book: a printed book whose text size jumps from page to page
 * looks broken. Every body block — text pages, text under a secondary illustration
 * and panorama body text (paper panel or gradient) — takes the smallest fitted size
 * (a smaller size with its tighter leading always still fits the boxes it was
 * measured against). Returns the book's body type (null when there is no body text).
 */
function harmonizeBodyType(pages: PlannedPage[]): FittedType | null {
  const bodies: FittedType[] = [];
  for (const p of pages) {
    if ((p.kind === "text" && p.variant !== "puente") || p.kind === "illustration-text") bodies.push(p.bodyType);
    if (p.kind === "spread" && p.overlay.role === "body") bodies.push(p.overlay.type);
  }
  if (bodies.length === 0) return null;
  const smallest = bodies.reduce((a, b) => (b.fontSize < a.fontSize ? b : a));
  const target: FittedType = { fontSize: smallest.fontSize, leading: Math.min(...bodies.filter((b) => b.fontSize === smallest.fontSize).map((b) => b.leading)) };
  for (const p of pages) {
    if ((p.kind === "text" && p.variant !== "puente") || p.kind === "illustration-text") p.bodyType = target;
    if (p.kind === "spread" && p.overlay.role === "body") {
      if (p.overlay.mode === "gradient" && p.overlay.type.fontSize !== target.fontSize) {
        // The gradient's height follows the text block: re-measure it at the book size.
        const fit = fitText({ text: p.overlay.text, variant: { role: "body" }, width: GEOMETRY.overlayTextWidth, height: GEOMETRY.maxGradientTextHeight, maxSize: target.fontSize, minSize: target.fontSize, leading: target.leading, minLeading: target.leading });
        p.overlay.blockHeight = fit.height;
      }
      p.overlay.type = target;
    }
  }
  return target;
}

/** Image boxes drawn on a planned page (for DPI checks and rendering). */
export function imageBoxesOf(page: PlannedPage): ImageBox[] {
  switch (page.kind) {
    case "illustration":
    case "spread":
    case "illustration-text":
      return [page.image];
    default:
      return [];
  }
}
