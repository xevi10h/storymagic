import { ogImageMetadata, ogTranslator, seoOgImage } from "@/lib/seo-og";
import { giftSeason, spainToday } from "@/lib/shipping";

export const revalidate = 86400;

/** What the image says (also its localized alt text). */
async function content(params: { locale: string }) {
  const { locale } = params;
  const t = await ogTranslator(locale, "christmasDelivery");
  const { christmasYear } = giftSeason(spainToday());
  return {
    eyebrow: t("ogEyebrow", { christmasYear, reyesYear: christmasYear + 1 }),
    headline: t("h1"),
  };
}

export async function generateImageMetadata({ params }: { params: { locale: string } }) {
  return ogImageMetadata((await content(params)).headline);
}

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  return seoOgImage(await content(await params));
}
