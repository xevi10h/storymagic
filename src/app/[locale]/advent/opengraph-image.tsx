import { ogImageMetadata, ogTranslator, seoOgImage } from "@/lib/seo-og";
import { isAdventLocale } from "@/lib/advent/calendar";

/** What the image says (also its localized alt text). */
async function content(params: { locale: string }) {
  // en/fr pages 404; their OG route still answers, in Spanish.
  const locale = isAdventLocale(params.locale) ? params.locale : "es";
  const t = await ogTranslator(locale, "advent");
  return { eyebrow: t("eyebrow"), headline: t("h1") };
}

export async function generateImageMetadata({ params }: { params: { locale: string } }) {
  return ogImageMetadata((await content(params)).headline);
}

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  return seoOgImage(await content(await params));
}
