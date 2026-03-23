import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { routing } from "@/i18n/routing";

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

  // ── Dynamic showcase story pages ──────────────────────────────────────
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { data: showcaseStories } = await supabase
      .from("stories")
      .select("id, updated_at")
      .eq("is_showcase", true)
      .eq("status", "ready")
      .order("created_at", { ascending: false });

    if (showcaseStories) {
      for (const story of showcaseStories) {
        const storyPath = `/ejemplo/${story.id}`;
        for (const locale of routing.locales) {
          entries.push({
            url: `${BASE_URL}/${locale}${storyPath}`,
            lastModified: story.updated_at ? new Date(story.updated_at) : new Date(),
            changeFrequency: "monthly",
            priority: 0.7,
            alternates: {
              languages: buildAlternates(storyPath),
            },
          });
        }
      }
    }
  } catch (error) {
    // Sitemap generation should not fail if DB is unreachable
    console.error("[Sitemap] Failed to fetch showcase stories:", error);
  }

  return entries;
}
