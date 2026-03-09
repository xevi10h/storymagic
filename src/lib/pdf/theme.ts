/**
 * PDF Book Theme System
 *
 * Dimensions follow Gelato print specs for 20×20cm / 8×8" square photo book:
 * - Trim size: 200mm × 200mm
 * - Bleed: 4mm on all sides → total page: 208mm × 208mm  ← Gelato requires 4mm
 * - Safe area: 15mm from trim edge (text/important elements)
 *
 * 1mm = 2.83465pt (PDF points)
 */

import { applyGenderTint } from "@/lib/template-colors";

// ── Dimensions (in PDF points) ─────────────────────────────────────────────

const MM_TO_PT = 2.83465;

export const BOOK = {
  /** Page with bleed (208mm) */
  pageWidth: 208 * MM_TO_PT,
  pageHeight: 208 * MM_TO_PT,
  /** Trim size (200mm) */
  trimWidth: 200 * MM_TO_PT,
  trimHeight: 200 * MM_TO_PT,
  /** Bleed area — Gelato requires 4mm */
  bleed: 4 * MM_TO_PT,
  /** Safe margin from trim edge for text content */
  safeMargin: 15 * MM_TO_PT,
  /** Inner content margin (from page edge including bleed) */
  contentMargin: 19 * MM_TO_PT, // bleed(4) + safe(15)
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
  dinosaurs: {
    id: "dinosaurs",
    coverGradientStart: "#1b4332",
    coverGradientEnd: "#2d6a4f",
    accent: "#40916c",
    accentLight: "#d8f3dc",
    pageTint: "#f6fdf8",
    titleColor: "#1b4332",
    ornamentColor: "#95d5b2",
  },
  castle: {
    id: "castle",
    coverGradientStart: "#2e1065",
    coverGradientEnd: "#4c1d95",
    accent: "#7c3aed",
    accentLight: "#ede9fe",
    pageTint: "#faf5ff",
    titleColor: "#3b0764",
    ornamentColor: "#c4b5fd",
  },
  safari: {
    id: "safari",
    coverGradientStart: "#7c2d12",
    coverGradientEnd: "#b45309",
    accent: "#d97706",
    accentLight: "#fef3c7",
    pageTint: "#fffbeb",
    titleColor: "#78350f",
    ornamentColor: "#fcd34d",
  },
  inventor: {
    id: "inventor",
    coverGradientStart: "#0c4a6e",
    coverGradientEnd: "#075985",
    accent: "#0284c7",
    accentLight: "#e0f2fe",
    pageTint: "#f0f9ff",
    titleColor: "#0c4a6e",
    ornamentColor: "#7dd3fc",
  },
  candy: {
    id: "candy",
    coverGradientStart: "#831843",
    coverGradientEnd: "#9d174d",
    accent: "#db2777",
    accentLight: "#fce7f3",
    pageTint: "#fdf2f8",
    titleColor: "#831843",
    ornamentColor: "#f9a8d4",
  },
};

/**
 * Get the PDF theme for a template, optionally tinted by character gender.
 * Girl → warm rose shift, boy → cool blue shift, neutral → unchanged.
 */
export function getTheme(templateId: string, gender?: string): TemplateTheme {
  const base = TEMPLATE_THEMES[templateId] ?? TEMPLATE_THEMES.forest;
  if (!gender || gender === "neutral") return base;

  const tinted = applyGenderTint(
    {
      accent: base.accent,
      accentLight: base.accentLight,
      titleColor: base.titleColor,
      ornamentColor: base.ornamentColor,
      pageTint: base.pageTint,
      gradientStart: base.coverGradientStart,
      gradientEnd: base.coverGradientEnd,
    },
    gender,
  );

  return {
    ...base,
    accent: tinted.accent,
    accentLight: tinted.accentLight,
    titleColor: tinted.titleColor,
    ornamentColor: tinted.ornamentColor,
    pageTint: tinted.pageTint,
    coverGradientStart: tinted.gradientStart,
    coverGradientEnd: tinted.gradientEnd,
  };
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

// ── Age-adaptive text sizing ──────────────────────────────────────────────
// Younger children → fewer words → larger text to fill the page nicely.
// Older children → more words → smaller text so everything fits.

export interface PdfTextConfig {
  /** Scene body text font size (pt) */
  body: number;
  /** Scene body line height multiplier */
  bodyLeading: number;
  /** Scene title font size (pt) */
  title: number;
  /** Drop cap font size for ventana spread (pt) */
  dropCap: number;
  /** Bridge (puente) display text size (pt) */
  bridgeText: number;
}

export function getPdfTextConfig(age: number): PdfTextConfig {
  if (age <= 4) {
    // 50-80 words/scene → large, spacious text
    return { body: 15, bodyLeading: 2.0, title: 22, dropCap: 36, bridgeText: 28 };
  }
  if (age <= 7) {
    // 100-140 words/scene → medium
    return { body: 12.5, bodyLeading: 1.85, title: 20, dropCap: 32, bridgeText: 24 };
  }
  // 150-200 words/scene → compact
  return { body: 10.5, bodyLeading: 1.7, title: 18, dropCap: 28, bridgeText: 22 };
}

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
