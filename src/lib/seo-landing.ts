// Programmatic-SEO landing registry.
// Drives a family of high-intent landing pages (gift occasions, age ranges,
// story themes) from a single config. English slugs (project SEO convention);
// all visible/meta content is localized via the `seo` message namespace.

import { STORY_TEMPLATES } from "@/lib/create-store";

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

export const SEO_AGE_SLUGS = ["2-4", "5-7", "8-12"] as const;

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
    return `/crear?template=${THEME_TEMPLATE[slug]}&from=seo`;
  }
  return "/crear";
}

/** Related pages (cross-links) for a page, for internal linking. */
export function relatedSeoPages(
  type: SeoPageType,
  slug: string,
): { type: SeoPageType; slug: string }[] {
  const all: { type: SeoPageType; slug: string }[] = [];
  (Object.keys(SEO_SLUGS) as SeoPageType[]).forEach((t) => {
    SEO_SLUGS[t].forEach((s) => {
      if (!(t === type && s === slug)) all.push({ type: t, slug: s });
    });
  });
  // Prefer a spread: a couple from each other type.
  const sameType = all.filter((p) => p.type === type).slice(0, 2);
  const otherTypes = all.filter((p) => p.type !== type);
  const giftsPick = otherTypes.filter((p) => p.type === "gifts").slice(0, 2);
  const agesPick = otherTypes.filter((p) => p.type === "ages").slice(0, 2);
  const themesPick = otherTypes.filter((p) => p.type === "themes").slice(0, 2);
  return [...sameType, ...giftsPick, ...agesPick, ...themesPick].slice(0, 6);
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
