import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { GelatoWebhookEvent } from "@/lib/gelato/types";
import { notifyOrderEmail } from "@/lib/email/notify-order";
import type { OrderEmailEvent } from "@/lib/email/order-emails";

// Service-role client — no user session in webhook context
function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for webhook");
  }
  return createSupabaseAdmin<Database>(url, serviceKey);
}

export const runtime = "nodejs";

// Map Gelato fulfillment status → our internal order status
const STATUS_MAP: Record<string, string> = {
  created: "producing",
  passed: "producing",
  printed: "producing",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "paid", // Revert to paid — needs manual review
  failed: "paid",
};

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
 * Apply a status change to the order and notify the customer — but only email on a
 * real transition (prev status !== new status), so Gelato's repeated/retried events
 * never produce duplicate emails. Tracking is stored whenever provided.
 */
async function transitionOrder(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  gelatoOrderId: string,
  newStatus: string,
  tracking?: TrackingInfo,
) {
  const { data: order } = await supabase
    .from("orders")
    .select("id, status, story_id, user_id, tracking_number, tracking_url")
    .eq("gelato_order_id", gelatoOrderId)
    .single();

  if (!order) {
    console.warn(`[Gelato webhook] No order found for gelato_order_id ${gelatoOrderId}`);
    return;
  }

  const alreadyAtStatus = order.status === newStatus;

  // Build update — keep existing tracking unless a new value arrives
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = { status: newStatus };
  const nextTrackingNumber =
    tracking?.trackingNumber ?? order.tracking_number ?? null;
  const nextTrackingUrl = tracking?.trackingUrl ?? order.tracking_url ?? null;
  if (tracking) {
    update.tracking_number = nextTrackingNumber;
    update.tracking_url = nextTrackingUrl;
  }

  const { error } = await supabase
    .from("orders")
    .update(update)
    .eq("gelato_order_id", gelatoOrderId);

  if (error) {
    throw new Error(`Failed to update order ${gelatoOrderId}: ${error.message}`);
  }

  console.log(
    `[Gelato webhook] Order ${gelatoOrderId} → ${newStatus}${alreadyAtStatus ? " (no change)" : ""}`,
  );

  // Keep the story status in sync for shipped/delivered
  if (newStatus === "shipped" || newStatus === "delivered") {
    await syncStoryStatus(supabase, order.story_id, newStatus);
  }

  // Email only on a genuine transition
  if (alreadyAtStatus) return;

  const emailEvent = STATUS_EMAIL[newStatus];
  if (emailEvent && order.user_id && order.story_id) {
    await notifyOrderEmail({
      supabase,
      event: emailEvent,
      storyId: order.story_id,
      userId: order.user_id,
      trackingNumber: nextTrackingNumber,
      trackingUrl: nextTrackingUrl,
    });
  }
}

async function handleOrderStatusUpdated(event: GelatoWebhookEvent) {
  const supabase = createServiceClient();
  const status = event.fulfillmentStatus?.toLowerCase();
  if (!status) return;

  const newStatus = STATUS_MAP[status];
  if (!newStatus) {
    console.log(`[Gelato webhook] Unhandled fulfillment status: ${status}`);
    return;
  }

  await transitionOrder(supabase, event.orderId, newStatus);
}

async function handleOrderItemStatusUpdated(event: GelatoWebhookEvent) {
  const supabase = createServiceClient();

  // Look for a shipped item that has tracking info
  const shippedItem = event.items?.find(
    (item) => item.fulfillmentStatus?.toLowerCase() === "shipped" && item.shipment?.trackingCode,
  );

  if (!shippedItem?.shipment) return;

  const { trackingCode, trackingUrl } = shippedItem.shipment;

  await transitionOrder(supabase, event.orderId, "shipped", {
    trackingNumber: trackingCode ?? null,
    trackingUrl: trackingUrl ?? null,
  });

  console.log(`[Gelato webhook] Item shipped — tracking: ${trackingCode} ${trackingUrl ?? ""}`);
}

async function syncStoryStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  storyId: string,
  orderStatus: string,
) {
  if (!storyId) return;

  // Map order status to story status
  const storyStatus = orderStatus === "delivered" ? "delivered" : "shipped";

  await supabase.from("stories").update({ status: storyStatus }).eq("id", storyId);

  console.log(`[Gelato webhook] Story ${storyId} → ${storyStatus}`);
}
