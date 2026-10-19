// Read side of published reviews (server-only, service role, explicit column whitelist:
// the reviews table has no client policies). Used by the home and the SEO landings,
// which render the reviews visibly AND pass the same summary to ProductJsonLd.
// Never throws: a missing table (code shipped before the migration) or any error
// means "no reviews", so the page and its markup simply omit them.

import { cache } from "react";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { EMPTY_REVIEW_SUMMARY, summarizeReviews, type PublishedReview, type ReviewSummary } from "./review-content";
import { isMissingSchemaError } from "./schema";

/** Reviews rendered in full on a page (the aggregate covers all of them). */
export const REVIEWS_SHOWN = 6;
const RATINGS_SCAN = 5000;

export const getReviewSummary = cache(async (): Promise<ReviewSummary> => {
  try {
    const supabase = createFulfilmentClient();
    const [ratings, newest] = await Promise.all([
      supabase.from("reviews").select("rating").eq("status", "published").limit(RATINGS_SCAN),
      supabase
        .from("reviews")
        .select("id, rating, body, display_name, locale, published_at")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(REVIEWS_SHOWN),
    ]);
    for (const res of [ratings, newest]) {
      if (res.error) {
        if (!isMissingSchemaError(res.error)) console.warn("[reviews] Could not read published reviews:", res.error.message);
        return EMPTY_REVIEW_SUMMARY;
      }
    }
    const shown: PublishedReview[] = (newest.data ?? [])
      .filter((r) => r.published_at)
      .map((r) => ({
        id: r.id,
        rating: r.rating,
        body: r.body,
        displayName: r.display_name,
        locale: r.locale,
        publishedAt: r.published_at as string,
      }));
    return summarizeReviews((ratings.data ?? []).map((r) => r.rating), shown, REVIEWS_SHOWN);
  } catch (err) {
    console.warn("[reviews] Could not read published reviews:", err instanceof Error ? err.message : err);
    return EMPTY_REVIEW_SUMMARY;
  }
});
