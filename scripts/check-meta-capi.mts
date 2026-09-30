// Self-check for the Meta CAPI Purchase payload (fetch mocked, nothing leaves the machine).
// Run: npx tsx scripts/check-meta-capi.mts
import assert from "node:assert";
import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { sendMetaPurchase } from "../src/lib/tracking/meta-capi.ts";

const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const calls: { url: string; body: { test_event_code?: string; data: Record<string, any>[] } }[] = [];
globalThis.fetch = (async (url: string, init: RequestInit) => {
  calls.push({ url, body: JSON.parse(String(init.body)) });
  return new Response("{}");
}) as typeof fetch;
process.env.NEXT_PUBLIC_META_PIXEL_ID = "123";
process.env.META_CAPI_TOKEN = "tok";
delete process.env.META_CAPI_TEST_EVENT_CODE;

const session = (metadata: Record<string, string>) =>
  ({
    id: "cs_test_abc",
    livemode: false,
    amount_total: 4990,
    currency: "eur",
    customer_details: { email: " Ana@Example.com ", phone: "+34 600 111 222", address: { country: "ES" } },
    metadata: { format: "hardcover", user_id: "u1", ...metadata },
  }) as unknown as Stripe.Checkout.Session;

await sendMetaPurchase(session({}));
assert.equal(calls.length, 0, "no ads consent → nothing sent");
await sendMetaPurchase(session({ ads_consent: "1" }));
assert.equal(calls.length, 0, "test-mode payment without META_CAPI_TEST_EVENT_CODE → nothing sent");

process.env.META_CAPI_TEST_EVENT_CODE = "TEST1";
await sendMetaPurchase(session({ ads_consent: "1", fbp: "fb.1.1.2", client_ip: "1.2.3.4", client_ua: "UA" }));
assert.equal(calls.length, 1);
const { url, body } = calls[0];
const ev = body.data[0];
assert.ok(url.startsWith("https://graph.facebook.com/v26.0/123/events?access_token=tok"));
assert.equal(body.test_event_code, "TEST1");
assert.equal(ev.event_id, "purchase_cs_test_abc", "must match the Pixel event id for dedup");
assert.equal(ev.custom_data.value, 49.9);
assert.equal(ev.custom_data.currency, "EUR");
assert.equal(ev.user_data.em[0], sha("ana@example.com"), "email trimmed + lowercased + hashed");
assert.equal(ev.user_data.ph[0], sha("34600111222"), "phone digits only, with country code");
assert.equal(ev.user_data.country[0], sha("es"));
assert.equal(ev.user_data.fbp, "fb.1.1.2");
assert.equal(ev.user_data.fbc, undefined);

globalThis.fetch = (async () => {
  throw new Error("network down (expected in this check)");
}) as typeof fetch;
await sendMetaPurchase(session({ ads_consent: "1" })); // must not throw: a webhook can't fail on tracking

console.log("meta-capi checks OK");
