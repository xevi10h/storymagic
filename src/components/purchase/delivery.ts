"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSeasonToday, formatSeasonDate } from "@/components/seasonal/season-client";
import { arrivalPromise, deliveryWindow, earliestPrintedCutoff, seasonBanner, type SeasonBanner } from "@/lib/shipping";
import { formatPrice, type BookFormat } from "@/lib/pricing";
import { SECOND_BOOK_PRICE_CENTS, secondBookIssuing, secondBookLastDay } from "@/lib/second-book";

/**
 * "Llega entre el 9 y el 15 de octubre" for a printed format ordered today (Spain),
 * or null for the PDF / before hydration. Client-only (reads today's date).
 */
export function useDeliveryLine(format: BookFormat): string | null {
  const t = useTranslations("crear.purchase");
  const locale = useLocale();
  const today = useSeasonToday(null);
  if (!today || format === "digital_pdf") return null;
  const { from, to } = deliveryWindow(today, format);
  if (from.slice(0, 7) === to.slice(0, 7)) {
    return t("deliverySameMonth", { fromDay: Number(from.slice(8, 10)), to: formatSeasonDate(to, locale) });
  }
  return t("deliveryCrossMonth", { from: formatSeasonDate(from, locale), to: formatSeasonDate(to, locale) });
}

/** The Christmas / Reyes notice for today (1 Nov – 5 Jan), with its formatted cut-off. */
export function useSeasonNotice(): { state: NonNullable<SeasonBanner>; text: string } | null {
  const t = useTranslations("christmasDelivery.banner");
  const locale = useLocale();
  const today = useSeasonToday(null);
  const state = today ? seasonBanner(today) : null;
  if (!state) return null;
  const text =
    state.kind === "physical"
      ? t(`physical.${state.occasion}`, { date: formatSeasonDate(state.lastOrderDate, locale) })
      : t(`digital.${state.occasion}`);
  return { state, text };
}

/** Pack Reyes line ("y el 2.º libro en tapa blanda a 19,90 €") while printed orders earn the code, else null. */
export function useSecondBookPromo(): string | null {
  const t = useTranslations("crear.purchase");
  const locale = useLocale();
  const today = useSeasonToday(null);
  if (!today) return null;
  const cutoff = earliestPrintedCutoff(today, "reyes");
  if (!secondBookIssuing(today, cutoff)) return null;
  return t("secondBookPromo", { price: formatPrice(SECOND_BOOK_PRICE_CENTS, locale), until: formatSeasonDate(secondBookLastDay(cutoff), locale) });
}

/**
 * The "llega a tiempo" promise for a printed format ordered today (1 Nov – 5 Jan), or null
 * (PDF, outside the season, before hydration). `late` = only the PDF arrives in time.
 */
export function useArrivalPromise(format: BookFormat): { title: string; detail: string | null; late: boolean } | null {
  const t = useTranslations("crear.purchase.promise");
  const locale = useLocale();
  const today = useSeasonToday(null);
  if (!today || format === "digital_pdf") return null;
  const promise = arrivalPromise(today, format);
  if (!promise) return null;
  if (promise.kind === "late") return { title: t(`late.${promise.occasion}`), detail: null, late: true };
  const detail =
    promise.daysLeft === 0
      ? t(`cutoffToday.${promise.occasion}`)
      : t(`cutoff.${promise.occasion}`, { date: formatSeasonDate(promise.lastOrderDate, locale) });
  return { title: t(`onTime.${promise.occasion}`), detail, late: false };
}
