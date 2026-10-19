import { ogImageMetadata, seoOgImage } from "@/lib/seo-og";
import { ABOUT_GUIDE_COPY } from "@/lib/guide-copy/about";
import { guideFacts } from "@/lib/guide-copy/facts";
import { isGuideLocale } from "@/lib/guides";
import { isPhotoUploadEnabled } from "@/lib/privacy/child-photo-policy";

/** What the image says (also its localized alt text). */
async function content(params: { locale: string }) {
  const { locale: requested } = params;
  // en/fr pages 404; their OG route still answers, in Spanish.
  const locale = isGuideLocale("about", requested) ? requested : "es";
  const copy = ABOUT_GUIDE_COPY[locale](guideFacts(locale), { photoUpload: isPhotoUploadEnabled() });
  return { eyebrow: copy.eyebrow, headline: copy.h1 };
}

export async function generateImageMetadata({ params }: { params: { locale: string } }) {
  return ogImageMetadata((await content(params)).headline);
}

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  return seoOgImage(await content(await params));
}
