import { ogImageMetadata, ogTranslator, seoOgImage } from "@/lib/seo-og";
import { isValidSeoSlug } from "@/lib/seo-landing";

/** What the image says (also its localized alt text). */
async function content(params: { locale: string; age: string }) {
  const { locale, age } = params;
  const t = await ogTranslator(locale, "seo");
  const valid = isValidSeoSlug("ages", age);
  const eyebrow = valid ? t(`nav.ages.${age}`) : t("nav.ageHeading");
  const headline = valid ? t(`ages.${age}.h1`) : t("hubs.ages.h1");
  return { eyebrow, headline };
}

export async function generateImageMetadata({ params }: { params: { locale: string; age: string } }) {
  return ogImageMetadata((await content(params)).headline);
}

export default async function Image({ params }: { params: Promise<{ locale: string; age: string }> }) {
  return seoOgImage(await content(await params));
}
