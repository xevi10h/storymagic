// Server-only: has this story been bought? Decides between the free preview and
// the full book in every API that returns book content (see preview-access.ts).
//
// Orders are read with the service role: their status is written only by the
// Stripe webhook / fulfilment (no client write grant), so a user cannot fake it.

import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { PAID_ORDER_STATUSES } from "@/lib/preview-access";

/** Statuses before a preview exists: no order can reference them (checkout needs a preview). */
const PRE_PREVIEW_STATUSES = new Set(["draft", "generating"]);

export interface PurchaseCheckInput {
  id: string;
  status: string;
  is_showcase?: boolean | null;
}

/**
 * True when the viewer may see the whole book:
 *  - a live paid order exists for the story (paid / producing / shipped / delivered;
 *    refunded or cancelled orders do not count), or
 *  - the story is a showcase example (public by design), or
 *  - local MOCK_MODE dev unlock (POST /complete marks the story ready without an
 *    order; same guard as that route: never with live Stripe).
 * Fails closed: a failed lookup shows the preview.
 */
export async function isStoryPurchased(story: PurchaseCheckInput): Promise<boolean> {
  if (story.is_showcase) return true;
  if (PRE_PREVIEW_STATUSES.has(story.status)) return false;
  if (process.env.MOCK_MODE === "true" && process.env.STRIPE_ENVIRONMENT !== "live" && story.status !== "preview") return true;

  const { data, error } = await createFulfilmentClient()
    .from("orders")
    .select("id")
    .eq("story_id", story.id)
    .in("status", [...PAID_ORDER_STATUSES])
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(`[paywall] Paid-order lookup failed for story ${story.id}: ${error.message}`);
    return false;
  }
  return !!data;
}
