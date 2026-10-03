// Self-check for the GA4 Measurement Protocol purchase payload (fetch mocked).
// Run: npx tsx scripts/check-ga4-mp.mts
import assert from "node:assert";
import type Stripe from "stripe";
import { gaClientId, gaSessionId, sendGa4Purchase } from "../src/lib/tracking/ga4-mp.ts";

type MpBody = {
  client_id: string;
  consent: Record<string, string>;
  events: { name: string; params: Record<string, unknown> }[];
};
const calls: { url: string; body: MpBody }[] = [];
globalThis.fetch = (async (url: string, init: RequestInit) => {
  calls.push({ url, body: JSON.parse(String(init.body)) });
  return new Response(null, { status: 204 });
}) as typeof fetch;
process.env.NEXT_PUBLIC_GA4_ID = "G-TEST";
process.env.GA4_API_SECRET = "sec";

assert.equal(gaClientId("GA1.1.123456789.1700000000"), "123456789.1700000000");
assert.equal(gaClientId("garbage"), "");
assert.equal(gaClientId(undefined), "");
assert.equal(gaSessionId("GS1.1.1700000123.4.1.1700000200.0.0.0"), "1700000123");
assert.equal(gaSessionId("GS2.1.s1700000123$o4$g1$t1700000200$j60$l0$h0"), "1700000123");
assert.equal(gaSessionId(undefined), "");

const session = (metadata: Record<string, string>, livemode = true) =>
  ({
    id: "cs_live_abc",
    livemode,
    amount_total: 3490,
    currency: "eur",
    metadata: { format: "softcover", ...metadata },
  }) as unknown as Stripe.Checkout.Session;

await sendGa4Purchase(session({ ga_cid: "1.2" }));
assert.equal(calls.length, 0, "no consent → nothing sent");
await sendGa4Purchase(session({ ads_consent: "1", ga_cid: "1.2" }, false));
assert.equal(calls.length, 0, "test-mode payment → nothing sent");
await sendGa4Purchase(session({ ads_consent: "1" }));
assert.equal(calls.length, 0, "no _ga client id → nothing sent (browser purchase covers it)");

await sendGa4Purchase(session({ ads_consent: "1", ga_cid: "123.456", ga_sid: "1700000123" }));
assert.equal(calls.length, 1);
const { url, body } = calls[0];
const ev = body.events[0];
assert.equal(url, "https://region1.google-analytics.com/mp/collect?measurement_id=G-TEST&api_secret=sec");
assert.equal(body.client_id, "123.456");
assert.deepEqual(body.consent, { ad_user_data: "GRANTED", ad_personalization: "GRANTED" });
assert.equal(ev.name, "purchase");
assert.equal(ev.params.transaction_id, "purchase_cs_live_abc", "must match the browser gtag transaction_id");
assert.equal(ev.params.value, 34.9);
assert.equal(ev.params.currency, "EUR");
assert.equal(ev.params.session_id, "1700000123");
assert.deepEqual(ev.params.items, [{ item_id: "softcover", item_name: "softcover", price: 34.9, quantity: 1 }]);

// Analytics accepted, advertising rejected (banner "Configurar"): sent, with the ad signals denied.
await sendGa4Purchase(session({ analytics_consent: "1", ga_cid: "123.456" }));
assert.equal(calls.length, 2);
assert.deepEqual(calls[1].body.consent, { ad_user_data: "DENIED", ad_personalization: "DENIED" });

globalThis.fetch = (async () => {
  throw new Error("network down (expected in this check)");
}) as typeof fetch;
await sendGa4Purchase(session({ ads_consent: "1", ga_cid: "1.2" })); // must not throw

console.log("ga4-mp checks OK");
