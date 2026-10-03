import { ogImageMetadata, ogTranslator, seoOgImage } from "@/lib/seo-og";
import { isValidSeoSlug } from "@/lib/seo-landing";

/** What the image says (also its localized alt text). */
async function content(params: { locale: string; occasion: string }) {
  const { locale, occasion } = params;
  const t = await ogTranslator(locale, "seo");
  const valid = isValidSeoSlug("gifts", occasion);
  const eyebrow = valid ? t(`nav.gifts.${occasion}`) : t("nav.giftHeading");
  const headline = valid ? t(`gifts.${occasion}.h1`) : t("hubs.gifts.h1");
  return { eyebrow, headline };
}

export async function generateImageMetadata({ params }: { params: { locale: string; occasion: string } }) {
  return ogImageMetadata((await content(params)).headline);
}

export default async function Image({ params }: { params: Promise<{ locale: string; occasion: string }> }) {
  return seoOgImage(await content(await params));
}
