import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { GelatoWebhookEvent } from "@/lib/gelato/types";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { applyGelatoStatus } from "@/lib/fulfilment/gelato-status";
import { pickTracking } from "@/lib/fulfilment/logic";

export const runtime = "nodejs";

/** Constant-time secret check (hashing first equalises the lengths timingSafeEqual needs). */
function secretMatches(provided: string | null | undefined, expected: string): boolean {
  if (!provided) return false;
  const digest = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(digest(provided), digest(expected));
}

export async function POST(request: Request) {
  // Gelato sends no signature and no custom headers: the secret travels as
  // ?secret= in the URL registered in the Gelato dashboard. Without it, anyone
  // who discovers the endpoint could spoof order updates.
  const webhookSecret = process.env.GELATO_WEBHOOK_SECRET?.trim();
  if (webhookSecret) {
    const authHeader = request.headers.get("authorization");
    const secretParam = new URL(request.url).searchParams.get("secret");
    const providedSecret = (authHeader?.replace("Bearer ", "") ?? secretParam)?.trim();
    if (!secretMatches(providedSecret, webhookSecret)) {
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
    const supabase = createFulfilmentClient();
    switch (event.event) {
      case "order_status_updated": {
        if (!event.fulfillmentStatus) break;
        // Tracking arrives here, in items[].fulfillments[] (verified against the docs 2026-09-28).
        const tracking = pickTracking(event.items);
        await applyGelatoStatus(supabase, event.orderId, event.fulfillmentStatus, tracking ?? undefined, event.orderReferenceId);
        break;
      }
      case "order_item_tracking_code_updated":
        // Fired when an item ships: a tracking code implies at least "shipped".
        if (event.trackingCode) {
          await applyGelatoStatus(
            supabase,
            event.orderId,
            "shipped",
            { trackingNumber: event.trackingCode, trackingUrl: event.trackingUrl || null },
            event.orderReferenceId,
          );
        }
        break;
      default:
        // order_item_status_updated is redundant for our one-item orders (the
        // order-level event carries the same status); anything else is ignored.
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[Gelato webhook] Handler error:", err);
    // 500 so Gelato retries (only 3 attempts, 5 s apart — the cron reconciles the rest)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
