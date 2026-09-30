// Runnable check for the pure fulfilment logic (no deps, no test runner):
//   node --experimental-strip-types src/lib/fulfilment/logic.check.mjs
import assert from "node:assert/strict";
import {
  backoffMs,
  decideFullRefund,
  decideGelatoTransition,
  isAdoptableGelatoOrder,
  purchaseEligibility,
  shouldSendTrackingUpdate,
  finalStageMarker,
  isExcludedSpanishPostcode,
  isOrderForActiveStripeMode,
  isUsableStoredImage,
  pickTracking,
  selectScenesToRender,
  validateSourceImages,
} from "./logic.ts";
import { classifyProviderError } from "./provider-errors.ts";
import { lastOrderDate } from "../shipping.ts";

const SB = "https://proj.supabase.co";
const img = (n) => `${SB}/storage/v1/object/public/illustrations/story/${n}.png`;
const isUsable = (url) => isUsableStoredImage(url, SB);
const FINAL = finalStageMarker("fal", "fal-ai/flux-2-flex");
const ALL = Array.from({ length: 12 }, (_, i) => i + 1);

// ── Gelato transition ranking ────────────────────────────────────────────────
assert.deepEqual(decideGelatoTransition("paid", "created"), { kind: "advance", to: "producing" });
assert.deepEqual(decideGelatoTransition("producing", "shipped"), { kind: "advance", to: "shipped" });
assert.deepEqual(decideGelatoTransition("producing", "In_Transit"), { kind: "advance", to: "shipped" });
assert.deepEqual(decideGelatoTransition("shipped", "delivered"), { kind: "advance", to: "delivered" });
// late / out-of-order events never move backwards
assert.equal(decideGelatoTransition("shipped", "printed").kind, "stale");
assert.equal(decideGelatoTransition("delivered", "shipped").kind, "stale");
assert.equal(decideGelatoTransition("delivered", "created").kind, "stale");
// retries of the same status are no-ops (no duplicate email)
assert.equal(decideGelatoTransition("producing", "passed").kind, "same");
// never touch unknown local statuses (e.g. a cancelled checkout)
assert.equal(decideGelatoTransition("cancelled", "created").kind, "stale");
// exceptions go to a human
for (const s of ["canceled", "cancelled", "failed", "returned"]) {
  assert.equal(decideGelatoTransition("producing", s).kind, "exception");
}
assert.equal(decideGelatoTransition("producing", "draft").kind, "unknown");
// paused at Gelato waiting on us → alert, never shown as progress
for (const s of ["pending_approval", "On_Hold", "not_connected"]) {
  assert.equal(decideGelatoTransition("producing", s).kind, "attention");
}

// ── Tracking (order_status_updated items[].fulfillments[]) ───────────────────
assert.equal(pickTracking(undefined), null);
assert.equal(pickTracking([{ fulfillments: [] }, { fulfillmentStatus: "printed" }]), null);
assert.deepEqual(
  pickTracking([{ fulfillments: [{ trackingCode: "" }] }, { fulfillments: [{ trackingCode: "PK1", trackingUrl: "https://t/PK1" }] }]),
  { trackingNumber: "PK1", trackingUrl: "https://t/PK1" },
);
assert.deepEqual(pickTracking([{ fulfillments: [{ trackingCode: "PK2", trackingUrl: "" }] }]), { trackingNumber: "PK2", trackingUrl: null });

// ── Shipping area + Reyes cut-off ────────────────────────────────────────────
for (const pc of ["35001", "38 001", "51001", "52006"]) assert.equal(isExcludedSpanishPostcode(pc), true, pc);
for (const pc of ["08036", "07001", "28001", "3500", "", null]) assert.equal(isExcludedSpanishPostcode(pc), false, String(pc));
assert.equal(lastOrderDate("2027-01-05", "hardcover", "peninsula"), "2026-12-22");
assert.equal(lastOrderDate("2027-01-05", "softcover", "baleares", 0), "2026-12-28");
console.log("gelato status/tracking/shipping ✓");

// ── Backoff ──────────────────────────────────────────────────────────────────
assert.equal(backoffMs(1), 5 * 60_000);
assert.equal(backoffMs(2), 10 * 60_000);
assert.equal(backoffMs(3), 20 * 60_000);
assert.equal(backoffMs(50), 6 * 3_600_000);
assert.equal(backoffMs(0), 5 * 60_000);

// ── Placeholder detection ────────────────────────────────────────────────────
assert.equal(isUsable(img(1)), true);
assert.equal(isUsable(`${img(1)}?v=1727430000000`), true);
assert.equal(isUsable("https://picsum.photos/seed/meapica-scene-1/1024"), false);
assert.equal(isUsable("https://fal.media/files/tmp.png"), false);
assert.equal(isUsable(null), false);
// private-bucket object paths (stored since 2026-09-27)
assert.equal(isUsable("0b0e4f2a-1c2d-4e5f-8a9b-0c1d2e3f4a5b/final/scene-3-m1x2k3-9f2a.jpg"), true);
assert.equal(isUsable("mock/scene-1.png"), false);
assert.equal(isUsable("../etc/passwd"), false);
assert.equal(isUsable("/images/local.png"), false);
assert.equal(isUsable("data:image/png;base64,AAAA"), false);
assert.equal(isUsable("https://other.supabase.co/storage/v1/object/public/illustrations/a/b.png"), false);

// ── Resume selection (two-speed: only final-stage renders count) ─────────────
const previewRows = ALL.map((n) => ({ scene_number: n, status: "ready", image_url: img(n), render_stage: null }));
assert.deepEqual(selectScenesToRender(previewRows, ALL, { twoSpeed: true, isUsable }), ALL);
// killed after 5 scenes were checkpointed → next run renders only the other 7
const partial = previewRows.map((r) => (r.scene_number <= 5 ? { ...r, render_stage: FINAL } : r));
assert.deepEqual(selectScenesToRender(partial, ALL, { twoSpeed: true, isUsable }), [6, 7, 8, 9, 10, 11, 12]);
// a final render from a different model still counts (no re-spend on env change)
const otherModel = previewRows.map((r) => ({ ...r, render_stage: "final:bfl:default" }));
assert.deepEqual(selectScenesToRender(otherModel, ALL, { twoSpeed: true, isUsable }), []);
// a "final" row that points at a placeholder is re-rendered
const badFinal = partial.map((r) => (r.scene_number === 2 ? { ...r, image_url: "https://picsum.photos/x" } : r));
assert.deepEqual(selectScenesToRender(badFinal, ALL, { twoSpeed: true, isUsable }).slice(0, 1), [2]);
// single-speed: preview images are already final quality; only pending/missing render
const single = previewRows.map((r) => (r.scene_number > 4 ? { ...r, status: "pending", image_url: null } : r)).slice(0, 10);
assert.deepEqual(selectScenesToRender(single, ALL, { twoSpeed: false, isUsable }), [5, 6, 7, 8, 9, 10, 11, 12]);

// ── Source gate ──────────────────────────────────────────────────────────────
const finalRows = ALL.map((n) => ({ scene_number: n, status: "ready", image_url: img(n), render_stage: FINAL }));
const good = { expectedScenes: ALL, scenes: finalRows, requireFinalStage: true, isUsable };
assert.deepEqual(validateSourceImages(good), []);
assert.equal(validateSourceImages({ ...good, scenes: finalRows.slice(0, 11) }).length, 1);
const withPlaceholder = finalRows.map((r) => (r.scene_number === 7 ? { ...r, image_url: "https://picsum.photos/x" } : r));
assert.deepEqual(validateSourceImages({ ...good, scenes: withPlaceholder }), ["scene 7: missing or placeholder illustration"]);
assert.equal(validateSourceImages({ ...good, scenes: previewRows }).length, 12);
assert.deepEqual(validateSourceImages({ ...good, scenes: previewRows, requireFinalStage: false }), []);

// ── Typed provider errors ────────────────────────────────────────────────────
assert.equal(classifyProviderError(new Error("NO CREDITS — top up at dashboard.bfl.ai. Error: {}"), "bfl")?.kind, "out_of_credits");
assert.equal(classifyProviderError(new Error("fal fal-ai/flux-2-flex 402: Payment Required"), "fal")?.kind, "out_of_credits");
assert.equal(classifyProviderError(new Error('fal fal-ai/flux-2 403: {"detail":"User is locked. Reason: Exhausted balance"}'), "fal")?.kind, "locked");
assert.equal(classifyProviderError(new Error("BFL API 401: invalid key"), "bfl")?.kind, "auth");
assert.equal(classifyProviderError(new Error("fal fal-ai/flux-2 500: internal"), "fal"), null);
assert.equal(classifyProviderError(new Error("Timeout after 120s waiting for FLUX.2"), "bfl"), null);
assert.equal(classifyProviderError(new Error("scene 4030 failed"), "bfl"), null);

console.log("fulfilment logic: all checks passed");

// ── Stripe mode isolation (shared DB between local test and prod live) ───────
{
  const prev = process.env.STRIPE_ENVIRONMENT;
  process.env.STRIPE_ENVIRONMENT = "live";
  assert.equal(isOrderForActiveStripeMode({ stripe_checkout_session_id: "cs_live_a1" }), true);
  assert.equal(isOrderForActiveStripeMode({ stripe_checkout_session_id: "cs_test_a1" }), false);
  assert.equal(isOrderForActiveStripeMode({ stripe_checkout_session_id: "mock_1" }), false);
  assert.equal(isOrderForActiveStripeMode({ stripe_checkout_session_id: null }), false);
  process.env.STRIPE_ENVIRONMENT = "test";
  assert.equal(isOrderForActiveStripeMode({ stripe_checkout_session_id: "cs_test_a1" }), true);
  assert.equal(isOrderForActiveStripeMode({ stripe_checkout_session_id: "cs_live_a1" }), false);
  if (prev === undefined) delete process.env.STRIPE_ENVIRONMENT;
  else process.env.STRIPE_ENVIRONMENT = prev;
}
console.log("stripe mode isolation ✓");

// ── Refunds: cancellation vs goodwill ────────────────────────────────────────
{
  const o = (status, format = "hardcover", gelato_order_id = null, gelato_status = null) => ({ status, format, gelato_order_id, gelato_status });
  // before print: close (no Gelato order yet)
  assert.deepEqual(decideFullRefund(o("paid")), { kind: "close", cancelAtGelato: false });
  // at Gelato, not shipped: close + cancel there
  assert.deepEqual(decideFullRefund(o("producing", "softcover", "g1", "printed")), { kind: "close", cancelAtGelato: true });
  // out of the door: history kept, no Gelato cancel (no false alert)
  assert.deepEqual(decideFullRefund(o("shipped", "hardcover", "g1", "shipped")), { kind: "record_only" });
  assert.deepEqual(decideFullRefund(o("delivered", "hardcover", "g1", "delivered")), { kind: "record_only" });
  // our status lags but Gelato already shipped it
  assert.deepEqual(decideFullRefund(o("producing", "hardcover", "g1", "in_transit")), { kind: "record_only" });
  assert.deepEqual(decideFullRefund(o("producing", "hardcover", "g1", "returned")), { kind: "record_only" });
  // digital: a refund always revokes (download dies)
  assert.deepEqual(decideFullRefund(o("producing", "digital_pdf")), { kind: "close", cancelAtGelato: false });
  // already closed / never paid
  for (const s of ["refunded", "cancelled", "pending"]) assert.deepEqual(decideFullRefund(o(s)), { kind: "noop" });
}
console.log("refund decisions ✓");

// ── Gelato adoption on (re)submission ────────────────────────────────────────
for (const s of ["created", "passed", "in_production", "printed", "shipped", "pending_approval"]) assert.equal(isAdoptableGelatoOrder(s), true, s);
for (const s of ["canceled", "cancelled", "failed", "returned", " Returned "]) assert.equal(isAdoptableGelatoOrder(s), false, s);
console.log("gelato adoption ✓");

// ── Tracking arrives after the shipped email ─────────────────────────────────
{
  const base = { status: "shipped", previousTrackingNumber: null, newTrackingNumber: "TRK1", advancedByThisEvent: false };
  assert.equal(shouldSendTrackingUpdate(base), true);
  assert.equal(shouldSendTrackingUpdate({ ...base, advancedByThisEvent: true }), false); // shipped email carries it
  assert.equal(shouldSendTrackingUpdate({ ...base, previousTrackingNumber: "TRK0" }), false); // already had one
  assert.equal(shouldSendTrackingUpdate({ ...base, newTrackingNumber: null }), false);
  assert.equal(shouldSendTrackingUpdate({ ...base, status: "delivered" }), false); // too late to matter
  assert.equal(shouldSendTrackingUpdate({ ...base, status: "refunded" }), false);
}
console.log("tracking update ✓");

// ── Purchases: preview, another copy, no second PDF ──────────────────────────
assert.equal(purchaseEligibility("preview", "digital_pdf"), "ok");
assert.equal(purchaseEligibility("preview", "hardcover"), "ok");
for (const s of ["ready", "ordered", "shipped", "delivered"]) {
  assert.equal(purchaseEligibility(s, "hardcover"), "ok", s);
  assert.equal(purchaseEligibility(s, "softcover"), "ok", s);
  assert.equal(purchaseEligibility(s, "digital_pdf"), "already_owned", s);
}
for (const s of ["draft", "generating", "completing"]) assert.equal(purchaseEligibility(s, "hardcover"), "not_ready", s);
console.log("purchase eligibility ✓");
