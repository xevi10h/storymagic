// Black Friday end-to-end against Stripe TEST mode (src/lib/black-friday.ts): builds real Checkout
// Sessions with the app's own builder (src/lib/checkout/session.ts) and the promotion code the app
// would pre-apply (getPromotionSetup), then reads Stripe's computed totals back. Every session is
// expired right away. Writes nothing in the database. Refuses a live key.
//
//   STRIPE_ENVIRONMENT=test STRIPE_SECRET_KEY_TEST=sk_test_... \
//     npx tsx --tsconfig tsconfig.json scripts/check-black-friday-checkout.mts
//
// Needs scripts/stripe-setup-black-friday.mts run on the same account first.

import assert from "node:assert/strict";
import { getStripe, getStripeCatalog, getStripeSecretKey } from "../src/lib/stripe";
import { getPromotionSetup } from "../src/lib/growth/stripe-promotions";
import { buildCheckoutSession } from "../src/lib/checkout/session";
import { isBlackFridayAt } from "../src/lib/black-friday";
import type { AddonId, BookFormat } from "../src/lib/pricing";

if (!getStripeSecretKey().startsWith("sk_test_")) throw new Error("TEST mode only (STRIPE_ENVIRONMENT=test)");
if (!isBlackFridayAt(Date.now())) throw new Error("Outside the Black Friday window: getPromotionSetup returns no code");

const stripe = getStripe();
const catalog = await getStripeCatalog();
const setup = await getPromotionSetup();
assert.ok(setup.blackFriday, "BLACKFRIDAY promotion code found on this account");
console.log(`BLACKFRIDAY → ${setup.blackFriday}`);

const cases: { format: BookFormat; addons: AddonId[]; total: number; discount: number }[] = [
  { format: "digital_pdf", addons: [], total: 792, discount: 198 },
  { format: "softcover", addons: [], total: 2792, discount: 698 },
  { format: "hardcover", addons: [], total: 3992, discount: 998 },
  // The extra copy is a separate Product: not discounted (27,92 + 19,90).
  { format: "softcover", addons: ["extra_copy"], total: 4782, discount: 698 },
  { format: "hardcover", addons: ["extra_copy"], total: 6982, discount: 998 },
];

for (const c of cases) {
  const plan = buildCheckoutSession({
    catalog,
    storyId: "00000000-0000-4000-8000-00000000bf26",
    userId: "00000000-0000-4000-8000-00000000bf26",
    email: "black-friday-check@example.com",
    format: c.format,
    addonIds: c.addons,
    locale: "es",
    isReorder: false,
    offer: null,
    origin: "https://meapica.es",
    referralPromotionCodeId: setup.blackFriday,
  });
  const session = await stripe.checkout.sessions.create(plan.params);
  try {
    const label = `${c.format}${c.addons.length ? ` + ${c.addons.join(",")}` : ""}`;
    assert.equal(session.amount_total, c.total, `${label}: amount_total`);
    assert.equal(session.total_details?.amount_discount, c.discount, `${label}: amount_discount`);
    console.log(`✓ ${label}: paid ${session.amount_total} (list ${plan.totalCents}, −${session.total_details?.amount_discount})`);
  } finally {
    await stripe.checkout.sessions.expire(session.id);
  }
}

// A plain reorder gets nothing pre-applied by /api/checkout (isReorder); and the extra-copy /
// upgrade Products are outside the coupon's applies_to. Typing BLACKFRIDAY by hand on a reorder of
// the same format IS accepted by Stripe (same Product): known, accepted gap (docs/stack.md).
console.log("black-friday checkout: all checks passed");
