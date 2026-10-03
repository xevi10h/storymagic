import { ogImageMetadata, seoOgImage } from "@/lib/seo-og";
import { COMPARE_GUIDE_COPY } from "@/lib/guide-copy/compare";
import { guideFacts } from "@/lib/guide-copy/facts";
import { PREVIEW_ILLUSTRATION_COUNT } from "@/lib/pricing";

/** What the image says (also its localized alt text). */
async function content(params: { locale: string }) {
  const { locale: requested } = params;
  // en/fr pages 404; their OG route still answers, in Spanish.
  const locale = COMPARE_GUIDE_COPY[requested] ? requested : "es";
  const copy = COMPARE_GUIDE_COPY[locale](guideFacts(locale), PREVIEW_ILLUSTRATION_COUNT);
  return { eyebrow: copy.eyebrow, headline: copy.h1 };
}

export async function generateImageMetadata({ params }: { params: { locale: string } }) {
  return ogImageMetadata((await content(params)).headline);
}

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  return seoOgImage(await content(await params));
}
