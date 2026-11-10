// Which locales search engines may index. Shared by the locale layout (robots meta),
// every page's hreflang (hreflangAlternates) and the sitemap. No server-only imports.

import { routing } from "@/i18n/routing";

/**
 * ── TEMPORARY SWITCH (owner decision 2026-11-10, revert in January 2027) ──────────────
 * We only ship to Spain, and Google was indexing /en and /fr pages before the Spanish
 * money pages of a young domain. While a locale is listed here its pages:
 *   - answer `<meta name="robots" content="noindex, follow">` (src/app/[locale]/layout.tsx),
 *   - are left out of every page's hreflang (hreflangAlternates below),
 *   - are left out of sitemap.xml (src/app/sitemap.ts).
 * The pages keep working for visitors (language switcher, direct links).
 *
 * TO REVERT: set this to `[]`. Nothing else to change. (docs/roadmap.md, January 2027)
 */
export const NOINDEX_LOCALES: readonly string[] = ["en", "fr"];

export function isIndexableLocale(locale: string): boolean {
  return !NOINDEX_LOCALES.includes(locale);
}

/** Locales listed in hreflang and in the sitemap. */
export const INDEXABLE_LOCALES: readonly string[] = routing.locales.filter(isIndexableLocale);

/**
 * hreflang map of a page that exists in every locale: one entry per indexable locale
 * plus x-default (the default locale). `path` has no locale prefix ("" = home).
 */
export function hreflangAlternates(baseUrl: string, path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const loc of INDEXABLE_LOCALES) languages[loc] = `${baseUrl}/${loc}${path}`;
  languages["x-default"] = `${baseUrl}/${routing.defaultLocale}${path}`;
  return languages;
}
