/**
 * Book colour palette — shared by the web viewer (CSS custom properties) and the
 * print PDF (getTheme in src/lib/pdf/theme.ts).
 *
 * The child's favourite colour (asked on the Protagonist screen, stored in
 * characters.favorite_color) LEADS the whole palette: accents, titles, ornaments,
 * text-page tints, endpapers and the deep cover/back-cover tone. Each colour of
 * FAVORITE_COLORS has a hand-tuned, print-safe palette (muted, never neon) whose
 * text roles pass WCAG contrast on the book's cream paper:
 *   - titleColor on cream ≥ 7:1 (AAA) — scene titles, the hero page name
 *   - accent on white, cream and accentLight ≥ 4.5:1 — small caps kickers, pills,
 *     the white "hero" badge, drop caps
 * Light grounds (accentLight, pageTint) are drawn toward the warm paper, not toward
 * pure white, so a red book reads terracotta/peach rather than pink.
 *
 * No favourite colour (optional question skipped, older books) → a neutral warm
 * palette (caramel + cocoa). The world (templateId) and gender no longer tint the
 * book: every child gets the same deliberate treatment of THEIR colour.
 */

import { FAVORITE_COLORS } from "./create-store";

export interface BookColors {
  /** Primary accent (badges, drop caps, rules, kickers) */
  accent: string;
  /** Light accent for backgrounds (tinted text pages, pills) */
  accentLight: string;
  /** Title text color */
  titleColor: string;
  /** Decorative ornament color (frames, dividers, dots) */
  ornamentColor: string;
  /** Subtle page background tint */
  pageTint: string;
  /** Deep tone for cover / back cover grounds and the QR code */
  gradientStart: string;
  /** Secondary deep tone */
  gradientEnd: string;
}

type FavoriteColorId = (typeof FAVORITE_COLORS)[number]["id"];

/** Hand-tuned palettes, one per FAVORITE_COLORS entry. */
const FAVORITE_PALETTES: Record<FavoriteColorId, BookColors> = {
  red: {
    accent: "#B23A2E",
    accentLight: "#F5E8DC",
    titleColor: "#6B1F17",
    ornamentColor: "#D4705A",
    pageTint: "#FCF6EF",
    gradientStart: "#5C1A13",
    gradientEnd: "#8A2B1F",
  },
  blue: {
    accent: "#2F62AA",
    accentLight: "#E3EBF6",
    titleColor: "#1B3663",
    ornamentColor: "#93B3DD",
    pageTint: "#F5F8FC",
    gradientStart: "#172D55",
    gradientEnd: "#244A86",
  },
  green: {
    accent: "#3A7442",
    accentLight: "#E3EEDF",
    titleColor: "#1E4426",
    ornamentColor: "#9BC49C",
    pageTint: "#F5F9F2",
    gradientStart: "#1B3A22",
    gradientEnd: "#2C5A34",
  },
  purple: {
    accent: "#7A3F9C",
    accentLight: "#EEE5F3",
    titleColor: "#3E1F56",
    ornamentColor: "#C0A0D5",
    pageTint: "#FAF6FB",
    gradientStart: "#301947",
    gradientEnd: "#522E78",
  },
  orange: {
    accent: "#A94C0C",
    accentLight: "#FAE8D6",
    titleColor: "#662D08",
    ornamentColor: "#EFAE76",
    pageTint: "#FEF6EE",
    gradientStart: "#652B0B",
    gradientEnd: "#944413",
  },
  yellow: {
    accent: "#8C6400",
    accentLight: "#F9EECB",
    titleColor: "#533B00",
    ornamentColor: "#E8C35A",
    pageTint: "#FEFAEC",
    gradientStart: "#4F3A05",
    gradientEnd: "#7D5C0B",
  },
  pink: {
    accent: "#B03466",
    accentLight: "#F7E3EA",
    titleColor: "#661D3B",
    ornamentColor: "#E9A0BB",
    pageTint: "#FDF5F7",
    gradientStart: "#5A1833",
    gradientEnd: "#882B52",
  },
  turquoise: {
    accent: "#0E7480",
    accentLight: "#DDEFF0",
    titleColor: "#0C474E",
    ornamentColor: "#86C9CE",
    pageTint: "#F3F9F9",
    gradientStart: "#0B3C42",
    gradientEnd: "#13626C",
  },
};

/** No favourite colour: warm caramel + cocoa on cream (neutral, never pink). */
export const NEUTRAL_BOOK_COLORS: BookColors = {
  accent: "#93552A",
  accentLight: "#F4E9DC",
  titleColor: "#5D4037",
  ornamentColor: "#D6BA9E",
  pageTint: "#FDF7F0",
  gradientStart: "#4E342E",
  gradientEnd: "#6D4C41",
};

// ── Colour maths (only for hex values outside FAVORITE_COLORS) ───────────────

const HEX_RE = /^#[0-9a-f]{6}$/i;
const PAPER = "#FDF8F0"; // COLORS.cream of the print theme
const INK = "#1A1008";

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Solid mix of two #rrggbb colours (t = 0 → a, 1 → b). */
function mix(a: string, b: string, t: number): string {
  const [x, y] = [hexToRgb(a), hexToRgb(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

function luminance(hex: string): number {
  return hexToRgb(hex)
    .map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
}

/** WCAG 2 contrast ratio between two #rrggbb colours. */
export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Darken `hex` toward ink until it reaches `ratio` against `ground`. */
function darkenTo(hex: string, ground: string, ratio: number): string {
  for (let t = 0; t <= 1; t += 0.02) {
    const c = mix(hex, INK, t);
    if (contrastRatio(c, ground) >= ratio) return c;
  }
  return INK;
}

/** Palette for an arbitrary hex (legacy/custom values): same roles and contrast floors. */
function derivePalette(hex: string): BookColors {
  const accentLight = mix(PAPER, hex, 0.13);
  return {
    accent: darkenTo(hex, accentLight, 4.6),
    accentLight,
    titleColor: darkenTo(mix(hex, INK, 0.45), PAPER, 7.5),
    ornamentColor: mix(PAPER, hex, 0.5),
    pageTint: mix(PAPER, hex, 0.04),
    gradientStart: mix(hex, INK, 0.62),
    gradientEnd: mix(hex, INK, 0.42),
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Palette for a stored favourite colour (hex, any case), or the neutral palette. */
export function paletteForFavoriteColor(favoriteColor?: string | null): BookColors {
  const hex = favoriteColor?.trim();
  if (!hex || !HEX_RE.test(hex)) return NEUTRAL_BOOK_COLORS;
  const known = FAVORITE_COLORS.find((c) => c.color.toLowerCase() === hex.toLowerCase());
  return known ? FAVORITE_PALETTES[known.id] : derivePalette(hex);
}

/**
 * Book colours. `templateId` and `gender` are accepted for call-site compatibility
 * but deliberately ignored: the favourite colour leads (see the header comment).
 */
export function getBookColors(_templateId?: string, _gender?: string, favoriteColor?: string | null): BookColors {
  return paletteForFavoriteColor(favoriteColor);
}
