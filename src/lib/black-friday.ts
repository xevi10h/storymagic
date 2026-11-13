// Black Friday 2026 (owner decision 2026-11-13): 20 % off the FIRST book, the book format line
// only (PDF 9,90 → 7,92 €, softcover 34,90 → 27,92 €, hardcover 49,90 → 39,92 €, IVA incluido).
// Not on extra copies, PDF → printed upgrades, post-purchase offers, reorders, gift vouchers or
// the 19,90 € Pack Reyes second book. Non-cumulative with any other code.
//
// THE single source of truth for the window: UI (price lines, banner, sticky bars), /api/checkout
// (server-side instant check), the Merchant/OpenAI feeds, the Product JSON-LD, llms.txt and the
// Stripe coupon's redeem_by (scripts/stripe-setup-black-friday.mts). After BLACK_FRIDAY.to
// everything reverts by itself, no deploy (ISR pages revalidate hourly).
//
// Pure rules, no imports (client + server, and `node --experimental-strip-types`):
//   node --experimental-strip-types src/lib/black-friday.check.mjs

/** Spain calendar days, both included (Europe/Madrid). Start = deploy day. */
export const BLACK_FRIDAY = { from: "2026-11-13", to: "2026-11-30" } as const;
export const BLACK_FRIDAY_PERCENT_OFF = 20;

/** First and last instant of the window. November is CET (UTC+1): 00:00 Madrid = 23:00Z the day before. */
export const BLACK_FRIDAY_STARTS_AT = new Date("2026-11-12T23:00:00Z");
export const BLACK_FRIDAY_ENDS_AT = new Date("2026-11-30T22:59:59Z");

/** Stripe objects (scripts/stripe-setup-black-friday.mts): 20 %, applies_to = the 3 book format Products. */
export const BLACK_FRIDAY_COUPON_ID = "meapica_black_friday_2026";
export const BLACK_FRIDAY_PROMO_CODE = "BLACKFRIDAY";

/** Book formats whose base line gets the discount (= the coupon's applies_to). */
export const BLACK_FRIDAY_FORMATS = ["digital_pdf", "softcover", "hardcover"] as const;

/** Is the offer on for this Spain date (YYYY-MM-DD, spainToday())? For rendering. */
export function isBlackFriday(today: string | null | undefined): boolean {
  return !!today && today >= BLACK_FRIDAY.from && today <= BLACK_FRIDAY.to;
}

/** Is the offer on at this instant? For checkout (never a UTC date string: 1 Dec 00:30 Madrid is still 30 Nov in UTC). */
export function isBlackFridayAt(ms: number): boolean {
  return ms >= BLACK_FRIDAY_STARTS_AT.getTime() && ms <= BLACK_FRIDAY_ENDS_AT.getTime();
}

/** Discount in cents on a book line, rounded like Stripe rounds percent_off (half up, per line). */
export function blackFridayDiscountCents(cents: number): number {
  return Math.round((cents * BLACK_FRIDAY_PERCENT_OFF) / 100);
}

/** What the book line costs with the discount (VAT-inclusive cents). */
export function blackFridayPriceCents(cents: number): number {
  return cents - blackFridayDiscountCents(cents);
}

/**
 * Price of a format's book line today: the Black Friday price inside the window, the list price
 * otherwise. Only for a FIRST book (never reorders / offers / vouchers / extra copies).
 */
export function bookPriceToday(listCents: number, today: string | null | undefined): number {
  return isBlackFriday(today) ? blackFridayPriceCents(listCents) : listCents;
}

/**
 * Omnibus directive (art. 6 bis Directive 98/6/EC, RDL 24/2021 art. 20 LOCM): an announced price
 * reduction shows the lowest price of the previous 30 days. Prices have been unchanged for more
 * than 30 days before the window, so that is the list price.
 */
export function lowestPrice30Days(listCents: number): number {
  return listCents;
}

/** Google Merchant `sale_price_effective_date` (ISO 8601 interval, `±hhmm` offset, no seconds). */
export const BLACK_FRIDAY_FEED_EFFECTIVE_DATE = `${BLACK_FRIDAY.from}T00:00+0100/${BLACK_FRIDAY.to}T23:59+0100`;

/** schema.org Offer validFrom / priceValidUntil (ISO 8601 with offset). */
export const BLACK_FRIDAY_VALID_FROM = `${BLACK_FRIDAY.from}T00:00:00+01:00`;
export const BLACK_FRIDAY_VALID_UNTIL = `${BLACK_FRIDAY.to}T23:59:59+01:00`;

// ── Which code /api/checkout pre-applies ────────────────────────────────────

/**
 * A code /api/checkout could pre-apply, with what it saves on the book line. Stripe takes ONE
 * code per session, so codes never stack.
 */
export type PromoCandidateKind = "second_book" | "referral" | "creator" | "black_friday";
export interface PromoCandidate {
  kind: PromoCandidateKind;
  promotionCodeId: string;
  /** Saving on the book line, in cents (amount_off, or percent of the line). */
  savingCents: number;
}

/**
 * Rule (owner 2026-11-13 + "biggest saving for the buyer"): the eligible code that saves the most
 * on the book line goes first; the others follow as fallbacks (a code that Stripe refuses, used up
 * or expired, falls through to the next). With 2026 prices that means:
 *   softcover: Pack Reyes (15 €) > referral (10 €) > Black Friday (6,98 €) > creator 10 % (3,49 €)
 *   hardcover: referral (10 €) > Black Friday (9,98 €) > creator 10 % (4,99 €)
 *   PDF:       Black Friday (1,98 €) > creator 10 % (0,99 €)   (referral / Pack Reyes don't cover the PDF)
 * Ties keep the input order. Empty list = nothing pre-applied (Stripe shows its code field).
 */
export function orderPromoCandidates(candidates: readonly (PromoCandidate | null | undefined | false)[]): PromoCandidate[] {
  return candidates
    .filter((c): c is PromoCandidate => !!c && !!c.promotionCodeId)
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.savingCents - a.c.savingCents || a.i - b.i)
    .map(({ c }) => c);
}
