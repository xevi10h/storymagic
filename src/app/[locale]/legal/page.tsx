import { Link } from "@/i18n/navigation";
import Navbar from "@/components/landing/Navbar";
import { FAQJsonLd } from "@/components/seo/JsonLd";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { hreflangAlternates } from "@/lib/seo-index";
import { COPY_PARAMS } from "@/lib/product-facts";
import { isPhotoUploadEnabled } from "@/lib/privacy/child-photo-policy";

/**
 * Privacy sections that describe the child-photo processing. While photo upload is off
 * (NEXT_PUBLIC_PHOTO_UPLOAD_ENABLED, build time) they render their `section{n}TextNoPhoto`
 * sibling, so the policy never describes a processing we don't do.
 */
const PHOTO_PRIVACY_SECTIONS: ReadonlySet<number> = new Set([2, 4, 5, 8]);

const BASE_URL = "https://meapica.es";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.terms" });
  const canonicalUrl = `${BASE_URL}/${locale}/legal`;

  const languages = hreflangAlternates(BASE_URL, "/legal");

  const descriptionMap: Record<string, string> = {
    es: "Aviso legal, privacidad, condiciones de uso, cookies, envíos y preguntas frecuentes de Meapica: quién vende, qué datos tratamos y cómo llega tu cuento a casa.",
    ca: "Avís legal, privadesa, condicions d'ús, cookies, enviaments i preguntes freqüents de Meapica: qui ven, quines dades tractem i com arriba el teu conte a casa.",
    en: "Legal notice, privacy policy, terms of use, cookies, shipping and FAQ for Meapica: who sells the books, what data we process and how your book reaches you.",
    fr: "Mentions légales, confidentialité, conditions d'utilisation, cookies, livraison et FAQ de Meapica : qui vend les livres et quelles données nous traitons.",
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
    // No `robots` here: index/follow is the default, and a page-level `robots` would replace
    // the locale layout's (which carries the temporary en/fr noindex, lib/seo-index.ts).
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
  const noPhoto = sectionKey === "privacy" && !isPhotoUploadEnabled();
  return (
    <div className="space-y-8">
      <p className="text-text-soft leading-relaxed">{t(`${sectionKey}.intro`)}</p>
      {Array.from({ length: sectionCount }, (_, i) => (
        <div key={i}>
          <h3 className="font-display text-lg font-bold text-secondary mb-2">
            {t(`${sectionKey}.section${i + 1}Title`)}
          </h3>
          <p className="text-text-soft leading-relaxed">
            {t(
              `${sectionKey}.section${i + 1}${noPhoto && PHOTO_PRIVACY_SECTIONS.has(i + 1) ? "TextNoPhoto" : "Text"}`,
              COPY_PARAMS,
            )}
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
            <span className="material-symbols-outlined text-base" data-icon="arrow_back" aria-hidden />
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
                {t("lastUpdated", { date: "2026-11-07" })}
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
