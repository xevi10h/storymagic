// Stripe payment → order state. Shared by the webhook and /api/checkout/verify so
// both flip pending → paid the same way (CAS on status, exactly-once email).
// Lightweight on purpose (no PDF/AI imports).

import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { cancelPrintOrder } from "@/lib/gelato/orders";
import { adminOrderUrl, alertOperator } from "./alerts";
import { sendOrderEmailOnce } from "./emails";
import { orderReference, type OrderReceipt } from "@/lib/email/order-emails";
import { catalogItemByLookupKey } from "@/lib/pricing";
import { decideFullRefund } from "./logic";
import { suppressEmail } from "@/lib/marketing/suppression";
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
  const session = await getStripe().checkout.sessions.retrieve(sessionId, { expand: ["invoice", "line_items"] });
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
        // For the carrier (Gelato passes it on); collected by Checkout for physical books.
        phone: session.customer_details?.phone ?? "",
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
  let invoiceNumber = invoice?.number ?? null;
  let invoicePaidAt = invoice?.status_transitions?.paid_at ?? null;
  if (invoiceId && !invoiceUrl) {
    const fresh = await getStripe().invoices.retrieve(invoiceId).catch(() => null);
    invoiceUrl = fresh?.hosted_invoice_url ?? null;
    invoiceNumber = fresh?.number ?? invoiceNumber;
    invoicePaidAt = fresh?.status_transitions?.paid_at ?? invoicePaidAt;
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
    .select("id, story_id, user_id, format, marketing_opt_out");
  if (error) throw new Error(`Failed to update order for session ${session.id}: ${error.message}`);

  let order = flipped?.[0];
  const processedHere = !!order;
  if (!order) {
    // Already paid (a retry, or the other caller won the race) — or closed.
    const { data: existing, error: readErr } = await supabase
      .from("orders")
      .select("id, story_id, user_id, format, status, customer_email, invoice_url, marketing_opt_out")
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

  // Checkout opt-out ("No quiero recibir ofertas…"): the order flag already keeps offers
  // out of this order's emails; the suppression list extends it to the address (other
  // orders, the reminder). Idempotent. A failure is logged, never blocks the payment.
  if (order.marketing_opt_out === true && customerEmail) {
    try {
      await suppressEmail(supabase, customerEmail, "checkout_opt_out", `order:${order.id}`);
    } catch (err) {
      console.error(`[payments] Could not record the marketing opt-out of order ${order.id}:`, err instanceof Error ? err.message : err);
    }
  }

  // Confirmation email (with receipt) for EVERY format, exactly once across webhook + verify.
  const physical = PHYSICAL_FORMATS.has(order.format);
  const receipt: OrderReceipt = {
    reference: orderReference(order.id),
    paidAt: new Date((invoicePaidAt ?? session.created) * 1000).toISOString(),
    items: (session.line_items?.data ?? []).map((li) => ({
      catalogId: catalogItemByLookupKey(li.price?.lookup_key),
      description: li.description ?? "",
      amountCents: li.amount_subtotal,
    })),
    discountCents: session.total_details?.amount_discount ?? 0,
    totalCents: session.amount_total ?? 0,
    taxCents: session.total_details?.amount_tax ?? 0,
    physical,
    shipping:
      physical && shippingAddress
        ? {
            name: shipping?.name ?? "",
            line1: shippingAddress.line1,
            line2: shippingAddress.line2,
            postalCode: shippingAddress.postal_code,
            city: shippingAddress.city,
          }
        : null,
    invoiceUrl,
    invoiceNumber,
  };
  await sendOrderEmailOnce(supabase, {
    order,
    column: "confirmation_email_sent_at",
    event: physical ? "order_confirmed" : "order_confirmed_digital",
    email: customerEmail,
    buyerName: session.customer_details?.name ?? null,
    receipt,
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
 * charge.refunded. What a FULL refund does depends on how far the order got
 * (decideFullRefund):
 *  - not shipped yet → the order is closed ('refunded'): generation and printing
 *    stop (the cron only takes 'paid', every Gelato claim is CAS on 'paid'), the
 *    download link dies, and a Gelato order not yet in production is cancelled;
 *  - already shipped/delivered (goodwill refund) → the status history is kept,
 *    only refunded_at is recorded: no Gelato cancel, no alert, the PDF stays.
 * Either way the customer gets one "refund issued" email and the invoice gets a
 * credit note (factura rectificativa). Partial refunds only alert the operator.
 */
export async function recordRefund(supabase: FulfilmentClient, charge: Stripe.Charge): Promise<void> {
  const paymentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentId) return;
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, story_id, user_id, format, status, gelato_order_id, gelato_status, refunded_at, stripe_invoice_id")
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
      lines: [
        `Order status stays '${order.status}'. Nothing was cancelled automatically and the customer was NOT emailed.`,
        "Tell the customer yourself, and issue a credit note on the invoice in the Stripe Dashboard.",
      ],
      dedupeSeconds: 7 * 24 * 3600,
    });
    return;
  }

  const decision = decideFullRefund(order);
  const refundedAt = new Date().toISOString();
  let cancelledBeforeShipping = false;

  if (decision.kind === "record_only") {
    const { error: updErr } = await supabase
      .from("orders")
      .update({ refunded_at: refundedAt })
      .eq("id", order.id)
      .is("refunded_at", null);
    if (updErr) throw new Error(`Failed to record refund on order ${order.id}: ${updErr.message}`);
    console.log(`[payments] Order ${order.id} refunded after it shipped (status kept: ${order.status})`);
  } else if (decision.kind === "close") {
    const { data: closed, error: updErr } = await supabase
      .from("orders")
      .update({ status: "refunded", refunded_at: refundedAt })
      .eq("id", order.id)
      .eq("status", order.status)
      .select("id, gelato_order_id, status");
    if (updErr) throw new Error(`Failed to mark order ${order.id} refunded: ${updErr.message}`);
    // It moved meanwhile (e.g. Gelato shipped it): Stripe retries and we decide again.
    if (!closed || closed.length === 0) throw new Error(`Order ${order.id} changed during refund, retry`);
    console.log(`[payments] Order ${order.id} refunded (was ${order.status})`);
    cancelledBeforeShipping = PHYSICAL_FORMATS.has(order.format);
    // Re-read: a Gelato submission may have recorded its id between our read and update.
    const gelatoOrderId = closed[0].gelato_order_id ?? order.gelato_order_id;
    if (gelatoOrderId) await cancelGelatoForRefund(supabase, order.id, gelatoOrderId, order.status);
  } else if (order.status !== "refunded" && !order.refunded_at) {
    return; // cancelled / pending: never paid, nothing to tell the customer
  }

  // Exactly once, also when this is a retry of an event whose email failed.
  await sendOrderEmailOnce(supabase, {
    order,
    column: "refund_email_sent_at",
    event: "refund_issued",
    amountCents: charge.amount_refunded,
    cancelledBeforeShipping,
  });
  await issueCreditNote(supabase, order, charge);
}

/**
 * Credit note (factura rectificativa, RD 1619/2012 art. 15) for a fully refunded
 * order whose Checkout produced an invoice: every invoice line credited in full,
 * linked to the charge's existing refunds so no money moves twice. Best-effort:
 * anything unexpected alerts the operator to issue it by hand in the Dashboard.
 */
async function issueCreditNote(
  supabase: FulfilmentClient,
  order: { id: string; stripe_invoice_id: string | null },
  charge: Stripe.Charge,
): Promise<void> {
  if (!order.stripe_invoice_id) return;
  const stripe = getStripe();
  try {
    const existing = await stripe.creditNotes.list({ invoice: order.stripe_invoice_id, limit: 1 });
    if (existing.data.length > 0) return;
    const invoice = await stripe.invoices.retrieve(order.stripe_invoice_id);
    const refunds = (await stripe.refunds.list({ charge: charge.id, limit: 100 })).data.filter(
      (r) => r.status === "succeeded" || r.status === "pending",
    );
    const refunded = refunds.reduce((sum, r) => sum + r.amount, 0);
    if (invoice.status !== "paid" || refunded !== invoice.total || invoice.lines.has_more) {
      throw new Error(
        `not auto-issuable: invoice ${invoice.status}, total ${invoice.total}, refunded ${refunded}, more lines ${invoice.lines.has_more}`,
      );
    }
    const note = await stripe.creditNotes.create(
      {
        invoice: invoice.id as string,
        lines: invoice.lines.data.map((li) => ({
          type: "invoice_line_item" as const,
          invoice_line_item: li.id,
          quantity: li.quantity ?? 1,
        })),
        refunds: refunds.map((r) => ({ type: "refund" as const, refund: r.id, amount_refunded: r.amount })),
        reason: "order_change",
        metadata: { order_id: order.id },
      },
      { idempotencyKey: `credit-note-${invoice.id}` },
    );
    console.log(`[payments] Credit note ${note.number ?? note.id} issued for order ${order.id}`);
  } catch (err) {
    await alertOperator(supabase, {
      key: `credit-note:${order.id}`,
      subject: `Refunded order ${order.id}: credit note NOT issued automatically`,
      lines: [
        `Invoice ${order.stripe_invoice_id} · error: ${err instanceof Error ? err.message.slice(0, 500) : String(err)}`,
        "Issue it by hand: Stripe Dashboard → Invoices → the invoice → More → Issue a credit note, linked to the existing refund.",
      ],
      dedupeSeconds: 7 * 24 * 3600,
    });
  }
}

/**
 * checkout.session.async_payment_failed: a delayed payment method (bank debit…)
 * didn't settle. The order never became 'paid'; close it and tell the buyer.
 */
export async function recordAsyncPaymentFailed(supabase: FulfilmentClient, session: Stripe.Checkout.Session): Promise<void> {
  const { data: cancelled, error } = await supabase
    .from("orders")
    .update({ status: "cancelled" })
    .eq("stripe_checkout_session_id", session.id)
    .eq("status", "pending")
    .select("id, story_id, user_id");
  if (error) throw new Error(`Failed to cancel order for session ${session.id}: ${error.message}`);
  const order = cancelled?.[0];
  if (!order) return; // already handled, or not one of ours
  await sendOrderEmailOnce(supabase, {
    order,
    column: "cancel_email_sent_at",
    event: "order_cancelled",
    // Guests have no account email and recordPaidSession never stored one.
    email: session.customer_details?.email?.trim() || session.customer_email?.trim() || null,
    buyerName: session.customer_details?.name ?? null,
  });
}

/**
 * charge.dispute.created (chargeback). Always alerts the operator (evidence is
 * due within days). If the book hasn't gone to print yet, fulfilment is put on
 * hold so we don't spend on a payment that may be clawed back.
 */
export async function recordDispute(supabase: FulfilmentClient, dispute: Stripe.Dispute): Promise<void> {
  const paymentId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;
  if (!paymentId) {
    console.warn(`[payments] Dispute ${dispute.id} has no payment_intent`);
    return;
  }
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, story_id, format, status, gelato_order_id, gelato_status, customer_email")
    .eq("stripe_payment_id", paymentId)
    .maybeSingle();
  if (error) throw new Error(`Failed to read order for payment ${paymentId}: ${error.message}`);
  if (!order) {
    await alertOperator(supabase, {
      key: `dispute:${dispute.id}`,
      subject: `Stripe dispute ${dispute.id} on an unknown payment ${paymentId}`,
      lines: [`Amount ${dispute.amount / 100} € · reason ${dispute.reason}. Answer it in the Stripe Dashboard.`],
      dedupeSeconds: 7 * 24 * 3600,
    });
    return;
  }

  const disputedAt = new Date().toISOString();
  // Hold only what hasn't reached Gelato (same conditions as the submit claim, so
  // a submission can't start after this; one already in flight is reported below).
  const { data: held, error: holdErr } = await supabase
    .from("orders")
    .update({ disputed_at: disputedAt, fulfilment_hold_reason: "dispute" })
    .eq("id", order.id)
    .eq("status", "paid")
    .is("gelato_order_id", null)
    .select("id, gelato_submit_started_at");
  if (holdErr) throw new Error(`Failed to hold order ${order.id}: ${holdErr.message}`);
  const paused = !!held && held.length > 0;
  if (!paused) {
    const { error: markErr } = await supabase
      .from("orders")
      .update({ disputed_at: disputedAt })
      .eq("id", order.id)
      .is("disputed_at", null);
    if (markErr) throw new Error(`Failed to mark order ${order.id} disputed: ${markErr.message}`);
  }
  const inFlight = paused && !!held?.[0]?.gelato_submit_started_at;

  await alertOperator(supabase, {
    key: `dispute:${dispute.id}`,
    subject: `Chargeback on order ${order.id} (${dispute.amount / 100} €, ${dispute.reason})`,
    lines: [
      `Story ${order.story_id} · format ${order.format} · status '${order.status}' · ${order.customer_email ?? "no email"}`,
      paused
        ? `Fulfilment is ON HOLD (no more generation or printing).${inFlight ? " A Gelato submission was in flight: check the Gelato dashboard for meapica-" + order.id + "." : ""} To resume once the dispute is settled: "Reenviar a Gelato" on ${adminOrderUrl(order.id)} (it lifts the hold).`
        : order.gelato_order_id
          ? `Already at Gelato (${order.gelato_order_id}, ${order.gelato_status ?? "status unknown"}): cancel it there if still possible.`
          : "Nothing to pause (digital or already fulfilled).",
      `Submit evidence in the Stripe Dashboard before ${dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000).toISOString().slice(0, 10) : "the deadline"}.`,
    ],
    dedupeSeconds: 7 * 24 * 3600,
  });
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
