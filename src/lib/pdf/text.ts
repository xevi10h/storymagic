/**
 * Print text helpers: glyph-safe normalisation and measured text fitting.
 *
 * Fitting uses the real font metrics (same fontkit faces react-pdf renders
 * with) and a greedy line breaker with a safety margin, so the template can
 * pick a font size that is guaranteed to fit a fixed box — text is never
 * truncated and can never overflow into an extra page.
 */

import { findMissingGlyphs, measureTextWidth, type FontVariant } from "./fonts";

// Emoji and pictographs we cannot print (no colour-emoji font is embedded).
// Symbols covered by the embedded Noto Sans Symbols 2 subset are kept.
const KEPT_SYMBOLS = new Set(["♥", "♡", "★", "☆", "❤", "✿", "☀", "☁", "✓", "✶", "❀"]);
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
// Variation selectors, ZWJ, skin-tone modifiers, keycap combiner, tag chars
const INVISIBLE_MODIFIERS = /[︎️‍⃣]|[\u{1F3FB}-\u{1F3FF}]|[\u{E0020}-\u{E007F}]/gu;

/**
 * Normalises text for print without changing its meaning:
 * - NFC composition (é typed as e + ◌́ becomes é)
 * - ŀ/Ŀ (U+0140/U+013F) → l·/L· (their canonical compatibility form)
 * - emoji are dropped (they would print as blank boxes); kept: ♥ ★ ✿ …
 * - collapses the whitespace left behind, preserves paragraph breaks
 */
export function sanitizePrintText(input: string): string {
  let text = input.normalize("NFC").replace(/ŀ/g, "l·").replace(/Ŀ/g, "L·");
  text = text.replace(INVISIBLE_MODIFIERS, "");
  text = Array.from(text)
    .filter((ch) => KEPT_SYMBOLS.has(ch) || !PICTOGRAPHIC.test(ch))
    .join("");
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

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
