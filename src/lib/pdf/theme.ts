/**
 * PDF Book Theme System
 *
 * Dimensions follow Gelato print specs for 20×20cm / 8×8" square photo book:
 * - Trim size: 200mm × 200mm
 * - Bleed: 4mm on all sides → total page: 208mm × 208mm  ← Gelato requires 4mm
 * - Safe area: 15mm from trim edge (text/important elements)
 * - Inner page 1 is a RIGHT-hand page (Gelato adds a blank endpaper before it) — see layout.ts
 *
 * 1mm = 2.83465pt (PDF points)
 */

import { getBookColors } from "@/lib/template-colors";
import { FONT_FAMILY } from "./fonts";

// ── Dimensions (in PDF points) — pure spec shared with the web viewer ─────

export { BOOK, COLORS, getPdfTextConfig, type PdfTextConfig } from "@/lib/book/print-spec";

// ── Book palette ───────────────────────────────────────────────────────────

export interface TemplateTheme {
  id: string;
  /** Deep tones — cover / back cover grounds, QR code */
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

/**
 * PDF theme of a book. The child's favourite colour leads the whole palette
 * (src/lib/template-colors.ts); no favourite colour → neutral warm palette.
 * templateId / gender are kept for call-site compatibility only.
 */
export function getTheme(templateId: string, gender?: string, favoriteColor?: string): TemplateTheme {
  const colors = getBookColors(templateId, gender, favoriteColor);
  return {
    id: templateId,
    accent: colors.accent,
    accentLight: colors.accentLight,
    titleColor: colors.titleColor,
    ornamentColor: colors.ornamentColor,
    pageTint: colors.pageTint,
    coverGradientStart: colors.gradientStart,
    coverGradientEnd: colors.gradientEnd,
  };
}

// ── Typography ─────────────────────────────────────────────────────────────

// Font stacks (per-glyph fallback) — see fonts.ts. Never set fontStyle "italic" on display.
export const FONTS = {
  display: [FONT_FAMILY.display, FONT_FAMILY.body, FONT_FAMILY.symbols],
  body: [FONT_FAMILY.body, FONT_FAMILY.symbols],
};

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

// ── Age-adaptive text sizing: getPdfTextConfig (src/lib/book/print-spec.ts) ──
// Body sizes raised 2026-09-28 (owner decision). The Book Plan word budgets (getPlanSpec in
// src/lib/ai/book-plan.ts) are calibrated against those sizes — change both together.
