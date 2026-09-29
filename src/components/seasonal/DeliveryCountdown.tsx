"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { nextPhysicalCutoff } from "@/lib/shipping";
import { formatSeasonDate, useSeasonToday } from "./season-client";

/** Live "Quedan X días" to the nearest printed-book cut-off, or the PDF fallback. */
export default function DeliveryCountdown({ serverToday, ctaLabel }: { serverToday: string; ctaLabel: string }) {
  const t = useTranslations("christmasDelivery");
  const locale = useLocale();
  const today = useSeasonToday(serverToday) ?? serverToday;
  const next = nextPhysicalCutoff(today);

  return (
    <div
      aria-live="polite"
      className="mt-10 flex flex-col gap-6 rounded-2xl border border-border-light bg-white p-6 shadow-sm sm:p-8 md:flex-row md:items-center md:justify-between"
    >
      <div className="flex items-start gap-4">
        <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cream sm:flex">
          <span aria-hidden className="material-symbols-outlined text-2xl text-primary">
            {next ? "event" : "download"}
          </span>
        </span>
        <div>
          {next ? (
            <>
              <p className="text-xs font-bold uppercase tracking-wider text-text-muted">{t("countdownLabel")}</p>
              <p className="mt-1 font-display text-3xl font-bold leading-tight text-secondary sm:text-4xl">
                {t("daysLeft", { days: next.daysLeft })}
              </p>
              <p className="mt-2 max-w-xl leading-relaxed text-text-soft">
                {t(`countdownDetail.${next.occasion}`, {
                  date: formatSeasonDate(next.lastOrderDate, locale, true),
                })}
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-2xl font-bold leading-tight text-secondary sm:text-3xl">
                {t("digitalTitle")}
              </p>
              <p className="mt-2 max-w-xl leading-relaxed text-text-soft">{t("digitalDetail")}</p>
            </>
          )}
        </div>
      </div>
      <Link
        href="/crear"
        className="flex h-14 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-8 text-lg font-bold text-white shadow-lg shadow-primary/10 transition-all hover:-translate-y-0.5 hover:bg-primary-hover"
      >
        {next ? ctaLabel : t("ctaDigital")}
        <span aria-hidden className="material-symbols-outlined">arrow_forward</span>
      </Link>
    </div>
  );
}
