// One email to the owner per new review (existing operator-alert pattern,
// src/lib/fulfilment/alerts.ts), with a signed link to hide it (or publish it, when it
// is held) without SQL. Never throws.

import type { FulfilmentClient } from "@/lib/fulfilment/db";
import { adminOrderUrl, alertOperator } from "@/lib/fulfilment/alerts";
import { getSiteUrl } from "@/lib/email/send";
import { moderationUrl, reviewKey, signReviewToken } from "./review-token";

export async function notifyOwnerOfReview(
  supabase: FulfilmentClient,
  review: { id: string; orderId: string; rating: number; body: string | null; displayName: string; locale: string; status: string; publishConsent: boolean },
): Promise<void> {
  try {
    const link = moderationUrl(getSiteUrl(), signReviewToken("moderate", review.id, reviewKey("moderate")));
    const state =
      review.status === "published"
        ? "PUBLISHED on the site now."
        : review.publishConsent
          ? "HELD (the text has a link): publish it or leave it hidden."
          : "PRIVATE (no consent to publish): never shown.";
    await alertOperator(supabase, {
      key: `review:${review.id}`,
      subject: `New review ${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)} from ${review.displayName}`,
      lines: [
        `Status: ${state}`,
        `Rating: ${review.rating}/5 · Language: ${review.locale}`,
        `Text: ${review.body ?? "(none)"}`,
        `Hide / publish: ${link}`,
        `Order: ${adminOrderUrl(review.orderId)}`,
      ],
      dedupeSeconds: 30 * 24 * 3600,
    });
  } catch (err) {
    console.error("[reviews] Owner notification failed:", err instanceof Error ? err.message : err);
  }
}
