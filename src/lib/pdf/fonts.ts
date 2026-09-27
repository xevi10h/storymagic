/**
 * PDF font registration — fonts are embedded (base64) so rendering never
 * depends on the network or on files outside the serverless bundle.
 *
 * Every family is used through a fallback STACK (react-pdf picks, per glyph,
 * the first font in the stack that has it):
 *   display: Fredoka → Plus Jakarta Sans (covers ŀ/Ŀ, which Fredoka lacks) → symbols
 *   body:    Plus Jakarta Sans → symbols (♥ ★ ✿ …, which Jakarta lacks)
 */

import { Font } from "@react-pdf/renderer";
import {
  FREDOKA_400,
  FREDOKA_600,
  JAKARTA_400,
  JAKARTA_400_ITALIC,
  JAKARTA_600,
  JAKARTA_700,
  SYMBOLS_400,
} from "./fonts/font-data";

export const FONT_FAMILY = {
  display: "Fredoka",
  body: "PlusJakartaSans",
  symbols: "NotoSansSymbols2",
} as const;

let registered = false;

export function registerPdfFonts(): void {
  if (registered) return;
  registered = true;

  Font.register({
    family: FONT_FAMILY.display,
    fonts: [
      { src: FREDOKA_400, fontWeight: 400 },
      { src: FREDOKA_600, fontWeight: 600 },
    ],
  });
  Font.register({
    family: FONT_FAMILY.body,
    fonts: [
      { src: JAKARTA_400, fontWeight: 400 },
      { src: JAKARTA_400_ITALIC, fontWeight: 400, fontStyle: "italic" },
      { src: JAKARTA_600, fontWeight: 600 },
      { src: JAKARTA_700, fontWeight: 700 },
    ],
  });
  Font.register({
    family: FONT_FAMILY.symbols,
    fonts: [
      { src: SYMBOLS_400, fontWeight: 400 },
      // Same file for every weight/style so the fallback resolves for bold/italic runs too
      { src: SYMBOLS_400, fontWeight: 600 },
      { src: SYMBOLS_400, fontWeight: 700 },
      { src: SYMBOLS_400, fontWeight: 400, fontStyle: "italic" },
    ],
  });

  // Never hyphenate children's text
  Font.registerHyphenationCallback((word) => [word]);
}

registerPdfFonts();

// ── Measurement (uses the same fontkit instances react-pdf renders with) ──

/** Minimal slice of the fontkit Font API we rely on. */
interface MeasurableFont {
  unitsPerEm: number;
  hasGlyphForCodePoint(codePoint: number): boolean;
  layout(text: string): { advanceWidth: number };
}

export type FontRole = "display" | "body";

export interface FontVariant {
  role: FontRole;
  weight?: 400 | 600 | 700;
  italic?: boolean;
}

const STACKS: Record<FontRole, string[]> = {
  display: [FONT_FAMILY.display, FONT_FAMILY.body, FONT_FAMILY.symbols],
  body: [FONT_FAMILY.body, FONT_FAMILY.symbols],
};

function descriptorsFor(v: FontVariant) {
  return STACKS[v.role].map((family) => ({
    fontFamily: family,
    fontWeight: family === FONT_FAMILY.display ? Math.min(v.weight ?? 400, 600) : (v.weight ?? 400),
    fontStyle: v.italic && family !== FONT_FAMILY.display ? ("italic" as const) : ("normal" as const),
  }));
}

/** Loads every font face we render with. Must be awaited before measuring. */
export async function ensurePdfFontsLoaded(): Promise<void> {
  registerPdfFonts();
  const variants: FontVariant[] = [
    { role: "display", weight: 400 },
    { role: "display", weight: 600 },
    { role: "body", weight: 400 },
    { role: "body", weight: 400, italic: true },
    { role: "body", weight: 600 },
    { role: "body", weight: 700 },
  ];
  await Promise.all(variants.flatMap((v) => descriptorsFor(v).map((d) => Font.load(d))));
}

function loadedStack(v: FontVariant): MeasurableFont[] {
  return descriptorsFor(v).map((d) => {
    const data = Font.getFont(d).data as unknown as MeasurableFont | null;
    if (!data) throw new Error(`[PDF fonts] ${d.fontFamily} not loaded — call ensurePdfFontsLoaded() first`);
    return data;
  });
}

/** Width (pt) of a single-line string at a font size, honouring the fallback stack. */
export function measureTextWidth(text: string, fontSize: number, variant: FontVariant): number {
  const stack = loadedStack(variant);
  let width = 0;
  let run = "";
  let runFont: MeasurableFont | null = null;
  const flush = () => {
    if (runFont && run) width += (runFont.layout(run).advanceWidth / runFont.unitsPerEm) * fontSize;
    run = "";
  };
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    const font = stack.find((f) => f.hasGlyphForCodePoint(cp)) ?? stack[0];
    if (font !== runFont) {
      flush();
      runFont = font;
    }
    run += ch;
  }
  flush();
  return width;
}

/** Characters that no font in the stack can draw (would print as blank boxes). */
export function findMissingGlyphs(text: string, variant: FontVariant): string[] {
  const stack = loadedStack(variant);
  const missing = new Set<string>();
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < 0x20 || ch === "\n") continue;
    if (!stack.some((f) => f.hasGlyphForCodePoint(cp))) missing.add(ch);
  }
  return [...missing];
}
