// Facts the guide copy interpolates: product facts + this season's Reyes cut-off.

import { factParams } from "@/lib/product-facts";
import { formatPrice } from "@/lib/pricing";
import { earliestPrintedCutoff, spainToday } from "@/lib/shipping";
import type { GuideFacts } from "./types";

const INTL_LOCALE: Record<string, string> = { es: "es-ES", ca: "ca-ES", en: "en-GB", fr: "fr-FR" };

export function guideFacts(locale: string): GuideFacts {
  const reyes = earliestPrintedCutoff(spainToday(), "reyes");
  return {
    ...factParams((cents) => formatPrice(cents, locale)),
    reyesDate: new Intl.DateTimeFormat(INTL_LOCALE[locale] ?? "es-ES", { timeZone: "UTC", day: "numeric", month: "long" }).format(
      new Date(`${reyes}T00:00:00Z`),
    ),
  };
}
