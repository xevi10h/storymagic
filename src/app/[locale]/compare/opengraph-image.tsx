import { seoOgImage, SEO_OG_SIZE, SEO_OG_CONTENT_TYPE } from "@/lib/seo-og";
import { COMPARE_GUIDE_COPY } from "@/lib/guide-copy/compare";
import { guideFacts } from "@/lib/guide-copy/facts";
import { PREVIEW_ILLUSTRATION_COUNT } from "@/lib/pricing";

export const alt = "Meapica — Personalised children's books in Spain: comparison";
export const size = SEO_OG_SIZE;
export const contentType = SEO_OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: requested } = await params;
  // en/fr pages 404; their OG route still answers, in Spanish.
  const locale = COMPARE_GUIDE_COPY[requested] ? requested : "es";
  const copy = COMPARE_GUIDE_COPY[locale](guideFacts(locale), PREVIEW_ILLUSTRATION_COUNT);
  return seoOgImage({ eyebrow: copy.eyebrow, headline: copy.h1 });
}
