"use client";

import { useLocale, useTranslations } from "next-intl";
import { PRICING, formatPrice, type BookFormat, type PhysicalFormat } from "@/lib/pricing";
import { SEASON_OCCASIONS, SHIPPING_REGIONS, formatDeadlines, giftSeason, type FormatDeadline } from "@/lib/shipping";
import { brandBadge } from "@/components/ui";
import { formatSeasonDate, useSeasonToday } from "./season-client";

const FORMATS: BookFormat[] = ["hardcover", "softcover", "digital_pdf"];

/** Last order date per format and occasion (Nochebuena / Reyes), live against today. */
export default function DeadlineCards({ serverToday }: { serverToday: string }) {
  const t = useTranslations("christmasDelivery");
  const tp = useTranslations("pricing");
  const locale = useLocale();
  const today = useSeasonToday(serverToday) ?? serverToday;
  const season = giftSeason(today);

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
      {FORMATS.map((id) => (
        <article key={id} className="flex flex-col overflow-hidden rounded-2xl border-2 border-line bg-paper">
          <header className="border-b-2 border-line px-5 py-4 sm:px-6">
            <h3 className="font-display text-xl font-bold leading-tight text-ink">{tp(`${id}.label`)}</h3>
            <p className="mt-0.5 text-sm text-ink-soft">
              <span className="font-bold tabular-nums text-brand-deep">{formatPrice(PRICING[id].price, locale)}</span>
              <span> · {tp("vatIncluded")}</span>
            </p>
          </header>

          <dl className="flex flex-1 flex-col divide-y divide-line">
            {SEASON_OCCASIONS.map((occasion) => (
              <div key={occasion} className="px-5 py-4 sm:px-6 sm:py-5">
                <dt className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                    {t(`occasion.${occasion}`)}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {t("homeBy", { date: formatSeasonDate(season.deliverBy[occasion], locale) })}
                  </span>
                </dt>
                <dd className="mt-2">
                  {id === "digital_pdf" ? (
                    <Status tone="open" label={t("pdfAlwaysOnTime")} />
                  ) : (
                    formatDeadlines(today, id as PhysicalFormat, occasion).map((d) => (
                      <DeadlineLine key={d.lastOrderDate} deadline={d} />
                    ))
                  )}
                </dd>
              </div>
            ))}
          </dl>

          {id === "digital_pdf" && (
            <p className="border-t-2 border-line px-5 py-4 text-sm leading-relaxed text-ink-body sm:px-6">
              {t("pdfDetail")}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

function DeadlineLine({ deadline }: { deadline: FormatDeadline }) {
  const t = useTranslations("christmasDelivery");
  const locale = useLocale();
  const allRegions = deadline.regions.length === SHIPPING_REGIONS.length;
  const date = formatSeasonDate(deadline.lastOrderDate, locale, true);

  return (
    <div className="mt-1 first:mt-0">
      <p className={`font-display text-lg font-bold leading-snug ${deadline.open ? "text-ink" : "text-ink-muted line-through decoration-1"}`}>
        {t("orderBy", { date })}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {deadline.open ? (
          <Status tone={deadline.daysLeft === 0 ? "urgent" : "open"} label={t("daysLeft", { days: deadline.daysLeft })} />
        ) : (
          <Status tone="closed" label={t("closed")} />
        )}
        <span className="text-xs text-ink-muted">
          {allRegions ? t("regionsAll") : deadline.regions.map((r) => t(`regions.${r}`)).join(", ")}
        </span>
      </div>
    </div>
  );
}

function Status({ tone, label }: { tone: "open" | "urgent" | "closed"; label: string }) {
  const cls =
    tone === "urgent"
      ? brandBadge
      : tone === "open"
        ? "bg-success/10 text-success"
        : "bg-line text-ink-soft";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}`}>{label}</span>;
}
