"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { CHRISTMAS_DELIVERY_PATH, giftSeason, seasonBanner } from "@/lib/shipping";
import {
  dismissBanner,
  formatSeasonDate,
  useDismissedBanner,
  useSeasonToday,
} from "./season-client";

/**
 * Slim Christmas / Reyes notice shown above the navbar from 1 Nov to 5 Jan:
 * the nearest printed-book cut-off, then the instant PDF once no print arrives.
 * Client-only (date + localStorage), so it never causes a hydration mismatch.
 */
export default function SeasonalBanner() {
  const t = useTranslations("christmasDelivery.banner");
  const locale = useLocale();
  const pathname = usePathname();
  const today = useSeasonToday(null);
  const dismissed = useDismissedBanner();

  const state = today ? seasonBanner(today) : null;
  if (!today || !state || dismissed === undefined || pathname === CHRISTMAS_DELIVERY_PATH) return null;

  // New message (Christmas → Reyes → PDF, or a new season) shows again once.
  const id = `${giftSeason(today).christmasYear}:${state.kind}:${state.occasion}`;
  if (dismissed === id) return null;

  const main =
    state.kind === "physical"
      ? t(`physical.${state.occasion}`, { date: formatSeasonDate(state.lastOrderDate, locale) })
      : t(`digital.${state.occasion}`);
  const more = state.kind === "physical" ? t("physicalMore") : t("digitalMore");

  return (
    <div
      role="region"
      aria-label={main}
      className="mx-auto -mt-2 mb-2 flex max-w-6xl items-center gap-1 rounded-lg bg-secondary pr-1 text-[13px] leading-snug text-white shadow-sm"
    >
      <Link
        href={CHRISTMAS_DELIVERY_PATH}
        className="group flex min-w-0 flex-1 items-center gap-2 py-2 pl-3 sm:pl-4"
      >
        <span aria-hidden className="material-symbols-outlined shrink-0 text-lg text-primary-light">
          {state.kind === "physical" ? "local_shipping" : "download"}
        </span>
        <span className="min-w-0">
          <span className="font-semibold">{main}</span>
          <span className="hidden text-white/75 md:inline"> · {more}</span>
        </span>
        <span className="ml-auto hidden shrink-0 items-center gap-0.5 pl-3 font-semibold text-primary-light group-hover:underline sm:inline-flex">
          {t("link")}
          <span aria-hidden className="material-symbols-outlined text-base">arrow_forward</span>
        </span>
      </Link>
      <button
        type="button"
        onClick={() => dismissBanner(id)}
        aria-label={t("dismiss")}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      >
        <span aria-hidden className="material-symbols-outlined text-lg">close</span>
      </button>
    </div>
  );
}
