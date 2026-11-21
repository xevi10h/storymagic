// "Llega a tiempo o te devolvemos el dinero" copy for today (client and server). The dates come
// from src/lib/shipping.ts (openGuaranteeCutoffs); terms section 5 holds the conditions.
import { dayMonth } from "@/lib/product-facts";
import { openGuaranteeCutoffs } from "@/lib/shipping";

type Translate = (key: string, values?: Record<string, string>) => string;

export interface GuaranteeCopy {
  /** "Llega a tiempo o te devolvemos el dinero". */
  title: string;
  /** Full sentence with the open cut-off(s), for the buy panel and the FAQs. */
  promise: string;
  /** One line for the hero / ad landings, nearest occasion only. */
  short: string;
}

/** null when nothing can be promised today (before November, after the Reyes cut-off). `t` = the "guarantee" namespace. */
export function guaranteeCopy(today: string, locale: string, t: Translate): GuaranteeCopy | null {
  const { christmas, reyes } = openGuaranteeCutoffs(today);
  if (!reyes) return null;
  const reyesDate = dayMonth(reyes, locale);
  if (christmas) {
    const christmasDate = dayMonth(christmas, locale);
    return { title: t("title"), promise: t("promise.both", { christmasDate, reyesDate }), short: t("short.christmas", { date: christmasDate }) };
  }
  return { title: t("title"), promise: t("promise.reyes", { reyesDate }), short: t("short.reyes", { date: reyesDate }) };
}
