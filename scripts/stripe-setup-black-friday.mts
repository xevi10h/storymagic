// Idempotent Stripe setup for the Black Friday 2026 offer (src/lib/black-friday.ts) on ONE
// account/mode (the one behind the key): the 20 % coupon restricted to the three book format
// Products (PDF, softcover, hardcover, resolved by their STRIPE_CATALOG lookup keys, so never the
// extra copies, upgrades or gift vouchers), redeemable until the window's last second, and the
// BLACKFRIDAY promotion code that /api/checkout pre-applies. Creates only these two objects.
//
//   STRIPE_KEY=sk_test_... npx tsx --tsconfig tsconfig.json scripts/stripe-setup-black-friday.mts [--dry-run]
//
// Run it on LIVE before deploying the offer: until both objects exist the app shows the Black
// Friday price but cannot apply it (checkout falls back to the list price and alerts the operator).
// Re-running is safe: existing objects are checked and reused. Coupons are immutable: a wrong one
// is reported; delete it in the Dashboard and re-run.

import Stripe from "stripe";
import { STRIPE_CATALOG } from "../src/lib/pricing";
import {
  BLACK_FRIDAY_COUPON_ID,
  BLACK_FRIDAY_ENDS_AT,
  BLACK_FRIDAY_FORMATS,
  BLACK_FRIDAY_PERCENT_OFF,
  BLACK_FRIDAY_PROMO_CODE,
} from "../src/lib/black-friday";

const key = process.env.STRIPE_KEY?.trim();
if (!key) throw new Error("STRIPE_KEY is required");
const dryRun = process.argv.includes("--dry-run");
const stripe = new Stripe(key);
const mode = key.startsWith("sk_live_") ? "LIVE" : "TEST";
const log = (...a: unknown[]) => console.log(`[${mode}]`, ...a);
const redeemBy = Math.floor(BLACK_FRIDAY_ENDS_AT.getTime() / 1000);
if (redeemBy <= Math.floor(Date.now() / 1000)) throw new Error(`The window ended at ${BLACK_FRIDAY_ENDS_AT.toISOString()}: nothing to set up`);

const account = await stripe.accounts.retrieve();
log(`account ${account.id} · ${account.settings?.dashboard?.display_name}${dryRun ? " · DRY RUN" : ""}`);

// ── The three book format Products ───────────────────────────────────────────
const products: string[] = [];
for (const format of BLACK_FRIDAY_FORMATS) {
  const price = (await stripe.prices.list({ lookup_keys: [STRIPE_CATALOG[format].lookupKey], active: true, limit: 1 })).data[0];
  if (!price) throw new Error(`No active Price for ${STRIPE_CATALOG[format].lookupKey}: run scripts/stripe-setup-catalog.mts first`);
  if (price.unit_amount !== STRIPE_CATALOG[format].amount) {
    throw new Error(`${format}: Stripe price ${price.unit_amount} ≠ STRIPE_CATALOG ${STRIPE_CATALOG[format].amount} (re-run stripe-setup-catalog.mts)`);
  }
  products.push(typeof price.product === "string" ? price.product : price.product.id);
  log(`${format}: product ${products.at(-1)} (${price.unit_amount} cents)`);
}
const wanted = [...products].sort();

// ── Coupon ───────────────────────────────────────────────────────────────────
const existing = await stripe.coupons.retrieve(BLACK_FRIDAY_COUPON_ID, { expand: ["applies_to"] }).catch((err: { code?: string }) => {
  if (err.code === "resource_missing") return null;
  throw err;
});
if (existing) {
  const got = [...(existing.applies_to?.products ?? [])].sort();
  const ok =
    existing.valid &&
    existing.percent_off === BLACK_FRIDAY_PERCENT_OFF &&
    existing.redeem_by === redeemBy &&
    JSON.stringify(got) === JSON.stringify(wanted);
  if (!ok) {
    throw new Error(
      `coupon ${BLACK_FRIDAY_COUPON_ID} differs (valid=${existing.valid}, percent_off=${existing.percent_off}, redeem_by=${existing.redeem_by} vs ${redeemBy}, products ${got.join(",")} vs ${wanted.join(",")}): delete it in the Dashboard and re-run`,
    );
  }
  log(`coupon ${BLACK_FRIDAY_COUPON_ID} ✓ (redeem_by ${BLACK_FRIDAY_ENDS_AT.toISOString()})`);
} else if (dryRun) {
  log(`would create coupon ${BLACK_FRIDAY_COUPON_ID} (${BLACK_FRIDAY_PERCENT_OFF} %, ${wanted.join(", ")}, redeem_by ${BLACK_FRIDAY_ENDS_AT.toISOString()})`);
} else {
  await stripe.coupons.create({
    id: BLACK_FRIDAY_COUPON_ID,
    // Customer-facing in Checkout and on the invoice (max 40 characters).
    name: `Black Friday −${BLACK_FRIDAY_PERCENT_OFF} %`,
    percent_off: BLACK_FRIDAY_PERCENT_OFF,
    duration: "once",
    applies_to: { products: wanted },
    redeem_by: redeemBy,
    metadata: { meapica: "black-friday-2026" },
  });
  log(`created coupon ${BLACK_FRIDAY_COUPON_ID}`);
}

// ── Promotion code ───────────────────────────────────────────────────────────
const couponOf = (p: Stripe.PromotionCode) => (typeof p.promotion.coupon === "string" ? p.promotion.coupon : p.promotion.coupon?.id);
const codes = (await stripe.promotionCodes.list({ code: BLACK_FRIDAY_PROMO_CODE, limit: 20 })).data;
const mine = codes.find((p) => couponOf(p) === BLACK_FRIDAY_COUPON_ID && p.active);
const clash = codes.find((p) => couponOf(p) !== BLACK_FRIDAY_COUPON_ID && p.active);
if (clash) throw new Error(`An active ${BLACK_FRIDAY_PROMO_CODE} code ${clash.id} exists on another coupon (${couponOf(clash)}): deactivate it first`);
if (mine) {
  log(`promotion code ${BLACK_FRIDAY_PROMO_CODE} ✓ ${mine.id} (expires ${mine.expires_at ? new Date(mine.expires_at * 1000).toISOString() : "never"})`);
} else if (dryRun) {
  log(`would create promotion code ${BLACK_FRIDAY_PROMO_CODE} on ${BLACK_FRIDAY_COUPON_ID}`);
} else {
  const created = await stripe.promotionCodes.create({
    promotion: { type: "coupon", coupon: BLACK_FRIDAY_COUPON_ID },
    code: BLACK_FRIDAY_PROMO_CODE,
    expires_at: redeemBy,
    metadata: { kind: "black_friday" },
  });
  log(`created promotion code ${BLACK_FRIDAY_PROMO_CODE} ${created.id}`);
}
