// Server-only: <head> metadata for the guide pages (src/lib/guides.ts).

import type { Metadata } from "next";
import { SITE_URL } from "@/lib/product-facts";
import { GUIDES, guideAlternates, isGuideLocale, type GuideId } from "./guides";

const OG_LOCALE: Record<string, string> = { es: "es_ES", ca: "ca_ES", en: "en_GB", fr: "fr_FR" };

/** Title, description, canonical, hreflang (only the page's locales, x-default = es) and OG. */
export function guideMetadata(id: GuideId, locale: string, copy: { metaTitle: string; metaDescription: string } | null): Metadata {
  if (!copy || !isGuideLocale(id, locale)) return { robots: { index: false, follow: false } };
  const url = `${SITE_URL}/${locale}${GUIDES[id].path}`;
  return {
    title: { absolute: copy.metaTitle },
    description: copy.metaDescription,
    alternates: { canonical: url, languages: guideAlternates(SITE_URL, id) },
    openGraph: { title: copy.metaTitle, description: copy.metaDescription, url, type: "website", locale: OG_LOCALE[locale] },
    twitter: { card: "summary_large_image", title: copy.metaTitle, description: copy.metaDescription },
  };
}
