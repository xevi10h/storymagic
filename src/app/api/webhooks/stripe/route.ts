import { NextResponse } from "next/server";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type Stripe from "stripe";
import type { Database } from "@/lib/database.types";

// Service-role client for webhook context (no user session/cookies available)
function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for webhook");
  }
  return createSupabaseAdmin<Database>(url, serviceKey);
}

// Stripe sends raw body — we need to disable body parsing
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let webhookSecret: string;
  try {
    webhookSecret = getStripeWebhookSecret();
  } catch (err) {
    console.error("Stripe webhook secret not configured:", err);
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error(
      "Webhook signature verification failed:",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Handle the event — throw on errors so Stripe retries the webhook
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutExpired(session);
        break;
      }
      default:
        // Ignore other event types
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const supabase = createServiceClient();

  const storyId = session.metadata?.story_id;
  const userId = session.metadata?.user_id;

  if (!storyId || !userId) {
    throw new Error(`Missing metadata in Stripe session: ${session.id}`);
  }

  // Idempotency guard — skip if already processed (Stripe guarantees at-least-once delivery)
  const { data: existingOrder } = await supabase
    .from("orders")
    .select("status")
    .eq("stripe_checkout_session_id", session.id)
    .single();

  if (existingOrder?.status === "paid" || existingOrder?.status === "completed") {
    console.log(`Order already processed for session ${session.id}, skipping`);
    return;
  }

  // Retrieve full session with shipping details from Stripe API
  const fullSession = await getStripe().checkout.sessions.retrieve(session.id);

  // Extract shipping details — Stripe Basil API (2025-03-31+) moved shipping
  // into collected_information.shipping_details. Fall back to top-level
  // shipping_details for older API versions / SDK compatibility.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawSession = fullSession as any;
  const shipping: { name?: string; address?: Record<string, string> } | undefined =
    rawSession.collected_information?.shipping_details ??
    rawSession.shipping_details ??
    undefined;

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
    console.warn(`[Stripe webhook] No shipping address found for physical order — session ${session.id}`);
  }

  // Update order
  const { error } = await supabase
    .from("orders")
    .update({
      status: "paid",
      stripe_payment_id: (typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id) ?? null,
      shipping_name: shipping?.name ?? null,
      shipping_address: shippingAddress
        ? JSON.parse(JSON.stringify(shippingAddress))
        : null,
    })
    .eq("stripe_checkout_session_id", session.id);

  if (error) {
    throw new Error(`Failed to update order for session ${session.id}: ${error.message}`);
  }

  // Check story status — only transition to "ordered" if story is already fully ready.
  // If story is in "preview" status, leave it — the success page will trigger
  // completion of remaining illustrations via /api/stories/[storyId]/complete
  const { data: story } = await supabase
    .from("stories")
    .select("status")
    .eq("id", storyId)
    .single();

  if (story?.status === "ready") {
    await supabase
      .from("stories")
      .update({ status: "ordered" })
      .eq("id", storyId);
  }

  console.log(`Order paid for story ${storyId}, session ${session.id}, story status: ${story?.status}`);
}

async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  const supabase = createServiceClient();

  // Mark the order as cancelled
  const { error } = await supabase
    .from("orders")
    .update({ status: "cancelled" })
    .eq("stripe_checkout_session_id", session.id);

  if (error) {
    throw new Error(`Failed to cancel order for session ${session.id}: ${error.message}`);
  }

  console.log(`Checkout expired for session ${session.id}`);
}
