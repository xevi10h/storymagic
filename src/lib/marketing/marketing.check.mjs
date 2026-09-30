// Runnable check for the commercial-email rules (no deps, no test runner):
//   node --experimental-strip-types src/lib/marketing/marketing.check.mjs
import assert from "node:assert/strict";
import { REMINDER_CATCH_UP_DAYS, UPGRADE_REMINDER_DELAY_DAYS, upgradeReminderDecision } from "../upsell.ts";
import {
  deriveUnsubscribeKey,
  listUnsubscribeHeaders,
  maskEmail,
  normalizeEmail,
  signUnsubscribeToken,
  verifyUnsubscribeToken,
} from "./unsubscribe-token.ts";

// ── PDF → papel reminder eligibility ─────────────────────────────────────────
const DAY = 86_400_000;
const READY = Date.parse("2026-09-01T10:00:00Z");
const pdf = (over = {}) => ({
  id: "o-pdf",
  user_id: "u-1",
  story_id: "s-1",
  format: "digital_pdf",
  status: "producing",
  refunded_at: null,
  created_at: "2026-09-01T09:00:00Z",
  offer: null,
  customer_email: "marta@example.com",
  ready_email_sent_at: new Date(READY).toISOString(),
  marketing_opt_out: false,
  upsell_reminder_sent_at: null,
  ...over,
});
const at = (days) => READY + days * DAY;
const decide = (order, others = [], over = {}) =>
  upgradeReminderDecision(order, others, { now: at(7), upgradeAvailable: true, suppressed: false, ...over });
const reason = (d) => (d.send ? "send" : d.reason);

assert.equal(UPGRADE_REMINDER_DELAY_DAYS, 7);
assert.equal(reason(decide(pdf(), [], { now: at(6) })), "too_early", "day 6: no");
assert.equal(reason(decide(pdf(), [], { now: at(7) - 1 })), "too_early", "1 ms before day 7: no");
assert.equal(reason(decide(pdf(), [], { now: at(7) })), "send", "day 7: yes");
assert.equal(reason(decide(pdf(), [], { now: at(7 + REMINDER_CATCH_UP_DAYS) - 1 })), "send", "catch-up window");
assert.equal(reason(decide(pdf(), [], { now: at(7 + REMINDER_CATCH_UP_DAYS) })), "too_late", "months-old orders never");
for (const status of ["paid", "producing", "shipped", "delivered"]) assert.equal(reason(decide(pdf({ status }))), "send", status);

// refunded / closed
assert.equal(reason(decide(pdf({ refunded_at: "2026-09-03T00:00:00Z" }))), "not_live", "refunded");
assert.equal(reason(decide(pdf({ status: "refunded", refunded_at: "2026-09-03T00:00:00Z" }))), "not_live");
assert.equal(reason(decide(pdf({ status: "cancelled" }))), "not_live");
assert.equal(reason(decide(pdf({ status: "pending" }))), "not_live");

// printed copy bought since (upgrade or full price) → offer gone; other stories don't count
const printed = { ...pdf(), id: "o-print", format: "hardcover", status: "paid", offer: "pdf_upgrade", created_at: "2026-09-05T00:00:00Z" };
assert.equal(reason(decide(pdf(), [printed])), "offer_gone", "printed bought");
assert.equal(reason(decide(pdf(), [{ ...printed, offer: null }])), "offer_gone", "printed at full price");
assert.equal(reason(decide(pdf(), [{ ...printed, refunded_at: "2026-09-06T00:00:00Z" }])), "send", "refunded print: offer back");
assert.equal(reason(decide(pdf(), [{ ...printed, story_id: "s-2" }])), "send", "other story");
assert.equal(reason(decide(pdf(), [{ ...printed, user_id: "u-2" }])), "send", "other buyer");
assert.equal(reason(decide(pdf(), [], { upgradeAvailable: false })), "offer_gone", "Stripe Price missing");

// permission
assert.equal(reason(decide(pdf(), [], { suppressed: true })), "suppressed", "suppressed address");
assert.equal(reason(decide(pdf({ marketing_opt_out: true }))), "opted_out", "ticked at checkout");
assert.equal(reason(decide(pdf({ marketing_opt_out: null }))), "opted_out", "legacy order: opt-out never offered");

// exactly once + data
assert.equal(reason(decide(pdf({ upsell_reminder_sent_at: "2026-09-08T10:00:00Z" }))), "already_sent");
assert.equal(reason(decide(pdf({ story_id: null }))), "detached", "null story");
assert.equal(reason(decide(pdf({ user_id: null }))), "detached", "null user");
assert.equal(reason(decide(pdf({ customer_email: null }))), "no_email");
assert.equal(reason(decide(pdf({ customer_email: "  " }))), "no_email");
assert.equal(reason(decide(pdf({ ready_email_sent_at: null }))), "not_ready");
assert.equal(reason(decide(pdf({ format: "hardcover" }))), "not_pdf");

// ── Unsubscribe token ────────────────────────────────────────────────────────
const key = deriveUnsubscribeKey("service-role-key-A");
const otherKey = deriveUnsubscribeKey("service-role-key-B");
assert.throws(() => deriveUnsubscribeKey(""));

const token = signUnsubscribeToken("  Marta.Garcia@Example.com ", key);
assert.equal(verifyUnsubscribeToken(token, key), "marta.garcia@example.com", "roundtrip (normalised)");
assert.equal(signUnsubscribeToken("marta.garcia@example.com", key), token, "one address, one token");
assert.match(token, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{22}$/);
assert.equal(verifyUnsubscribeToken(token, otherKey), null, "wrong key");

const [v, payload, sig] = token.split(".");
const other = Buffer.from("someone@example.com").toString("base64url");
assert.equal(verifyUnsubscribeToken(`${v}.${other}.${sig}`, key), null, "tampered email");
const flipped = sig.slice(0, -2) + (sig.at(-2) === "A" ? "B" : "A") + sig.at(-1);
assert.equal(verifyUnsubscribeToken(`${v}.${payload}.${flipped}`, key), null, "tampered signature");
assert.equal(verifyUnsubscribeToken(`v2.${payload}.${sig}`, key), null, "wrong version");
assert.equal(verifyUnsubscribeToken(`${token}.x`, key), null, "extra part");
assert.equal(verifyUnsubscribeToken(`${v}.${payload}`, key), null, "missing signature");
for (const bad of [null, undefined, "", "x".repeat(600), "v1..", "v1.%%%.abc"]) assert.equal(verifyUnsubscribeToken(bad, key), null, String(bad));
assert.throws(() => signUnsubscribeToken("not-an-email", key));

// helpers
assert.equal(normalizeEmail(" A@B.CO "), "a@b.co");
assert.equal(normalizeEmail("nope"), null);
assert.equal(maskEmail("marta.garcia@example.com"), "m•••@example.com");
const headers = listUnsubscribeHeaders("https://meapica.com/api/email/unsubscribe?t=abc", "hola@meapica.com");
assert.equal(headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
assert.equal(headers["List-Unsubscribe"], "<https://meapica.com/api/email/unsubscribe?t=abc>, <mailto:hola@meapica.com?subject=unsubscribe>");

console.log("marketing.check: ok");
