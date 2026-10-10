import { Link } from "@/i18n/navigation";
import Navbar from "@/components/landing/Navbar";
import { FAQJsonLd } from "@/components/seo/JsonLd";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { COPY_PARAMS } from "@/lib/product-facts";

const BASE_URL = "https://meapica.shop";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.terms" });
  const canonicalUrl = `${BASE_URL}/${locale}/legal`;

  const languages: Record<string, string> = {};
  for (const loc of routing.locales) {
    languages[loc] = `${BASE_URL}/${loc}/legal`;
  }
  languages["x-default"] = `${BASE_URL}/${routing.defaultLocale}/legal`;

  const descriptionMap: Record<string, string> = {
    es: "Política de privacidad, condiciones de uso, cookies, preguntas frecuentes y envíos de Meapica.",
    ca: "Política de privadesa, condicions d'ús, cookies, preguntes freqüents i enviaments de Meapica.",
    en: "Privacy policy, terms of use, cookies, FAQ and shipping information for Meapica.",
    fr: "Politique de confidentialité, conditions d'utilisation, cookies, FAQ et informations de livraison de Meapica.",
  };

  const description = descriptionMap[locale] || descriptionMap.es;
  return {
    title: t("title"),
    description,
    alternates: {
      canonical: canonicalUrl,
      languages,
    },
    // Own og:url (the layout's would say /{locale}); same shape as the other pages.
    openGraph: { title: t("title"), description, url: canonicalUrl, type: "website" },
    robots: {
      index: true,
      follow: true,
    },
  };
}

// Reusable section renderer
function LegalSection({
  t,
  sectionKey,
  sectionCount,
}: {
  t: (key: string, values?: Record<string, string | number>) => string;
  sectionKey: string;
  sectionCount: number;
}) {
  return (
    <div className="space-y-8">
      <p className="text-text-soft leading-relaxed">{t(`${sectionKey}.intro`)}</p>
      {Array.from({ length: sectionCount }, (_, i) => (
        <div key={i}>
          <h3 className="font-display text-lg font-bold text-secondary mb-2">
            {t(`${sectionKey}.section${i + 1}Title`)}
          </h3>
          <p className="text-text-soft leading-relaxed">
            {t(`${sectionKey}.section${i + 1}Text`, COPY_PARAMS)}
          </p>
        </div>
      ))}
    </div>
  );
}

export default async function LegalPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "legal" });

  // The legal notice comes first: its title is the page's <title>, so it is also the <h1>.
  const pages = [
    { id: "terms", sectionCount: 8 },
    { id: "privacy", sectionCount: 8 },
    { id: "cookies", sectionCount: 4 },
    { id: "faq", sectionCount: 6 },
    { id: "shipping", sectionCount: 4 },
  ] as const;

  // FAQPage structured data — enables FAQ rich results in Google SERP
  const faqQuestions = Array.from({ length: 6 }, (_, i) => ({
    question: t(`faq.section${i + 1}Title`),
    answer: t(`faq.section${i + 1}Text`, COPY_PARAMS),
  }));

  return (
    <>
      <FAQJsonLd questions={faqQuestions} />
      <Navbar />
      <main className="min-h-screen bg-white pt-24 pb-16">
        <div className="mx-auto max-w-3xl px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-brand-text transition-colors mb-10"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            {t("backHome")}
          </Link>

          {pages.map(({ id, sectionCount }, index) => {
            // One <h1> per page (the legal notice, same as <title>); the others are h2, same look.
            const Heading = index === 0 ? "h1" : "h2";
            return (
            <article key={id} id={id} className={index > 0 ? "mt-16 pt-16 border-t border-border-light" : ""}>
              <Heading className="font-display text-3xl font-bold text-secondary mb-2">
                {t(`${id}.title`)}
              </Heading>
              <p className="text-xs text-text-muted mb-8">
                {t("lastUpdated", { date: "2026-10-09" })}
              </p>
              <LegalSection t={t} sectionKey={id} sectionCount={sectionCount} />
            </article>
            );
          })}
        </div>
      </main>
    </>
  );
}
