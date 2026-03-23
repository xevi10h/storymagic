import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function Hero() {
  const t = useTranslations("hero");

  return (
    <header className="relative overflow-hidden px-4 pt-32 pb-20">
      {/* Ambient blurs */}
      <div className="absolute top-0 right-0 -z-10 h-[600px] w-[600px] -translate-y-1/2 translate-x-1/3 rounded-full bg-primary-light/20 blur-[100px] mix-blend-multiply" />
      <div className="absolute bottom-0 left-0 -z-10 h-[500px] w-[500px] -translate-x-1/4 translate-y-1/4 rounded-full bg-badge-bg/40 blur-[80px] mix-blend-multiply" />

      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
        {/* Left — Text */}
        <div className="relative z-10 flex flex-col gap-6">
          <div className="inline-flex w-fit -rotate-1 items-center gap-2 rounded-md border border-badge-border bg-badge-bg px-4 py-1.5 shadow-sm">
            <span className="material-symbols-outlined text-sm text-secondary">spa</span>
            <span className="text-xs font-bold uppercase tracking-wider text-secondary">
              {t("badge")}
            </span>
          </div>

          <h1 className="font-display text-5xl font-bold leading-[1.1] tracking-tight text-secondary lg:text-7xl">
            {t("titleStart")} <br />
            <span className="italic text-primary">{t("titleHighlight")}</span> {t("titleEnd")}
          </h1>

          <p className="max-w-lg text-lg leading-relaxed text-text-soft lg:text-xl">
            {t("description")}
          </p>

          <div className="flex flex-col gap-4 pt-4 sm:flex-row">
            <Link
              href="/crear"
              className="flex h-14 items-center justify-center gap-2 rounded-lg bg-primary px-8 text-lg font-bold text-white shadow-lg shadow-primary/10 transition-all hover:-translate-y-1 hover:bg-primary-hover"
            >
              {t("cta")}
              <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
            <a
              href="#artisanal"
              className="flex items-center justify-center gap-2 text-lg font-bold text-secondary underline decoration-border-light decoration-2 underline-offset-4 transition-all hover:text-primary hover:decoration-primary"
            >
              {t("secondaryCta")}
            </a>
          </div>

          <div className="mt-2 flex items-center gap-4 border-t border-border-light pt-6 text-sm font-medium text-text-soft">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-xl text-success">forest</span>
              <span>{t("fscPaper")}</span>
            </div>
            <span className="text-text-muted">|</span>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-xl text-primary-hover">local_shipping</span>
              <span>{t("artisanalShipping")}</span>
            </div>
          </div>
        </div>

        {/* Right — Polaroid image */}
        <div className="group relative">
          <div className="relative w-full transform rotate-1 bg-white p-3 shadow-xl transition-transform duration-500 aspect-[4/5] group-hover:rotate-0">
            <div className="pointer-events-none absolute inset-0 z-20 m-2 border-2 border-cream" />
            <div className="relative h-full w-full overflow-hidden bg-cream">
              <Image
                alt="Child reading a physical book in a cozy nook with warm lighting"
                className="h-full w-full object-cover sepia-[0.1] contrast-[1.1]"
                src="/images/hero-child-reading.png"
                width={512}
                height={512}
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-80" />
            </div>
            <div className="absolute right-6 bottom-6 left-6 z-30 text-white">
              <div className="border-l-4 border-primary bg-black/30 p-4 backdrop-blur-md">
                <p className="font-display mb-1 text-xl font-bold text-cream">{t("imageCaption")}</p>
                <p className="text-sm text-text-light">
                  {t("imageSubcaption")}
                </p>
              </div>
            </div>
          </div>
          <div className="absolute -inset-4 -z-10 rotate-[-2deg] border border-cream bg-warm shadow-sm" />
        </div>
      </div>
    </header>
  );
}
