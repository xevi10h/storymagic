// Runnable check for the operator allowlist + order views (no deps, no test runner):
//   node --experimental-strip-types src/lib/admin/admin.check.mjs
import assert from "node:assert/strict";
import { isAdminUser, parseAdminEmails } from "./allowlist.ts";
import {
  filterOrders,
  gelatoOrderUrl,
  isOrderFilter,
  matchesSearch,
  orderProblems,
  orderReferenceOf,
  stripePaymentUrl,
} from "./orders-view.ts";

// ── Allowlist ────────────────────────────────────────────────────────────────
assert.deepEqual(parseAdminEmails(" Ops@Meapica.com, ops@meapica.com ,, not-an-email, b@x.io "), ["ops@meapica.com", "b@x.io"]);
assert.deepEqual(parseAdminEmails(undefined), []);
assert.deepEqual(parseAdminEmails(""), []);

const confirmed = { email: "OPS@meapica.com", email_confirmed_at: "2026-09-01T00:00:00Z", is_anonymous: false };
const LIST = "ops@meapica.com,other@x.io";
assert.equal(isAdminUser(confirmed, LIST), true, "confirmed listed user (case-insensitive)");
assert.equal(isAdminUser({ ...confirmed, email_confirmed_at: null }, LIST), false, "unconfirmed email is refused");
assert.equal(isAdminUser({ ...confirmed, is_anonymous: true }, LIST), false, "anonymous session is refused");
assert.equal(isAdminUser({ ...confirmed, email: "intruder@meapica.com" }, LIST), false, "unlisted email is refused");
assert.equal(isAdminUser({ ...confirmed, email: "ops@meapica.com.evil.io" }, LIST), false, "no suffix/prefix matching");
assert.equal(isAdminUser(confirmed, ""), false, "empty allowlist = nobody (fail closed)");
assert.equal(isAdminUser(confirmed, undefined), false, "missing allowlist = nobody");
assert.equal(isAdminUser(null, LIST), false);
assert.equal(isAdminUser({ ...confirmed, email: null }, LIST), false);

// ── Problems ─────────────────────────────────────────────────────────────────
const NOW = Date.parse("2026-09-30T12:00:00Z");
const h = (hours) => new Date(NOW - hours * 3_600_000).toISOString();
const base = {
  id: "0a1b2c3d-1111-4222-8333-444455556666",
  created_at: h(1),
  status: "paid",
  format: "hardcover",
  total: 49.9,
  currency: "eur",
  customer_email: "ana_garcia@example.com",
  shipping_name: "Ana García",
  story_id: "11111111-1111-4111-8111-111111111111",
  user_id: "22222222-2222-4222-8222-222222222222",
  gelato_order_id: null,
  gelato_status: null,
  gelato_last_error: null,
  gelato_submit_attempts: 0,
  fulfilment_alerted_at: null,
  fulfilment_requeued_at: null,
  stripe_payment_id: "pi_123",
  stripe_checkout_session_id: "cs_live_abc",
  tracking_number: null,
  refunded_at: null,
  story_title: "El bosque de Lucía",
  child_name: "Lucía",
};
assert.deepEqual(orderProblems(base, NOW), [], "fresh paid order is fine");
assert.deepEqual(orderProblems({ ...base, created_at: h(7) }, NOW), ["stuck_paid"], "paid > 6 h is stuck");
assert.deepEqual(orderProblems({ ...base, created_at: h(200), fulfilment_requeued_at: h(1) }, NOW), [], "a recent re-queue resets the clock");
assert.deepEqual(orderProblems({ ...base, gelato_last_error: "boom" }, NOW), ["stuck_paid"], "an error flags immediately");
assert.deepEqual(orderProblems({ ...base, fulfilment_hold_reason: "dispute" }, NOW), ["on_hold"], "a chargeback hold is flagged");
assert.deepEqual(orderProblems({ ...base, status: "refunded", fulfilment_hold_reason: "excluded_area" }, NOW), ["refunded"], "an auto-refunded excluded-area order needs no action");
assert.deepEqual(
  orderProblems({ ...base, status: "producing", gelato_order_id: "g1", gelato_status: "on_hold" }, NOW),
  ["gelato_problem"],
);
assert.deepEqual(orderProblems({ ...base, status: "producing", gelato_order_id: "g1", created_at: h(121) }, NOW), ["not_shipped"]);
assert.deepEqual(orderProblems({ ...base, status: "producing", format: "digital_pdf", created_at: h(500) }, NOW), [], "digital never 'not shipped'");
assert.deepEqual(orderProblems({ ...base, status: "refunded", gelato_status: "cancelled" }, NOW), ["refunded"], "refunded + cancelled at Gelato is expected");

// ── Filter + search ──────────────────────────────────────────────────────────
const rows = [
  { ...base, id: "aaaaaaaa-0000-4000-8000-000000000001", created_at: h(10) }, // stuck
  { ...base, id: "bbbbbbbb-0000-4000-8000-000000000002", created_at: h(2), status: "shipped", child_name: "Mateo" },
  { ...base, id: "cccccccc-0000-4000-8000-000000000003", created_at: h(5), status: "refunded" },
];
assert.deepEqual(filterOrders(rows, "all", "", NOW).map((o) => o.id[0]), ["b", "c", "a"], "newest first");
assert.deepEqual(filterOrders(rows, "problems", "", NOW).map((o) => o.id[0]), ["a"], "refunded is not an open problem");
assert.deepEqual(filterOrders(rows, "refunded", "", NOW).map((o) => o.id[0]), ["c"]);
assert.deepEqual(filterOrders(rows, "stuck_paid", "", NOW).map((o) => o.id[0]), ["a"]);
assert.deepEqual(filterOrders(rows, "all", "mateo", NOW).map((o) => o.id[0]), ["b"], "child name");
assert.equal(matchesSearch(base, "LUCIA"), true, "accent/case-insensitive child name");
assert.equal(matchesSearch(base, "ana_garcia@"), true, "email");
assert.equal(matchesSearch(base, orderReferenceOf(base.id)), true, "customer reference");
assert.equal(matchesSearch(base, "0a1b2c3d-1111"), true, "id with dashes");
assert.equal(matchesSearch(base, "0a1"), false, "too-short id fragments don't match everything");
assert.equal(orderReferenceOf(base.id), "0A1B2C3D");
assert.equal(isOrderFilter("not_shipped"), true);
assert.equal(isOrderFilter("refunded"), true);
assert.equal(isOrderFilter("drop table"), false);
assert.equal(isOrderFilter(undefined), false);

// ── Links ────────────────────────────────────────────────────────────────────
assert.equal(stripePaymentUrl("pi_1", "cs_live_x"), "https://dashboard.stripe.com/acct_1UKcQRAyKcfLUpfG/payments/pi_1");
assert.equal(stripePaymentUrl("pi_1", "cs_test_x"), "https://dashboard.stripe.com/acct_1UKcQsBD04FISl5u/test/payments/pi_1");
assert.equal(stripePaymentUrl(null, "cs_test_x"), "https://dashboard.stripe.com/acct_1UKcQsBD04FISl5u/test/checkout/sessions/cs_test_x");
assert.equal(stripePaymentUrl("pi_1", "mock_1"), null, "mock orders have no dashboard");
assert.equal(gelatoOrderUrl(null), null);
assert.match(gelatoOrderUrl("abc-123"), /^https:\/\/dashboard\.gelato\.com\/.+abc-123$/);

console.log("admin.check: all assertions passed");
