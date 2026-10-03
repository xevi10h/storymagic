import { ogImageMetadata, ogTranslator, seoOgImage } from "@/lib/seo-og";

// Share image of the blog index (its page metadata sets its own openGraph, which
// would otherwise drop the [locale] image). Posts set their cover as og:image.

/** What the image says (also its localized alt text). */
async function content(params: { locale: string }) {
  const { locale } = params;
  const t = await ogTranslator(locale, "blog");
  return { eyebrow: "Blog", headline: t("title") };
}

export async function generateImageMetadata({ params }: { params: { locale: string } }) {
  return ogImageMetadata((await content(params)).headline);
}

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  return seoOgImage(await content(await params));
}
