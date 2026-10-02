// Server-only: <head> metadata for the tools pages (es + ca only).

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SITE_URL } from "@/lib/product-facts";
import { isToolLocale, toolAlternates } from "./registry";

/** Title, description, canonical, hreflang (es, ca, x-default = es) and OG for one tools page. */
export async function toolMetadata(locale: string, namespace: "tools.hub" | "tools.letter" | "tools.reply", path: string): Promise<Metadata> {
  if (!isToolLocale(locale)) return { robots: { index: false, follow: false } };
  const t = await getTranslations({ locale, namespace });
  const url = `${SITE_URL}/${locale}${path}`;
  const title = t("metaTitle");
  const description = t("metaDescription");
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url, languages: toolAlternates(SITE_URL, path) },
    openGraph: { title, description, url, type: "website", locale: locale === "ca" ? "ca_ES" : "es_ES" },
    twitter: { card: "summary_large_image", title, description },
  };
}
