import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import SeoLandingPage from "@/components/seo-landing/SeoLandingPage";
import { SEO_GIFT_SLUGS, isValidSeoSlug, seoPath } from "@/lib/seo-landing";

const BASE_URL = "https://meapica.shop";
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

  const languages: Record<string, string> = {};
  for (const loc of routing.locales) languages[loc] = `${BASE_URL}/${loc}${path}`;
  languages["x-default"] = `${BASE_URL}/${routing.defaultLocale}${path}`;

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
