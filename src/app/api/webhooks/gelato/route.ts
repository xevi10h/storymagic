import { NextResponse } from "next/server";
import type { GelatoWebhookEvent } from "@/lib/gelato/types";
import { notifyOrderEmail } from "@/lib/email/notify-order";
import type { OrderEmailEvent } from "@/lib/email/order-emails";
import { createFulfilmentClient, type FulfilmentClient } from "@/lib/fulfilment/db";
import { alertOperator } from "@/lib/fulfilment/alerts";
import { decideGelatoTransition } from "@/lib/fulfilment/logic";

// Service-role client — no user session in webhook context
const createServiceClient = createFulfilmentClient;

export const runtime = "nodejs";

// Internal order status → customer email event. "paid" has no email (manual review).
const STATUS_EMAIL: Record<string, OrderEmailEvent | undefined> = {
  producing: "in_production",
  shipped: "shipped",
  delivered: "delivered",
};

export async function POST(request: Request) {
  // Verify webhook secret — configured as Authorization header in Gelato dashboard.
  // Without this, anyone who discovers the endpoint URL can spoof order updates.
  const webhookSecret = process.env.GELATO_WEBHOOK_SECRET?.trim();
  if (webhookSecret) {
    const authHeader = request.headers.get("authorization");
    const secretParam = new URL(request.url).searchParams.get("secret");
    const providedSecret = (authHeader?.replace("Bearer ", "") ?? secretParam)?.trim();
    if (providedSecret !== webhookSecret) {
      console.warn("[Gelato webhook] Invalid or missing authorization");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    console.error("[Gelato webhook] GELATO_WEBHOOK_SECRET not configured — rejecting request");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 401 });
  }

  let event: GelatoWebhookEvent;

  try {
    event = (await request.json()) as GelatoWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  console.log(`[Gelato webhook] ${event.event} — order ${event.orderId} (ref: ${event.orderReferenceId})`);

  try {
    switch (event.event) {
      case "order_status_updated":
        await handleOrderStatusUpdated(event);
        break;
      case "order_item_status_updated":
        await handleOrderItemStatusUpdated(event);
        break;
      default:
        // Acknowledge unknown events silently
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[Gelato webhook] Handler error:", err);
    // Return 500 so Gelato retries (3 attempts with 5s delay)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

interface TrackingInfo {
  trackingNumber?: string | null;
  trackingUrl?: string | null;
}

/**
 * Apply a Gelato status to the order. Transitions are ranked (paid < producing <
 * shipped < delivered): a late or retried event can never move an order
 * backwards, and the update is a compare-and-set on the status we read, so two
 * concurrent events can't both "win". Customers are emailed only by the event
 * that performed the transition. Tracking is stored whenever provided.
 * Canceled/failed/returned never change the status automatically: the raw status
 * is recorded and the operator is alerted.
 */
async function applyGelatoStatus(
  supabase: FulfilmentClient,
  gelatoOrderId: string,
  gelatoStatus: string,
  tracking?: TrackingInfo,
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: order, error: readErr } = await supabase
      .from("orders")
      .select("id, status, story_id, user_id, tracking_number, tracking_url")
      .eq("gelato_order_id", gelatoOrderId)
      .maybeSingle();
    if (readErr) throw new Error(`Failed to read order ${gelatoOrderId}: ${readErr.message}`);
    if (!order) {
      // Our submit records gelato_order_id right after Gelato accepts the order; an
      // event racing that write is safe to drop (the submitter sends the email).
      console.warn(`[Gelato webhook] No order found for gelato_order_id ${gelatoOrderId}`);
      return;
    }

    const decision = decideGelatoTransition(order.status, gelatoStatus);
    const nextTrackingNumber = tracking?.trackingNumber ?? order.tracking_number ?? null;
    const nextTrackingUrl = tracking?.trackingUrl ?? order.tracking_url ?? null;
    const trackingUpdate = tracking ? { tracking_number: nextTrackingNumber, tracking_url: nextTrackingUrl } : {};

    if (decision.kind === "unknown") {
      console.log(`[Gelato webhook] Unhandled fulfillment status: ${decision.gelatoStatus}`);
      return;
    }

    if (decision.kind === "exception") {
      await supabase
        .from("orders")
        .update({ gelato_status: decision.gelatoStatus, ...trackingUpdate })
        .eq("id", order.id);
      // We cancelled it ourselves after a Stripe refund: expected, no alert.
      if (order.status === "refunded" && decision.gelatoStatus.startsWith("cancel")) return;
      await alertOperator(supabase, {
        key: `gelato-exception:${order.id}:${decision.gelatoStatus}`,
        subject: `Gelato order ${gelatoOrderId} is ${decision.gelatoStatus}`,
        lines: [
          `Local order ${order.id} (story ${order.story_id}) stays at '${order.status}'.`,
          "Check the order in the Gelato dashboard. To re-submit, clear orders.gelato_order_id and set status back to 'paid' — the cron will send a new order.",
        ],
        dedupeSeconds: 24 * 3600,
      });
      return;
    }

    if (decision.kind !== "advance") {
      // Same or older status: keep the order where it is, only refresh tracking.
      await supabase
        .from("orders")
        .update({ gelato_status: gelatoStatus.toLowerCase(), ...trackingUpdate })
        .eq("id", order.id);
      console.log(`[Gelato webhook] Order ${gelatoOrderId}: '${gelatoStatus}' ignored (${decision.kind}, order is '${order.status}')`);
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

    console.log(`[Gelato webhook] Order ${gelatoOrderId} ${order.status} → ${decision.to}`);

    if (decision.to === "shipped" || decision.to === "delivered") {
      await syncStoryStatus(supabase, order.story_id, decision.to);
    }

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

async function handleOrderStatusUpdated(event: GelatoWebhookEvent) {
  const status = event.fulfillmentStatus?.toLowerCase();
  if (!status) return;
  await applyGelatoStatus(createServiceClient(), event.orderId, status);
}

const TRACKABLE_ITEM_STATUSES = new Set(["shipped", "in_transit", "delivered"]);

async function handleOrderItemStatusUpdated(event: GelatoWebhookEvent) {
  // Look for a shipped item that has tracking info
  const shippedItem = event.items?.find(
    (item) => TRACKABLE_ITEM_STATUSES.has(item.fulfillmentStatus?.toLowerCase() ?? "") && item.shipment?.trackingCode,
  );

  if (!shippedItem?.shipment || !shippedItem.fulfillmentStatus) return;

  const { trackingCode, trackingUrl } = shippedItem.shipment;

  await applyGelatoStatus(createServiceClient(), event.orderId, shippedItem.fulfillmentStatus.toLowerCase(), {
    trackingNumber: trackingCode ?? null,
    trackingUrl: trackingUrl ?? null,
  });

  console.log(`[Gelato webhook] Item ${shippedItem.fulfillmentStatus} — tracking: ${trackingCode} ${trackingUrl ?? ""}`);
}

async function syncStoryStatus(
  supabase: FulfilmentClient,
  storyId: string,
  orderStatus: "shipped" | "delivered",
) {
  if (!storyId) return;

  // Forward-only: never move a delivered story back to shipped.
  const storyStatus = orderStatus === "delivered" ? "delivered" : "shipped";
  let query = supabase.from("stories").update({ status: storyStatus }).eq("id", storyId);
  if (storyStatus === "shipped") query = query.neq("status", "delivered");
  await query;

  console.log(`[Gelato webhook] Story ${storyId} → ${storyStatus}`);
}
