// Facts the guide copy interpolates: product facts + this season's Christmas and Reyes cut-offs.

import { factParams } from "@/lib/product-facts";
import { formatPrice } from "@/lib/pricing";
import { earliestPrintedCutoff, spainToday } from "@/lib/shipping";
import type { GuideFacts } from "./types";

const INTL_LOCALE: Record<string, string> = { es: "es-ES", ca: "ca-ES", en: "en-GB", fr: "fr-FR" };

export function guideFacts(locale: string): GuideFacts {
  const today = spainToday();
  const dayMonth = new Intl.DateTimeFormat(INTL_LOCALE[locale] ?? "es-ES", { timeZone: "UTC", day: "numeric", month: "long" });
  const cutoff = (occasion: "christmas" | "reyes") => dayMonth.format(new Date(`${earliestPrintedCutoff(today, occasion)}T00:00:00Z`));
  return {
    ...factParams((cents) => formatPrice(cents, locale)),
    reyesDate: cutoff("reyes"),
    christmasDate: cutoff("christmas"),
  };
}
