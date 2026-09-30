/**
 * Print text helpers: glyph-safe normalisation and measured text fitting.
 *
 * Fitting uses the real font metrics (same fontkit faces react-pdf renders
 * with) and a greedy line breaker with a safety margin, so the template can
 * pick a font size that is guaranteed to fit a fixed box — text is never
 * truncated and can never overflow into an extra page.
 */

import { findMissingGlyphs, measureTextWidth, type FontVariant } from "./fonts";

import { KEPT_SYMBOLS, PICTOGRAPHIC, sanitizePrintText } from "@/lib/book/print-text";

// Pure text helpers live in src/lib/book/print-text.ts (shared with the web viewer).
export { joinName, printQuotes, sanitizePrintText } from "@/lib/book/print-text";

/** Returns the characters sanitizePrintText would drop plus glyphs no embedded font has. */
export function unprintableCharacters(input: string, variant: FontVariant): string[] {
  const clean = sanitizePrintText(input);
  const dropped = Array.from(input.normalize("NFC")).filter(
    (ch) => PICTOGRAPHIC.test(ch) && !KEPT_SYMBOLS.has(ch),
  );
  return [...new Set([...dropped, ...findMissingGlyphs(clean, variant)])];
}

// ── Line measurement ─────────────────────────────────────────────────────

/** react-pdf breaks lines slightly differently than a greedy breaker — keep a margin. */
const WIDTH_SAFETY = 0.95;

/** Number of lines `text` occupies in a box `width` pt wide. */
export function countLines(text: string, fontSize: number, width: number, variant: FontVariant): number {
  const usable = width * WIDTH_SAFETY;
  const spaceW = measureTextWidth(" ", fontSize, variant);
  let lines = 0;
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(" ").filter(Boolean);
    if (words.length === 0) {
      lines += 1; // blank line between paragraphs
      continue;
    }
    let lineW = 0;
    lines += 1;
    for (const word of words) {
      const w = measureTextWidth(word, fontSize, variant);
      if (lineW === 0) {
        // A single word wider than the box still takes (at least) its own line(s)
        lineW = w;
        if (w > usable) lines += Math.ceil(w / usable) - 1;
      } else if (lineW + spaceW + w <= usable) {
        lineW += spaceW + w;
      } else {
        lines += 1;
        lineW = w;
      }
    }
  }
  return lines;
}

export interface FitOptions {
  text: string;
  variant: FontVariant;
  width: number;
  height: number;
  /** Preferred (largest) font size, pt */
  maxSize: number;
  /** Smallest acceptable font size, pt */
  minSize: number;
  /** Preferred line-height multiplier */
  leading: number;
  /** Tightest acceptable line-height multiplier */
  minLeading?: number;
}

export interface FitResult {
  fontSize: number;
  leading: number;
  lines: number;
  /** Height the text block will occupy, pt */
  height: number;
  fits: boolean;
}

/**
 * Largest font size (0.25 pt steps) whose wrapped text fits width × height.
 * Leading is tightened proportionally as the size shrinks, never below minLeading.
 * If nothing fits, returns the minimum setting with fits=false (caller must treat as an error).
 */
export function fitText(opts: FitOptions): FitResult {
  const minLeading = opts.minLeading ?? Math.min(opts.leading, 1.4);
  const span = Math.max(opts.maxSize - opts.minSize, 0.0001);
  let last: FitResult | null = null;
  for (let size = opts.maxSize; size >= opts.minSize - 1e-6; size -= 0.25) {
    const t = (opts.maxSize - size) / span; // 0 at max size → 1 at min size
    // Floor to 2 decimals so the rendered leading is never larger than the measured one
    const leading = Math.floor((opts.leading - (opts.leading - minLeading) * t) * 100) / 100;
    const lines = countLines(opts.text, size, opts.width, opts.variant);
    const height = lines * size * leading;
    last = { fontSize: size, leading, lines, height, fits: height <= opts.height };
    if (last.fits) return last;
  }
  return last ?? { fontSize: opts.minSize, leading: minLeading, lines: 0, height: 0, fits: false };
}

/**
 * Splits `text` after its first `lineCount` visual lines at `width`, with the same greedy
 * breaker (and safety margin) as countLines — so the head is guaranteed to fit in that many
 * lines when react-pdf renders it. A blank line between paragraphs counts as one line.
 * Used to set text beside a drop cap; the tail continues at full width.
 */
export function splitLeadingLines(
  text: string,
  lineCount: number,
  fontSize: number,
  width: number,
  variant: FontVariant,
): { head: string; tail: string } {
  const usable = width * WIDTH_SAFETY;
  const spaceW = measureTextWidth(" ", fontSize, variant);
  const paragraphs = text.split("\n");
  const head: string[] = [];
  let used = 0;
  for (let p = 0; p < paragraphs.length; p++) {
    if (used >= lineCount) return { head: head.join("\n"), tail: paragraphs.slice(p).join("\n") };
    const words = paragraphs[p].split(" ").filter(Boolean);
    if (words.length === 0) {
      head.push("");
      used += 1;
      continue;
    }
    let lineW = 0;
    let taken = 0;
    used += 1;
    for (const word of words) {
      const w = measureTextWidth(word, fontSize, variant);
      if (lineW === 0 || lineW + spaceW + w <= usable) {
        lineW = lineW === 0 ? w : lineW + spaceW + w;
      } else if (used < lineCount) {
        used += 1;
        lineW = w;
      } else {
        break;
      }
      taken += 1;
    }
    head.push(words.slice(0, taken).join(" "));
    if (taken < words.length) {
      return { head: head.join("\n"), tail: [words.slice(taken).join(" "), ...paragraphs.slice(p + 1)].join("\n") };
    }
  }
  return { head: head.join("\n"), tail: "" };
}
