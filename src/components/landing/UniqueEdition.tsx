import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function UniqueEdition() {
  const t = useTranslations("uniqueEdition");

  return (
    <section className="relative overflow-hidden bg-cream py-24">
      {/* Subtle background texture — faint ruled lines like aged notebook paper */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, #8B4513 0px, #8B4513 1px, transparent 1px, transparent 32px)",
        }}
      />

      <div className="mx-auto max-w-4xl px-4">
        {/* Central certificate-style card */}
        <div className="relative border border-border-light bg-white px-8 py-16 shadow-sm sm:px-16">
          {/* Corner ornaments */}
          <div className="absolute top-4 left-4 h-8 w-8 border-t-2 border-l-2 border-accent/30" />
          <div className="absolute top-4 right-4 h-8 w-8 border-t-2 border-r-2 border-accent/30" />
          <div className="absolute bottom-4 left-4 h-8 w-8 border-b-2 border-l-2 border-accent/30" />
          <div className="absolute bottom-4 right-4 h-8 w-8 border-b-2 border-r-2 border-accent/30" />

          <div className="flex flex-col items-center text-center">
            {/* Wax seal — pure CSS */}
            <div className="relative mb-8">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-accent shadow-lg shadow-accent/20">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-white/30">
                  <span className="font-display text-2xl font-bold text-white tracking-tight">1/1</span>
                </div>
              </div>
              {/* Drip effect */}
              <div className="absolute -bottom-2 left-1/2 h-4 w-3 -translate-x-1/2 rounded-b-full bg-accent" />
            </div>

            {/* Edition label */}
            <span className="mb-6 text-xs font-bold uppercase tracking-[0.3em] text-accent">
              {t("badge")}
            </span>

            {/* Title */}
            <h2 className="font-display text-4xl font-bold leading-tight text-secondary sm:text-5xl">
              {t("titleStart")}{" "}
              <span className="italic text-primary">{t("titleHighlight")}</span>{" "}
              {t("titleEnd")}
            </h2>

            {/* Decorative divider */}
            <div className="my-8 flex items-center gap-3">
              <div className="h-px w-12 bg-border-light" />
              <span className="material-symbols-outlined text-sm text-text-muted">diamond</span>
              <div className="h-px w-12 bg-border-light" />
            </div>

            {/* Description */}
            <p className="max-w-xl text-lg leading-relaxed text-text-soft">
              {t("description")}
            </p>

            {/* Three uniqueness pillars */}
            <div className="mt-12 grid w-full grid-cols-1 gap-8 sm:grid-cols-3">
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border-light bg-badge-bg">
                  <span className="material-symbols-outlined text-xl text-secondary">auto_stories</span>
                </div>
                <h3 className="font-display text-lg font-bold text-secondary">{t("pillar1Title")}</h3>
                <p className="text-sm leading-relaxed text-text-soft">{t("pillar1Description")}</p>
              </div>

              <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border-light bg-badge-bg">
                  <span className="material-symbols-outlined text-xl text-secondary">brush</span>
                </div>
                <h3 className="font-display text-lg font-bold text-secondary">{t("pillar2Title")}</h3>
                <p className="text-sm leading-relaxed text-text-soft">{t("pillar2Description")}</p>
              </div>

              <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border-light bg-badge-bg">
                  <span className="material-symbols-outlined text-xl text-secondary">fingerprint</span>
                </div>
                <h3 className="font-display text-lg font-bold text-secondary">{t("pillar3Title")}</h3>
                <p className="text-sm leading-relaxed text-text-soft">{t("pillar3Description")}</p>
              </div>
            </div>

            {/* CTA */}
            <Link
              href="/crear"
              className="mt-12 flex h-14 items-center justify-center gap-2 rounded-lg bg-primary px-8 text-lg font-bold text-white shadow-lg shadow-primary/10 transition-all hover:-translate-y-1 hover:bg-primary-hover"
            >
              {t("cta")}
              <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
          </div>
        </div>

        {/* Backing card (rotated, like other sections) */}
        <div className="pointer-events-none absolute inset-0 mx-auto max-w-4xl px-4">
          <div className="absolute top-[calc(6rem-8px)] right-4 bottom-[calc(6rem-8px)] left-4 -z-10 -rotate-1 border border-border-medium bg-tan sm:right-16 sm:left-16" />
        </div>
      </div>
    </section>
  );
}
