import { getTranslations } from "next-intl/server";
import { seoOgImage, SEO_OG_SIZE, SEO_OG_CONTENT_TYPE } from "@/lib/seo-og";
import { isValidSeoSlug } from "@/lib/seo-landing";

export const alt = "Meapica — Personalized Children's Books";
export const size = SEO_OG_SIZE;
export const contentType = SEO_OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; theme: string }>;
}) {
  const { locale, theme } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  const valid = isValidSeoSlug("themes", theme);
  const eyebrow = valid ? t(`nav.themes.${theme}`) : t("nav.themeHeading");
  const headline = valid ? t(`themes.${theme}.h1`) : t("hubs.themes.h1");
  return seoOgImage({ eyebrow, headline });
}
