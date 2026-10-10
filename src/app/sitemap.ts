import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { allSeoPaths } from "@/lib/seo-landing";
import { getAllPublishedPostRefs } from "@/lib/blog";
import { CHRISTMAS_DELIVERY_PATH } from "@/lib/shipping";
import { GIFT_VOUCHER_PATH } from "@/lib/promo-codes";
import { TOOL_IDS, TOOL_LOCALES, TOOLS_CONTENT_UPDATED, TOOLS_HUB_PATH, toolAlternates, toolPath } from "@/lib/tools/registry";
import { GUIDES, GUIDE_IDS, guideAlternates, guideUpdated } from "@/lib/guides";
import { getShowcaseRefs } from "@/lib/showcase";
import { showcasePath } from "@/lib/showcase-slug";

const BASE_URL = "https://meapica.shop";

// We only ship to Spain: until the es/ca pages are indexed, en/fr stay out of the sitemap so the
// crawl budget of a young domain is not spent on them. The pages still exist, stay indexable and
// keep their hreflang; add the locales back here once es/ca coverage is healthy.
const SITEMAP_LOCALES: readonly string[] = ["es", "ca"];

function buildAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[locale] = `${BASE_URL}/${locale}${path}`;
  }
  languages["x-default"] = `${BASE_URL}/${routing.defaultLocale}${path}`;
  return languages;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // lastModified only where there is a real content date (blog rows). Static and
  // programmatic pages have none: omitting it beats a deploy-time date, which
  // Google learns to ignore for the whole sitemap.

  // ── Static pages ──────────────────────────────────────────────────────
  const staticPages: { path: string; changeFrequency: "weekly" | "monthly"; priority: number }[] = [
    { path: "", changeFrequency: "weekly", priority: 1.0 },
    { path: "/gifts", changeFrequency: "monthly", priority: 0.9 },
    { path: CHRISTMAS_DELIVERY_PATH, changeFrequency: "weekly", priority: 0.8 },
    { path: GIFT_VOUCHER_PATH, changeFrequency: "monthly", priority: 0.8 },
    { path: "/personalized-books", changeFrequency: "monthly", priority: 0.9 },
    { path: "/themes", changeFrequency: "monthly", priority: 0.9 },
    { path: "/examples", changeFrequency: "weekly", priority: 0.7 },
    { path: "/legal", changeFrequency: "monthly", priority: 0.3 },
  ];

  for (const page of staticPages) {
    for (const locale of routing.locales) {
      entries.push({
        url: `${BASE_URL}/${locale}${page.path}`,
        changeFrequency: page.changeFrequency,
        priority: page.priority,
        alternates: {
          languages: buildAlternates(page.path),
        },
      });
    }
  }

  // ── Programmatic SEO landing pages (gifts / ages / themes) ────────────
  for (const { path } of allSeoPaths()) {
    for (const locale of routing.locales) {
      entries.push({
        url: `${BASE_URL}/${locale}${path}`,
        changeFrequency: "monthly",
        priority: 0.8,
        alternates: {
          languages: buildAlternates(path),
        },
      });
    }
  }

  // ── Free Reyes printables: es + ca only (en/fr 404), lastmod = content date ──
  for (const path of [TOOLS_HUB_PATH, ...TOOL_IDS.map(toolPath)]) {
    for (const locale of TOOL_LOCALES) {
      entries.push({
        url: `${BASE_URL}/${locale}${path}`,
        lastModified: new Date(`${TOOLS_CONTENT_UPDATED}T00:00:00Z`),
        changeFrequency: "monthly",
        priority: 0.8,
        alternates: { languages: toolAlternates(BASE_URL, path) },
      });
    }
  }

  // ── Guides (Catalan, likeness, comparison, tió, Catalan by age): only their own locales, lastmod = content date ──
  for (const id of GUIDE_IDS) {
    for (const locale of GUIDES[id].locales) {
      entries.push({
        url: `${BASE_URL}/${locale}${GUIDES[id].path}`,
        lastModified: new Date(`${guideUpdated(id)}T00:00:00Z`),
        changeFrequency: "monthly",
        priority: 0.8,
        alternates: { languages: guideAlternates(BASE_URL, id) },
      });
    }
  }

  // ── Blog index + posts (only locales with published posts) ──────────
  try {
    const refs = await getAllPublishedPostRefs();
    // An index with zero posts is a noindex "coming soon" page: list it only
    // once its locale has a post (same rule as the page's robots/hreflang).
    const blogLocales = routing.locales.filter((loc) => refs.some((r) => r.locale === loc));
    const blogLanguages: Record<string, string> = {};
    for (const loc of blogLocales) blogLanguages[loc] = `${BASE_URL}/${loc}/blog`;
    if (blogLocales.includes(routing.defaultLocale)) {
      blogLanguages["x-default"] = `${BASE_URL}/${routing.defaultLocale}/blog`;
    }
    const latestUpdate = (loc: string): Date | undefined => {
      const times = refs
        .filter((r) => r.locale === loc && r.updatedAt)
        .map((r) => new Date(r.updatedAt as string).getTime());
      return times.length ? new Date(Math.max(...times)) : undefined;
    };
    for (const loc of blogLocales) {
      const lastModified = latestUpdate(loc);
      entries.push({
        url: `${BASE_URL}/${loc}/blog`,
        ...(lastModified ? { lastModified } : {}),
        changeFrequency: "weekly",
        priority: 0.6,
        alternates: { languages: blogLanguages },
      });
    }

    const localesBySlug = new Map<string, string[]>();
    for (const r of refs) {
      const arr = localesBySlug.get(r.slug) ?? [];
      arr.push(r.locale);
      localesBySlug.set(r.slug, arr);
    }
    for (const r of refs) {
      const postPath = `/blog/${r.slug}`;
      const languages: Record<string, string> = {};
      const postLocales = localesBySlug.get(r.slug) ?? [];
      for (const loc of postLocales) {
        languages[loc] = `${BASE_URL}/${loc}${postPath}`;
      }
      // Same x-default rule as the post's HTML hreflang.
      if (postLocales.includes(routing.defaultLocale)) {
        languages["x-default"] = `${BASE_URL}/${routing.defaultLocale}${postPath}`;
      }
      entries.push({
        url: `${BASE_URL}/${r.locale}${postPath}`,
        ...(r.updatedAt ? { lastModified: new Date(r.updatedAt) } : {}),
        changeFrequency: "monthly",
        priority: 0.6,
        alternates: { languages },
      });
    }
  } catch (error) {
    console.error("[Sitemap] Failed to fetch blog posts:", error);
  }

  // ── Example books (/examples/{slug}): server-rendered, one URL per locale
  // edition, hreflang between the editions of the same book ──────────────
  try {
    const refs = await getShowcaseRefs();
    for (const ref of refs) {
      if (!routing.locales.includes(ref.locale as (typeof routing.locales)[number])) continue;
      const languages: Record<string, string> = {};
      for (const edition of refs.filter((r) => r.groupId === ref.groupId)) {
        languages[edition.locale] = `${BASE_URL}/${edition.locale}${showcasePath(edition.slug)}`;
      }
      // Same x-default rule as the page's HTML hreflang.
      if (languages[routing.defaultLocale]) languages["x-default"] = languages[routing.defaultLocale];
      entries.push({
        url: `${BASE_URL}/${ref.locale}${showcasePath(ref.slug)}`,
        changeFrequency: "monthly",
        priority: 0.6,
        alternates: { languages },
      });
    }
  } catch (error) {
    console.error("[Sitemap] Failed to fetch example books:", error);
  }

  return entries.filter((entry) => SITEMAP_LOCALES.includes(entry.url.slice(BASE_URL.length + 1).split("/")[0]));
}
