import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import type Stripe from "stripe";

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

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
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

  // Handle the event
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
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const supabase = await createClient();

  const storyId = session.metadata?.story_id;
  const userId = session.metadata?.user_id;

  if (!storyId || !userId) {
    console.error("Missing metadata in Stripe session:", session.id);
    return;
  }

  // Retrieve full session with shipping details from Stripe API
  const fullSession = await getStripe().checkout.sessions.retrieve(session.id);

  // Extract shipping details from collected_information (basil API)
  const shippingRaw = fullSession as unknown as Record<string, unknown>;
  const shipping = (shippingRaw.collected_information as Record<string, unknown>)?.shipping_details as {
    name?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
  } | undefined;

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
    console.error("Failed to update order:", error);
    return;
  }

  // Update story status to "ordered"
  await supabase
    .from("stories")
    .update({ status: "ordered" })
    .eq("id", storyId);

  console.log(`Order completed for story ${storyId}, session ${session.id}`);
}

async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  const supabase = await createClient();

  // Mark the order as cancelled
  await supabase
    .from("orders")
    .update({ status: "cancelled" })
    .eq("stripe_checkout_session_id", session.id);

  console.log(`Checkout expired for session ${session.id}`);
}
