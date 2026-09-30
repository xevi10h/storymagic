/**
 * Interior page plan — the single source of truth for page order, facing
 * pages, image boxes and fitted type sizes. Used by the PDF template AND by
 * validatePrintableBook, so what is validated is exactly what is printed.
 *
 * Gelato photobook = [cover] [pastedown] [30 inner pages] [pastedown]. The Gelato
 * "inside" file carries the two pastedowns (glued to the boards, not counted in
 * pageCount) — exactly the layout of Teo's book (order 34d619c2, delivered
 * 2026-04-01, printed perfectly): 32-page file, pageCount 30.
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
import type { MapGame } from "@/lib/ai/adventure-map";
import {
  BOOK,
  GEOMETRY,
  ILL_TEXT_WIDTH,
  MAP_PANEL,
  PANEL_PADDING,
  getPdfTextConfig,
  type FittedType,
  type FrontMatterType,
  type MapPanel,
  type PdfTextConfig,
  type DropCapPlan,
} from "@/lib/book/print-spec";
import { SCENE_COUNT, sequenceInterior, INTERIOR_PAGE_COUNT, type IllustrationLayout, type TextVariant } from "@/lib/book/sequence";
import { sanitizePrintText, tieLastWords } from "@/lib/book/print-text";
import { countLines, fitText, splitLeadingLines, type FitResult } from "./text";
import { fontMetrics, measureTextWidth, type FontVariant } from "./fonts";

// Pure spec + sequence live in src/lib/book (shared with the web viewer); re-exported for the print code.
export { GEOMETRY, ILL_TEXT_WIDTH, MAP_PANEL, PANEL_PADDING } from "@/lib/book/print-spec";
export type { FittedType, FrontMatterType, MapPanel } from "@/lib/book/print-spec";
export {
  INTERIOR_PAGE_COUNT,
  INSIDE_FILE_PAGE_COUNT,
  SCENE_COUNT,
  SECONDARY_SCENE_OFFSET,
  type IllustrationLayout,
  type TextVariant,
} from "@/lib/book/sequence";

const W = BOOK.pageWidth;
const H = BOOK.pageHeight;
const M = BOOK.contentMargin; // 19 mm from page edge = 15 mm inside trim

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
        /** Page scale (ornaments, gaps) + the small lines' sizes — grows with the book's body type */
        front: FrontMatterType;
      }
    | {
        kind: "illustration";
        scene: GeneratedScene;
        layout: IllustrationLayout;
        image: ImageBox;
        /**
         * Scene title over the art — only when the facing page has no heading of its own
         * (bridge / text under a secondary illustration) and the layout allows a title
         * (full_illustration never). A title is printed once per spread, never twice.
         */
        title: FittedType | null;
      }
    | {
        kind: "spread";
        half: "left" | "right";
        scene: GeneratedScene;
        image: ImageBox;
        /** left half: scene title; right half: body text */
        overlay: { text: string; type: FittedType; role: "title" | "body"; mode: "gradient" | "panel"; blockHeight: number };
      }
    | {
        kind: "text";
        scene: GeneratedScene;
        variant: TextVariant;
        body: string;
        titleType: FittedType;
        bodyType: FittedType;
        /** Chrome scale (gaps, ornaments, drop-cap allowance) — grows with the body type (growBodyType) */
        scale: number;
        /** Bottom padding of the text column that lifts the block to the optical centre (≤ opticalLift) */
        lift: number;
        /** Ventana pages: the two-line drop cap (null → plain paragraphs) */
        dropCap?: DropCapPlan | null;
      }
    | { kind: "illustration-text"; scene: GeneratedScene; image: ImageBox; body: string; bodyType: FittedType }
    | { kind: "final"; message: string; messageType: FittedType; front: FrontMatterType }
    | { kind: "about-reader" }
    /** Adventure map spread; the game panel is drawn on the right half */
    | { kind: "map"; half: "left" | "right"; panel: MapPanel | null }
    | { kind: "endpaper" }
    | { kind: "colophon" }
  );

type PageOf<K extends PlannedPage["kind"]> = Extract<PlannedPage, { kind: K }>;

/** Body room under a secondary illustration (image, gap, bottom margin, ornaments). */
const ILL_TEXT_BODY_HEIGHT = H - GEOMETRY.illTextImageHeight - 8 - M - 36;
/** Body room inside a panorama's paper panel. */
const SPREAD_PANEL_BODY_HEIGHT = H - 2 * M - 2 * PANEL_PADDING - 40;

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
  /** How to play, one line ("Find these 6 things hidden on the map."), count already filled in */
  howTo: string;
  /** Generic "follow the trail" line, when the game has none of its own */
  trail: string;
  questions: string;
  answers: string;
}

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
  if (p.howTo) h += lines(p.howTo, MAP_PANEL.howTo.size * scale, inner, MAP_FONT.question) * MAP_PANEL.howTo.size * scale * MAP_PANEL.howTo.leading + MAP_PANEL.howTo.gap - MAP_PANEL.titleGap / 2; // drawn tucked under the title
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
    howTo: strings.howTo,
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

/** Height a text page's fixed chrome takes at scale 1 (title handled separately). */
export const TEXT_PAGE_CHROME = {
  titleGap: 12, // title → divider
  divider: 12 + 12, // divider + gap to body (galeria/ventana) ≈ rule + gap (pergamino)
  bottomOrnament: 14 + 24,
  /**
   * Text pages sit their block slightly above the geometric centre (optical centre): the
   * column carries up to this much bottom padding (PlannedPage.lift), taken only from
   * leftover space — it never costs type size.
   */
  opticalLift: 18,
} as const;

/** Bridge (puente) page chrome at scale 1: divider + 2 × gap + wavy dots. */
const BRIDGE_CHROME = 60 + 2 * 28 + 20;

function scaledChrome(scale: number): number {
  return (TEXT_PAGE_CHROME.titleGap + TEXT_PAGE_CHROME.divider + TEXT_PAGE_CHROME.bottomOrnament) * scale;
}

/** Room for body text on a text page, below a title block `titleHeight` tall. */
function textPageBodyHeight(titleHeight: number, scale: number): number {
  return GEOMETRY.textInnerHeight - titleHeight - scaledChrome(scale);
}

/** Body width of a text page (ventana reserves room for the two-line drop cap, which grows with the type). */
function textPageBodyWidth(variant: TextVariant, tc: PdfTextConfig, scale: number): number {
  return GEOMETRY.textColumnWidth - (variant === "ventana" ? tc.dropCap * scale * 0.9 + 6 : 0);
}

function fitSceneTitle(title: string, maxSize: number) {
  return fitText({
    text: title,
    variant: { role: "display", weight: 600 },
    width: GEOMETRY.textColumnWidth,
    height: lineCapHeight(2, maxSize, 1.3),
    maxSize,
    minSize: 13,
    leading: 1.3,
    minLeading: 1.2,
  });
}

function fitBridge(text: string, maxSize: number, scale: number) {
  return fitText({
    text,
    variant: { role: "display", weight: 600 },
    width: BOOK.trimWidth * 0.7,
    height: GEOMETRY.textInnerHeight - BRIDGE_CHROME * scale,
    maxSize,
    minSize: 13,
    leading: 1.5,
    minLeading: 1.3,
  });
}

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

  if (story.scenes.length !== SCENE_COUNT) {
    issues.push({ severity: "error", code: "scene_count", message: `Story has ${story.scenes.length} scenes, print layout needs ${SCENE_COUNT}` });
  }

  // Secondary illustration + text, only while the text still fits comfortably under the image
  const secondaryFit = new Map<number, FitResult>();
  const sceneText = (scene: GeneratedScene) => tieLastWords(sanitizePrintText(scene.text));
  const secondaryFits = (scene: GeneratedScene): boolean => {
    const fit = fitText({
      text: sceneText(scene),
      variant: { role: "body" },
      width: ILL_TEXT_WIDTH,
      height: ILL_TEXT_BODY_HEIGHT,
      maxSize: body.max,
      minSize: Math.max(body.min, body.max - 1.5),
      leading: body.leading,
      minLeading: Math.max(body.minLeading, body.leading - 0.25),
    });
    secondaryFit.set(scene.sceneNumber, fit);
    if (!fit.fits) {
      issues.push({ severity: "warning", code: "secondary_image_dropped", message: `Scene ${scene.sceneNumber}: text too long for the secondary illustration, using a full text page`, pageNumber: 1 + scene.sceneNumber * 2 });
    }
    return fit.fits;
  };

  // The page ORDER is decided by the shared sequence (src/lib/book/sequence.ts, also used by
  // the web viewer); this planner adds boxes and fitted type to each page.
  const sequence = sequenceInterior({ scenes: story.scenes, availableImages: input.availableImages, hasMap: !!input.map, secondaryFits });
  const overlayTitleFits = new Map<number, FitResult>();
  const overlayTitleOf = (scene: GeneratedScene): FitResult => {
    const cached = overlayTitleFits.get(scene.sceneNumber);
    if (cached) return cached;
    const fit = fitText({
      text: sanitizePrintText(scene.title),
      variant: { role: "display", weight: 600 },
      width: GEOMETRY.overlayTextWidth,
      height: lineCapHeight(2, 20, 1.25),
      maxSize: 20,
      minSize: 13,
      leading: 1.25,
      minLeading: 1.15,
    });
    if (!fit.fits) issues.push({ severity: "error", code: "text_overflow", message: `Scene ${scene.sceneNumber} title too long`, pageNumber: 2 * scene.sceneNumber });
    if (!input.availableImages.has(scene.sceneNumber)) {
      issues.push({ severity: "error", code: "missing_illustration", message: `Scene ${scene.sceneNumber} has no illustration`, pageNumber: 2 * scene.sceneNumber });
    }
    overlayTitleFits.set(scene.sceneNumber, fit);
    return fit;
  };

  for (const seq of sequence) {
    const base = { pageNumber: seq.pageNumber, side: seq.side };
    switch (seq.kind) {
      case "title-dedication": {
        // p1 — title + dedication (verbatim when the parent wrote one)
        const verbatim = input.dedicationText?.trim();
        const dedication = sanitizePrintText(verbatim ? verbatim : story.dedication ?? "");
        if (!dedication) {
          issues.push({ severity: "warning", code: "dedication_missing", message: "No dedication at all — title page printed without one", pageNumber: 1 });
        } else if (!verbatim) {
          issues.push({ severity: "warning", code: "dedication_generated", message: "No parent dedication — printing the generated one", pageNumber: 1 });
        }
        pages.push({
          ...base,
          kind: "title-dedication",
          title: sanitizePrintText(story.bookTitle),
          // Fitted once the book's body size is known (planTitlePage, below)
          titleType: { fontSize: 26, leading: 1.3 },
          dedication,
          dedicationType: { fontSize: 12, leading: 1.8 },
          sender: input.senderName ? sanitizePrintText(input.senderName) : null,
          front: { scale: 1, kicker: 11, display: 18, sender: 10, logo: 14 },
        });
        break;
      }
      case "spread": {
        const { scene } = seq;
        const titleFit = overlayTitleOf(scene);
        const image: ImageBox = { sceneNumber: scene.sceneNumber, boxWidth: GEOMETRY.spreadWidth, boxHeight: H, windowLeft: 0 };
        if (seq.half === "left") {
          pages.push({
            ...base,
            kind: "spread",
            half: "left",
            scene,
            image,
            overlay: { text: sanitizePrintText(scene.title), type: toType(titleFit), role: "title", mode: "gradient", blockHeight: titleFit.height },
          });
          break;
        }
        // Body over the right half: white text on the viewer's dark gradient only while it is short
        // (the gradient must stay dark behind every line); longer text goes on a readable paper panel.
        const text = sceneText(scene);
        const bodyW = GEOMETRY.overlayTextWidth;
        // Gradient text only at the band's body size (never shrunk to stay on the gradient).
        const gradientFit = fitText({ text, variant: { role: "body" }, width: bodyW, height: GEOMETRY.maxGradientTextHeight, maxSize: body.max, minSize: body.max, leading: body.leading, minLeading: body.leading });
        let overlay: { type: FittedType; mode: "gradient" | "panel"; blockHeight: number };
        if (gradientFit.fits) {
          overlay = { type: toType(gradientFit), mode: "gradient", blockHeight: gradientFit.height };
        } else {
          const panelFit = fitText({ text, variant: { role: "body" }, width: bodyW - 2 * PANEL_PADDING, height: SPREAD_PANEL_BODY_HEIGHT, maxSize: body.max, minSize: body.min, leading: body.leading, minLeading: body.minLeading });
          if (!panelFit.fits) issues.push({ severity: "error", code: "text_overflow", message: `Scene ${scene.sceneNumber} text does not fit the panorama page`, pageNumber: seq.pageNumber });
          overlay = { type: toType(panelFit), mode: "panel", blockHeight: panelFit.height };
        }
        pages.push({ ...base, kind: "spread", half: "right", scene, image: { ...image, windowLeft: GEOMETRY.spreadRightOffset }, overlay: { text, role: "body", ...overlay } });
        break;
      }
      case "illustration": {
        // Full-bleed art; the title goes on the art only while the facing page has no heading.
        const titleFit = overlayTitleOf(seq.scene);
        pages.push({
          ...base,
          kind: "illustration",
          scene: seq.scene,
          layout: seq.layout,
          image: { sceneNumber: seq.scene.sceneNumber, boxWidth: W, boxHeight: H, windowLeft: 0 },
          title: seq.artTitle ? toType(titleFit) : null,
        });
        break;
      }
      case "illustration-text": {
        const fit = secondaryFit.get(seq.scene.sceneNumber)!;
        pages.push({
          ...base,
          kind: "illustration-text",
          scene: seq.scene,
          image: { sceneNumber: seq.secondarySceneNumber, boxWidth: W, boxHeight: GEOMETRY.illTextImageHeight, windowLeft: 0 },
          body: sceneText(seq.scene),
          bodyType: toType(fit),
        });
        break;
      }
      case "text": {
        const { scene, variant } = seq;
        const text = sceneText(scene);
        if (variant === "puente") {
          const bridgeFit = fitBridge(text, tc.bridgeText, 1);
          if (!bridgeFit.fits) issues.push({ severity: "error", code: "text_overflow", message: `Bridge ${scene.sceneNumber} text too long`, pageNumber: seq.pageNumber });
          pages.push({ ...base, kind: "text", scene, variant, body: text, titleType: toType(overlayTitleOf(scene)), bodyType: toType(bridgeFit), scale: 1, lift: 0 });
          break;
        }
        const titleType = fitSceneTitle(sanitizePrintText(scene.title), tc.title);
        if (!titleType.fits) issues.push({ severity: "error", code: "text_overflow", message: `Scene ${scene.sceneNumber} title too long`, pageNumber: seq.pageNumber });
        const bodyFit = fitText({
          text,
          variant: { role: "body" },
          width: textPageBodyWidth(variant, tc, 1),
          height: textPageBodyHeight(titleType.height, 1),
          maxSize: body.max,
          minSize: body.min,
          leading: body.leading,
          minLeading: body.minLeading,
        });
        if (!bodyFit.fits) {
          issues.push({ severity: "error", code: "text_overflow", message: `Scene ${scene.sceneNumber} text too long (${text.split(/\s+/).length} words) even at ${body.min}pt`, pageNumber: seq.pageNumber });
        }
        pages.push({ ...base, kind: "text", scene, variant, body: text, titleType: toType(titleType), bodyType: toType(bodyFit), scale: 1, lift: 0 });
        break;
      }
      case "final":
        // Fitted once the book's body size is known (planFinalPage, below)
        pages.push({ ...base, kind: "final", message: sanitizePrintText(story.finalMessage ?? ""), messageType: { fontSize: 16, leading: 1.5 }, front: { scale: 1, kicker: 9.5, display: 26, sender: 10, logo: 14 } });
        break;
      case "map":
        pages.push({ ...base, kind: "map", half: seq.half, panel: seq.half === "right" && input.map ? planMapPanel(input.map.game, input.map.strings, issues) : null });
        break;
      case "about-reader":
      case "endpaper":
      case "colophon":
        pages.push({ ...base, kind: seq.kind });
        break;
    }
  }

  const harmonized = harmonizeBodyType(pages);
  const bodyType = harmonized ? growBodyType(pages, tc, harmonized) : null;
  setOpticalLift(pages, tc);
  for (const p of pages) {
    if (p.kind === "text" && p.variant === "ventana") p.dropCap = planDropCap(p.body, p.bodyType, GEOMETRY.textColumnWidth);
  }
  if (bodyType && bodyType.fontSize < tc.body - BODY_SHRINK_WARN_PT) {
    issues.push({ severity: "warning", code: "body_type_shrunk", message: `Body text set at ${bodyType.fontSize}pt instead of the age band's ${tc.body}pt (the longest page does not fit at full size)` });
  }

  const bookBody = bodyType?.fontSize ?? tc.body;
  planTitlePage(pages[0] as PageOf<"title-dedication">, bookBody, issues);

  // p26 — the closing line at least at the book's body size
  const finalPage = pages.find((p): p is PageOf<"final"> => p.kind === "final");
  if (finalPage) {
    const closing = planFinalPage(finalPage.message, bookBody);
    if (!closing.fits) issues.push({ severity: "error", code: "text_overflow", message: "Final message too long" });
    finalPage.messageType = closing.messageType;
    finalPage.front = closing.front;
  }

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

/** Body leading at `size`: eases from the band's leading to `bodyMaxLeading` as the type grows. */
function grownLeading(tc: PdfTextConfig, size: number): number {
  const g = tc.bodyMax > tc.body ? (size - tc.body) / (tc.bodyMax - tc.body) : 0;
  return Math.floor((tc.bodyLeading + (tc.bodyMaxLeading - tc.bodyLeading) * g) * 100) / 100;
}

/**
 * Young bands (2–6) write very short pages: at the band size they sit as a few small
 * lines in a large empty frame. Grow the WHOLE book's body type — still one size per
 * book — to the largest size (0.5 pt steps, capped at tc.bodyMax) at which EVERY body
 * block still fits its box: text pages (title and chrome grown with it), text under a
 * secondary illustration, and panorama body text (a gradient overlay must stay within
 * the gradient's limit — it never flips to a paper panel to grow). Scene titles, the
 * text-page chrome and the bridge pages scale along. Never below the harmonized size;
 * books already shrunk below the band size are left alone.
 */
function growBodyType(pages: PlannedPage[], tc: PdfTextConfig, base: FittedType): FittedType {
  if (tc.bodyMax <= tc.body || base.fontSize < tc.body) return base;
  const body = { role: "body" } as const;
  const blockHeight = (text: string, width: number, size: number, leading: number) => countLines(text, size, width, body) * size * leading;
  for (let size = tc.bodyMax; size > tc.body + 1e-6; size -= 0.5) {
    const leading = grownLeading(tc, size);
    const g = (size - tc.body) / (tc.bodyMax - tc.body);
    const scale = size / tc.body;
    const titleMax = Math.round((tc.title + (tc.titleMax - tc.title) * g) * 2) / 2;
    const apply: (() => void)[] = [];
    let fits = true;
    for (const p of pages) {
      if (p.kind === "text" && p.variant !== "puente") {
        const title = fitSceneTitle(sanitizePrintText(p.scene.title), titleMax);
        const room = textPageBodyHeight(title.height, scale);
        if (!title.fits || blockHeight(p.body, textPageBodyWidth(p.variant, tc, scale), size, leading) > room) fits = false;
        else apply.push(() => Object.assign(p, { titleType: toType(title), scale }));
      } else if (p.kind === "illustration-text") {
        if (blockHeight(p.body, ILL_TEXT_WIDTH, size, leading) > ILL_TEXT_BODY_HEIGHT) fits = false;
      } else if (p.kind === "spread" && p.overlay.role === "body") {
        const gradient = p.overlay.mode === "gradient";
        const width = gradient ? GEOMETRY.overlayTextWidth : GEOMETRY.overlayTextWidth - 2 * PANEL_PADDING;
        const h = blockHeight(p.overlay.text, width, size, leading);
        if (h > (gradient ? GEOMETRY.maxGradientTextHeight : SPREAD_PANEL_BODY_HEIGHT)) fits = false;
        else apply.push(() => void (p.overlay.blockHeight = h));
      }
      if (!fits) break;
    }
    if (!fits) continue;
    const grown: FittedType = { fontSize: size, leading };
    for (const f of apply) f();
    const bridgeMax = Math.round((tc.bridgeText + (tc.bridgeMax - tc.bridgeText) * g) * 2) / 2;
    for (const p of pages) {
      if (p.kind === "text" && p.variant === "puente") {
        const bridge = fitBridge(p.body, bridgeMax, scale);
        // Grown only when it still fits; otherwise the page keeps its band-size fit.
        if (bridge.fits) Object.assign(p, { bodyType: toType(bridge), scale });
      } else if ((p.kind === "text" && p.variant !== "puente") || p.kind === "illustration-text") {
        p.bodyType = grown;
      } else if (p.kind === "spread" && p.overlay.role === "body") {
        p.overlay.type = grown;
      }
    }
    return grown;
  }
  return base;
}

/** Final pass: each text page's optical lift, from the room its block leaves free. */
function setOpticalLift(pages: PlannedPage[], tc: PdfTextConfig) {
  for (const p of pages) {
    if (p.kind !== "text") continue;
    const size = p.bodyType.fontSize;
    const block =
      p.variant === "puente"
        ? countLines(p.body, size, BOOK.trimWidth * 0.7, { role: "display", weight: 600 }) * size * p.bodyType.leading + BRIDGE_CHROME * p.scale
        : countLines(sanitizePrintText(p.scene.title), p.titleType.fontSize, GEOMETRY.textColumnWidth, { role: "display", weight: 600 }) * p.titleType.fontSize * p.titleType.leading +
          scaledChrome(p.scale) +
          countLines(p.body, size, textPageBodyWidth(p.variant, tc, p.scale), { role: "body" }) * size * p.bodyType.leading;
    p.lift = Math.max(0, Math.min(TEXT_PAGE_CHROME.opticalLift, GEOMETRY.textInnerHeight - block));
  }
}

// ── Title / dedication (p1) and "The End" (p26) ──────────────────────────

/**
 * Front-matter scales, largest first: the dedication target steps from the book's body size
 * (never below 14 pt) down to 12 pt in 0.5 pt steps; scale = target ÷ 12 (1 = the historical layout).
 */
function frontScales(bookBody: number): number[] {
  const out: number[] = [];
  for (let size = Math.round(Math.max(14, bookBody) * 2) / 2; size > 12 + 1e-6; size -= 0.5) out.push(size / 12);
  out.push(1);
  return out;
}

const half = (pt: number) => Math.round(pt * 2) / 2;

function frontType(k: number): FrontMatterType {
  return { scale: k, kicker: half(Math.min(16, 11 * k)), display: half(Math.min(28, 18 * k)), sender: half(Math.min(14, 10 * k)), logo: half(Math.min(20, 14 * k)) };
}

/** Line pitch of a single-line label (template sets lineHeight 1.3 on these). */
const LABEL_LEADING = 1.3;

/**
 * p1: the dedication is the gift's emotional centre — it prints at the book's body size
 * (never below 14 pt) when it fits, with the title, name and ornaments scaled alongside.
 * Long dedications step the whole page down (scale 1 = the historical layout, dedication
 * floor 8.5 pt), so a 500-character dedication always still fits.
 */
function planTitlePage(page: PageOf<"title-dedication">, bookBody: number, issues: PlanIssue[]) {
  const dedicationWidth = BOOK.trimWidth * 0.66;
  let last: { titleFit: FitResult; dedicationFit: FitResult; front: FrontMatterType } | null = null;
  for (const k of frontScales(bookBody)) {
    const front = frontType(k);
    const titleMax = half(Math.min(36, 26 * k));
    const titleFit = fitText({
      text: page.title,
      variant: { role: "display", weight: 600 },
      width: GEOMETRY.textColumnWidth,
      height: lineCapHeight(3, titleMax, 1.3),
      maxSize: titleMax,
      minSize: 17,
      leading: 1.3,
      minLeading: 1.2,
    });
    // Everything drawn above/below the dedication (same stack as TitleDedicationPage) + 10 pt safety
    const chrome =
      front.logo + 16 * k + // logo
      titleFit.height +
      (10 + 9 + 10) * k + // divider
      front.kicker * LABEL_LEADING +
      4 * k + front.display * LABEL_LEADING + // name
      (page.dedication ? (20 + 9 + 20) * k : 0) + // heart row
      (page.sender ? 8 * k + front.sender * LABEL_LEADING : 0) +
      (20 + 24) * k + // stars
      10;
    const dedicationMax = 12 * k;
    const dedicationFit = fitText({
      text: page.dedication || " ",
      variant: { role: "body", italic: true },
      width: dedicationWidth,
      height: GEOMETRY.textInnerHeight - chrome,
      maxSize: dedicationMax,
      // Scaled pages keep the dedication within 10 % of its target; only scale 1 may go to the floor
      minSize: k > 1 ? Math.max(8.5, dedicationMax * 0.9) : 8.5,
      leading: 1.7,
      minLeading: 1.4,
    });
    last = { titleFit, dedicationFit, front };
    if (titleFit.fits && dedicationFit.fits) break;
  }
  if (!last) return;
  if (!last.titleFit.fits) issues.push({ severity: "error", code: "text_overflow", message: "Book title too long for the title page", pageNumber: 1 });
  if (page.dedication && !last.dedicationFit.fits) {
    issues.push({ severity: "error", code: "text_overflow", message: `Dedication too long to print (${page.dedication.length} chars)`, pageNumber: 1 });
  }
  page.titleType = toType(last.titleFit);
  page.dedicationType = toType(last.dedicationFit);
  page.front = last.front;
}

/** p26: the closing line at least at the book's body size, "The End" as a real display word. */
function planFinalPage(message: string, bookBody: number): { messageType: FittedType; front: FrontMatterType; fits: boolean } {
  let out: { messageType: FittedType; front: FrontMatterType; fits: boolean } | null = null;
  for (let k of frontScales(bookBody)) {
    // Gaps grow less than the type here: the closing stack is tall and must clear the folio
    const front: FrontMatterType = { ...frontType(Math.min(k, 1.35)), kicker: half(Math.min(14, 9.5 * k)), display: half(Math.min(36, 26 * k)) };
    k = front.scale;
    const messageMax = half(Math.min(28, Math.max(16, bookBody * 1.1)));
    const chrome =
      Math.min(56, 40 * k) + // star cluster
      (20 + 15 + 20) * k + // divider
      (20 + 4) * k + // wavy dots
      28 * k + front.kicker * LABEL_LEADING + // "created for"
      8 * k + front.display * 1.2 + // "The End"
      10;
    const fit = fitText({
      text: message || " ",
      variant: { role: "display", weight: 600 },
      width: BOOK.trimWidth * 0.7,
      height: GEOMETRY.textInnerHeight - chrome,
      maxSize: messageMax,
      minSize: k > 1 ? Math.max(10, Math.min(messageMax, bookBody) * 0.9) : 10,
      leading: 1.5,
      minLeading: 1.3,
    });
    out = { messageType: toType(fit), front, fits: fit.fits };
    if (fit.fits) break;
  }
  return out!;
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

// ── Drop cap (ventana pages) ─────────────────────────────────────────────

/** Opening punctuation that travels with the initial ("¿Qué", "«Hola"); dashes (dialogue) get no drop cap. */
const DROP_CAP_INITIAL = /^[¿¡«"“'‘]?[\p{L}\p{N}]/u;

/**
 * Two-line drop cap. react-pdf cannot float text around a box, so the first two lines are
 * measured off and set beside the initial; the rest continues at full width. The initial's
 * cap height spans from line 1's cap line to line 2's baseline, its baseline sitting exactly
 * on line 2's. The planner fits ventana bodies at a narrower width, so this never grows the
 * block. Null (plain paragraphs) when the first paragraph does not fill both lines beside it.
 */
export function planDropCap(text: string, type: FittedType, width: number): DropCapPlan | null {
  const initial = DROP_CAP_INITIAL.exec(text)?.[0];
  if (!initial) return null;
  const fs = type.fontSize;
  const pitch = fs * type.leading;
  const bodyFont = fontMetrics({ role: "body" });
  const capVariant = { role: "display" as const, weight: 600 as const };
  const capFont = fontMetrics(capVariant);
  const capSize = (pitch + bodyFont.capHeight * fs) / capFont.capHeight;
  // react-pdf baseline = line top + ascent·size → offset that puts the initial's baseline on line 2's
  const capTop = pitch + bodyFont.ascent * fs - capFont.ascent * capSize;
  const capWidth = measureTextWidth(initial, capSize, capVariant) + fs * 0.35;
  const lineWidth = width - capWidth;
  const { head, tail } = splitLeadingLines(text.slice(initial.length), 2, fs, lineWidth, { role: "body" });
  // Only when the first paragraph itself fills both lines beside the initial: a one-line
  // opening paragraph would leave the initial hanging into the blank gap below it.
  // splitLeadingLines breaks early (safety margin), so a head it spreads over 2 lines can
  // still render on ONE — require the head to overflow the REAL line width by a margin;
  // borderline cases fall back to plain paragraphs (no drop cap beats an empty line).
  const headOverflows = measureTextWidth(head, fs, { role: "body" }) > lineWidth * 1.04;
  if (!head || head.includes("\n") || !headOverflows) return null;
  return { initial, capSize, capTop, capWidth, head, tail };
}
