import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Navbar from "@/components/landing/Navbar";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.terms");
  return { title: t("title") };
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
