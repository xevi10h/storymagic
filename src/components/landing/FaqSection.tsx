import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

// Conversion-ordered subset of the legal FAQ: lead with the objections that
// block a gift purchase (shipping time, "will it really look like my child?"),
// then reassurance (how it works, paper quality, size, post-purchase changes).
// Reuses the existing `legal.faq.*` copy (all 4 locales) — single source of truth.
const FAQ_ORDER = [2, 3, 1, 4, 6, 5] as const;

export default function FaqSection() {
  const t = useTranslations("legal");
  const th = useTranslations("hero");

  return (
    <section className="bg-white px-4 py-24" id="faq">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 text-center">
          <h2 className="mb-4 font-display text-4xl font-bold text-secondary">
            {t("faq.title")}
          </h2>
          <p className="text-text-soft">{t("faq.intro")}</p>
        </div>

        <div className="flex flex-col gap-4">
          {FAQ_ORDER.map((n) => (
            <details
              key={n}
              className="group rounded-xl border border-border-light bg-cream/40 transition-colors open:bg-cream/70"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 font-display text-lg font-bold text-secondary [&::-webkit-details-marker]:hidden">
                {t(`faq.section${n}Title`)}
                <span className="material-symbols-outlined shrink-0 text-text-muted transition-transform duration-300 group-open:rotate-180">
                  expand_more
                </span>
              </summary>
              <p className="px-6 pb-6 leading-relaxed text-text-soft">
                {t(`faq.section${n}Text`)}
              </p>
            </details>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/crear"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-4 text-lg font-bold text-white shadow-lg shadow-primary/10 transition-all hover:-translate-y-1 hover:bg-primary-hover"
          >
            {th("cta")}
            <span className="material-symbols-outlined">arrow_forward</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
