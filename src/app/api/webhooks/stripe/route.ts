import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, getStripeWebhookSecrets, isEventForActiveEnvironment } from "@/lib/stripe";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import {
  recordAsyncPaymentFailed,
  recordDispute,
  recordExpiredSession,
  recordPaidSession,
  recordRefund,
} from "@/lib/fulfilment/payments";

// Stripe signs the raw body.
export const runtime = "nodejs";

/**
 * Stripe webhook (live AND test endpoints point here; see
 * scripts/stripe-setup-catalog.mts for the event list). Events of the mode that
 * STRIPE_ENVIRONMENT isn't running are acknowledged and ignored. Handler errors
 * answer 500 so Stripe retries (every handler is idempotent).
 */
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const secrets = getStripeWebhookSecrets();
  if (secrets.length === 0) {
    console.error("Stripe webhook secret not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event | null = null;
  for (const secret of secrets) {
    try {
      event = getStripe().webhooks.constructEvent(body, signature, secret);
      break;
    } catch {
      // try the next secret
    }
  }
  if (!event) {
    console.error("Webhook signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (!isEventForActiveEnvironment(event)) {
    console.log(`[Stripe webhook] Ignoring ${event.livemode ? "live" : "test"} event ${event.id} (${event.type})`);
    return NextResponse.json({ received: true, ignored: "other_mode" });
  }

  try {
    const supabase = createFulfilmentClient();
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        // Not one of ours (e.g. `stripe trigger` fixtures, other integrations on the account).
        if (!session.metadata?.story_id) break;
        const result = await recordPaidSession(supabase, session.id);
        if (result.state === "not_found") {
          // /api/checkout inserts the row right after creating the session: retry.
          throw new Error(`No order row for session ${session.id}`);
        }
        console.log(`[Stripe webhook] ${event.type} ${session.id}: ${result.state}`);
        break;
      }
      case "checkout.session.expired":
        await recordExpiredSession(supabase, event.data.object.id);
        break;
      case "checkout.session.async_payment_failed": {
        const session = event.data.object;
        if (!session.metadata?.story_id) break;
        await recordAsyncPaymentFailed(supabase, session);
        break;
      }
      case "charge.refunded":
        await recordRefund(supabase, event.data.object);
        break;
      case "charge.dispute.created":
        await recordDispute(supabase, event.data.object);
        break;
      default:
        break;
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
