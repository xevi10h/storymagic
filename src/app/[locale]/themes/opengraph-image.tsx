import { ogImageMetadata, ogTranslator, seoOgImage } from "@/lib/seo-og";

/** What the image says (also its localized alt text). */
async function content(params: { locale: string }) {
  const { locale } = params;
  const t = await ogTranslator(locale, "seo");
  return {
    eyebrow: t("nav.themeHeading"),
    headline: t("hubs.themes.h1"),
  };
}

export async function generateImageMetadata({ params }: { params: { locale: string } }) {
  return ogImageMetadata((await content(params)).headline);
}

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  return seoOgImage(await content(await params));
}
