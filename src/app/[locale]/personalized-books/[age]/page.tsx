import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import SeoLandingPage from "@/components/seo-landing/SeoLandingPage";
import { SEO_AGE_SLUGS, isValidSeoSlug, seoPath } from "@/lib/seo-landing";

const BASE_URL = "https://meapica.shop";
const TYPE = "ages" as const;

type PageProps = {
  params: Promise<{ locale: string; age: string }>;
};

export function generateStaticParams() {
  return SEO_AGE_SLUGS.map((age) => ({ age }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, age } = await params;
  if (!isValidSeoSlug(TYPE, age)) return {};
  const t = await getTranslations({ locale, namespace: "seo" });
  const path = seoPath(TYPE, age);
  const url = `${BASE_URL}/${locale}${path}`;

  const languages: Record<string, string> = {};
  for (const loc of routing.locales) languages[loc] = `${BASE_URL}/${loc}${path}`;
  languages["x-default"] = `${BASE_URL}/${routing.defaultLocale}${path}`;

  const title = t(`${TYPE}.${age}.metaTitle`);
  const description = t(`${TYPE}.${age}.metaDescription`);

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url, languages },
    openGraph: { title, description, url, type: "website" },
  };
}

export default async function Page({ params }: PageProps) {
  const { locale, age } = await params;
  setRequestLocale(locale);
  if (!isValidSeoSlug(TYPE, age)) notFound();
  return <SeoLandingPage type={TYPE} slug={age} locale={locale} />;
}
