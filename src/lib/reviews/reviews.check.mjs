// Runnable check for the review rules (no deps, no test runner):
//   node --experimental-strip-types src/lib/reviews/reviews.check.mjs
import assert from "node:assert/strict";
import { deriveReviewKey, moderationUrl, reviewPageUrl, signReviewToken, verifyReviewToken } from "./review-token.ts";
import {
  DAYS_AFTER_DELIVERY,
  PDF_DAYS_AFTER_READY,
  REVIEW_CATCH_UP_DAYS,
  businessToCalendarDays,
  reviewRequestDecision,
} from "./review-schedule.ts";
import {
  EMPTY_REVIEW_SUMMARY,
  initialReviewStatus,
  parseReviewInput,
  productReviewMarkup,
  suggestDisplayName,
  summarizeReviews,
} from "./review-content.ts";

// ── Signed tokens ────────────────────────────────────────────────────────────
const ORDER = "6f1c2a4e-0b7d-4c1e-9a55-2f3e4d5c6b7a";
const REVIEW = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const reviewK = deriveReviewKey("service-role-secret", "review");
const modK = deriveReviewKey("service-role-secret", "moderate");
const otherK = deriveReviewKey("another-secret", "review");

const token = signReviewToken("review", ORDER, reviewK);
assert.match(token, /^r1\.[0-9a-f-]{36}\.[A-Za-z0-9_-]+$/);
assert.equal(verifyReviewToken("review", token, reviewK), ORDER, "round trip");
assert.equal(signReviewToken("review", ORDER.toUpperCase(), reviewK), token, "uuid case is normalised");
assert.equal(verifyReviewToken("review", token, otherK), null, "other secret: rejected");
assert.equal(verifyReviewToken("moderate", token, modK), null, "review token is not a moderation token");
const tampered = token.replace(ORDER, "6f1c2a4e-0b7d-4c1e-9a55-2f3e4d5c6b7b");
assert.equal(verifyReviewToken("review", tampered, reviewK), null, "other order id: rejected");
assert.equal(verifyReviewToken("review", token.slice(0, -2), reviewK), null, "cut signature: rejected");
assert.equal(verifyReviewToken("review", `${token}x`, reviewK), null, "extended signature: rejected");
for (const bad of [null, undefined, "", "r1", "r1.x.y", `${token}.extra`, "a".repeat(300)]) {
  assert.equal(verifyReviewToken("review", bad, reviewK), null, `garbage ${String(bad).slice(0, 12)}: rejected`);
}
assert.throws(() => signReviewToken("review", "not-a-uuid", reviewK));
assert.throws(() => deriveReviewKey("", "review"));
const modToken = signReviewToken("moderate", REVIEW, modK);
assert.equal(verifyReviewToken("moderate", modToken, modK), REVIEW);
assert.equal(verifyReviewToken("review", modToken, reviewK), null, "moderation token is not a review token");
assert.equal(reviewPageUrl("https://meapica.shop/", "ca", token), `https://meapica.shop/ca/review?t=${token}`);
assert.equal(moderationUrl("https://meapica.shop", modToken), `https://meapica.shop/api/reviews/moderate?t=${modToken}`);

// ── Schedule ─────────────────────────────────────────────────────────────────
const DAY = 86_400_000;
const T0 = Date.parse("2026-11-02T10:00:00Z");
const iso = (days) => new Date(T0 + days * DAY).toISOString();
const TRANSIT = 6;
const printed = (over = {}) => ({
  id: ORDER,
  format: "hardcover",
  status: "delivered",
  story_id: "s-1",
  customer_email: "marta@example.com",
  refunded_at: null,
  disputed_at: null,
  problem_email_sent_at: null,
  offer: null,
  total: "34.90",
  marketing_opt_out: false,
  ready_email_sent_at: iso(-5),
  shipped_at: iso(-3),
  delivered_at: iso(0),
  review_request_sent_at: null,
  ...over,
});
const decide = (order, now, over = {}) => reviewRequestDecision(order, { now, suppressed: false, transitBusinessDays: TRANSIT, ...over });
const reason = (d) => (d.send ? "send" : d.reason);

assert.equal(businessToCalendarDays(6), 9);
assert.equal(reason(decide(printed(), T0 + DAYS_AFTER_DELIVERY * DAY - 1)), "too_early", "1 ms before delivered + 4 d");
assert.equal(reason(decide(printed(), T0 + DAYS_AFTER_DELIVERY * DAY)), "send", "delivered + 4 d");
assert.equal(reason(decide(printed(), T0 + (DAYS_AFTER_DELIVERY + REVIEW_CATCH_UP_DAYS) * DAY)), "send", "last catch-up day");
assert.equal(reason(decide(printed(), T0 + (DAYS_AFTER_DELIVERY + REVIEW_CATCH_UP_DAYS) * DAY + 1)), "too_late", "past the window");
// Shipped, never reported delivered: shipped + 9 calendar days of transit + 4.
const shippedOnly = printed({ status: "shipped", shipped_at: iso(0), delivered_at: null });
assert.equal(reason(decide(shippedOnly, T0 + 12 * DAY)), "too_early");
assert.equal(reason(decide(shippedOnly, T0 + 13 * DAY)), "send");
assert.equal(reason(decide(printed({ status: "producing", shipped_at: null, delivered_at: null }), T0 + 30 * DAY)), "not_delivered");
// PDF: ready email + 5 days.
const pdf = printed({ format: "digital_pdf", status: "paid", shipped_at: null, delivered_at: null, ready_email_sent_at: iso(0) });
assert.equal(reason(decide(pdf, T0 + PDF_DAYS_AFTER_READY * DAY - 1)), "too_early");
assert.equal(reason(decide(pdf, T0 + PDF_DAYS_AFTER_READY * DAY)), "send");
assert.equal(reason(decide(printed({ format: "digital_pdf", ready_email_sent_at: null }), T0 + 30 * DAY)), "not_delivered");
// Exclusions.
const due = T0 + 5 * DAY;
assert.equal(reason(decide(printed({ review_request_sent_at: iso(4) }), due)), "already_sent");
assert.equal(reason(decide(printed({ status: "refunded" }), due)), "not_live");
assert.equal(reason(decide(printed({ status: "cancelled" }), due)), "not_live");
assert.equal(reason(decide(printed({ refunded_at: iso(1) }), due)), "refunded");
assert.equal(reason(decide(printed({ disputed_at: iso(1) }), due)), "disputed");
assert.equal(reason(decide(printed({ problem_email_sent_at: iso(1) }), due)), "print_problem");
assert.equal(reason(decide(printed({ offer: "extra_copy_repeat" }), due)), "offer_order");
assert.equal(reason(decide(printed({ total: "0.00" }), due)), "free_order");
assert.equal(reason(decide(printed({ story_id: null }), due)), "no_story");
assert.equal(reason(decide(printed({ customer_email: "  " }), due)), "no_email");
assert.equal(reason(decide(printed({ marketing_opt_out: true }), due)), "opted_out", "checkout opt-out ticked: never");
assert.equal(reason(decide(printed({ marketing_opt_out: null }), due)), "send", "ordered before the opt-out existed: asked");
assert.equal(reason(decide(printed(), due, { suppressed: true })), "suppressed");

// ── Input + publish rule ─────────────────────────────────────────────────────
const ok = (raw) => {
  const r = parseReviewInput(raw);
  assert.equal(r.ok, true, JSON.stringify(raw));
  return r.value;
};
const err = (raw) => {
  const r = parseReviewInput(raw);
  assert.equal(r.ok, false, JSON.stringify(raw));
  return r.error;
};
assert.deepEqual(ok({ rating: 5, body: "  Precioso \r\n\r\n\r\n\r\nGracias ", displayName: "  Marta   G. ", publishConsent: true }), {
  rating: 5,
  body: "Precioso\n\nGracias",
  displayName: "Marta G.",
  publishConsent: true,
});
assert.equal(ok({ rating: 1, body: "", displayName: "Jordi", publishConsent: "yes" }).body, null, "empty text → null");
assert.equal(ok({ rating: 1, displayName: "Jordi", publishConsent: "yes" }).publishConsent, false, "only literal true consents");
assert.equal(err({ rating: 0, displayName: "Jordi" }), "rating");
assert.equal(err({ rating: 6, displayName: "Jordi" }), "rating");
assert.equal(err({ rating: 4.5, displayName: "Jordi" }), "rating");
assert.equal(err({ rating: "5", displayName: "Jordi" }), "rating");
assert.equal(err({ rating: 5, body: "a".repeat(1001), displayName: "Jordi" }), "body");
assert.equal(ok({ rating: 5, body: "é".repeat(1000), displayName: "Jordi" }).body.length, 1000);
assert.equal(err({ rating: 5, displayName: "J" }), "display_name");
assert.equal(err({ rating: 5, displayName: "x".repeat(41) }), "display_name");
assert.equal(err({ rating: 5, displayName: "marta@gmail.com" }), "display_name");
assert.equal(err({ rating: 5, displayName: "<script>" }), "display_name");
assert.equal(ok({ rating: 5, displayName: "Núria i Pau" }).displayName, "Núria i Pau");
assert.equal(ok({ rating: 5, displayName: "Anne-Sophie O'Neill" }).displayName, "Anne-Sophie O'Neill");

const status = (raw) => initialReviewStatus(ok(raw));
assert.equal(status({ rating: 1, displayName: "Jordi", publishConsent: true }), "published", "any rating with consent is live");
assert.equal(status({ rating: 5, displayName: "Jordi", publishConsent: false }), "pending", "no consent: never public");
assert.equal(status({ rating: 5, body: "Mirad https://spam.example", displayName: "Jordi", publishConsent: true }), "pending");
assert.equal(status({ rating: 5, body: "Visitad WWW.tienda.com", displayName: "Jordi", publishConsent: true }), "pending");
assert.equal(status({ rating: 5, body: "Comprad en mitienda.com ya", displayName: "Jordi", publishConsent: true }), "pending");
assert.equal(status({ rating: 5, body: "Nos encantó.Es precioso", displayName: "Jordi", publishConsent: true }), "published", "missing space after a full stop is not a link");

assert.equal(suggestDisplayName("Marta García López"), "Marta G.");
assert.equal(suggestDisplayName("  núria   ÀLVAREZ "), "núria À.");
assert.equal(suggestDisplayName("Pau"), "Pau");
assert.equal(suggestDisplayName(""), null);
assert.equal(suggestDisplayName(null), null);
assert.equal(suggestDisplayName("marta@gmail.com"), null);

// ── JSON-LD condition ────────────────────────────────────────────────────────
assert.deepEqual(productReviewMarkup(undefined), {}, "no summary: no review markup");
assert.deepEqual(productReviewMarkup(EMPTY_REVIEW_SUMMARY), {}, "zero reviews: no review markup");
assert.deepEqual(summarizeReviews([], [], 6), EMPTY_REVIEW_SUMMARY);
assert.deepEqual(productReviewMarkup({ count: 3, average: 4.7, shown: [] }), {}, "nothing visible: no markup");

const shown = [
  { id: "r1", rating: 5, body: "Precioso", displayName: "Marta G.", locale: "es", publishedAt: "2026-11-10T09:00:00.000Z" },
  { id: "r2", rating: 4, body: null, displayName: "Jordi P.", locale: "ca", publishedAt: "2026-11-09T09:00:00.000Z" },
];
const summary = summarizeReviews([5, 4, 5], shown, 6);
assert.deepEqual(summary, { count: 3, average: 4.7, shown });
const markup = productReviewMarkup(summary);
assert.deepEqual(markup.aggregateRating, { "@type": "AggregateRating", ratingValue: "4.7", reviewCount: 3, bestRating: 5, worstRating: 1 });
assert.equal(markup.review.length, 2, "one Review per visible review");
assert.deepEqual(markup.review[0], {
  "@type": "Review",
  author: { "@type": "Person", name: "Marta G." },
  datePublished: "2026-11-10",
  inLanguage: "es",
  reviewRating: { "@type": "Rating", ratingValue: 5, bestRating: 5, worstRating: 1 },
  reviewBody: "Precioso",
});
assert.equal("reviewBody" in markup.review[1], false, "rating-only review: no empty body");
assert.equal(summarizeReviews([5, 0, 7, 3], shown, 1).count, 2, "out-of-range ratings ignored");
assert.equal(summarizeReviews([5, 4], shown, 1).shown.length, 1, "show limit");

console.log("reviews.check: all assertions passed");
