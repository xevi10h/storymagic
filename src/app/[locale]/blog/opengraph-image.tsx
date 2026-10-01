import { getTranslations } from "next-intl/server";
import { seoOgImage, SEO_OG_SIZE, SEO_OG_CONTENT_TYPE } from "@/lib/seo-og";

// Share image of the blog index (its page metadata sets its own openGraph, which
// would otherwise drop the [locale] image). Posts set their cover as og:image.
export const alt = "Meapica — Blog";
export const size = SEO_OG_SIZE;
export const contentType = SEO_OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "blog" });
  return seoOgImage({ eyebrow: "Blog", headline: t("title") });
}
