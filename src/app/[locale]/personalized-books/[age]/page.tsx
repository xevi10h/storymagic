import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { hreflangAlternates } from "@/lib/seo-index";
import SeoLandingPage from "@/components/seo-landing/SeoLandingPage";
import { SEO_AGE_SLUGS, isValidSeoSlug, seoPath } from "@/lib/seo-landing";

const BASE_URL = "https://meapica.es";
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

  const languages = hreflangAlternates(BASE_URL, path);

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
