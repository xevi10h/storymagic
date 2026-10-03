import { ogImageMetadata, ogTranslator, seoOgImage } from "@/lib/seo-og";
import { BRAND_NAME } from "@/lib/product-facts";

// Share image of the legal page (its page metadata sets its own openGraph, which
// would otherwise drop the [locale] image).

/** What the image says (also its localized alt text). */
async function content(params: { locale: string }) {
  const t = await ogTranslator(params.locale, "legal.terms");
  return { eyebrow: BRAND_NAME, headline: t("title") };
}

export async function generateImageMetadata({ params }: { params: { locale: string } }) {
  return ogImageMetadata((await content(params)).headline);
}

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  return seoOgImage(await content(await params));
}
