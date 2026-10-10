// Runnable check for the referral + gift voucher rules (no deps, no test runner):
//   node --experimental-strip-types src/lib/promo-codes.check.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CODE_ALPHABET,
  VOUCHER_CATALOG_ITEMS,
  VOUCHER_COUPON_IDS,
  VOUCHER_FORMATS,
  addMonths,
  canPreApplyReferral,
  cleanVoucherText,
  generateCode,
  isVoucherFormat,
  normalizeCode,
  referralRewardDecision,
  referralUrl,
  sessionPromotionCodeIds,
} from "./promo-codes.ts";

// ── Codes ─────────────────────────────────────────────────────────────────
let seed = 0;
const fake = (n) => seed++ % n;
const ref = generateCode("referral", fake);
assert.match(ref, /^MEA[A-Z2-9]{6}$/);
assert.equal(generateCode("voucher", fake).length, 13);
assert.ok(![..."01ILO"].some((c) => CODE_ALPHABET.includes(c)), "no ambiguous characters");
assert.equal(normalizeCode(" mea 7k3-p9q "), "MEA7K3P9Q");
assert.equal(normalizeCode("MEA_7K3"), null);
assert.equal(normalizeCode("<script>"), null);
assert.equal(normalizeCode(42), null);
assert.equal(referralUrl("https://meapica.shop/", "ca", "MEA7K3P9Q"), "https://meapica.shop/ca/r/MEA7K3P9Q");

// ── Dates: 12 months, clamped month ends ──────────────────────────────────
assert.equal(addMonths(new Date("2026-12-24T10:00:00Z"), 12).toISOString(), "2027-12-24T10:00:00.000Z");
assert.equal(addMonths(new Date("2027-01-31T00:00:00Z"), 1).toISOString(), "2027-02-28T00:00:00.000Z");
assert.equal(addMonths(new Date("2028-02-29T00:00:00Z"), 12).toISOString(), "2029-02-28T00:00:00.000Z");

// ── Reward eligibility ────────────────────────────────────────────────────
const source = { order_id: "o-ref", user_id: "u-ref", email: "ana@example.com", stripe_customer_id: "cus_A" };
const referred = (over = {}) => ({
  id: "o-new",
  user_id: "u-new",
  email: "marta@example.com",
  stripe_customer_id: "cus_B",
  status: "paid",
  created_at: "2026-11-02T10:00:00Z",
  ...over,
});
const prior = (over = {}) => ({ id: "o-old", status: "delivered", refunded_at: null, created_at: "2026-10-01T10:00:00Z", ...over });

assert.deepEqual(referralRewardDecision(source, referred(), []), { reward: true });
// any live status of the referred order
for (const status of ["producing", "shipped", "delivered"]) assert.equal(referralRewardDecision(source, referred({ status }), []).reward, true);
// not paid
for (const status of ["pending", "cancelled", "refunded"]) assert.equal(referralRewardDecision(source, referred({ status }), []).reason, "not_paid");
// self-referral: same email (any case/space), same account, same Stripe customer, own order
assert.equal(referralRewardDecision(source, referred({ email: " ANA@example.com " }), []).reason, "self_referral");
assert.equal(referralRewardDecision(source, referred({ user_id: "u-ref" }), []).reason, "self_referral");
assert.equal(referralRewardDecision(source, referred({ stripe_customer_id: "cus_A" }), []).reason, "self_referral");
assert.equal(referralRewardDecision(source, referred({ id: "o-ref" }), []).reason, "own_order");
// null identifiers never match each other
assert.equal(
  referralRewardDecision({ ...source, user_id: null, stripe_customer_id: null }, referred({ user_id: null, stripe_customer_id: null }), []).reward,
  true,
);
// returning customer: an earlier live, unrefunded order → no reward
assert.equal(referralRewardDecision(source, referred(), [prior()]).reason, "returning_customer");
// earlier orders that never counted: refunded, cancelled, pending, or later than this one
assert.equal(referralRewardDecision(source, referred(), [prior({ refunded_at: "2026-10-05T00:00:00Z" })]).reward, true);
assert.equal(referralRewardDecision(source, referred(), [prior({ status: "cancelled" })]).reward, true);
assert.equal(referralRewardDecision(source, referred(), [prior({ status: "pending" })]).reward, true);
assert.equal(referralRewardDecision(source, referred(), [prior({ created_at: "2026-12-01T00:00:00Z" })]).reward, true);
assert.equal(referralRewardDecision(source, referred(), [prior({ id: "o-new" })]).reward, true); // itself
// referrer without an email can't receive the reward
assert.equal(referralRewardDecision({ ...source, email: null }, referred(), []).reason, "no_referrer_email");

// ── Pre-applying the /r cookie at checkout ─────────────────────────────────
assert.equal(canPreApplyReferral(source, { userId: "u-new", email: "marta@example.com", format: "hardcover" }), true);
assert.equal(canPreApplyReferral(source, { userId: "u-new", email: null, format: "softcover" }), true);
assert.equal(canPreApplyReferral(source, { userId: "u-new", email: "marta@example.com", format: "digital_pdf" }), false, "never on the PDF");
assert.equal(canPreApplyReferral(source, { userId: "u-ref", email: null, format: "hardcover" }), false, "own account");
assert.equal(canPreApplyReferral(source, { userId: "u-new", email: "Ana@Example.com", format: "hardcover" }), false, "own email");

// ── Idempotency: the promotion code applied to a session ──────────────────
assert.deepEqual(sessionPromotionCodeIds(null), []);
assert.deepEqual(sessionPromotionCodeIds([{ coupon: "c", promotion_code: null }]), []);
assert.deepEqual(sessionPromotionCodeIds([{ promotion_code: "promo_1" }, { promotion_code: { id: "promo_2" } }]), ["promo_1", "promo_2"]);

// ── Vouchers: format restriction + text on the card ───────────────────────
assert.deepEqual([...VOUCHER_FORMATS].sort(), ["digital_pdf", "hardcover", "softcover"]);
assert.ok(isVoucherFormat("softcover") && !isVoucherFormat("extra_copy_softcover") && !isVoucherFormat(undefined));
// one coupon per format, never shared (a PDF voucher can't pay a hardcover)
assert.equal(new Set(Object.values(VOUCHER_COUPON_IDS)).size, 3);
assert.equal(cleanVoucherText("  Lucía \u0007 ", 40), "Lucía");
assert.equal(cleanVoucherText("   ", 40), null);
assert.equal(cleanVoucherText(42, 40), null);
assert.equal(cleanVoucherText("Hola\r\n\r\n\r\nvalent", 240, true), "Hola\nvalent");
assert.equal(cleanVoucherText("Hola\nvalent", 240), "Hola valent");
assert.equal(cleanVoucherText("😀".repeat(50), 40), "😀".repeat(40), "cut by code points");

// The voucher catalog items exist in STRIPE_CATALOG with the book's amount and tax code
// (single-purpose voucher: VAT at sale exactly like the book), and are optional (fail soft).
const pricing = readFileSync(new URL("./pricing.ts", import.meta.url), "utf8");
const line = (key) => pricing.split("\n").find((l) => l.trimStart().startsWith(`${key}: { lookupKey`)) ?? "";
for (const f of VOUCHER_FORMATS) {
  const voucher = line(VOUCHER_CATALOG_ITEMS[f]);
  const book = line(f);
  assert.ok(voucher, `${VOUCHER_CATALOG_ITEMS[f]} in STRIPE_CATALOG`);
  assert.equal(voucher.match(/amount: (\d+)/)?.[1], book.match(/amount: (\d+)/)?.[1], `${f}: voucher amount = book amount`);
  assert.equal(voucher.match(/taxCode: (\w+)/)?.[1], book.match(/taxCode: (\w+)/)?.[1], `${f}: voucher tax code = book tax code`);
  assert.ok(new RegExp(`OPTIONAL_CATALOG_ITEMS = \\[[^\\]]*"${VOUCHER_CATALOG_ITEMS[f]}"`).test(pricing), `${f}: optional item`);
}

console.log("promo-codes.check: all assertions passed");
