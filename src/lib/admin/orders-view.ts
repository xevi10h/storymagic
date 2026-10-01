// Operator order views — pure (no I/O, no path aliases) so orders-view.check.mjs can run it.
// Problem detection, list filtering/search and dashboard links for /admin.

export const ORDER_STATUSES = ["pending", "paid", "producing", "shipped", "delivered", "cancelled", "refunded"] as const;

/** Gelato statuses that need a human (mirrors GELATO_EXCEPTION/ATTENTION_STATUSES in fulfilment/logic.ts). */
export const GELATO_PROBLEM_STATUSES = ["failed", "canceled", "cancelled", "returned", "on_hold", "pending_approval", "not_connected"];

const PHYSICAL_FORMATS = new Set(["softcover", "hardcover"]);
/** A paid order should reach Gelato (or be delivered by email) within a few hours. */
export const STUCK_PAID_HOURS = 6;
/** Mirrors GELATO_STUCK_PRODUCING_HOURS (5 days). */
export const NOT_SHIPPED_HOURS = 5 * 24;

export interface AdminOrderRow {
  id: string;
  created_at: string;
  status: string;
  format: string;
  total: number | null;
  currency: string | null;
  customer_email: string | null;
  shipping_name: string | null;
  story_id: string | null;
  user_id: string | null;
  gelato_order_id: string | null;
  gelato_status: string | null;
  gelato_last_error: string | null;
  gelato_submit_attempts: number;
  fulfilment_alerted_at: string | null;
  fulfilment_requeued_at?: string | null;
  /** Set by a chargeback (payments.ts) or an excluded shipping area (excluded-area.ts): nothing is generated or printed. */
  fulfilment_hold_reason?: string | null;
  stripe_payment_id: string | null;
  stripe_checkout_session_id: string | null;
  tracking_number: string | null;
  refunded_at: string | null;
  /** Post-purchase offer the order was bought with (20260930155000_upsell_offers.sql). */
  offer?: string | null;
  /** Joined: stories.title and characters.name (null once the customer erased their account). */
  story_title: string | null;
  child_name: string | null;
}

export type OrderProblem = "on_hold" | "stuck_paid" | "gelato_problem" | "not_shipped" | "refunded";

export const PROBLEM_LABELS: Record<OrderProblem, string> = {
  on_hold: "En pausa (contracargo / reembolso pendiente)",
  stuck_paid: "Pagado y atascado",
  gelato_problem: "Gelato con incidencia",
  not_shipped: "Sin enviar > 5 días",
  refunded: "Reembolsado",
};

export const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente de pago",
  paid: "Pagado",
  producing: "En producción",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

const hoursSince = (iso: string | null | undefined, now: number) =>
  iso ? (now - new Date(iso).getTime()) / 3_600_000 : 0;

/** Operator attention flags of one order. */
export function orderProblems(order: AdminOrderRow, now: number): OrderProblem[] {
  const problems: OrderProblem[] = [];
  // A refunded order is closed: its hold (e.g. excluded_area, auto-refunded) needs no action.
  if (order.fulfilment_hold_reason && order.status !== "refunded") problems.push("on_hold");
  const physical = PHYSICAL_FORMATS.has(order.format);
  // Age counts from the last operator re-queue when there is one.
  const since =
    order.fulfilment_requeued_at && order.fulfilment_requeued_at > order.created_at ? order.fulfilment_requeued_at : order.created_at;

  if (
    order.status === "paid" &&
    (hoursSince(since, now) > STUCK_PAID_HOURS || !!order.fulfilment_alerted_at || !!order.gelato_last_error)
  ) {
    problems.push("stuck_paid");
  }
  if (order.status !== "refunded" && GELATO_PROBLEM_STATUSES.includes((order.gelato_status ?? "").toLowerCase())) {
    problems.push("gelato_problem");
  }
  if (physical && order.status === "producing" && hoursSince(since, now) > NOT_SHIPPED_HOURS) {
    problems.push("not_shipped");
  }
  if (order.status === "refunded") problems.push("refunded");
  return problems;
}

/** Short human reference shown to customers (same rule as orderReference in email/order-emails.ts). */
export function orderReferenceOf(orderId: string): string {
  return orderId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export type OrderFilter = "all" | "problems" | OrderProblem | (typeof ORDER_STATUSES)[number];

export function isOrderFilter(value: string | null | undefined): value is OrderFilter {
  return (
    value === "all" ||
    value === "problems" ||
    value === "on_hold" ||
    value === "stuck_paid" ||
    value === "gelato_problem" ||
    value === "not_shipped" ||
    (ORDER_STATUSES as readonly string[]).includes(value ?? "")
  );
}

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Free-text match on email, order id / reference, child name, title, shipping name, Gelato / Stripe ids. */
export function matchesSearch(order: AdminOrderRow, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  const compactQ = q.replace(/[\s-]/g, "");
  const fields = [
    order.customer_email,
    order.shipping_name,
    order.child_name,
    order.story_title,
    order.gelato_order_id,
    order.stripe_payment_id,
    order.stripe_checkout_session_id,
    order.story_id,
    order.tracking_number,
  ];
  if (fields.some((f) => f && normalize(f).includes(q))) return true;
  // Order id with or without dashes, or the 8-char customer reference.
  const compactId = order.id.replace(/-/g, "").toLowerCase();
  return compactQ.length >= 4 && compactId.startsWith(compactQ);
}

/** Newest first, filtered by status/problem and search text. */
export function filterOrders(orders: readonly AdminOrderRow[], filter: OrderFilter, query: string, now: number): AdminOrderRow[] {
  return orders
    .filter((o) => {
      if (filter === "all") return true;
      if (filter === "problems") return orderProblems(o, now).some((p) => p !== "refunded");
      if (filter === "on_hold" || filter === "stuck_paid" || filter === "gelato_problem" || filter === "not_shipped") {
        return orderProblems(o, now).includes(filter);
      }
      return o.status === filter;
    })
    .filter((o) => matchesSearch(o, query))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
}

// ── Dashboard links ──────────────────────────────────────────────────────────

/** Meapica Stripe accounts (docs/stack.md › Payments). */
const STRIPE_ACCOUNTS = { live: "acct_1UKcQRAyKcfLUpfG", test: "acct_1UKcQsBD04FISl5u" } as const;

/** Stripe mode of an order, from its Checkout Session id. */
export function stripeModeOf(sessionId: string | null | undefined): "live" | "test" | null {
  if (sessionId?.startsWith("cs_live_")) return "live";
  if (sessionId?.startsWith("cs_test_")) return "test";
  return null;
}

/**
 * Stripe Dashboard page of the payment (refunds are done there), pinned to the
 * Meapica account so it never opens in another account the operator is logged into.
 * Format: dashboard.stripe.com/{account}/[test/]payments/{pi} (Stripe deep-link docs).
 */
export function stripePaymentUrl(paymentId: string | null | undefined, sessionId: string | null | undefined): string | null {
  const mode = stripeModeOf(sessionId);
  if (!mode) return null;
  const base = `https://dashboard.stripe.com/${STRIPE_ACCOUNTS[mode]}${mode === "test" ? "/test" : ""}`;
  if (paymentId) return `${base}/payments/${encodeURIComponent(paymentId)}`;
  return sessionId ? `${base}/checkout/sessions/${encodeURIComponent(sessionId)}` : null;
}

/** Gelato Dashboard page of a print order. */
export function gelatoOrderUrl(gelatoOrderId: string | null | undefined): string | null {
  return gelatoOrderId ? `https://dashboard.gelato.com/checkout/orders/${encodeURIComponent(gelatoOrderId)}` : null;
}
