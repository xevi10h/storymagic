import { NextResponse } from "next/server";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { asReviewLocale, initialReviewStatus, parseReviewInput } from "@/lib/reviews/review-content";
import { loadReviewableOrder } from "@/lib/reviews/review-order";
import { notifyOwnerOfReview } from "@/lib/reviews/notify-owner";
import { revalidateReviewPages } from "@/lib/reviews/revalidate";
import { reviewKey, verifyReviewToken } from "@/lib/reviews/review-token";
import { isMissingSchemaError } from "@/lib/reviews/schema";

/**
 * Submit the review of an order (form at /[locale]/review). No login: the signed link
 * from the review-request email names the order (src/lib/reviews/review-token.ts), and
 * reviews.order_id is unique, so each order gets exactly one review.
 *
 * Body: { t, rating 1-5, body?, displayName, publishConsent, locale }
 * 200 { ok, status } · 400 invalid_token | invalid_<field> · 409 already_reviewed
 * 410 unavailable (refunded / cancelled order) · 503 not ready (migration pending) · 500
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const reply = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

export async function POST(request: Request) {
  let raw: Record<string, unknown>;
  try {
    raw = (await request.json()) as Record<string, unknown>;
  } catch {
    return reply({ error: "invalid_body" }, 400);
  }

  let orderId: string | null = null;
  try {
    orderId = verifyReviewToken("review", typeof raw.t === "string" ? raw.t : null, reviewKey("review"));
  } catch (err) {
    console.error("[reviews] Key unavailable:", err instanceof Error ? err.message : err);
    return reply({ error: "unavailable" }, 500);
  }
  if (!orderId) return reply({ error: "invalid_token" }, 400);

  const parsed = parseReviewInput({
    rating: raw.rating,
    body: raw.body,
    displayName: raw.displayName,
    publishConsent: raw.publishConsent,
  });
  if (!parsed.ok) return reply({ error: `invalid_${parsed.error}` }, 400);
  const input = parsed.value;

  const supabase = createFulfilmentClient();
  try {
    const target = await loadReviewableOrder(supabase, orderId);
    if (target.state === "reviewed") return reply({ error: "already_reviewed" }, 409);
    if (target.state === "unavailable") return reply({ error: "unavailable" }, 410);

    const status = initialReviewStatus(input);
    const locale = asReviewLocale(typeof raw.locale === "string" ? raw.locale : "es");
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("reviews")
      .insert({
        order_id: orderId,
        rating: input.rating,
        body: input.body,
        display_name: input.displayName,
        locale,
        publish_consent: input.publishConsent,
        status,
        published_at: status === "published" ? now : null,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") return reply({ error: "already_reviewed" }, 409);
      if (isMissingSchemaError(error)) return reply({ error: "not_ready" }, 503);
      throw new Error(error.message);
    }

    console.log(`[reviews] Review ${data.id} for order ${orderId} (${status})`);
    if (status === "published") revalidateReviewPages();
    await notifyOwnerOfReview(supabase, {
      id: data.id,
      orderId,
      rating: input.rating,
      body: input.body,
      displayName: input.displayName,
      locale,
      status,
      publishConsent: input.publishConsent,
    });
    return reply({ ok: true, status });
  } catch (err) {
    console.error(`[reviews] Could not save the review of order ${orderId}:`, err instanceof Error ? err.message : err);
    return reply({ error: "failed" }, 500);
  }
}
