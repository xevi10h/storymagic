import { NextResponse } from "next/server";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";
import type Stripe from "stripe";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { sendOrderEmailOnce } from "@/lib/fulfilment/emails";

// Service-role client for webhook context (no user session/cookies available)
const createServiceClient = createFulfilmentClient;

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
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
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

const PHYSICAL_FORMATS = new Set(["softcover", "hardcover"]);

type LegacyShipping = { name?: string | null; address?: Stripe.Address | null } | null | undefined;

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // Delayed payment methods complete the session unpaid; the money arrives later
  // with checkout.session.async_payment_succeeded (handled by this same function).
  // no_payment_required = 100% promo code.
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    console.log(`[Stripe webhook] Session ${session.id} completed with payment_status=${session.payment_status} — waiting for payment`);
    return;
  }

  const supabase = createServiceClient();

  const storyId = session.metadata?.story_id;
  const userId = session.metadata?.user_id;

  if (!storyId || !userId) {
    throw new Error(`Missing metadata in Stripe session: ${session.id}`);
  }

  // Retrieve full session with shipping + customer details from Stripe API
  const fullSession = await getStripe().checkout.sessions.retrieve(session.id);

  // Stripe Basil API (2025-03-31+) moved shipping into
  // collected_information.shipping_details; fall back to the legacy top-level field.
  const legacyShipping = (fullSession as Stripe.Checkout.Session & { shipping_details?: LegacyShipping }).shipping_details;
  const shipping = fullSession.collected_information?.shipping_details ?? legacyShipping ?? undefined;

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

  // Guests are anonymous auth users with no email: the Checkout email is the only
  // address we have for them.
  const customerEmail =
    fullSession.customer_details?.email?.trim() || fullSession.customer_email?.trim() || null;

  // Conditional transition pending → paid: the affected row tells us whether THIS
  // delivery processed the payment (Stripe delivers at-least-once, and
  // /api/checkout/verify may have flipped it first).
  const { data: flipped, error } = await supabase
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
      customer_email: customerEmail,
    })
    .eq("stripe_checkout_session_id", session.id)
    .eq("status", "pending")
    .select("id, story_id, user_id, format");

  if (error) {
    throw new Error(`Failed to update order for session ${session.id}: ${error.message}`);
  }

  let order = flipped?.[0];
  const processedHere = !!order;

  if (!order) {
    // Already paid: a retry of this webhook, or verify won the race.
    const { data: existing, error: readErr } = await supabase
      .from("orders")
      .select("id, story_id, user_id, format, status, customer_email")
      .eq("stripe_checkout_session_id", session.id)
      .maybeSingle();
    if (readErr) throw new Error(`Failed to read order for session ${session.id}: ${readErr.message}`);
    if (!existing) throw new Error(`No order row for paid session ${session.id}`);
    if (existing.status === "pending" || existing.status === "cancelled") {
      throw new Error(`Order ${existing.id} for paid session ${session.id} is '${existing.status}' — retry`);
    }
    // Backfill the email if the row predates customer_email.
    if (!existing.customer_email && customerEmail) {
      await supabase
        .from("orders")
        .update({ customer_email: customerEmail })
        .eq("id", existing.id)
        .is("customer_email", null);
    }
    order = existing;
  }

  console.log(`Order ${order.id} paid for story ${storyId}, session ${session.id} (processed here: ${processedHere})`);

  // Confirmation email for EVERY format, exactly once (claimed via
  // orders.confirmation_email_sent_at; /checkout/verify uses the same claim).
  const isPhysical = PHYSICAL_FORMATS.has(order.format);
  await sendOrderEmailOnce(supabase, {
    order,
    column: "confirmation_email_sent_at",
    event: isPhysical ? "order_confirmed" : "order_confirmed_digital",
    email: customerEmail,
  });
}

async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  const supabase = createServiceClient();

  // Mark the order as cancelled — only if it never got paid
  const { error } = await supabase
    .from("orders")
    .update({ status: "cancelled" })
    .eq("stripe_checkout_session_id", session.id)
    .eq("status", "pending");

  if (error) {
    throw new Error(`Failed to cancel order for session ${session.id}: ${error.message}`);
  }

  console.log(`Checkout expired for session ${session.id}`);
}
