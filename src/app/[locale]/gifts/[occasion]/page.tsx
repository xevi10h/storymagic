import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { hreflangAlternates } from "@/lib/seo-index";
import SeoLandingPage from "@/components/seo-landing/SeoLandingPage";
import { SEO_GIFT_SLUGS, isValidSeoSlug, seoPath } from "@/lib/seo-landing";

const BASE_URL = "https://meapica.es";
const TYPE = "gifts" as const;

// Christmas / Reyes pages quote this season's order-by dates (FAQ + deadline cards): refresh daily.
export const revalidate = 86400;

type PageProps = {
  params: Promise<{ locale: string; occasion: string }>;
};

export function generateStaticParams() {
  return SEO_GIFT_SLUGS.map((occasion) => ({ occasion }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, occasion } = await params;
  if (!isValidSeoSlug(TYPE, occasion)) return {};
  const t = await getTranslations({ locale, namespace: "seo" });
  const path = seoPath(TYPE, occasion);
  const url = `${BASE_URL}/${locale}${path}`;

  const languages = hreflangAlternates(BASE_URL, path);

  const title = t(`${TYPE}.${occasion}.metaTitle`);
  const description = t(`${TYPE}.${occasion}.metaDescription`);

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url, languages },
    openGraph: { title, description, url, type: "website" },
  };
}

export default async function Page({ params }: PageProps) {
  const { locale, occasion } = await params;
  setRequestLocale(locale);
  if (!isValidSeoSlug(TYPE, occasion)) notFound();
  return <SeoLandingPage type={TYPE} slug={occasion} locale={locale} />;
}
