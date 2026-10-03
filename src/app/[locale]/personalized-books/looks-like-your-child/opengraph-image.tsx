import { ogImageMetadata, seoOgImage } from "@/lib/seo-og";
import { LIKENESS_GUIDE_COPY } from "@/lib/guide-copy/likeness";
import { guideFacts } from "@/lib/guide-copy/facts";
import { PREVIEW_ILLUSTRATION_COUNT } from "@/lib/pricing";

/** What the image says (also its localized alt text). */
async function content(params: { locale: string }) {
  const { locale: requested } = params;
  const locale = LIKENESS_GUIDE_COPY[requested] ? requested : "es";
  const copy = LIKENESS_GUIDE_COPY[locale](guideFacts(locale), PREVIEW_ILLUSTRATION_COUNT);
  return { eyebrow: copy.eyebrow, headline: copy.h1 };
}

export async function generateImageMetadata({ params }: { params: { locale: string } }) {
  return ogImageMetadata((await content(params)).headline);
}

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  return seoOgImage(await content(await params));
}
