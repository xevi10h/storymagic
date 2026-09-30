// Runnable check for the post-purchase offer decision (no deps, no test runner):
//   node --experimental-strip-types src/lib/upsell.check.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EXTRA_COPY_WINDOW_DAYS, offerCatalogItem, upsellForStory } from "./upsell.ts";

const DAY = 86_400_000;
const USER = "u-1";
const STORY = "s-1";
const PAID_AT = Date.parse("2026-09-01T10:00:00Z");
const order = (over) => ({
  id: "o-1",
  user_id: USER,
  story_id: STORY,
  format: "digital_pdf",
  status: "paid",
  refunded_at: null,
  created_at: new Date(PAID_AT).toISOString(),
  offer: null,
  ...over,
});
const decide = (orders, over = {}) => upsellForStory(orders, { userId: USER, storyId: STORY, now: PAID_AT + DAY, ...over });

// PDF paid → upgrade (any live status), no time limit
for (const status of ["paid", "producing", "shipped", "delivered"]) {
  const u = decide([order({ status })]);
  assert.equal(u?.offer, "pdf_upgrade", status);
  assert.equal(u.sourceOrderId, "o-1");
  assert.equal(u.expiresAt, null);
}
assert.equal(decide([order({})], { now: PAID_AT + 400 * DAY })?.offer, "pdf_upgrade");
// Upgrade Price missing on the Stripe account → hidden (fail soft)
assert.equal(decide([order({})], { upgradeAvailable: false }), null);

// Refunded / never paid / closed PDF order → nothing
assert.equal(decide([order({ status: "refunded", refunded_at: "2026-09-02T00:00:00Z" })]), null);
assert.equal(decide([order({ status: "paid", refunded_at: "2026-09-02T00:00:00Z" })]), null); // refund recorded
assert.equal(decide([order({ status: "pending" })]), null);
assert.equal(decide([order({ status: "cancelled" })]), null);

// Upgrade used (a live printed order exists) → extra copy window from THAT order instead
{
  const upgradedAt = PAID_AT + 10 * DAY;
  const orders = [order({}), order({ id: "o-2", format: "hardcover", offer: "pdf_upgrade", created_at: new Date(upgradedAt).toISOString() })];
  const u = decide(orders, { now: upgradedAt + DAY });
  assert.equal(u?.offer, "extra_copy_repeat");
  assert.equal(u.sourceOrderId, "o-2");
  // …and after that window: normal price, the upgrade does not come back
  assert.equal(decide(orders, { now: upgradedAt + 61 * DAY }), null);
}
// Upgrade refunded → the PDF upgrade is offered again
assert.equal(
  decide([order({}), order({ id: "o-2", format: "hardcover", offer: "pdf_upgrade", status: "refunded", refunded_at: "2026-09-12T00:00:00Z" })])?.offer,
  "pdf_upgrade",
);

// Printed within 60 days → extra-copy price, deadline = order + 60 days
{
  const printed = [order({ format: "softcover", status: "delivered" })];
  const u = decide(printed, { now: PAID_AT + 59 * DAY });
  assert.equal(u?.offer, "extra_copy_repeat");
  assert.equal(u.sourceFormat, "softcover");
  assert.equal(u.expiresAt, new Date(PAID_AT + EXTRA_COPY_WINDOW_DAYS * DAY).toISOString());
  assert.equal(decide(printed, { now: PAID_AT + 60 * DAY - 1 })?.offer, "extra_copy_repeat"); // last millisecond of day 60
  // Day 61 → normal price
  assert.equal(decide(printed, { now: PAID_AT + 60 * DAY }), null);
  assert.equal(decide(printed, { now: PAID_AT + 61 * DAY }), null);
  // Refunded printed order → nothing
  assert.equal(decide([order({ format: "hardcover", status: "refunded", refunded_at: "2026-09-05T00:00:00Z" })]), null);
  // Goodwill refund on a delivered book (status kept, refunded_at set) → nothing
  assert.equal(decide([order({ format: "hardcover", status: "delivered", refunded_at: "2026-09-05T00:00:00Z" })]), null);
}
// A post-purchase extra copy does not restart the 60 days
{
  const orders = [
    order({ format: "hardcover" }),
    order({ id: "o-3", format: "hardcover", offer: "extra_copy_repeat", created_at: new Date(PAID_AT + 50 * DAY).toISOString() }),
  ];
  assert.equal(decide(orders, { now: PAID_AT + 55 * DAY })?.sourceOrderId, "o-1");
  assert.equal(decide(orders, { now: PAID_AT + 70 * DAY }), null);
}
// Latest full printed purchase anchors the window (a normal-price reorder restarts it)
assert.equal(
  decide([order({ format: "hardcover" }), order({ id: "o-4", format: "softcover", created_at: new Date(PAID_AT + 80 * DAY).toISOString() })], {
    now: PAID_AT + 90 * DAY,
  })?.sourceOrderId,
  "o-4",
);

// Another user's order, another story, detached orders (account deleted) → nothing
assert.equal(decide([order({ user_id: "u-2" })]), null);
assert.equal(decide([order({ story_id: "s-2" })]), null);
assert.equal(decide([order({ story_id: null })]), null);
assert.equal(decide([order({ user_id: null })]), null);
assert.equal(upsellForStory([order({})], { userId: null, storyId: STORY, now: PAID_AT }), null);
assert.equal(upsellForStory([order({ story_id: null })], { userId: USER, storyId: null, now: PAID_AT }), null);
// Unparseable date on a printed order: no window, and no upgrade either (a printed copy exists)
assert.equal(decide([order({}), order({ id: "o-5", format: "hardcover", created_at: "not-a-date" })]), null);

// Pricing: which catalog item each offer sells, and its amount in STRIPE_CATALOG
assert.equal(offerCatalogItem("pdf_upgrade", "hardcover"), "upgrade_hardcover");
assert.equal(offerCatalogItem("pdf_upgrade", "softcover"), "upgrade_softcover");
assert.equal(offerCatalogItem("extra_copy_repeat", "hardcover"), "extra_copy_hardcover");
assert.equal(offerCatalogItem("extra_copy_repeat", "softcover"), "extra_copy_softcover");
{
  // pricing.ts can't be imported here (extensionless imports); read the amounts from its source.
  const src = readFileSync(new URL("./pricing.ts", import.meta.url), "utf8");
  const amount = (item) => Number(new RegExp(`\\n  ${item}: \\{[^}]*amount: (\\d+)`).exec(src)?.[1]);
  assert.equal(amount("upgrade_hardcover"), 4000);
  assert.equal(amount("upgrade_softcover"), 2500);
  assert.equal(amount("extra_copy_hardcover"), 2990);
  assert.equal(amount("extra_copy_softcover"), 1990);
  // The upgrade is exactly the format price minus the PDF ("te descontamos los 9,90 €")
  assert.equal(amount("hardcover") - amount("digital_pdf"), amount("upgrade_hardcover"));
  assert.equal(amount("softcover") - amount("digital_pdf"), amount("upgrade_softcover"));
}

console.log("upsell.check: all assertions passed");
