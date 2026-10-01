"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Eyebrow, buttonClass } from "@/components/ui";
import { nextPhysicalCutoff } from "@/lib/shipping";
import { formatSeasonDate, useSeasonToday } from "./season-client";

/** Live "Quedan X días" to the nearest printed-book cut-off, or the PDF fallback. */
export default function DeliveryCountdown({ serverToday, ctaLabel }: { serverToday: string; ctaLabel: string }) {
  const t = useTranslations("christmasDelivery");
  const locale = useLocale();
  const today = useSeasonToday(serverToday) ?? serverToday;
  const next = nextPhysicalCutoff(today);

  return (
    <div className="mt-8 flex flex-col gap-6 rounded-2xl border-2 border-line bg-surface p-5 sm:p-7 md:flex-row md:items-center md:justify-between lg:mt-10">
      <div aria-live="polite" className="min-w-0">
        {next ? (
          <>
            <Eyebrow tone="muted">{t("countdownLabel")}</Eyebrow>
            <p className="mt-1 font-display text-[28px] font-bold leading-tight text-ink tabular-nums sm:text-4xl">
              {t("daysLeft", { days: next.daysLeft })}
            </p>
            <p className="mt-2 max-w-xl text-base leading-relaxed text-ink-body">
              {t(`countdownDetail.${next.occasion}`, {
                date: formatSeasonDate(next.lastOrderDate, locale, true),
              })}
            </p>
          </>
        ) : (
          <>
            <p className="font-display text-2xl font-bold leading-tight text-ink sm:text-3xl">{t("digitalTitle")}</p>
            <p className="mt-2 max-w-xl text-base leading-relaxed text-ink-body">{t("digitalDetail")}</p>
          </>
        )}
      </div>
      <Link id="hero-cta" href="/create" className={buttonClass({ className: "min-h-14 shrink-0 sm:px-8" })}>
        {next ? ctaLabel : t("ctaDigital")}
        <span aria-hidden className="material-symbols-outlined text-xl transition-transform group-hover:translate-x-1">
          arrow_forward
        </span>
      </Link>
    </div>
  );
}
