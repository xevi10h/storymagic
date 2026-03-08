/**
 * Shared template color palettes — used by both web viewer and PDF.
 *
 * Each book template has a coherent color identity derived from its theme
 * (space = indigo, forest = green, pirates = sky blue, etc.).
 * The web viewer uses these as CSS custom properties; the PDF uses them
 * via the extended TemplateTheme in theme.ts.
 */

export interface BookColors {
  /** Primary accent (badges, borders, interactive elements) */
  accent: string;
  /** Light accent for backgrounds */
  accentLight: string;
  /** Title text color */
  titleColor: string;
  /** Decorative ornament color */
  ornamentColor: string;
  /** Subtle page background tint */
  pageTint: string;
  /** Dark gradient for cover/endpapers */
  gradientStart: string;
  /** Secondary gradient color */
  gradientEnd: string;
}

const PALETTES: Record<string, BookColors> = {
  space: {
    accent: "#6366f1",
    accentLight: "#e8eaf6",
    titleColor: "#312e81",
    ornamentColor: "#a5b4fc",
    pageTint: "#f8f7ff",
    gradientStart: "#1a1a4e",
    gradientEnd: "#2d1b69",
  },
  forest: {
    accent: "#16a34a",
    accentLight: "#dcfce7",
    titleColor: "#14532d",
    ornamentColor: "#86efac",
    pageTint: "#f7fdf9",
    gradientStart: "#1a3a2a",
    gradientEnd: "#2d5016",
  },
  superhero: {
    accent: "#dc2626",
    accentLight: "#fee2e2",
    titleColor: "#7f1d1d",
    ornamentColor: "#fca5a5",
    pageTint: "#fef7f7",
    gradientStart: "#7f1d1d",
    gradientEnd: "#991b1b",
  },
  pirates: {
    accent: "#0284c7",
    accentLight: "#e0f2fe",
    titleColor: "#0c4a6e",
    ornamentColor: "#7dd3fc",
    pageTint: "#f6fbff",
    gradientStart: "#0c2d48",
    gradientEnd: "#0e4d64",
  },
  chef: {
    accent: "#ea580c",
    accentLight: "#fff7ed",
    titleColor: "#7c2d12",
    ornamentColor: "#fdba74",
    pageTint: "#fffbf5",
    gradientStart: "#7c2d12",
    gradientEnd: "#9a3412",
  },
  dinosaurs: {
    accent: "#40916c",
    accentLight: "#d8f3dc",
    titleColor: "#1b4332",
    ornamentColor: "#95d5b2",
    pageTint: "#f6fdf8",
    gradientStart: "#1b4332",
    gradientEnd: "#2d6a4f",
  },
  castle: {
    accent: "#7c3aed",
    accentLight: "#ede9fe",
    titleColor: "#3b0764",
    ornamentColor: "#c4b5fd",
    pageTint: "#faf5ff",
    gradientStart: "#2e1065",
    gradientEnd: "#4c1d95",
  },
  safari: {
    accent: "#d97706",
    accentLight: "#fef3c7",
    titleColor: "#78350f",
    ornamentColor: "#fcd34d",
    pageTint: "#fffbeb",
    gradientStart: "#7c2d12",
    gradientEnd: "#b45309",
  },
  inventor: {
    accent: "#0284c7",
    accentLight: "#e0f2fe",
    titleColor: "#0c4a6e",
    ornamentColor: "#7dd3fc",
    pageTint: "#f0f9ff",
    gradientStart: "#0c4a6e",
    gradientEnd: "#075985",
  },
  candy: {
    accent: "#db2777",
    accentLight: "#fce7f3",
    titleColor: "#831843",
    ornamentColor: "#f9a8d4",
    pageTint: "#fdf2f8",
    gradientStart: "#831843",
    gradientEnd: "#9d174d",
  },
};

/** Default palette (warm brown) — used when templateId is unknown */
const DEFAULT_PALETTE: BookColors = {
  accent: "#D2691E",
  accentLight: "#FFF3E8",
  titleColor: "#5D4037",
  ornamentColor: "#D7CCC8",
  pageTint: "#FFFCF7",
  gradientStart: "#5D4037",
  gradientEnd: "#4E342E",
};

export function getBookColors(templateId: string): BookColors {
  return PALETTES[templateId] ?? DEFAULT_PALETTE;
}
