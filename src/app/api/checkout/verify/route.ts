import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
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

  // Fetch order by checkout session ID — only return paid orders
  const query = supabase
    .from("orders")
    .select("format, status, story_id, stories(generated_text, characters(name))")
    .eq("stripe_checkout_session_id", sessionId);

  // If authenticated, scope to user; otherwise session ID is proof enough
  if (user) query.eq("user_id", user.id);

  const { data: order, error } = await query.single();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status !== "paid") {
    return NextResponse.json({ error: "Order not yet paid" }, { status: 402 });
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
