import { getTranslations } from "next-intl/server";
import { seoOgImage, SEO_OG_SIZE, SEO_OG_CONTENT_TYPE } from "@/lib/seo-og";
import { isValidSeoSlug } from "@/lib/seo-landing";

export const alt = "Meapica — Personalized Children's Books";
export const size = SEO_OG_SIZE;
export const contentType = SEO_OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; occasion: string }>;
}) {
  const { locale, occasion } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  const valid = isValidSeoSlug("gifts", occasion);
  const eyebrow = valid ? t(`nav.gifts.${occasion}`) : t("nav.giftHeading");
  const headline = valid ? t(`gifts.${occasion}.h1`) : t("hubs.gifts.h1");
  return seoOgImage({ eyebrow, headline });
}
