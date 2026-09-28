import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { recordPaidSession } from "@/lib/fulfilment/payments";

const PAID_STATUSES = new Set(["paid", "producing", "shipped", "delivered"]);

/**
 * Success-page check. The Checkout Session id is the proof of purchase (guests are
 * anonymous users; a signed-in buyer is additionally scoped to their own orders).
 * If the webhook hasn't landed yet, ask Stripe directly and record the payment the
 * same way the webhook does.
 */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!sessionId || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  const userSupabase = await createClient();
  const {
    data: { user },
  } = await userSupabase.auth.getUser();
  const admin = createFulfilmentClient();

  const readOrder = () => {
    const query = admin
      .from("orders")
      .select("id, format, status, story_id, user_id, invoice_url, stories(title, generated_text, characters(name))")
      .eq("stripe_checkout_session_id", sessionId);
    if (user) query.eq("user_id", user.id);
    return query.maybeSingle();
  };

  let { data: order } = await readOrder();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (!PAID_STATUSES.has(order.status)) {
    if (order.status !== "pending") return NextResponse.json({ error: "Order not paid" }, { status: 410 });
    try {
      const result = await recordPaidSession(admin, sessionId, { fallbackEmail: user?.email });
      if (result.state !== "paid") return NextResponse.json({ error: "Order not yet paid" }, { status: 402 });
    } catch (err) {
      console.error("[verify] Stripe session check failed:", err);
      return NextResponse.json({ error: "Order not yet paid" }, { status: 402 });
    }
    ({ data: order } = await readOrder());
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const story = order.stories as unknown as {
    title: string | null;
    generated_text: { bookTitle?: string } | null;
    characters: { name: string } | null;
  } | null;

  return NextResponse.json({
    format: order.format,
    storyId: order.story_id,
    // null when unknown — the client falls back to its localized generic copy
    bookTitle: story?.title ?? story?.generated_text?.bookTitle ?? null,
    characterName: story?.characters?.name ?? null,
    invoiceUrl: order.invoice_url,
  });
}
