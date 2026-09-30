import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { isPdfUpgradeAvailable } from "@/lib/stripe";
import { upsellForStory } from "@/lib/upsell";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The post-purchase offer on the owner's finished book (`{ offer }`, null if none):
 * shown on the book view next to the PDF download. Same decision as /api/checkout,
 * which re-checks it when paying. Fails soft to `{ offer: null }`.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ storyId: string }> }) {
  const { storyId } = await params;
  if (!UUID_RE.test(storyId)) return NextResponse.json({ error: "Invalid story ID" }, { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Service role + explicit owner filter (order status is not user-writable).
  const { data: orders, error } = await createFulfilmentClient()
    .from("orders")
    .select("id, user_id, story_id, format, status, refunded_at, created_at, offer")
    .eq("user_id", user.id)
    .eq("story_id", storyId);
  if (error) {
    console.error(`[offer] Order lookup failed for story ${storyId}: ${error.message}`);
    return NextResponse.json({ offer: null }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const now = Date.now();
  let offer = upsellForStory(orders ?? [], { userId: user.id, storyId, now });
  if (offer?.offer === "pdf_upgrade" && !(await isPdfUpgradeAvailable())) offer = null;
  return NextResponse.json({ offer }, { headers: { "Cache-Control": "private, no-store" } });
}
