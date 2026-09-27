// Runnable check for the pure fulfilment logic (no deps, no test runner):
//   node --experimental-strip-types src/lib/fulfilment/logic.check.mjs
import assert from "node:assert/strict";
import {
  backoffMs,
  decideGelatoTransition,
  finalStageMarker,
  isUsableStoredImage,
  selectScenesToRender,
  validateSourceImages,
} from "./logic.ts";
import { classifyProviderError } from "./provider-errors.ts";

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
