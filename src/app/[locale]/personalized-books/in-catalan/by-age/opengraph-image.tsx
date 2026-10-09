import { ogImageMetadata, seoOgImage } from "@/lib/seo-og";
import { CATALAN_AGES_GUIDE_COPY } from "@/lib/guide-copy/catalan-ages";
import { guideFacts } from "@/lib/guide-copy/facts";
import { PREVIEW_ILLUSTRATION_COUNT } from "@/lib/pricing";

/** What the image says (also its alt text). The page exists in Catalan only; every locale's OG route answers in Catalan. */
function content() {
  const copy = CATALAN_AGES_GUIDE_COPY.ca(guideFacts("ca"), PREVIEW_ILLUSTRATION_COUNT);
  return { eyebrow: copy.eyebrow, headline: copy.h1 };
}

export async function generateImageMetadata() {
  return ogImageMetadata(content().headline);
}

export default async function Image() {
  return seoOgImage(content());
}
