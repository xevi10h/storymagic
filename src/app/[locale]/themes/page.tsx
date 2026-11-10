import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { hreflangAlternates } from "@/lib/seo-index";
import HubPage from "@/components/seo-landing/HubPage";

const BASE_URL = "https://meapica.es";
const PATH = "/themes";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  const url = `${BASE_URL}/${locale}${PATH}`;
  const languages = hreflangAlternates(BASE_URL, PATH);
  const title = t("hubs.themes.metaTitle");
  const description = t("hubs.themes.metaDescription");
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url, languages },
    openGraph: { title, description, url, type: "website" },
  };
}

export default async function Page({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HubPage type="themes" locale={locale} />;
}
