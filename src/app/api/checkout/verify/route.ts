import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing session_id" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch order by checkout session ID — only return paid orders
  const { data: order, error } = await supabase
    .from("orders")
    .select("format, status, story_id, stories(generated_text, characters(name))")
    .eq("stripe_checkout_session_id", sessionId)
    .eq("user_id", user.id)
    .single();

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
