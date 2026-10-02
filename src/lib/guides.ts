// Editorial "why Meapica" pages (owner-approved positioning, 2026-10-02): the
// Catalan-native landing, the likeness page and the honest comparison. Each page
// exists only in the locales listed here: the others 404, stay out of the sitemap
// and out of hreflang (x-default = es, which every page has). Shared by client and
// server — no server-only imports here.

export type GuideId = "catalan" | "likeness" | "compare";

export const GUIDES: Record<GuideId, { path: string; locales: readonly string[] }> = {
  catalan: { path: "/personalized-books/in-catalan", locales: ["es", "ca"] },
  likeness: { path: "/personalized-books/looks-like-your-child", locales: ["es", "ca", "en", "fr"] },
  // Competitor facts are Spain-specific (prices, shipping): es + ca only.
  compare: { path: "/compare", locales: ["es", "ca"] },
};

export const GUIDE_IDS = Object.keys(GUIDES) as GuideId[];

/**
 * Date the page content was last written (sitemap lastmod). Bump it when the copy
 * changes; for /compare also when the competitor facts are re-checked.
 */
export const GUIDES_CONTENT_UPDATED = "2026-10-02";

export function isGuideLocale(id: GuideId, locale: string): boolean {
  return GUIDES[id].locales.includes(locale);
}

/** Guides available in a locale (footer, hub links). */
export function guidesForLocale(locale: string): GuideId[] {
  return GUIDE_IDS.filter((id) => isGuideLocale(id, locale));
}

/** hreflang map: only the locales the page exists in, x-default = es. */
export function guideAlternates(baseUrl: string, id: GuideId): Record<string, string> {
  const { path, locales } = GUIDES[id];
  const languages: Record<string, string> = {};
  for (const loc of locales) languages[loc] = `${baseUrl}/${loc}${path}`;
  languages["x-default"] = `${baseUrl}/es${path}`;
  return languages;
}

/** Footer heading of the guide links. */
export const GUIDES_HEADING: Record<string, string> = { es: "Guías", ca: "Guies", en: "Guides", fr: "Guides" };

/** Short link label per guide and locale (footer, hub, related links). */
export const GUIDE_LINK_LABELS: Record<GuideId, Record<string, string>> = {
  catalan: { es: "Cuentos personalizados en catalán", ca: "Contes personalitzats en català" },
  likeness: {
    es: "Un cuento que se parece a tu hijo",
    ca: "Un conte que s'assembla al teu fill",
    en: "A book that looks like your child",
    fr: "Un livre qui lui ressemble",
  },
  compare: { es: "Comparativa de cuentos personalizados", ca: "Comparativa de contes personalitzats" },
};

/**
 * Where the language switcher sends a reader of a guide that does not exist in the
 * target locale: the personalised-books hub, which exists in every locale.
 */
export function guidesFallbackPath(pathname: string, targetLocale: string): string | null {
  const id = GUIDE_IDS.find((g) => pathname === GUIDES[g].path);
  if (!id || isGuideLocale(id, targetLocale)) return null;
  return "/personalized-books";
}
