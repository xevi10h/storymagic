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
  /**
   * Decorative page frame, from the page edge: 6 mm inside trim, so the ±1 mm
   * trimming tolerance can never cut it or make it visibly uneven.
   */
  frameInset: (4 + 6) * MM_TO_PT,
  /**
   * Folios, from the page edge: 10 mm inside trim —
   * inside the frame, clear of trim variance, below the 15 mm text safe area.
   */
  folioInset: (4 + 10) * MM_TO_PT,
} as const;

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

// ── Age-adaptive text sizing ──────────────────────────────────────────────
// Younger children → fewer words → larger text to fill the page nicely.
// Older children → more words → smaller text so everything fits.
// Body sizes raised 2026-09-28 (owner decision). Leading multipliers step down
// slightly as the size grows (larger type needs relatively less air; the absolute
// line pitch still grows). The Book Plan word budgets (getPlanSpec in
// src/lib/ai/book-plan.ts) are calibrated against these sizes — change both together.

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
