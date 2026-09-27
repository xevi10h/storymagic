import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { sendOrderEmailOnce } from "@/lib/fulfilment/emails";

type LegacyShipping = { name?: string | null; address?: Stripe.Address | null } | null | undefined;

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing session_id" },
      { status: 400 }
    );
  }

  // Try user session first, fall back to service role for guest users
  // The Stripe checkout session ID acts as proof of ownership
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();

  const supabase = user ? userSupabase : createFulfilmentClient();

  // Fetch order by checkout session ID
  const query = supabase
    .from("orders")
    .select("id, format, status, story_id, user_id, stories(generated_text, characters(name))")
    .eq("stripe_checkout_session_id", sessionId);

  // If authenticated, scope to user; otherwise session ID is proof enough
  if (user) query.eq("user_id", user.id);

  const { data: order, error } = await query.single();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // If order is not yet paid, proactively check with Stripe instead of
  // waiting for the webhook. This handles cases where the webhook is delayed
  // or not yet configured, giving the user immediate access after payment.
  if (order.status !== "paid") {
    // Skip Stripe check for mock sessions
    if (sessionId.startsWith("mock_")) {
      return NextResponse.json({ error: "Order not yet paid" }, { status: 402 });
    }

    try {
      const stripeSession = await getStripe().checkout.sessions.retrieve(sessionId);

      // Mirror the webhook: only a settled payment flips the order. A 100%
      // promotion code completes the session with no_payment_required.
      const settled =
        stripeSession.payment_status === "paid" ||
        stripeSession.payment_status === "no_payment_required";
      if (!settled) {
        return NextResponse.json({ error: "Order not yet paid" }, { status: 402 });
      }

      // Extract shipping details (Basil API + legacy fallback)
      const legacyShipping = (stripeSession as Stripe.Checkout.Session & { shipping_details?: LegacyShipping }).shipping_details;
      const shipping = stripeSession.collected_information?.shipping_details ?? legacyShipping ?? undefined;
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

      // Guests are anonymous auth users with no email: the Checkout email is the
      // only address we have for them.
      const customerEmail =
        stripeSession.customer_details?.email?.trim() || stripeSession.customer_email?.trim() || null;

      // Conditional transition pending → paid (service role: user RLS may not
      // allow status changes). The affected row tells us whether THIS request
      // processed the payment — the Stripe webhook may have flipped it first.
      const admin = createFulfilmentClient();
      const { data: flipped, error: updateError } = await admin
        .from("orders")
        .update({
          status: "paid",
          stripe_payment_id: (typeof stripeSession.payment_intent === "string"
            ? stripeSession.payment_intent
            : stripeSession.payment_intent?.id) ?? null,
          shipping_name: shipping?.name ?? null,
          shipping_address: shippingAddress
            ? JSON.parse(JSON.stringify(shippingAddress))
            : null,
          customer_email: customerEmail,
        })
        .eq("id", order.id)
        .eq("status", "pending")
        .select("id, story_id, user_id, format");

      if (updateError) {
        console.error(`[verify] Failed to update order ${order.id}:`, updateError.message);
        return NextResponse.json({ error: "Order not yet paid" }, { status: 402 });
      }

      const flippedOrder = flipped?.[0];
      if (flippedOrder) {
        console.log(`[verify] Order ${order.id} marked paid via direct Stripe check (session ${sessionId})`);
        // Confirmation email for every format, exactly once across webhook + verify
        // (claimed via orders.confirmation_email_sent_at).
        const isPhysical = flippedOrder.format !== "digital_pdf";
        await sendOrderEmailOnce(admin, {
          order: flippedOrder,
          column: "confirmation_email_sent_at",
          event: isPhysical ? "order_confirmed" : "order_confirmed_digital",
          email: customerEmail ?? user?.email ?? null,
        });
      } else {
        // Not pending any more: fine if the webhook already marked it paid (or it
        // moved further along); anything else (e.g. cancelled) is not paid.
        const { data: fresh } = await admin
          .from("orders")
          .select("status")
          .eq("id", order.id)
          .single();
        if (!fresh || fresh.status === "pending" || fresh.status === "cancelled") {
          return NextResponse.json({ error: "Order not yet paid" }, { status: 402 });
        }
      }
      // Fall through to return order data below
    } catch (stripeError) {
      console.error(`[verify] Stripe session check failed:`, stripeError);
      return NextResponse.json({ error: "Order not yet paid" }, { status: 402 });
    }
  }

  const stories = order.stories as {
    generated_text: { bookTitle?: string } | null;
    characters: { name: string } | null;
  } | null;

  return NextResponse.json({
    format: order.format,
    storyId: order.story_id,
    // null when unknown — the client falls back to its localized generic copy
    bookTitle: (stories?.generated_text as { bookTitle?: string })?.bookTitle ?? null,
    characterName: stories?.characters?.name ?? null,
  });
}
