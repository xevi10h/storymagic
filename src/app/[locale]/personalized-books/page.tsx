import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import HubPage from "@/components/seo-landing/HubPage";
import { GUIDES, GUIDE_LINK_LABELS, guidesForLocale } from "@/lib/guides";
import { COPY_PARAMS } from "@/lib/product-facts";

const BASE_URL = "https://meapica.es";
const PATH = "/personalized-books";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  const url = `${BASE_URL}/${locale}${PATH}`;
  const languages: Record<string, string> = {};
  for (const loc of routing.locales) languages[loc] = `${BASE_URL}/${loc}${PATH}`;
  languages["x-default"] = `${BASE_URL}/${routing.defaultLocale}${PATH}`;
  // Age range from the story templates (product-facts), never hard-coded in the copy.
  const title = t("hubs.ages.metaTitle", COPY_PARAMS);
  const description = t("hubs.ages.metaDescription", COPY_PARAMS);
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
  const guideLinks = guidesForLocale(locale).map((id) => ({ href: GUIDES[id].path, label: GUIDE_LINK_LABELS[id][locale] }));
  return <HubPage type="ages" locale={locale} extraLinks={guideLinks} />;
}
