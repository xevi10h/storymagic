// Programmatic-SEO landing registry.
// Drives a family of high-intent landing pages (gift occasions, age ranges,
// story themes) from a single config. English slugs (project SEO convention);
// all visible/meta content is localized via the `seo` message namespace.

import { STORY_TEMPLATES } from "@/lib/create-store";
import { AGE_BANDS } from "@/lib/product-facts";

export type SeoPageType = "gifts" | "ages" | "themes";

// Route base segment per page type (English slugs).
export const SEO_ROUTE_BASE: Record<SeoPageType, string> = {
  gifts: "/gifts",
  ages: "/personalized-books",
  themes: "/themes",
};

export const SEO_GIFT_SLUGS = [
  "three-kings",
  "sant-jordi",
  "birthday",
  "communion",
  "christmas",
  "baptism",
  "end-of-school",
  "name-day",
  "graduation",
  "first-birthday",
] as const;

// Same bands as the landing catalog filter (single source: lib/product-facts.ts).
export const SEO_AGE_SLUGS = AGE_BANDS.map((b) => b.slug);

// Theme slug → underlying STORY_TEMPLATES id.
export const THEME_TEMPLATE: Record<string, string> = {
  dinosaurs: "dinosaurs",
  space: "space",
  pirates: "pirates",
  superheroes: "superhero",
  "magic-forest": "forest",
  safari: "safari",
};
export const SEO_THEME_SLUGS = Object.keys(THEME_TEMPLATE);

export const SEO_SLUGS: Record<SeoPageType, readonly string[]> = {
  gifts: SEO_GIFT_SLUGS,
  ages: SEO_AGE_SLUGS,
  themes: SEO_THEME_SLUGS,
};

export function isValidSeoSlug(type: SeoPageType, slug: string): boolean {
  return SEO_SLUGS[type].includes(slug);
}

/** URL path (without locale prefix) for a given page, e.g. "/gifts/three-kings". */
export function seoPath(type: SeoPageType, slug: string): string {
  return `${SEO_ROUTE_BASE[type]}/${slug}`;
}

/** Hub (index) path for a page type, e.g. "/gifts". */
export function seoHubPath(type: SeoPageType): string {
  return SEO_ROUTE_BASE[type];
}

/** Message key (under `seo.nav`) for a type's hub heading label. */
export const SEO_HUB_HEADING_KEY: Record<SeoPageType, string> = {
  gifts: "nav.giftHeading",
  ages: "nav.ageHeading",
  themes: "nav.themeHeading",
};

/** Templates featured on a page, as create-store template ids. */
export function featuredTemplateIds(type: SeoPageType, slug: string): string[] {
  if (type === "ages") {
    const [min, max] = slug.split("-").map(Number);
    return STORY_TEMPLATES.filter(
      (t) => t.ageMin <= max && t.ageMax >= min,
    ).map((t) => t.id);
  }

  if (type === "themes") {
    const mainId = THEME_TEMPLATE[slug];
    const main = STORY_TEMPLATES.find((t) => t.id === mainId);
    if (!main) return STORY_TEMPLATES.slice(0, 4).map((t) => t.id);
    // Main template first, then up to 3 others sharing an emotional tag.
    const related = STORY_TEMPLATES.filter(
      (t) => t.id !== mainId && t.tags.some((tag) => main.tags.includes(tag)),
    ).slice(0, 3);
    return [mainId, ...related.map((t) => t.id)];
  }

  // gifts: show a diverse curated set across ages/themes.
  return STORY_TEMPLATES.slice(0, 8).map((t) => t.id);
}

/** Primary CTA deep-link into the creation flow, prefilling the theme template. */
export function seoCtaHref(type: SeoPageType, slug: string): string {
  if (type === "themes") {
    return `/create?template=${THEME_TEMPLATE[slug]}&from=seo`;
  }
  return "/create";
}

/**
 * Related pages (cross-links) for a page, for internal linking: 2 of the same type
 * + 2 of each other type. Deterministic rotation (no slice(0, 2)), so the links are
 * spread over every slug instead of always pointing at the first ones:
 * - same type: the next two slugs after this one (wrapping), so each page of a
 *   type gets exactly two inbound links from its siblings;
 * - other types: a window that advances by 2 per source page (its position in
 *   allSeoPaths()), so inbound links cycle evenly over that type's slugs.
 */
export function relatedSeoPages(
  type: SeoPageType,
  slug: string,
): { type: SeoPageType; slug: string }[] {
  const PER_TYPE = 2;
  const own = SEO_SLUGS[type];
  const ownIndex = Math.max(0, own.indexOf(slug));
  const globalIndex = Math.max(0, allSeoPaths().findIndex((p) => p.type === type && p.slug === slug));
  const out: { type: SeoPageType; slug: string }[] = [];
  const order: SeoPageType[] = [type, ...(Object.keys(SEO_SLUGS) as SeoPageType[]).filter((t) => t !== type)];
  for (const t of order) {
    const slugs = SEO_SLUGS[t];
    if (t === type) {
      for (let k = 1; k <= PER_TYPE && k < slugs.length; k++) {
        out.push({ type: t, slug: slugs[(ownIndex + k) % slugs.length] });
      }
    } else {
      const picks = Math.min(PER_TYPE, slugs.length);
      for (let k = 0; k < picks; k++) {
        out.push({ type: t, slug: slugs[(globalIndex * PER_TYPE + k) % slugs.length] });
      }
    }
  }
  return out;
}

/** All SEO landing paths (no locale prefix), for sitemap + static params. */
export function allSeoPaths(): { type: SeoPageType; slug: string; path: string }[] {
  const out: { type: SeoPageType; slug: string; path: string }[] = [];
  (Object.keys(SEO_SLUGS) as SeoPageType[]).forEach((type) => {
    SEO_SLUGS[type].forEach((slug) => {
      out.push({ type, slug, path: seoPath(type, slug) });
    });
  });
  return out;
}
