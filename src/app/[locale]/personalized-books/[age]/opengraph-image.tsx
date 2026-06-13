import { getTranslations } from "next-intl/server";
import { seoOgImage, SEO_OG_SIZE, SEO_OG_CONTENT_TYPE } from "@/lib/seo-og";
import { isValidSeoSlug } from "@/lib/seo-landing";

export const alt = "Meapica — Personalized Children's Books";
export const size = SEO_OG_SIZE;
export const contentType = SEO_OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; age: string }>;
}) {
  const { locale, age } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  const valid = isValidSeoSlug("ages", age);
  const eyebrow = valid ? t(`nav.ages.${age}`) : t("nav.ageHeading");
  const headline = valid ? t(`ages.${age}.h1`) : t("hubs.ages.h1");
  return seoOgImage({ eyebrow, headline });
}
