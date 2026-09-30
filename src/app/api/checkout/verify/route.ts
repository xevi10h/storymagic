import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { recordPaidSession } from "@/lib/fulfilment/payments";

const PAID_STATUSES = new Set(["paid", "producing", "shipped", "delivered"]);

/**
 * Success-page check: the Checkout Session id AND the buyer's own session (guests
 * are anonymous users) — the order must belong to the caller.
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
  // The buyer's session (guests: the anonymous session that paid, same device) is
  // required: a leaked session_id alone (history, screenshots, logs) must not reveal
  // the book, the child's name or the invoice (buyer name + address). Without it the
  // client falls back to its generic "payment confirmed" state; the webhook + cron
  // record and complete the order anyway.
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createFulfilmentClient();

  const readOrder = () =>
    admin
      .from("orders")
      .select("id, format, status, story_id, user_id, invoice_url, stories(title, generated_text, characters(name))")
      .eq("stripe_checkout_session_id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();

  let { data: order } = await readOrder();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (!PAID_STATUSES.has(order.status)) {
    if (order.status !== "pending") return NextResponse.json({ error: "Order not paid" }, { status: 410 });
    try {
      const result = await recordPaidSession(admin, sessionId, { fallbackEmail: user.email });
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
