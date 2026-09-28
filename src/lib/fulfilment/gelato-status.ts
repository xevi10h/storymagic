// Apply a Gelato fulfilment status to our order. Shared by the Gelato webhook and
// the reconciliation sweep in /api/cron/fulfill-orders.

import { notifyOrderEmail } from "@/lib/email/notify-order";
import type { OrderEmailEvent } from "@/lib/email/order-emails";
import type { FulfilmentClient } from "./db";
import { alertOperator } from "./alerts";
import { decideGelatoTransition } from "./logic";

// Internal order status → customer email event. "paid" has no email (manual review).
const STATUS_EMAIL: Record<string, OrderEmailEvent | undefined> = {
  producing: "in_production",
  shipped: "shipped",
  delivered: "delivered",
};

export interface TrackingInfo {
  trackingNumber?: string | null;
  trackingUrl?: string | null;
}

const REFERENCE_PREFIX = "meapica-";

/**
 * Transitions are ranked (paid < producing < shipped < delivered): a late or
 * retried event can never move an order backwards, and the update is a
 * compare-and-set on the status we read, so two concurrent events can't both
 * "win". Customers are emailed only by the event that performed the transition.
 * Tracking is stored whenever provided.
 * Canceled/failed/returned and paused statuses (pending_approval, on_hold,
 * not_connected) never change the status: the raw status is recorded and the
 * operator is alerted.
 */
export async function applyGelatoStatus(
  supabase: FulfilmentClient,
  gelatoOrderId: string,
  gelatoStatus: string,
  tracking?: TrackingInfo,
  orderReferenceId?: string,
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: order, error: readErr } = await supabase
      .from("orders")
      .select("id, status, story_id, user_id, tracking_number, tracking_url")
      .eq("gelato_order_id", gelatoOrderId)
      .maybeSingle();
    if (readErr) throw new Error(`Failed to read order ${gelatoOrderId}: ${readErr.message}`);
    if (!order) {
      await handleUnknownGelatoOrder(supabase, gelatoOrderId, gelatoStatus, orderReferenceId);
      return;
    }

    const decision = decideGelatoTransition(order.status, gelatoStatus);
    const nextTrackingNumber = tracking?.trackingNumber ?? order.tracking_number ?? null;
    const nextTrackingUrl = tracking?.trackingUrl ?? order.tracking_url ?? null;
    const trackingUpdate = tracking ? { tracking_number: nextTrackingNumber, tracking_url: nextTrackingUrl } : {};

    if (decision.kind === "unknown") {
      console.log(`[gelato-status] Unhandled fulfillment status: ${decision.gelatoStatus}`);
      return;
    }

    if (decision.kind === "exception" || decision.kind === "attention") {
      await supabase
        .from("orders")
        .update({ gelato_status: decision.gelatoStatus, ...trackingUpdate })
        .eq("id", order.id);
      // We cancelled it ourselves after a Stripe refund: expected, no alert.
      if (order.status === "refunded" && decision.gelatoStatus.startsWith("cancel")) return;
      await alertOperator(supabase, {
        key: `gelato-${decision.kind}:${order.id}:${decision.gelatoStatus}`,
        subject: `Gelato order ${gelatoOrderId} is ${decision.gelatoStatus}`,
        lines: [
          `Local order ${order.id} (story ${order.story_id}) stays at '${order.status}'.`,
          decision.kind === "attention"
            ? "Gelato paused it and is waiting for us: open the order in the Gelato dashboard and approve / resolve it, or the book never prints."
            : "Check the order in the Gelato dashboard. To re-submit, clear orders.gelato_order_id and set status back to 'paid' — the cron will send a new order.",
        ],
        dedupeSeconds: 24 * 3600,
      });
      return;
    }

    if (decision.kind !== "advance") {
      // Same or older status: keep the order where it is, only refresh tracking
      // (a late, out-of-order event must not rewind the mirrored Gelato status either).
      const refresh = { ...(decision.kind === "same" ? { gelato_status: gelatoStatus.toLowerCase() } : {}), ...trackingUpdate };
      if (Object.keys(refresh).length > 0) await supabase.from("orders").update(refresh).eq("id", order.id);
      return;
    }

    const { data: moved, error } = await supabase
      .from("orders")
      .update({ status: decision.to, gelato_status: gelatoStatus.toLowerCase(), ...trackingUpdate })
      .eq("id", order.id)
      .eq("status", order.status)
      .select("id");
    if (error) throw new Error(`Failed to update order ${gelatoOrderId}: ${error.message}`);
    if (!moved || moved.length === 0) continue; // a concurrent event moved it — re-evaluate

    console.log(`[gelato-status] Order ${gelatoOrderId} ${order.status} → ${decision.to}`);

    if (decision.to === "shipped" || decision.to === "delivered") {
      await syncStoryStatus(supabase, order.story_id, decision.to);
    }

    // ponytail: a "shipped" email sent before any tracking code exists is not re-sent
    // when the code arrives later (the dashboard still shows it). Gelato's
    // order_status_updated "shipped" normally carries the fulfillments already.
    const emailEvent = STATUS_EMAIL[decision.to];
    if (emailEvent && order.user_id && order.story_id) {
      await notifyOrderEmail({
        supabase,
        event: emailEvent,
        storyId: order.story_id,
        userId: order.user_id,
        orderId: order.id,
        trackingNumber: nextTrackingNumber,
        trackingUrl: nextTrackingUrl,
      });
    }
    return;
  }
  throw new Error(`Order ${gelatoOrderId}: status kept changing concurrently — retry`);
}

/**
 * An event for a Gelato id we never recorded: either it raced our own submit
 * (the submitter records the id and sends the email — safe to drop) or Gelato
 * split our order into connected orders. A split order's status only describes
 * part of the shipment, so it is never applied automatically.
 */
async function handleUnknownGelatoOrder(
  supabase: FulfilmentClient,
  gelatoOrderId: string,
  gelatoStatus: string,
  orderReferenceId: string | undefined,
): Promise<void> {
  const localId = orderReferenceId?.startsWith(REFERENCE_PREFIX) ? orderReferenceId.slice(REFERENCE_PREFIX.length) : null;
  const { data: parent } = localId
    ? await supabase.from("orders").select("id, gelato_order_id").eq("id", localId).maybeSingle()
    : { data: null };
  if (!parent?.gelato_order_id || parent.gelato_order_id === gelatoOrderId) {
    console.warn(`[gelato-status] No order found for gelato_order_id ${gelatoOrderId}`);
    return;
  }
  await alertOperator(supabase, {
    key: `gelato-connected:${parent.id}:${gelatoOrderId}:${gelatoStatus}`,
    subject: `Gelato split order ${orderReferenceId}: connected order ${gelatoOrderId} is ${gelatoStatus}`,
    lines: [
      `Our order ${parent.id} is tracked on Gelato order ${parent.gelato_order_id}; Gelato also created ${gelatoOrderId} for part of it.`,
      "Its status/tracking is not applied automatically. Check both in the Gelato dashboard and send the customer the second tracking link by hand.",
    ],
    dedupeSeconds: 24 * 3600,
  });
}

async function syncStoryStatus(supabase: FulfilmentClient, storyId: string, orderStatus: "shipped" | "delivered") {
  if (!storyId) return;
  // Forward-only: never move a delivered story back to shipped.
  let query = supabase.from("stories").update({ status: orderStatus }).eq("id", storyId);
  if (orderStatus === "shipped") query = query.neq("status", "delivered");
  await query;
}
