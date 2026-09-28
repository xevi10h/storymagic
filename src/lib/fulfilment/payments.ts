// Stripe payment → order state. Shared by the webhook and /api/checkout/verify so
// both flip pending → paid the same way (CAS on status, exactly-once email).
// Lightweight on purpose (no PDF/AI imports).

import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { cancelPrintOrder } from "@/lib/gelato/orders";
import { alertOperator } from "./alerts";
import { sendOrderEmailOnce } from "./emails";
import type { FulfilmentClient, FulfilmentDatabase } from "./db";

type OrderRow = FulfilmentDatabase["public"]["Tables"]["orders"]["Row"];
type LegacyShipping = { name?: string | null; address?: Stripe.Address | null } | null | undefined;

const PHYSICAL_FORMATS = new Set(["softcover", "hardcover"]);

export type PaidSessionResult =
  | { state: "not_paid" }
  | { state: "not_found" }
  | { state: "closed"; status: string } // cancelled / refunded
  | { state: "paid"; order: Pick<OrderRow, "id" | "story_id" | "user_id" | "format">; processedHere: boolean };

/**
 * Record a settled Checkout Session on its order (idempotent). Throws on DB/Stripe
 * errors so the webhook answers 500 and Stripe retries.
 */
export async function recordPaidSession(
  supabase: FulfilmentClient,
  sessionId: string,
  opts: { fallbackEmail?: string | null } = {},
): Promise<PaidSessionResult> {
  const session = await getStripe().checkout.sessions.retrieve(sessionId, { expand: ["invoice"] });
  // Delayed payment methods complete the session unpaid; the money arrives later
  // with checkout.session.async_payment_succeeded. no_payment_required = 100 % promo code.
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return { state: "not_paid" };
  }

  // Stripe Basil API (2025-03-31+) moved shipping into
  // collected_information.shipping_details; fall back to the legacy top-level field.
  const legacyShipping = (session as Stripe.Checkout.Session & { shipping_details?: LegacyShipping }).shipping_details;
  const shipping = session.collected_information?.shipping_details ?? legacyShipping ?? undefined;
  const shippingAddress = shipping?.address
    ? {
        line1: shipping.address.line1 ?? "",
        line2: shipping.address.line2 ?? "",
        city: shipping.address.city ?? "",
        state: shipping.address.state ?? "",
        postal_code: shipping.address.postal_code ?? "",
        country: shipping.address.country ?? "",
      }
    : null;
  if (!shippingAddress && session.metadata?.format !== "digital_pdf") {
    console.warn(`[payments] No shipping address for physical order — session ${session.id}`);
  }

  // Guests are anonymous auth users with no email: the Checkout email is the only
  // address we have for them.
  const customerEmail =
    session.customer_details?.email?.trim() || session.customer_email?.trim() || opts.fallbackEmail?.trim() || null;
  const invoice = session.invoice && typeof session.invoice === "object" ? session.invoice : null;
  const invoiceId = invoice?.id ?? (typeof session.invoice === "string" ? session.invoice : null);
  // Measured: the invoice is finalized by the time checkout.session.completed arrives;
  // re-read once in case Stripe is a beat late (no invoice webhook needed).
  let invoiceUrl = invoice?.hosted_invoice_url ?? null;
  if (invoiceId && !invoiceUrl) {
    invoiceUrl = (await getStripe().invoices.retrieve(invoiceId).catch(() => null))?.hosted_invoice_url ?? null;
  }
  const paymentId =
    (typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id) ?? null;

  const { data: flipped, error } = await supabase
    .from("orders")
    .update({
      status: "paid",
      stripe_payment_id: paymentId,
      shipping_name: shipping?.name ?? null,
      shipping_address: shippingAddress,
      customer_email: customerEmail,
      stripe_invoice_id: invoiceId,
      invoice_url: invoiceUrl,
      total: (session.amount_total ?? 0) / 100,
    })
    .eq("stripe_checkout_session_id", session.id)
    .eq("status", "pending")
    .select("id, story_id, user_id, format");
  if (error) throw new Error(`Failed to update order for session ${session.id}: ${error.message}`);

  let order = flipped?.[0];
  const processedHere = !!order;
  if (!order) {
    // Already paid (a retry, or the other caller won the race) — or closed.
    const { data: existing, error: readErr } = await supabase
      .from("orders")
      .select("id, story_id, user_id, format, status, customer_email, invoice_url")
      .eq("stripe_checkout_session_id", session.id)
      .maybeSingle();
    if (readErr) throw new Error(`Failed to read order for session ${session.id}: ${readErr.message}`);
    if (!existing) return { state: "not_found" };
    if (existing.status === "pending") throw new Error(`Order ${existing.id} still pending after paid update — retry`);
    if (existing.status === "cancelled" || existing.status === "refunded") {
      // Paid after the session "expired" should not happen; a refund can precede a
      // late webhook. Either way a human decides.
      if (existing.status === "cancelled") {
        await alertOperator(supabase, {
          key: `paid-cancelled:${existing.id}`,
          subject: `Paid Stripe session ${session.id} maps to a CANCELLED order ${existing.id}`,
          lines: ["Refund in Stripe or set the order to 'paid' manually."],
          dedupeSeconds: 24 * 3600,
        });
      }
      return { state: "closed", status: existing.status };
    }
    const backfill: Partial<OrderRow> = {};
    if (!existing.customer_email && customerEmail) backfill.customer_email = customerEmail;
    if (!existing.invoice_url && invoiceUrl) backfill.invoice_url = invoiceUrl;
    if (Object.keys(backfill).length > 0) await supabase.from("orders").update(backfill).eq("id", existing.id);
    order = existing;
  }

  // Confirmation email for EVERY format, exactly once across webhook + verify.
  await sendOrderEmailOnce(supabase, {
    order,
    column: "confirmation_email_sent_at",
    event: PHYSICAL_FORMATS.has(order.format) ? "order_confirmed" : "order_confirmed_digital",
    email: customerEmail,
    invoiceUrl,
  });
  return { state: "paid", order, processedHere };
}

/** checkout.session.expired → cancel the order if it never got paid. */
export async function recordExpiredSession(supabase: FulfilmentClient, sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({ status: "cancelled" })
    .eq("stripe_checkout_session_id", sessionId)
    .eq("status", "pending");
  if (error) throw new Error(`Failed to cancel order for session ${sessionId}: ${error.message}`);
}

/**
 * charge.refunded. A FULL refund closes the order: generation and printing stop
 * (the cron only takes 'paid', every Gelato claim is CAS on 'paid'), the download
 * link dies, and a Gelato order not yet in production is cancelled. Partial
 * refunds (e.g. goodwill) only alert the operator.
 */
export async function recordRefund(supabase: FulfilmentClient, charge: Stripe.Charge): Promise<void> {
  const paymentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentId) return;
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, story_id, format, status, gelato_order_id")
    .eq("stripe_payment_id", paymentId)
    .maybeSingle();
  if (error) throw new Error(`Failed to read order for payment ${paymentId}: ${error.message}`);
  if (!order) {
    console.warn(`[payments] charge.refunded for unknown payment ${paymentId}`);
    return;
  }

  if (!charge.refunded) {
    await alertOperator(supabase, {
      key: `partial-refund:${order.id}:${charge.amount_refunded}`,
      subject: `Partial refund on order ${order.id} (${charge.amount_refunded / 100} € of ${charge.amount / 100} €)`,
      lines: [`Order status stays '${order.status}'. Nothing was cancelled automatically.`],
      dedupeSeconds: 7 * 24 * 3600,
    });
    return;
  }
  if (order.status === "refunded") return;

  const { data: closed, error: updErr } = await supabase
    .from("orders")
    .update({ status: "refunded", refunded_at: new Date().toISOString() })
    .eq("id", order.id)
    .neq("status", "refunded")
    .select("id, gelato_order_id, status");
  if (updErr) throw new Error(`Failed to mark order ${order.id} refunded: ${updErr.message}`);
  if (!closed || closed.length === 0) return; // a concurrent delivery did it
  console.log(`[payments] Order ${order.id} refunded (was ${order.status})`);

  // Re-read: a Gelato submission may have recorded its id between our read and update.
  const gelatoOrderId = closed[0].gelato_order_id ?? order.gelato_order_id;
  if (gelatoOrderId) await cancelGelatoForRefund(supabase, order.id, gelatoOrderId, order.status);
}

export async function cancelGelatoForRefund(
  supabase: FulfilmentClient,
  orderId: string,
  gelatoOrderId: string,
  previousStatus: string,
): Promise<void> {
  try {
    await cancelPrintOrder(gelatoOrderId);
    console.log(`[payments] Gelato order ${gelatoOrderId} cancelled for refunded order ${orderId}`);
  } catch (err) {
    await alertOperator(supabase, {
      key: `refund-gelato-cancel:${orderId}`,
      subject: `Refunded order ${orderId} could NOT be cancelled at Gelato (${gelatoOrderId})`,
      lines: [
        `Status before the refund: ${previousStatus}`,
        `Error: ${err instanceof Error ? err.message.slice(0, 500) : String(err)}`,
        "It is probably already in production: cancel it by hand in the Gelato dashboard or let it ship.",
      ],
      dedupeSeconds: 24 * 3600,
    });
  }
}
