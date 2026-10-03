import { ogImageMetadata, seoOgImage } from "@/lib/seo-og";
import { CATALAN_GUIDE_COPY } from "@/lib/guide-copy/catalan";
import { guideFacts } from "@/lib/guide-copy/facts";
import { isGuideLocale } from "@/lib/guides";

/** What the image says (also its localized alt text). */
async function content(params: { locale: string }) {
  const { locale: requested } = params;
  // en/fr pages 404; their OG route still answers, in Catalan.
  const locale = isGuideLocale("catalan", requested) ? requested : "ca";
  const copy = CATALAN_GUIDE_COPY[locale](guideFacts(locale));
  return { eyebrow: copy.eyebrow, headline: copy.h1 };
}

export async function generateImageMetadata({ params }: { params: { locale: string } }) {
  return ogImageMetadata((await content(params)).headline);
}

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  return seoOgImage(await content(await params));
}
