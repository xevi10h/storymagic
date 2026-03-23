import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Navbar from "@/components/landing/Navbar";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";

const BASE_URL = "https://meapica.com";

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

  return {
    title: t("title"),
    description: descriptionMap[locale] || descriptionMap.es,
    alternates: {
      canonical: canonicalUrl,
      languages,
    },
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
  t: (key: string) => string;
  sectionKey: string;
  sectionCount: number;
}) {
  return (
    <div className="space-y-8">
      <p className="text-text-soft leading-relaxed">{t(`${sectionKey}.intro`)}</p>
      {Array.from({ length: sectionCount }, (_, i) => (
        <div key={i}>
          <h2 className="font-display text-lg font-bold text-secondary mb-2">
            {t(`${sectionKey}.section${i + 1}Title`)}
          </h2>
          <p className="text-text-soft leading-relaxed">
            {t(`${sectionKey}.section${i + 1}Text`)}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function LegalPage() {
  const t = useTranslations("legal");

  const pages = [
    { id: "privacy", sectionCount: 7 },
    { id: "terms", sectionCount: 6 },
    { id: "cookies", sectionCount: 4 },
    { id: "faq", sectionCount: 6 },
    { id: "shipping", sectionCount: 4 },
  ] as const;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white pt-24 pb-16">
        <div className="mx-auto max-w-3xl px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-create-primary transition-colors mb-10"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            {t("backHome")}
          </Link>

          {pages.map(({ id, sectionCount }, index) => (
            <article key={id} id={id} className={index > 0 ? "mt-16 pt-16 border-t border-border-light" : ""}>
              <h1 className="font-display text-3xl font-bold text-secondary mb-2">
                {t(`${id}.title`)}
              </h1>
              <p className="text-xs text-text-muted mb-8">
                {t("lastUpdated", { date: "2026-03-08" })}
              </p>
              <LegalSection t={t} sectionKey={id} sectionCount={sectionCount} />
            </article>
          ))}
        </div>
      </main>
    </>
  );
}
