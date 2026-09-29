"use client";

import { useLocale, useTranslations } from "next-intl";
import { PRICING, formatPrice, type BookFormat, type PhysicalFormat } from "@/lib/pricing";
import { SEASON_OCCASIONS, SHIPPING_REGIONS, formatDeadlines, giftSeason, type FormatDeadline } from "@/lib/shipping";
import { formatSeasonDate, useSeasonToday } from "./season-client";

const FORMATS: { id: BookFormat; icon: string }[] = [
  { id: "hardcover", icon: "book" },
  { id: "softcover", icon: "menu_book" },
  { id: "digital_pdf", icon: "download" },
];

/** Last order date per format and occasion (Nochebuena / Reyes), live against today. */
export default function DeadlineCards({ serverToday }: { serverToday: string }) {
  const t = useTranslations("christmasDelivery");
  const tp = useTranslations("pricing");
  const locale = useLocale();
  const today = useSeasonToday(serverToday) ?? serverToday;
  const season = giftSeason(today);

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
      {FORMATS.map(({ id, icon }) => (
        <article key={id} className="flex flex-col rounded-2xl border border-border-light bg-white shadow-sm">
          <header className="flex items-center gap-3 border-b border-border-light/60 px-6 py-5">
            <span aria-hidden className="material-symbols-outlined text-2xl text-primary">
              {icon}
            </span>
            <div>
              <h3 className="font-display text-xl font-bold leading-tight text-secondary">{tp(`${id}.label`)}</h3>
              <p className="text-sm text-text-muted">
                {formatPrice(PRICING[id].price, locale)} · {tp("vatIncluded")}
              </p>
            </div>
          </header>

          <dl className="flex flex-1 flex-col divide-y divide-border-light/60">
            {SEASON_OCCASIONS.map((occasion) => (
              <div key={occasion} className="px-6 py-5">
                <dt className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-secondary">
                    {t(`occasion.${occasion}`)}
                  </span>
                  <span className="text-xs text-text-muted">
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
            <p className="border-t border-border-light/60 px-6 py-4 text-sm leading-relaxed text-text-soft">
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
      <p className={`font-display text-lg font-bold leading-snug ${deadline.open ? "text-text-main" : "text-text-muted line-through decoration-1"}`}>
        {t("orderBy", { date })}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {deadline.open ? (
          <Status tone={deadline.daysLeft === 0 ? "urgent" : "open"} label={t("daysLeft", { days: deadline.daysLeft })} />
        ) : (
          <Status tone="closed" label={t("closed")} />
        )}
        <span className="text-xs text-text-muted">
          {allRegions ? t("regionsAll") : deadline.regions.map((r) => t(`regions.${r}`)).join(", ")}
        </span>
      </div>
    </div>
  );
}

function Status({ tone, label }: { tone: "open" | "urgent" | "closed"; label: string }) {
  const cls =
    tone === "urgent"
      ? "bg-primary text-white"
      : tone === "open"
        ? "bg-sage text-success"
        : "bg-cream text-text-muted";
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${cls}`}>{label}</span>;
}
