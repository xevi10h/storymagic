import { useTranslations } from "next-intl";

export default function HowItWorks() {
  const t = useTranslations("howItWorks");

  return (
    <section className="relative border-y border-border-light bg-white py-20" id="manifesto">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "url('https://www.transparenttextures.com/patterns/clean-gray-paper.png')",
        }}
      />
      <div className="relative z-10 mx-auto max-w-6xl px-4">
        <div className="mb-16 text-center">
          <span className="text-sm font-bold uppercase tracking-wider text-primary">
            {t("badge")}
          </span>
          <h2 className="mt-2 font-display text-4xl font-bold text-secondary">
            {t("title")}
          </h2>
        </div>

        <div className="relative grid grid-cols-1 gap-12 md:grid-cols-3">
          {/* Dotted connector line */}
          <div className="absolute top-12 right-[16%] left-[16%] z-0 hidden h-0.5 border-t-2 border-dashed border-border-light md:block" />

          {/* Step 1 */}
          <div className="group flex flex-col items-center text-center">
            <div className="relative z-10 mb-6 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-sand shadow-md transition-transform group-hover:scale-105">
              <span className="material-symbols-outlined text-4xl text-primary">auto_stories</span>
            </div>
            <h3 className="mb-3 font-display text-xl font-bold text-secondary">{t("step1Title")}</h3>
            <p className="max-w-xs text-sm leading-relaxed text-text-soft">
              {t("step1Description")}
            </p>
          </div>

          {/* Step 2 */}
          <div className="group flex flex-col items-center text-center">
            <div className="relative z-10 mb-6 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-earth shadow-md transition-transform group-hover:scale-105">
              <span className="material-symbols-outlined text-4xl text-secondary">brush</span>
            </div>
            <h3 className="mb-3 font-display text-xl font-bold text-secondary">{t("step2Title")}</h3>
            <p className="max-w-xs text-sm leading-relaxed text-text-soft">
              {t("step2Description")}
            </p>
          </div>

          {/* Step 3 */}
          <div className="group flex flex-col items-center text-center">
            <div className="relative z-10 mb-6 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-sage shadow-md transition-transform group-hover:scale-105">
              <span className="material-symbols-outlined text-4xl text-success">inventory_2</span>
            </div>
            <h3 className="mb-3 font-display text-xl font-bold text-secondary">{t("step3Title")}</h3>
            <p className="max-w-xs text-sm leading-relaxed text-text-soft">
              {t("step3Description")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
