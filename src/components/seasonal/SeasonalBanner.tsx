"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cx, focusRing } from "@/components/ui";
import { CHRISTMAS_DELIVERY_PATH, giftSeason, seasonBanner } from "@/lib/shipping";
import {
  dismissBanner,
  formatSeasonDate,
  useDismissedBanner,
  useSeasonToday,
} from "./season-client";
import { DISMISSED_ATTR } from "./season-scripts";

/**
 * Slim Christmas / Reyes notice shown above the navbar from 1 Nov to 5 Jan:
 * the nearest printed-book cut-off, then the instant PDF once no print arrives.
 * Server-rendered from `serverToday` (the page's render date, ISR hourly) so it
 * is in the initial HTML and never shifts the page; the live client date takes
 * over after hydration. A dismissed message is hidden before paint by the
 * <style> below + DISMISSED_HEAD_SCRIPT, then unmounted once hydrated.
 */
export default function SeasonalBanner({ serverToday }: { serverToday: string | null }) {
  const t = useTranslations("christmasDelivery.banner");
  const locale = useLocale();
  const pathname = usePathname();
  const today = useSeasonToday(serverToday);
  const dismissed = useDismissedBanner();

  const state = today ? seasonBanner(today) : null;
  if (!today || !state || pathname === CHRISTMAS_DELIVERY_PATH) return null;

  // New message (Christmas → Reyes → PDF, or a new season) shows again once.
  const id = `${giftSeason(today).christmasYear}:${state.kind}:${state.occasion}`;
  if (dismissed === id) return null;

  const main =
    state.kind === "physical"
      ? t(`physical.${state.occasion}`, { date: formatSeasonDate(state.lastOrderDate, locale) })
      : t(`digital.${state.occasion}`);
  const more = state.kind === "physical" ? t("physicalMore") : t("digitalMore");

  return (
    <div data-season-banner={id} className="px-4 pt-2 sm:px-6">
      <style>{`[${DISMISSED_ATTR}="${id}"] [data-season-banner="${id}"]{display:none}`}</style>
      <div
        role="region"
        aria-label={main}
        className="mx-auto -mt-2 mb-2 flex max-w-[1200px] items-center gap-1 rounded-full bg-brand-deep pr-1 text-[13px] leading-snug text-white"
      >
        <Link
          href={CHRISTMAS_DELIVERY_PATH}
          className={cx("group flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-full py-1.5 pl-3.5 sm:pl-4", focusRing)}
        >
          <span aria-hidden className="material-symbols-outlined !text-lg shrink-0 text-white/85">
            {state.kind === "physical" ? "local_shipping" : "download"}
          </span>
          <span className="min-w-0">
            <span className="font-semibold">{main}</span>
            <span className="hidden text-white/75 md:inline"> · {more}</span>
          </span>
          <span className="ml-auto hidden shrink-0 items-center gap-0.5 pl-3 font-bold underline decoration-white/40 underline-offset-2 group-hover:decoration-white sm:inline-flex">
            {t("link")}
            <span aria-hidden className="material-symbols-outlined !text-base transition-transform group-hover:translate-x-0.5">
              arrow_forward
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => dismissBanner(id)}
          aria-label={t("dismiss")}
          className={cx(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/75 transition-colors hover:bg-white/10 hover:text-white",
            focusRing,
          )}
        >
          <span aria-hidden className="material-symbols-outlined !text-lg">close</span>
        </button>
      </div>
    </div>
  );
}
