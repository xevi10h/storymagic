import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { allSeoPaths } from "@/lib/seo-landing";
import { getAllPublishedPostRefs } from "@/lib/blog";
import { CHRISTMAS_DELIVERY_PATH } from "@/lib/shipping";

const BASE_URL = "https://meapica.com";

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

  // ── Static pages ──────────────────────────────────────────────────────
  const staticPages: { path: string; changeFrequency: "weekly" | "monthly"; priority: number }[] = [
    { path: "", changeFrequency: "weekly", priority: 1.0 },
    { path: "/gifts", changeFrequency: "monthly", priority: 0.9 },
    { path: CHRISTMAS_DELIVERY_PATH, changeFrequency: "weekly", priority: 0.8 },
    { path: "/personalized-books", changeFrequency: "monthly", priority: 0.9 },
    { path: "/themes", changeFrequency: "monthly", priority: 0.9 },
    { path: "/ejemplo", changeFrequency: "weekly", priority: 0.7 },
    { path: "/blog", changeFrequency: "weekly", priority: 0.6 },
    { path: "/legal", changeFrequency: "monthly", priority: 0.3 },
  ];

  for (const page of staticPages) {
    for (const locale of routing.locales) {
      entries.push({
        url: `${BASE_URL}/${locale}${page.path}`,
        lastModified: new Date(),
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
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.8,
        alternates: {
          languages: buildAlternates(path),
        },
      });
    }
  }

  // ── Blog posts (per locale, alternates only for published locales) ────
  try {
    const refs = await getAllPublishedPostRefs();
    const localesBySlug = new Map<string, string[]>();
    for (const r of refs) {
      const arr = localesBySlug.get(r.slug) ?? [];
      arr.push(r.locale);
      localesBySlug.set(r.slug, arr);
    }
    for (const r of refs) {
      const postPath = `/blog/${r.slug}`;
      const languages: Record<string, string> = {};
      for (const loc of localesBySlug.get(r.slug) ?? []) {
        languages[loc] = `${BASE_URL}/${loc}${postPath}`;
      }
      entries.push({
        url: `${BASE_URL}/${r.locale}${postPath}`,
        lastModified: r.updatedAt ? new Date(r.updatedAt) : new Date(),
        changeFrequency: "monthly",
        priority: 0.6,
        alternates: { languages },
      });
    }
  } catch (error) {
    console.error("[Sitemap] Failed to fetch blog posts:", error);
  }

  // Individual showcase stories (/ejemplo/[storyId]) are deliberately NOT
  // listed: they are client-rendered shells (no server-rendered story text),
  // so Google sees thin/empty pages. Re-add them once the viewer is SSR'd.

  return entries;
}
