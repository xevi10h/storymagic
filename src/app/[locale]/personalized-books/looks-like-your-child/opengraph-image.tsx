import { seoOgImage, SEO_OG_SIZE, SEO_OG_CONTENT_TYPE } from "@/lib/seo-og";
import { LIKENESS_GUIDE_COPY } from "@/lib/guide-copy/likeness";
import { guideFacts } from "@/lib/guide-copy/facts";
import { PREVIEW_ILLUSTRATION_COUNT } from "@/lib/pricing";

export const alt = "Meapica — A personalised book that looks like your child";
export const size = SEO_OG_SIZE;
export const contentType = SEO_OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: requested } = await params;
  const locale = LIKENESS_GUIDE_COPY[requested] ? requested : "es";
  const copy = LIKENESS_GUIDE_COPY[locale](guideFacts(locale), PREVIEW_ILLUSTRATION_COUNT);
  return seoOgImage({ eyebrow: copy.eyebrow, headline: copy.h1 });
}
