// Self-check for the TikTok Events API CompletePayment payload (fetch mocked).
// Run: npx tsx scripts/check-tiktok-events.mts
import assert from "node:assert";
import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { sendTikTokPurchase } from "../src/lib/tracking/tiktok-events.ts";

const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const calls: { url: string; headers: Record<string, string>; body: Record<string, any> }[] = [];
globalThis.fetch = (async (url: string, init: RequestInit) => {
  calls.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
  return new Response(JSON.stringify({ code: 0, message: "OK" }));
}) as typeof fetch;
process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID = "PIX";
process.env.TIKTOK_EVENTS_TOKEN = "tok";
delete process.env.TIKTOK_TEST_EVENT_CODE;

const session = (metadata: Record<string, string>) =>
  ({
    id: "cs_test_abc",
    livemode: false,
    amount_total: 3490,
    currency: "eur",
    customer_details: { email: " Ana@Example.com ", phone: "600 111 222" },
    metadata: { format: "softcover", user_id: "u1", ...metadata },
  }) as unknown as Stripe.Checkout.Session;

await sendTikTokPurchase(session({}));
assert.equal(calls.length, 0, "no ads consent → nothing sent");
await sendTikTokPurchase(session({ ads_consent: "1" }));
assert.equal(calls.length, 0, "test-mode payment without TIKTOK_TEST_EVENT_CODE → nothing sent");

process.env.TIKTOK_TEST_EVENT_CODE = "TEST1";
await sendTikTokPurchase(session({ ads_consent: "1", ttp: "ttp1", ttclid: "click1", client_ip: "1.2.3.4", client_ua: "UA" }));
assert.equal(calls.length, 1);
const { url, headers, body } = calls[0];
const ev = body.data[0];
assert.equal(url, "https://business-api.tiktok.com/open_api/v1.3/event/track/");
assert.equal(headers["Access-Token"], "tok");
assert.equal(body.event_source, "web");
assert.equal(body.event_source_id, "PIX");
assert.equal(body.test_event_code, "TEST1");
assert.equal(ev.event, "CompletePayment");
assert.equal(ev.event_id, "purchase_cs_test_abc", "must match the browser pixel event id");
assert.equal(ev.user.email, sha("ana@example.com"));
assert.equal(ev.user.phone, sha("+34600111222"), "E.164 then hashed");
assert.equal(ev.user.ttp, "ttp1");
assert.equal(ev.user.ttclid, "click1");
assert.equal(ev.properties.value, 34.9);
assert.equal(ev.properties.currency, "EUR");
assert.deepEqual(ev.properties.contents, [{ content_id: "softcover" }]);

globalThis.fetch = (async () => {
  throw new Error("network down (expected in this check)");
}) as typeof fetch;
await sendTikTokPurchase(session({ ads_consent: "1" })); // must not throw

console.log("tiktok-events checks OK");
