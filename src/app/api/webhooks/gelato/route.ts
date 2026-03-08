import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { GelatoWebhookEvent } from "@/lib/gelato/types";

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

export async function POST(request: Request) {
  // Verify webhook secret — configured as Authorization header in Gelato dashboard.
  // Without this, anyone who discovers the endpoint URL can spoof order updates.
  const webhookSecret = process.env.GELATO_WEBHOOK_SECRET;
  if (webhookSecret) {
    const authHeader = request.headers.get("authorization");
    const secretParam = new URL(request.url).searchParams.get("secret");
    const providedSecret = authHeader?.replace("Bearer ", "") ?? secretParam;
    if (providedSecret !== webhookSecret) {
      console.warn("[Gelato webhook] Invalid or missing authorization");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    console.warn("[Gelato webhook] GELATO_WEBHOOK_SECRET not configured — skipping auth check");
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

async function handleOrderStatusUpdated(event: GelatoWebhookEvent) {
  const supabase = createServiceClient();
  const status = event.fulfillmentStatus?.toLowerCase();

  if (!status) return;

  // Map Gelato fulfillment status → our order status
  const statusMap: Record<string, string> = {
    created: "producing",
    passed: "producing",
    printed: "producing",
    shipped: "shipped",
    delivered: "delivered",
    cancelled: "paid", // Revert to paid — needs manual review
    failed: "paid",
  };

  const newStatus = statusMap[status];
  if (!newStatus) {
    console.log(`[Gelato webhook] Unhandled fulfillment status: ${status}`);
    return;
  }

  const { error } = await supabase
    .from("orders")
    .update({ status: newStatus })
    .eq("gelato_order_id", event.orderId);

  if (error) {
    throw new Error(`Failed to update order ${event.orderId}: ${error.message}`);
  }

  console.log(`[Gelato webhook] Order ${event.orderId} → ${newStatus}`);

  if (newStatus === "shipped" || newStatus === "delivered") {
    await syncStoryStatus(supabase, event.orderId);
  }
}

async function handleOrderItemStatusUpdated(event: GelatoWebhookEvent) {
  const supabase = createServiceClient();

  // Look for a shipped item that has tracking info
  const shippedItem = event.items?.find(
    (item) => item.fulfillmentStatus?.toLowerCase() === "shipped" && item.shipment?.trackingCode,
  );

  if (!shippedItem?.shipment) return;

  const { trackingCode, trackingUrl } = shippedItem.shipment;

  const { error } = await supabase
    .from("orders")
    .update({
      status: "shipped",
      tracking_number: trackingCode ?? null,
    })
    .eq("gelato_order_id", event.orderId);

  if (error) {
    throw new Error(`Failed to update tracking for order ${event.orderId}: ${error.message}`);
  }

  console.log(`[Gelato webhook] Item shipped — tracking: ${trackingCode} ${trackingUrl ?? ""}`);

  await syncStoryStatus(supabase, event.orderId);
}

async function syncStoryStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  gelatoOrderId: string,
) {
  const { data: order } = await supabase
    .from("orders")
    .select("story_id")
    .eq("gelato_order_id", gelatoOrderId)
    .single();

  if (!order?.story_id) return;

  await supabase
    .from("stories")
    .update({ status: "shipped" })
    .eq("id", order.story_id);

  console.log(`[Gelato webhook] Story ${order.story_id} → shipped`);
}
