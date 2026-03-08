import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";

const BASE_URL = "https://meapica.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const locales = routing.locales;

  // Static pages — one entry per locale
  const staticPages = ["", "/legal"];

  const entries: MetadataRoute.Sitemap = [];

  for (const page of staticPages) {
    for (const locale of locales) {
      entries.push({
        url: `${BASE_URL}/${locale}${page}`,
        lastModified: new Date(),
        changeFrequency: page === "" ? "weekly" : "monthly",
        priority: page === "" ? 1 : 0.3,
      });
    }
  }

  return entries;
}
