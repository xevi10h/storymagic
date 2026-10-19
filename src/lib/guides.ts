// Editorial "why Meapica" pages (owner-approved positioning, 2026-10-02): the
// Catalan-native landing, the likeness page and the honest comparison; plus the
// Catalan cluster (2026-10-09): the Tió de Nadal gift page and Catalan books by age,
// which exist in Catalan only (the topic is Catalan). Each page
// exists only in the locales listed here: the others 404, stay out of the sitemap
// and out of hreflang (x-default = es, which every page has). Shared by client and
// server — no server-only imports here.

export type GuideId = "catalan" | "likeness" | "compare" | "tio" | "catalanAges" | "about";

interface GuideConfig {
  path: string;
  locales: readonly string[];
  /** First publication date (Article JSON-LD datePublished). */
  published: string;
  /** Content date of this page when newer than GUIDES_CONTENT_UPDATED (sitemap lastmod). */
  updated?: string;
  /** Where the language switcher sends a reader to a locale without this page (default: the personalised-books hub). */
  fallback?: string;
  /** Listed in the footer "Guías" row and the hub guide links (default true). */
  listed?: boolean;
}

export const GUIDES: Record<GuideId, GuideConfig> = {
  catalan: { path: "/personalized-books/in-catalan", locales: ["es", "ca"], published: "2026-10-02", updated: "2026-10-09" },
  likeness: { path: "/personalized-books/looks-like-your-child", locales: ["es", "ca", "en", "fr"], published: "2026-10-02" },
  // Competitor facts are Spain-specific (prices, shipping): es + ca only.
  compare: { path: "/compare", locales: ["es", "ca"], published: "2026-10-02" },
  // The tió is a Catalan tradition: Catalan only; other locales get the Christmas gift page.
  tio: { path: "/gifts/tio-de-nadal", locales: ["ca"], published: "2026-10-09", updated: "2026-10-09", fallback: "/gifts/christmas" },
  // Reading stages as Catalan schools name them (I3-I5, cicles): Catalan only.
  catalanAges: { path: "/personalized-books/in-catalan/by-age", locales: ["ca"], published: "2026-10-09", updated: "2026-10-09" },
  // "Qué es Meapica" facts sheet (GEO, 2026-10-19): es + ca, the Spain-facing locales. Linked from
  // the footer's support column, not the guides row; en/fr readers fall back to the home.
  about: { path: "/about", locales: ["es", "ca"], published: "2026-10-19", updated: "2026-10-19", fallback: "/", listed: false },
};

export const GUIDE_IDS = Object.keys(GUIDES) as GuideId[];

/**
 * Date the page content was last written (sitemap lastmod). Bump it when the copy
 * changes; for /compare also when the competitor facts are re-checked.
 */
export const GUIDES_CONTENT_UPDATED = "2026-10-02";

/** Sitemap lastmod of a guide: its own content date, else the shared one. */
export function guideUpdated(id: GuideId): string {
  return GUIDES[id].updated ?? GUIDES_CONTENT_UPDATED;
}

export function isGuideLocale(id: GuideId, locale: string): boolean {
  return GUIDES[id].locales.includes(locale);
}

/** Guides listed in a locale (footer "Guías" row, hub links); unlisted pages (about) are linked on their own. */
export function guidesForLocale(locale: string): GuideId[] {
  return GUIDE_IDS.filter((id) => GUIDES[id].listed !== false && isGuideLocale(id, locale));
}

/** hreflang map: only the locales the page exists in; x-default = es, or the page's one locale when it has no es edition. */
export function guideAlternates(baseUrl: string, id: GuideId): Record<string, string> {
  const { path, locales } = GUIDES[id];
  const languages: Record<string, string> = {};
  for (const loc of locales) languages[loc] = `${baseUrl}/${loc}${path}`;
  languages["x-default"] = `${baseUrl}/${locales.includes("es") ? "es" : locales[0]}${path}`;
  return languages;
}

const BYLINE: Record<string, { updated: string; by: string; intl: string }> = {
  es: { updated: "Actualizado el", by: "Por", intl: "es-ES" },
  ca: { updated: "Actualitzat el", by: "Per", intl: "ca-ES" },
  en: { updated: "Updated", by: "By", intl: "en-GB" },
  fr: { updated: "Mis à jour le", by: "Par", intl: "fr-FR" },
};

/**
 * Visible byline of a guide page ("Actualizado el 19 de octubre de 2026 · Por Xavier Huix"):
 * the same content date and author as its Article JSON-LD.
 */
export function guideByline(id: GuideId, locale: string, author: string): { date: string; text: string } {
  const b = BYLINE[locale] ?? BYLINE.es;
  const date = guideUpdated(id);
  const label = new Intl.DateTimeFormat(b.intl, { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${date}T00:00:00Z`),
  );
  return { date, text: `${b.updated} ${label} · ${b.by} ${author}` };
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
  tio: { ca: "Regal per al tió de Nadal" },
  catalanAges: { ca: "Contes en català per edats" },
  about: { es: "Qué es Meapica", ca: "Què és Meapica" },
};

/**
 * Catalan-cluster guides linked from a programmatic landing (SeoLandingPage "related"
 * block): the Christmas and Reyes gift pages point to the tió page, every age page to
 * Catalan books by age, and the Catalan-calendar occasions to the Catalan landing.
 * Only guides that exist in the page's locale are returned.
 */
const GUIDE_CONTEXT: Record<string, GuideId[]> = {
  "gifts/christmas": ["tio", "catalan"],
  "gifts/three-kings": ["tio", "catalan"],
  "gifts/sant-jordi": ["catalan", "catalanAges"],
  "ages/2-4": ["catalanAges"],
  "ages/5-7": ["catalanAges"],
  "ages/8-12": ["catalanAges"],
};
export function contextGuides(type: string, slug: string, locale: string): GuideId[] {
  return (GUIDE_CONTEXT[`${type}/${slug}`] ?? []).filter((id) => isGuideLocale(id, locale));
}

/**
 * Where the language switcher sends a reader of a guide that does not exist in the
 * target locale: the personalised-books hub, which exists in every locale.
 */
export function guidesFallbackPath(pathname: string, targetLocale: string): string | null {
  const id = GUIDE_IDS.find((g) => pathname === GUIDES[g].path);
  if (!id || isGuideLocale(id, targetLocale)) return null;
  return GUIDES[id].fallback ?? "/personalized-books";
}
