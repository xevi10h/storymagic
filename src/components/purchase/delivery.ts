"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSeasonToday, formatSeasonDate } from "@/components/seasonal/season-client";
import { deliveryWindow, seasonBanner, type SeasonBanner } from "@/lib/shipping";
import type { BookFormat } from "@/lib/pricing";

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
