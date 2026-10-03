import { ogImageMetadata, ogTranslator, seoOgImage } from "@/lib/seo-og";
import { isValidSeoSlug } from "@/lib/seo-landing";

/** What the image says (also its localized alt text). */
async function content(params: { locale: string; theme: string }) {
  const { locale, theme } = params;
  const t = await ogTranslator(locale, "seo");
  const valid = isValidSeoSlug("themes", theme);
  const eyebrow = valid ? t(`nav.themes.${theme}`) : t("nav.themeHeading");
  const headline = valid ? t(`themes.${theme}.h1`) : t("hubs.themes.h1");
  return { eyebrow, headline };
}

export async function generateImageMetadata({ params }: { params: { locale: string; theme: string } }) {
  return ogImageMetadata((await content(params)).headline);
}

export default async function Image({ params }: { params: Promise<{ locale: string; theme: string }> }) {
  return seoOgImage(await content(await params));
}
