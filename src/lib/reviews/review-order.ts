// The order a review link points at, and whether it can still be reviewed
// (server-only). Shared by the /review page and POST /api/reviews.

import type { FulfilmentClient, ReviewRow } from "@/lib/fulfilment/db";
import { isMissingSchemaError } from "./schema";

const REVIEWABLE = new Set(["paid", "producing", "shipped", "delivered"]);

export type ReviewableOrder =
  /** Refunded, cancelled, anonymised, unknown, or the reviews table is not there yet. */
  | { state: "unavailable" }
  | { state: "reviewed"; review: Pick<ReviewRow, "id" | "status" | "publish_consent"> }
  | {
      state: "open";
      order: { id: string; userId: string | null; checkoutSessionId: string | null; storyId: string };
      bookTitle: string | null;
    };

export async function loadReviewableOrder(supabase: FulfilmentClient, orderId: string): Promise<ReviewableOrder> {
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, status, refunded_at, story_id, user_id, stripe_checkout_session_id")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(`review order read: ${error.message}`);

  const { data: existing, error: reviewErr } = await supabase
    .from("reviews")
    .select("id, status, publish_consent")
    .eq("order_id", orderId)
    .maybeSingle();
  if (reviewErr) {
    if (isMissingSchemaError(reviewErr)) return { state: "unavailable" };
    throw new Error(`review read: ${reviewErr.message}`);
  }
  if (existing) return { state: "reviewed", review: existing };

  if (!order || !order.story_id || order.refunded_at || !REVIEWABLE.has(order.status)) return { state: "unavailable" };

  const { data: story } = await supabase.from("stories").select("title, generated_text").eq("id", order.story_id).maybeSingle();
  const generated = story?.generated_text as { bookTitle?: string } | null | undefined;
  const bookTitle = story?.title || (generated && typeof generated === "object" ? generated.bookTitle : null) || null;

  return {
    state: "open",
    order: { id: order.id, userId: order.user_id, checkoutSessionId: order.stripe_checkout_session_id, storyId: order.story_id },
    bookTitle,
  };
}
