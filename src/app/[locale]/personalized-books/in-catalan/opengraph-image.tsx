import { seoOgImage, SEO_OG_SIZE, SEO_OG_CONTENT_TYPE } from "@/lib/seo-og";
import { CATALAN_GUIDE_COPY } from "@/lib/guide-copy/catalan";
import { guideFacts } from "@/lib/guide-copy/facts";
import { isGuideLocale } from "@/lib/guides";

export const alt = "Meapica — Personalised children's book in Catalan";
export const size = SEO_OG_SIZE;
export const contentType = SEO_OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: requested } = await params;
  // en/fr pages 404; their OG route still answers, in Catalan.
  const locale = isGuideLocale("catalan", requested) ? requested : "ca";
  const copy = CATALAN_GUIDE_COPY[locale](guideFacts(locale));
  return seoOgImage({ eyebrow: copy.eyebrow, headline: copy.h1 });
}
