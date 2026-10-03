import { ogImageMetadata, ogTranslator, seoOgImage } from "@/lib/seo-og";
import { isToolLocale } from "@/lib/tools/registry";

/** What the image says (also its localized alt text). */
async function content(params: { locale: string }) {
  const { locale: requested } = params;
  // en/fr pages 404; their OG route still answers, in Spanish.
  const locale = isToolLocale(requested) ? requested : "es";
  const t = await ogTranslator(locale, "tools.letter");
  const tc = await ogTranslator(locale, "tools.common");
  return { eyebrow: tc("ogEyebrow"), headline: t("h1") };
}

export async function generateImageMetadata({ params }: { params: { locale: string } }) {
  return ogImageMetadata((await content(params)).headline);
}

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  return seoOgImage(await content(await params));
}
