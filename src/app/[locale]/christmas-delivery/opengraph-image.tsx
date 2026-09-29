import { getTranslations } from "next-intl/server";
import { seoOgImage, SEO_OG_SIZE, SEO_OG_CONTENT_TYPE } from "@/lib/seo-og";
import { giftSeason, spainToday } from "@/lib/shipping";

export const alt = "Meapica — Christmas and Three Kings delivery dates";
export const size = SEO_OG_SIZE;
export const contentType = SEO_OG_CONTENT_TYPE;
export const revalidate = 86400;

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "christmasDelivery" });
  const { christmasYear } = giftSeason(spainToday());
  return seoOgImage({
    eyebrow: t("ogEyebrow", { christmasYear, reyesYear: christmasYear + 1 }),
    headline: t("h1"),
  });
}
