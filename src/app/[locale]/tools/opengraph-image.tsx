import { getTranslations } from "next-intl/server";
import { seoOgImage, SEO_OG_SIZE, SEO_OG_CONTENT_TYPE } from "@/lib/seo-og";
import { isToolLocale } from "@/lib/tools/registry";

export const alt = "Meapica — Free Three Kings printables";
export const size = SEO_OG_SIZE;
export const contentType = SEO_OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: requested } = await params;
  // en/fr pages 404; their OG route still answers, in Spanish.
  const locale = isToolLocale(requested) ? requested : "es";
  const t = await getTranslations({ locale, namespace: "tools.hub" });
  const tc = await getTranslations({ locale, namespace: "tools.common" });
  return seoOgImage({ eyebrow: tc("ogEyebrow"), headline: t("h1") });
}
