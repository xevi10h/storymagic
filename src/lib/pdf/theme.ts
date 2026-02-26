/**
 * PDF Book Theme System
 *
 * Dimensions follow Gelato print specs:
 * - Trim size: 210mm × 210mm (square children's book standard)
 * - Bleed: 3mm on all sides → total page: 216mm × 216mm
 * - Safe area: 15mm from trim edge (text/important elements)
 *
 * 1mm = 2.83465pt (PDF points)
 */

// ── Dimensions (in PDF points) ─────────────────────────────────────────────

const MM_TO_PT = 2.83465;

export const BOOK = {
  /** Page with bleed (216mm) */
  pageWidth: 216 * MM_TO_PT,
  pageHeight: 216 * MM_TO_PT,
  /** Trim size (210mm) */
  trimWidth: 210 * MM_TO_PT,
  trimHeight: 210 * MM_TO_PT,
  /** Bleed area */
  bleed: 3 * MM_TO_PT,
  /** Safe margin from trim edge for text content */
  safeMargin: 15 * MM_TO_PT,
  /** Inner content margin (from page edge including bleed) */
  contentMargin: 18 * MM_TO_PT, // bleed(3) + safe(15)
} as const;

// ── Template Color Palettes ────────────────────────────────────────────────

export interface TemplateTheme {
  id: string;
  /** Primary gradient — used on cover and back */
  coverGradientStart: string;
  coverGradientEnd: string;
  /** Accent color for decorations, page numbers, scene titles */
  accent: string;
  /** Lighter accent for backgrounds and borders */
  accentLight: string;
  /** Warm tint for page backgrounds */
  pageTint: string;
  /** Scene title color */
  titleColor: string;
  /** Decorative element color */
  ornamentColor: string;
}

export const TEMPLATE_THEMES: Record<string, TemplateTheme> = {
  space: {
    id: "space",
    coverGradientStart: "#1a1a4e",
    coverGradientEnd: "#2d1b69",
    accent: "#6366f1",
    accentLight: "#e8eaf6",
    pageTint: "#f8f7ff",
    titleColor: "#312e81",
    ornamentColor: "#a5b4fc",
  },
  forest: {
    id: "forest",
    coverGradientStart: "#1a3a2a",
    coverGradientEnd: "#2d5016",
    accent: "#16a34a",
    accentLight: "#dcfce7",
    pageTint: "#f7fdf9",
    titleColor: "#14532d",
    ornamentColor: "#86efac",
  },
  superhero: {
    id: "superhero",
    coverGradientStart: "#7f1d1d",
    coverGradientEnd: "#991b1b",
    accent: "#dc2626",
    accentLight: "#fee2e2",
    pageTint: "#fef7f7",
    titleColor: "#7f1d1d",
    ornamentColor: "#fca5a5",
  },
  pirates: {
    id: "pirates",
    coverGradientStart: "#0c2d48",
    coverGradientEnd: "#0e4d64",
    accent: "#0284c7",
    accentLight: "#e0f2fe",
    pageTint: "#f6fbff",
    titleColor: "#0c4a6e",
    ornamentColor: "#7dd3fc",
  },
  chef: {
    id: "chef",
    coverGradientStart: "#7c2d12",
    coverGradientEnd: "#9a3412",
    accent: "#ea580c",
    accentLight: "#fff7ed",
    pageTint: "#fffbf5",
    titleColor: "#7c2d12",
    ornamentColor: "#fdba74",
  },
};

export function getTheme(templateId: string): TemplateTheme {
  return TEMPLATE_THEMES[templateId] ?? TEMPLATE_THEMES.forest;
}

// ── Typography ─────────────────────────────────────────────────────────────

export const FONTS = {
  display: "Fredoka",
  body: "PlusJakartaSans",
} as const;

export const TYPE = {
  coverTitle: { fontFamily: FONTS.display, fontSize: 32, fontWeight: 600 as const, color: "#ffffff", lineHeight: 1.2 },
  coverSubtitle: { fontFamily: FONTS.body, fontSize: 13, color: "#ffffffcc", lineHeight: 1.4 },
  coverBrand: { fontFamily: FONTS.display, fontSize: 10, color: "#ffffff88", letterSpacing: 3 },
  dedicationText: { fontFamily: FONTS.body, fontSize: 14, color: "#5D4037", lineHeight: 1.8, fontStyle: "italic" as const },
  dedicationSender: { fontFamily: FONTS.body, fontSize: 11, color: "#8D6E63", lineHeight: 1.6 },
  sceneTitle: { fontFamily: FONTS.display, fontSize: 18, fontWeight: 600 as const, lineHeight: 1.3 },
  sceneText: { fontFamily: FONTS.body, fontSize: 12, color: "#4a3b32", lineHeight: 1.8 },
  pageNumber: { fontFamily: FONTS.body, fontSize: 8, color: "#A1887F" },
  finalMessage: { fontFamily: FONTS.display, fontSize: 16, fontWeight: 600 as const, color: "#5D4037", lineHeight: 1.5 },
  backText: { fontFamily: FONTS.body, fontSize: 11, color: "#ffffffbb", lineHeight: 1.5 },
} as const;

// ── Shared colors ──────────────────────────────────────────────────────────

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
