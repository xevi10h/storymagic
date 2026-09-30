// Runnable check for the erasure + guest retention rules (no deps, no test runner):
//   node --experimental-strip-types src/lib/privacy/retention-policy.check.mjs
import assert from "node:assert/strict";
import {
  erasureBlocker,
  lastActivityMs,
  orderErasureDisposition,
  selectGuestsToPurge,
  userStorageTargets,
} from "./retention-policy.ts";
import {
  fulfilmentAgeHours,
  gelatoOrderReference,
  parseGelatoOrderReference,
} from "../fulfilment/logic.ts";

const NOW = Date.parse("2026-09-30T12:00:00Z");
const d = (days) => new Date(NOW - days * 24 * 3_600_000).toISOString();
const hrs = (hours) => new Date(NOW - hours * 3_600_000).toISOString();
const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

// ── Erasure blocker ──────────────────────────────────────────────────────────
const o = (status, format = "hardcover", extra = {}) => ({ id: `o-${status}-${format}`, status, format, created_at: d(1), ...extra });
assert.equal(erasureBlocker([o("paid")])?.status, "paid", "physical paid blocks");
assert.equal(erasureBlocker([o("producing")])?.status, "producing", "physical at Gelato blocks");
assert.equal(erasureBlocker([o("shipped")]), null, "shipped does not block");
assert.equal(erasureBlocker([o("delivered"), o("refunded")]), null);
assert.equal(erasureBlocker([o("paid", "digital_pdf")])?.status, "paid", "digital not delivered blocks");
assert.equal(erasureBlocker([o("producing", "digital_pdf")]), null, "digital delivered does not block");
assert.equal(erasureBlocker([o("pending"), o("cancelled")]), null, "unpaid never blocks");
assert.equal(erasureBlocker([]), null);

// ── Order disposition ────────────────────────────────────────────────────────
assert.equal(orderErasureDisposition(o("delivered"), NOW), "anonymise", "paid orders are kept (accounting)");
assert.equal(orderErasureDisposition(o("refunded"), NOW), "anonymise", "refunded keeps its invoice");
assert.equal(orderErasureDisposition(o("cancelled"), NOW), "delete");
assert.equal(orderErasureDisposition(o("pending", "hardcover", { created_at: hrs(25) }), NOW), "delete", "expired checkout");
assert.equal(orderErasureDisposition(o("pending", "hardcover", { created_at: hrs(2) }), NOW), "anonymise", "open checkout may still pay");
assert.equal(orderErasureDisposition(o("cancelled", "hardcover", { stripe_payment_id: "pi_1" }), NOW), "anonymise", "money moved → keep");
assert.equal(orderErasureDisposition(o("weird"), NOW), "anonymise", "unknown status is never deleted");

// ── Storage targets ──────────────────────────────────────────────────────────
const targets = userStorageTargets({
  userId: U(1),
  storyIds: [U(2), "../../etc", ""],
  prepIds: [U(3), "*"],
  legacyPortraitPaths: [`portraits/${U(4)}/portrait.jpg`, `portraits/${U(4)}`, "portraits/x/y.jpg", `${U(2)}/a.jpg`],
});
const keys = targets.map((t) => `${t.bucket}:${t.prefix ?? t.path}`);
assert.deepEqual(keys, [
  `illustrations:${U(2)}/`,
  `showcase:${U(2)}/`,
  `illustrations:portraits/${U(1)}/`,
  `illustrations:character-preps/${U(3)}/`,
  `illustrations:portraits/${U(4)}/portrait.jpg`,
  `book-pdfs:${U(1)}/`,
  `child-photos:${U(1)}/`,
]);
assert.ok(targets.every((t) => (t.prefix ?? t.path).length > 10), "no prefix can widen to a whole bucket");
assert.throws(() => userStorageTargets({ userId: "", storyIds: [], prepIds: [], legacyPortraitPaths: [] }));

// ── Guest selection ──────────────────────────────────────────────────────────
const guest = (n, created, lastSignIn = null, anon = true) => ({ id: U(n), is_anonymous: anon, created_at: created, last_sign_in_at: lastSignIn });
const users = [
  guest(10, d(90), d(60)), // inactive 60 d → eligible (oldest)
  guest(11, d(40), d(31)), // inactive 31 d → eligible
  guest(12, d(40), d(29)), // signed in 29 d ago → active
  guest(13, d(90), d(90)), // story edited 5 d ago → active
  guest(14, d(90), d(90)), // paid → kept
  guest(15, d(90), d(90)), // owns a showcase book → kept
  guest(16, d(90), d(90), false), // registered → never
  { id: U(17), is_anonymous: true, created_at: null, last_sign_in_at: null }, // no dates → treated as active
  guest(18, d(30.01)), // never signed in again, created just over 30 d ago → eligible
];
const input = {
  users,
  latestStoryUpdate: new Map([[U(13), d(5)], [U(10), d(61)]]),
  paidUserIds: new Set([U(14)]),
  showcaseUserIds: new Set([U(15)]),
};
const sel = selectGuestsToPurge(input, NOW, { limit: 10 });
assert.deepEqual(sel.selected, [U(10), U(11), U(18)], "oldest activity first; only inactive unpaid guests");
assert.equal(sel.eligible, 3);
assert.equal(sel.skippedPaid, 1);
assert.equal(sel.skippedShowcase, 1);
assert.equal(sel.skippedActive, 3, "12, 13 and the undated 17");
assert.deepEqual(selectGuestsToPurge(input, NOW, { limit: 2 }).selected, [U(10), U(11)], "batch limit");
assert.deepEqual(selectGuestsToPurge(input, NOW, { limit: 0 }).selected, []);
assert.equal(selectGuestsToPurge(input, NOW, { limit: 10, inactiveDays: 100 }).selected.length, 0);
assert.equal(lastActivityMs(guest(1, d(50), d(40)), d(3)), Date.parse(d(3)), "story edit counts as activity");

// ── Re-queue window + Gelato references ──────────────────────────────────────
assert.equal(fulfilmentAgeHours({ created_at: hrs(100) }, NOW), 100);
assert.equal(fulfilmentAgeHours({ created_at: hrs(100), fulfilment_requeued_at: hrs(1) }, NOW), 1, "re-queue re-opens the window");
assert.equal(fulfilmentAgeHours({ created_at: hrs(5), fulfilment_requeued_at: hrs(50) }, NOW), 5, "older re-queue never extends the age");
const id = "0a1b2c3d-1111-4222-8333-444455556666";
assert.equal(gelatoOrderReference(id, 0), `meapica-${id}`, "original reference unchanged");
assert.equal(gelatoOrderReference(id, null), `meapica-${id}`);
assert.equal(gelatoOrderReference(id, 2), `meapica-${id}-r2`);
assert.deepEqual(parseGelatoOrderReference(`meapica-${id}`), { orderId: id, reprint: 0 });
assert.deepEqual(parseGelatoOrderReference(`meapica-${id}-r2`), { orderId: id, reprint: 2 });
assert.equal(parseGelatoOrderReference("other-123"), null);
assert.equal(parseGelatoOrderReference(undefined), null);

console.log("retention-policy.check: all assertions passed");
