// What the Advent book CTA may promise on a given day (page + email). Computed from the
// live rules, never hardcoded: the printed Reyes cut-off (src/lib/shipping.ts), the Pack
// Reyes second-book code while it is issued (src/lib/second-book.ts) and the catalogue
// prices (src/lib/pricing.ts). After the cut-off the CTA switches to the instant PDF.

import { PRICING, formatPrice } from "@/lib/pricing";
import { BOOK_INNER_PAGES, PRINTED_FROM_CENTS } from "@/lib/product-facts";
import { SECOND_BOOK_PRICE_CENTS, secondBookIssuing } from "@/lib/second-book";
import { earliestPrintedCutoff, giftSeason } from "@/lib/shipping";
import type { AdventOffer } from "./email";

const DATE_LOCALE = { es: "es-ES", ca: "ca-ES" } as const;

export function adventOffer(today: string, locale: "es" | "ca"): AdventOffer {
  const cutoff = earliestPrintedCutoff(today, "reyes");
  const printedOpen = today <= cutoff;
  const deadline = printedOpen
    ? new Intl.DateTimeFormat(DATE_LOCALE[locale], { timeZone: "UTC", day: "numeric", month: "long" }).format(new Date(`${cutoff}T00:00:00Z`))
    : null;
  return {
    deadline,
    packPrice: printedOpen && secondBookIssuing(today, cutoff) ? formatPrice(SECOND_BOOK_PRICE_CENTS, locale) : null,
    latePdfPrice: !printedOpen && today <= giftSeason(today).ends ? formatPrice(PRICING.digital_pdf.price, locale) : null,
    fromPrice: formatPrice(PRINTED_FROM_CENTS, locale),
    pages: BOOK_INNER_PAGES,
  };
}
