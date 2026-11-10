import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { hreflangAlternates } from "@/lib/seo-index";
import SeoLandingPage from "@/components/seo-landing/SeoLandingPage";
import { SEO_THEME_SLUGS, isValidSeoSlug, seoPath } from "@/lib/seo-landing";

const BASE_URL = "https://meapica.es";
const TYPE = "themes" as const;

type PageProps = {
  params: Promise<{ locale: string; theme: string }>;
};

export function generateStaticParams() {
  return SEO_THEME_SLUGS.map((theme) => ({ theme }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, theme } = await params;
  if (!isValidSeoSlug(TYPE, theme)) return {};
  const t = await getTranslations({ locale, namespace: "seo" });
  const path = seoPath(TYPE, theme);
  const url = `${BASE_URL}/${locale}${path}`;

  const languages = hreflangAlternates(BASE_URL, path);

  const title = t(`${TYPE}.${theme}.metaTitle`);
  const description = t(`${TYPE}.${theme}.metaDescription`);

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url, languages },
    openGraph: { title, description, url, type: "website" },
  };
}

export default async function Page({ params }: PageProps) {
  const { locale, theme } = await params;
  setRequestLocale(locale);
  if (!isValidSeoSlug(TYPE, theme)) notFound();
  return <SeoLandingPage type={TYPE} slug={theme} locale={locale} />;
}
