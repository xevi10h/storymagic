// When an order gets its single review-request email (pure, no imports: checked by
// src/lib/reviews/reviews.check.mjs).
//
//   printed, delivered  → delivered_at + DAYS_AFTER_DELIVERY
//   printed, shipped    → shipped_at + carrier transit (max business days from
//                         product-facts, as calendar days) + DAYS_AFTER_DELIVERY,
//                         for orders Gelato never reports as delivered
//   PDF                 → ready_email_sent_at + PDF_DAYS_AFTER_READY (before the
//                         7-day "PDF → papel" offer, never on the same day)
//
// Sent only while the due date is at most CATCH_UP_DAYS old (an outage or the
// backfill never mails an order delivered months ago). Never for refunded, disputed,
// cancelled orders, orders with a print problem, follow-on offer orders (the book was
// already asked about on its first order), anonymised orders (no story), buyers who
// ticked the checkout opt-out, or suppressed addresses.

const DAY_MS = 86_400_000;

export const DAYS_AFTER_DELIVERY = 4;
export const PDF_DAYS_AFTER_READY = 5;
export const REVIEW_CATCH_UP_DAYS = 14;

export interface ReviewOrderRow {
  id: string;
  format: string;
  status: string;
  story_id: string | null;
  customer_email: string | null;
  refunded_at: string | null;
  disputed_at: string | null;
  problem_email_sent_at: string | null;
  offer: string | null;
  /** numeric from PostgREST (string) or number. */
  total: number | string | null;
  marketing_opt_out: boolean | null;
  ready_email_sent_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  review_request_sent_at: string | null;
}

export type ReviewSkipReason =
  | "already_sent"
  | "not_live"
  | "refunded"
  | "disputed"
  | "print_problem"
  | "offer_order"
  | "free_order"
  | "no_story"
  | "no_email"
  | "opted_out"
  | "suppressed"
  | "not_delivered"
  | "too_early"
  | "too_late";

export type ReviewDecision = { send: true; dueAt: number } | { send: false; reason: ReviewSkipReason };

/** Business days → calendar days (5 working days a week), rounded up. */
export function businessToCalendarDays(businessDays: number): number {
  return Math.ceil((businessDays * 7) / 5);
}

const time = (iso: string | null) => (iso ? Date.parse(iso) : NaN);

/** Due time in ms, or null when the order has not been delivered (or shipped) yet. */
export function reviewRequestDueAt(order: ReviewOrderRow, transitBusinessDays: number): number | null {
  if (order.format === "digital_pdf") {
    const ready = time(order.ready_email_sent_at);
    return Number.isFinite(ready) ? ready + PDF_DAYS_AFTER_READY * DAY_MS : null;
  }
  const delivered = time(order.delivered_at);
  if (Number.isFinite(delivered)) return delivered + DAYS_AFTER_DELIVERY * DAY_MS;
  const shipped = time(order.shipped_at);
  if (Number.isFinite(shipped)) return shipped + (businessToCalendarDays(transitBusinessDays) + DAYS_AFTER_DELIVERY) * DAY_MS;
  return null;
}

const LIVE = new Set(["paid", "producing", "shipped", "delivered"]);

export function reviewRequestDecision(
  order: ReviewOrderRow,
  opts: { now: number; suppressed: boolean; transitBusinessDays: number },
): ReviewDecision {
  if (order.review_request_sent_at) return { send: false, reason: "already_sent" };
  if (!LIVE.has(order.status)) return { send: false, reason: "not_live" };
  if (order.refunded_at) return { send: false, reason: "refunded" };
  if (order.disputed_at) return { send: false, reason: "disputed" };
  if (order.problem_email_sent_at) return { send: false, reason: "print_problem" };
  if (order.offer) return { send: false, reason: "offer_order" };
  // Gifted books (creator codes, 100 % vouchers): a review of a free product shown as a customer review would mislead.
  if (!(Number(order.total) > 0)) return { send: false, reason: "free_order" };
  if (!order.story_id) return { send: false, reason: "no_story" };
  if (!order.customer_email?.trim()) return { send: false, reason: "no_email" };
  if (order.marketing_opt_out === true) return { send: false, reason: "opted_out" };
  if (opts.suppressed) return { send: false, reason: "suppressed" };
  const dueAt = reviewRequestDueAt(order, opts.transitBusinessDays);
  if (dueAt === null) return { send: false, reason: "not_delivered" };
  if (opts.now < dueAt) return { send: false, reason: "too_early" };
  if (opts.now > dueAt + REVIEW_CATCH_UP_DAYS * DAY_MS) return { send: false, reason: "too_late" };
  return { send: true, dueAt };
}

/** Oldest shipped_at / ready_email_sent_at a due order can have (the SQL scan window). */
export function reviewScanWindow(now: number, transitBusinessDays: number): { from: string; to: string; pdfFrom: string; pdfTo: string } {
  const printedMaxDelay = businessToCalendarDays(transitBusinessDays) + DAYS_AFTER_DELIVERY + REVIEW_CATCH_UP_DAYS;
  return {
    // A parcel delivered N days after shipping is due N + 4 days after shipped_at; the scan
    // stays wide enough for the slowest parcel Gelato reports as delivered (60 days).
    from: new Date(now - Math.max(printedMaxDelay, 60) * DAY_MS).toISOString(),
    to: new Date(now - DAYS_AFTER_DELIVERY * DAY_MS).toISOString(),
    pdfFrom: new Date(now - (PDF_DAYS_AFTER_READY + REVIEW_CATCH_UP_DAYS) * DAY_MS).toISOString(),
    pdfTo: new Date(now - PDF_DAYS_AFTER_READY * DAY_MS).toISOString(),
  };
}
