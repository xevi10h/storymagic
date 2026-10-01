// Printed orders to a postcode we don't ship to (Canarias, Ceuta, Melilla; see
// isExcludedSpanishPostcode). Stripe hosted Checkout can only restrict by country,
// so such an order is paid like any other; this closes it automatically: fulfilment
// on hold (no AI or print spend), full refund in Stripe, order 'refunded', one
// customer email in their language, operator alert. Lightweight (webhook-safe).
//
// Called by recordPaidSession (webhook / verify: the normal path, before any
// generation) and by the print step of the pipeline (safety net for orders paid
// before this existed). Idempotent: every step is a claim or an idempotent call.

import { getStripe } from "@/lib/stripe";
import { adminOrderUrl, alertOperator } from "./alerts";
import { sendOrderEmailOnce } from "./emails";
import { EXCLUDED_AREA_HOLD } from "./logic";
import type { FulfilmentClient, FulfilmentDatabase } from "./db";

export { EXCLUDED_AREA_HOLD };

type OrderRow = FulfilmentDatabase["public"]["Tables"]["orders"]["Row"];

export type ExcludedAreaResult = { ok: true } | { ok: false; error: string };

/** Stripe error code when the charge was already refunded in full (e.g. by hand, or the idempotency key expired). */
const ALREADY_REFUNDED = "charge_already_refunded";

export async function closeExcludedAreaOrder(
  supabase: FulfilmentClient,
  params: {
    order: Pick<OrderRow, "id" | "story_id" | "user_id" | "format">;
    postcode: string;
    /** PaymentIntent; null when nothing was charged (100 % promo code). */
    paymentId: string | null;
    amountCents: number;
    email?: string | null;
    buyerName?: string | null;
  },
): Promise<ExcludedAreaResult> {
  const { order, postcode, paymentId, amountCents } = params;
  const reason = `excluded shipping area (postcode ${postcode})`;

  // 1. Hold: neither the cron nor /complete generates or prints a held order.
  const { error: holdErr } = await supabase
    .from("orders")
    .update({ fulfilment_hold_reason: EXCLUDED_AREA_HOLD, gelato_last_error: reason })
    .eq("id", order.id)
    .eq("status", "paid")
    .is("gelato_order_id", null);
  if (holdErr) return { ok: false, error: `hold failed: ${holdErr.message}` };

  // 2. Full refund. The idempotency key makes webhook + verify + retries one refund.
  if (paymentId && amountCents > 0) {
    try {
      await getStripe().refunds.create(
        {
          payment_intent: paymentId,
          reason: "requested_by_customer",
          metadata: { order_id: order.id, reason: "excluded_shipping_area", postcode },
        },
        { idempotencyKey: `excluded-area-refund-${order.id}` },
      );
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code !== ALREADY_REFUNDED) {
        const message = err instanceof Error ? err.message : String(err);
        await alertOperator(supabase, {
          key: `excluded-area-refund-failed:${order.id}`,
          subject: `Order ${order.id} ships to an excluded area (postcode ${postcode}): automatic refund FAILED`,
          lines: [
            `Payment ${paymentId} · ${amountCents / 100} € · error: ${message.slice(0, 500)}`,
            "The order is on hold (nothing is generated or printed). Refund it in full in the Stripe Dashboard: the charge.refunded webhook then closes the order and emails the customer.",
            `Admin: ${adminOrderUrl(order.id)}`,
          ],
          dedupeSeconds: 24 * 3600,
        });
        return { ok: false, error: `refund failed: ${message}` };
      }
    }
  }

  // 3. Close. No row = the charge.refunded webhook closed it first (same outcome).
  const { error: closeErr } = await supabase
    .from("orders")
    .update({ status: "refunded", refunded_at: new Date().toISOString() })
    .eq("id", order.id)
    .eq("status", "paid")
    .is("gelato_order_id", null);
  if (closeErr) return { ok: false, error: `close failed: ${closeErr.message}` };

  // 4. One email, claimed on refund_email_sent_at so recordRefund (charge.refunded)
  //    doesn't send a second, generic "refund issued" one.
  await sendOrderEmailOnce(supabase, {
    order,
    column: "refund_email_sent_at",
    event: "excluded_area",
    email: params.email,
    buyerName: params.buyerName,
    amountCents,
    postcode,
  });
  const { data: after } = await supabase.from("orders").select("refund_email_sent_at").eq("id", order.id).maybeSingle();
  const emailed = !!after?.refund_email_sent_at;

  await alertOperator(supabase, {
    key: `excluded-area:${order.id}`,
    subject: `Order ${order.id} shipped to an excluded area (postcode ${postcode}): refunded automatically`,
    lines: [
      `Story ${order.story_id ?? "deleted"} · format ${order.format} · ${amountCents / 100} € ${paymentId ? "refunded in full" : "(nothing was charged)"}.`,
      emailed
        ? "The customer was emailed (refund + how to reorder with a mainland address or buy the PDF). Nothing to do."
        : "The customer email could NOT be sent: write to them yourself.",
      `Admin: ${adminOrderUrl(order.id)}`,
    ],
    dedupeSeconds: 7 * 24 * 3600,
  });
  return { ok: true };
}
