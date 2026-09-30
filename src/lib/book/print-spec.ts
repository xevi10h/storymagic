/**
 * Printed-book specification — pure numbers and types shared by the PDF renderer
 * (src/lib/pdf/*) and the web book viewer (src/components/book-viewer/*).
 *
 * Nothing here touches fonts or @react-pdf, so the browser can import it: the web viewer
 * draws every page in the same point geometry the PDF uses (BookPrintPage), which is what
 * keeps "what we show" and "what we print" identical.
 *
 * Gelato 20×20 cm square photobook: 200 mm trim + 4 mm bleed on every side.
 */

// ── Units ─────────────────────────────────────────────────────────────────

/** Exact mm → pt (72 / 25.4). Page geometry that must line up across a fold uses this one. */
export const MM_TO_PT = 72 / 25.4;
/** Historical rounded factor the BOOK dimensions were defined with — kept so print output does not move. */
const BOOK_MM_TO_PT = 2.83465;

export const BOOK = {
  /** Page with bleed (208mm) */
  pageWidth: 208 * BOOK_MM_TO_PT,
  pageHeight: 208 * BOOK_MM_TO_PT,
  /** Trim size (200mm) */
  trimWidth: 200 * BOOK_MM_TO_PT,
  trimHeight: 200 * BOOK_MM_TO_PT,
  /** Bleed area — Gelato requires 4mm */
  bleed: 4 * BOOK_MM_TO_PT,
  /** Safe margin from trim edge for text content */
  safeMargin: 15 * BOOK_MM_TO_PT,
  /** Inner content margin (from page edge including bleed) */
  contentMargin: 19 * BOOK_MM_TO_PT, // bleed(4) + safe(15)
  /**
   * Decorative page frame, from the page edge: 6 mm inside trim, so the ±1 mm
   * trimming tolerance can never cut it or make it visibly uneven.
   */
  frameInset: (4 + 6) * BOOK_MM_TO_PT,
  /**
   * Folios, from the page edge: 10 mm inside trim —
   * inside the frame, clear of trim variance, below the 15 mm text safe area.
   */
  folioInset: (4 + 10) * BOOK_MM_TO_PT,
} as const;

// ── Shared colours ────────────────────────────────────────────────────────

export const COLORS = {
  cream: "#FDF8F0",
  paper: "#FFFCF7",
  warmWhite: "#FFF9F2",
  textDark: "#2C1810",
  textMedium: "#5D4037",
  textMuted: "#A1887F",
  textLight: "#D7CCC8",
  gold: "#D4AF37",
  goldLight: "#F0E6C0",
  border: "#E6C9A8",
} as const;

/** Ink of body text on the back cover (TYPE.sceneText.color). */
export const SCENE_TEXT_INK = "#4a3b32";

// ── Age-adaptive type (see src/lib/pdf/theme.ts for the history) ─────────

export interface PdfTextConfig {
  /** Scene body text font size (pt) — the size every body page should print at */
  body: number;
  /** Scene body line height multiplier */
  bodyLeading: number;
  /** Scene title font size (pt) */
  title: number;
  /** Drop cap font size for ventana spread (pt) */
  dropCap: number;
  /** Bridge (puente) display text size (pt) */
  bridgeText: number;
  /**
   * Growth ceiling for short read-aloud texts (layout.ts growBodyType): the whole book's
   * body grows toward `bodyMax` (leading easing toward `bodyMaxLeading`, scene titles toward
   * `titleMax`, bridges toward `bridgeMax`) as far as its LONGEST page allows. Equal to the
   * band sizes where no growth is wanted (7+).
   */
  bodyMax: number;
  bodyMaxLeading: number;
  titleMax: number;
  bridgeMax: number;
}

export function getPdfTextConfig(age: number): PdfTextConfig {
  if (age <= 4) {
    // read-aloud refrain book → large, spacious text
    return { body: 17, bodyLeading: 1.85, title: 24, dropCap: 40, bridgeText: 30, bodyMax: 24, bodyMaxLeading: 1.6, titleMax: 31, bridgeMax: 36 };
  }
  if (age <= 6) {
    // picture book → medium-large, still easy to read
    return { body: 15.5, bodyLeading: 1.8, title: 23, dropCap: 38, bridgeText: 28, bodyMax: 19, bodyMaxLeading: 1.65, titleMax: 26, bridgeMax: 31 };
  }
  if (age <= 9) {
    // first chapter-book readers → medium
    return { body: 13, bodyLeading: 1.7, title: 21, dropCap: 34, bridgeText: 25, bodyMax: 13, bodyMaxLeading: 1.7, titleMax: 21, bridgeMax: 25 };
  }
  // confident readers → compact
  return { body: 11.5, bodyLeading: 1.65, title: 19, dropCap: 31, bridgeText: 23, bodyMax: 11.5, bodyMaxLeading: 1.65, titleMax: 19, bridgeMax: 23 };
}

// ── Interior geometry (pt, origin = the bleed page's top-left corner) ────

const W = BOOK.pageWidth;
const H = BOOK.pageHeight;
const M = BOOK.contentMargin; // 19 mm from page edge = 15 mm inside trim

export const GEOMETRY = {
  pageWidth: W,
  pageHeight: H,
  margin: M,
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

export const PANEL_PADDING = 16;
export const ILL_TEXT_WIDTH = 460;

/** Panel metrics of the adventure-map game — shared by the planner (fitting) and both renderers. */
export const MAP_PANEL = {
  padding: 16,
  kicker: 6.5,
  kickerGap: 6,
  titleGap: 8,
  /** "How to play" line under the title (every band) */
  howTo: { size: 8.5, leading: 1.35, gap: 8 },
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

// ── Page-plan value types ────────────────────────────────────────────────

export interface FittedType {
  fontSize: number;
  leading: number;
}

/**
 * Title/dedication page (p1) and "The End" page (p26) scale with the book's body type, so a
 * 21.5 pt read-aloud book does not open on 11 pt small print. `scale` multiplies ornaments and
 * gaps; the other fields are the small lines' sizes (pt).
 */
export interface FrontMatterType {
  scale: number;
  /** p1 "A personalised adventure for" · p26 "A story created especially for" */
  kicker: number;
  /** p1 child's name · p26 "The End" */
  display: number;
  sender: number;
  logo: number;
}

export type MapGameBand = "little" | "middle" | "big";

export interface MapPanel {
  band: MapGameBand;
  kicker: string;
  title: string;
  /** One line telling the child how to play (count of things to find, how to mark them) */
  howTo: string;
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

// ── Covers ────────────────────────────────────────────────────────────────

/** One stacked line group of the front-cover title; `hero` is the child's name. */
export interface CoverTitleSegment {
  text: string;
  type: FittedType;
  hero: boolean;
}

/**
 * Front-cover title lockup, set at the top of the panel (Wonderbly / Hooray Heroes
 * hierarchy): when the title contains the child's name, the name gets its own
 * large line and the rest of the title sits above / below it at a smaller size.
 */
export interface CoverTitleLockup {
  segments: CoverTitleSegment[];
  /** Height of the stacked segments, pt */
  height: number;
  /** The title does not name the child: print "A personalised story for {name}" under it */
  showSubtitle: boolean;
}

export interface BackCoverLayout {
  titleType: FittedType;
  synopsisType: FittedType;
  /** Synopsis column width, pt */
  measure: number;
  /** Height budget of the arch vignette, pt (0: no room, printed without art) — see vignetteBox */
  vignette: number;
}

export const COVER_SUBTITLE = { fontSize: 11, leading: 1.3, gap: 8 };

/** Back-cover measurements, pt unless noted. The stack is sized so it always fits its column. */
export const BACK = {
  title: { max: 16, min: 11, leading: 1.2, minLeading: 1.15, maxLines: 2 },
  /** "Una historia personalizada para {name}" */
  forLine: { fontSize: 10, leading: 1.35, gap: 5 },
  /** Ornamental divider (OrnamentalDivider is 0.15 × its width tall) and the space around it */
  divider: { width: 60, gap: 10 },
  /** Synopsis in the body face, like the interior text */
  synopsis: { max: 12.5, min: 9.5, comfortableMin: 10.5, leading: 1.55, minLeading: 1.45 },
  /** Synopsis measure: ≤ 82 % of the column and ≤ 132 mm (~60 characters a line) */
  measureRatio: 0.82,
  measureMaxMm: 132,
  /** Arch vignette (image window with a round top) height budget, mm; its width follows the image */
  vignetteMaxMm: 70,
  vignetteMaxWidthMm: 80,
  /** Image aspect range shown whole; beyond it the window crops (cover-fit, centred) */
  aspectRange: [0.75, 1.6],
  vignetteComfortableMm: 44,
  vignetteMinMm: 28,
  /** Hairline frame drawn this far outside the vignette */
  ring: 5,
  vignetteGap: 14,
  /** Brand signature: logo + url, pinned to the bottom of the column */
  brand: { logo: 12, urlSize: 6.5, gapAboveMin: 16 },
  /** Absorbs rounding between the measured model and react-pdf's layout */
  slack: 6,
} as const;

/**
 * Arch vignette box for an image of `aspect` (w/h) within the fitted height budget: the window
 * takes the image's own proportions (clamped to BACK.aspectRange) so the whole scene shows.
 */
export function vignetteBoxFor(aspect: number | null, budget: number): { width: number; height: number } | null {
  if (budget <= 0) return null;
  const [lo, hi] = BACK.aspectRange;
  const a = aspect ? Math.min(hi, Math.max(lo, aspect)) : 1;
  const width = Math.min(budget * a, BACK.vignetteMaxWidthMm * MM_TO_PT);
  return { width, height: width / a };
}

/**
 * Splits the title around the child's name (whole word, case-insensitive). A possessive,
 * trailing punctuation, opening marks and an elided article stay on the name's line:
 * "Martina's", "Núria,", "¡Leo", "d’Émile".
 */
export function splitTitleOnName(title: string, name: string): { pre: string; hero: string; post: string } | null {
  const n = name.trim();
  if (!n) return null;
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${escaped}(?![\\p{L}\\p{M}\\p{N}])`, "iu").exec(title);
  if (!match) return null;
  let pre = title.slice(0, match.index);
  let post = title.slice(match.index + match[0].length);
  const tail = /^(?:['’]s)?[,;:!?.…»”"')]*/u.exec(post)?.[0] ?? "";
  post = post.slice(tail.length);
  const lead = /(?<!\p{L})(?:\p{L}{1,2}['’]|[¡¿«“"(]+)$/u.exec(pre)?.[0] ?? "";
  pre = pre.slice(0, pre.length - lead.length);
  return { pre: pre.trim(), hero: `${lead}${match[0]}${tail}`, post: post.trim() };
}

// ── Gradients (PDF: stretched 1×N PNGs; web: CSS linear-gradients) ────────

/** [position 0..1 from TOP, alpha 0..1] stops, linearly interpolated. */
export type GradientStops = [number, number][];

/** Matches the web viewer spread_right overlay (linear-gradient to top). */
export const TEXT_OVERLAY_STOPS: GradientStops = [
  [0, 0],
  [0.25, 0.15],
  [0.45, 0.45],
  [0.7, 0.7],
  [1, 0.82],
];
/** Softer fade for a title over artwork. */
export const TITLE_OVERLAY_STOPS: GradientStops = [
  [0, 0],
  [0.45, 0.35],
  [1, 0.75],
];
/**
 * Front cover scrim for the title at the TOP: drawn from the visible top edge down to
 * about half the panel, darkest behind the title and eased out to nothing (no hard edge),
 * so white type reads over a light wall as well as a busy sky.
 */
export const COVER_OVERLAY_STOPS: GradientStops = [
  [0, 0.62],
  [0.5, 0.52],
  [0.72, 0.26],
  [0.9, 0.06],
  [1, 0],
];
/** Portrait → cream fade on the keepsake page (colour set by caller). */
export const CREAM_FADE_STOPS: GradientStops = [
  [0, 0],
  [0.5, 0.35],
  [1, 0.95],
];


/** CSS `linear-gradient` (top → bottom) of a stop list, in `rgb` (default black). */
export function cssGradient(stops: GradientStops, rgb: [number, number, number] = [0, 0, 0]): string {
  return `linear-gradient(to bottom, ${stops.map(([pos, a]) => `rgba(${rgb.join(",")},${a}) ${(pos * 100).toFixed(1)}%`).join(", ")})`;
}

/** The cream of the keepsake-page fade (CREAM_FADE_STOPS). */
export const CREAM_FADE_RGB: [number, number, number] = [250, 248, 245];

/**
 * Bottom gradient height shared by BOTH halves of a panorama, so the darkening is identical on
 * each side of the fold (TEXT_OVERLAY_STOPS on both pages): body text occupies the bottom 55 %
 * of it, where it is ≥ 45 % black; the title needs half the page. `overlays` = both halves.
 */
export function spreadGradientHeight(overlays: { role: "title" | "body"; mode: "gradient" | "panel"; blockHeight: number }[]): number {
  let height = BOOK.pageHeight * 0.5;
  for (const o of overlays) {
    if (o.role === "body" && o.mode === "gradient") height = Math.max(height, (o.blockHeight + BOOK.contentMargin + 6) / 0.55);
  }
  return Math.min(BOOK.pageHeight, height);
}

/** Drop cap of a ventana text page, planned with font metrics (layout.ts planDropCap). */
export interface DropCapPlan {
  /** The initial, with any opening punctuation that travels with it ("¿Q", "«H") */
  initial: string;
  capSize: number;
  /** Offset from the top of the two-line box that puts the initial's baseline on line 2's */
  capTop: number;
  /** Width reserved beside the two lines */
  capWidth: number;
  /** The first two lines (set beside the initial) and the rest (full width) */
  head: string;
  tail: string;
}
