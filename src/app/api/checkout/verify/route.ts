import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";
import type { Database } from "@/lib/database.types";

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Missing Supabase service config");
  return createSupabaseAdmin<Database>(url, serviceKey);
}

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

  const supabase = user ? userSupabase : createServiceClient();

  // Fetch order by checkout session ID
  const query = supabase
    .from("orders")
    .select("id, format, status, story_id, stories(generated_text, characters(name))")
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

      if (stripeSession.payment_status === "paid") {
        // Payment confirmed by Stripe — update order directly
        // Extract shipping details (Basil API + legacy fallback)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawSession = stripeSession as any;
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

        const { error: updateError } = await supabase
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
          })
          .eq("id", order.id);

        if (updateError) {
          console.error(`[verify] Failed to update order ${order.id}:`, updateError.message);
          return NextResponse.json({ error: "Order not yet paid" }, { status: 402 });
        }

        console.log(`[verify] Order ${order.id} marked paid via direct Stripe check (session ${sessionId})`);
        // Fall through to return order data below
      } else {
        // Stripe confirms payment is not complete
        return NextResponse.json({ error: "Order not yet paid" }, { status: 402 });
      }
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
    bookTitle:
      (stories?.generated_text as { bookTitle?: string })?.bookTitle ??
      "Tu cuento",
    characterName: stories?.characters?.name ?? "tu hijo/a",
  });
}
