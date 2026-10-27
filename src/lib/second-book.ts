// "Pack Reyes" (owner decision 2026-10-26): every printed book paid between the campaign
// start and the printed Reyes cut-off earns ONE single-use code for a second book in
// softcover at 19,90 € IVA incluido (34,90 € − 15 €), valid until 6 January. Any story,
// any child: it can be shared with another family. A book paid with that code earns none.
// Pure rules, no imports (client + server; dates come from src/lib/shipping.ts at the
// call site). Stripe side: src/lib/growth/second-book.ts.
//
// Check: node --experimental-strip-types src/lib/second-book.check.mjs

/** 15 € off, applies_to = the softcover book product only (scripts/stripe-setup-catalog.mts). */
export const SECOND_BOOK_COUPON_ID = "meapica_second_book_softcover";
export const SECOND_BOOK_DISCOUNT_CENTS = 1500;
/** What the buyer pays (softcover 3490 − 1500). Kept in sync by the check. */
export const SECOND_BOOK_PRICE_CENTS = 1990;
// ponytail: one campaign; move this date for the next season.
export const SECOND_BOOK_FROM = "2026-10-26";

/** Black Friday week (owner 2026-10-26): no price cut, the pack is presented as the Black Friday offer. */
export const SECOND_BOOK_BLACK_FRIDAY = { from: "2026-11-23", to: "2026-11-30" } as const;

export function isBlackFridayWeek(today: string): boolean {
  return today >= SECOND_BOOK_BLACK_FRIDAY.from && today <= SECOND_BOOK_BLACK_FRIDAY.to;
}

const PRINTED = new Set(["softcover", "hardcover"]);

/**
 * Is a code issued for books paid on `today` (YYYY-MM-DD, Spain)? From SECOND_BOOK_FROM to the
 * printed Reyes cut-off of that season (`reyesCutoff` = earliestPrintedCutoff(today, "reyes")).
 */
export function secondBookIssuing(today: string, reyesCutoff: string): boolean {
  return today >= SECOND_BOOK_FROM && today <= reyesCutoff;
}

/** Last day a code can be redeemed: 6 January right after that cut-off. */
export function secondBookLastDay(reyesCutoff: string): string {
  return `${Number(reyesCutoff.slice(0, 4)) + (reyesCutoff.slice(5) >= "07-01" ? 1 : 0)}-01-06`;
}

/** Stripe expires_at for that last day: 23:59:59 in Madrid (CET, UTC+1 in January). */
export function secondBookExpiresAt(reyesCutoff: string): Date {
  return new Date(`${secondBookLastDay(reyesCutoff)}T22:59:59Z`);
}

/** Does this paid order earn a code? Printed, actually paid, not itself bought with a pack code. */
export function earnsSecondBookCode(order: {
  format: string;
  amountTotalCents: number;
  usedSecondBookCode: boolean;
  today: string;
  reyesCutoff: string;
}): boolean {
  return (
    PRINTED.has(order.format) &&
    order.amountTotalCents > 0 &&
    !order.usedSecondBookCode &&
    secondBookIssuing(order.today, order.reyesCutoff)
  );
}
