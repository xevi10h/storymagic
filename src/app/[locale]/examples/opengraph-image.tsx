import { ogImageMetadata, ogTranslator, seoOgImage } from "@/lib/seo-og";

// Share image of the examples index (its page metadata sets its own openGraph,
// which would otherwise drop the [locale] image). Stories set their first
// illustration as og:image.

/** What the image says (also its localized alt text). */
async function content(params: { locale: string }) {
  const { locale } = params;
  const t = await ogTranslator(locale, "showcase");
  const th = await ogTranslator(locale, "hero");
  return { eyebrow: th("eyebrow"), headline: t("title") };
}

export async function generateImageMetadata({ params }: { params: { locale: string } }) {
  return ogImageMetadata((await content(params)).headline);
}

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  return seoOgImage(await content(await params));
}
