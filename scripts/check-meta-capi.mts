// Self-check for the Meta CAPI Purchase payload (fetch mocked, nothing leaves the machine).
// Run: npx tsx scripts/check-meta-capi.mts
import assert from "node:assert";
import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { sendMetaPurchase } from "../src/lib/tracking/meta-capi.ts";

const sha = (v: string) => createHash("sha256").update(v).digest("hex");
// Every outcome must leave a log line: capture them.
const logs: string[] = [];
for (const level of ["info", "warn", "error"] as const) console[level] = (...args: unknown[]) => void logs.push(`${level}: ${args.join(" ")}`);
const lastLog = () => logs[logs.length - 1] ?? "";
let reply: () => Response = () => Response.json({ events_received: 1, messages: [], fbtrace_id: "TRACE1" });
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double: loose payload shape is asserted field by field below
const calls: { url: string; body: { test_event_code?: string; data: Record<string, any>[] } }[] = [];
globalThis.fetch = (async (url: string, init: RequestInit) => {
  calls.push({ url, body: JSON.parse(String(init.body)) });
  return reply();
}) as typeof fetch;
process.env.NEXT_PUBLIC_META_PIXEL_ID = "123";
process.env.META_CAPI_TOKEN = "SECRETTOK";
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
assert.match(lastLog(), /^info: .*skipped: no ads consent/);
await sendMetaPurchase(session({ ads_consent: "1" }));
assert.equal(calls.length, 0, "test-mode payment without META_CAPI_TEST_EVENT_CODE → nothing sent");
assert.match(lastLog(), /^info: .*skipped: test-mode payment/);

process.env.META_CAPI_TOKEN = " \n";
await sendMetaPurchase(session({ ads_consent: "1" }));
assert.equal(calls.length, 0);
assert.match(lastLog(), /^error: .*NOT sent: missing META_CAPI_TOKEN$/, "blank token is reported by name");
process.env.META_CAPI_TOKEN = "SECRETTOK\n"; // stray newline from a piped `vercel env add`

process.env.META_CAPI_TEST_EVENT_CODE = "TEST1";
await sendMetaPurchase(session({ ads_consent: "1", fbp: "fb.1.1.2", client_ip: "1.2.3.4", client_ua: "UA" }));
assert.equal(calls.length, 1);
const { url, body } = calls[0];
const ev = body.data[0];
assert.equal(url, "https://graph.facebook.com/v26.0/123/events?access_token=SECRETTOK", "token trimmed");
assert.match(lastLog(), /^info: .*cs_test_abc sent \(test:TEST1\): events_received=1 fbtrace_id=TRACE1/);
assert.equal(body.test_event_code, "TEST1");
assert.equal(ev.event_id, "purchase_cs_test_abc", "must match the Pixel event id for dedup");
assert.equal(ev.custom_data.value, 49.9);
assert.equal(ev.custom_data.currency, "EUR");
assert.equal(ev.user_data.em[0], sha("ana@example.com"), "email trimmed + lowercased + hashed");
assert.equal(ev.user_data.ph[0], sha("34600111222"), "phone digits only, with country code");
assert.equal(ev.user_data.country[0], sha("es"));
assert.equal(ev.user_data.fbp, "fb.1.1.2");
assert.equal(ev.user_data.fbc, undefined);

reply = () => Response.json({ error: { message: "Invalid OAuth access token.", type: "OAuthException", code: 190, fbtrace_id: "TRACE2" } }, { status: 400 });
await sendMetaPurchase(session({ ads_consent: "1" }));
assert.match(lastLog(), /^error: .*REJECTED .*http=400 code=190 .*fbtrace_id=TRACE2 message=Invalid OAuth access token\./);
assert.ok(!lastLog().includes("SECRETTOK"), "the token never reaches the logs");

reply = () => Response.json({ events_received: 0 });
await sendMetaPurchase(session({ ads_consent: "1" }));
assert.match(lastLog(), /^error: .*NOT confirmed .*http=200/, "200 without events_received=1 is not a success");

reply = () => new Response("<html>Bad gateway</html>", { status: 502 });
await sendMetaPurchase(session({ ads_consent: "1" }));
assert.match(lastLog(), /^error: .*NOT confirmed .*http=502 body=<html>/);

globalThis.fetch = (async () => {
  throw new Error("network down (expected in this check)");
}) as typeof fetch;
await sendMetaPurchase(session({ ads_consent: "1" })); // must not throw: a webhook can't fail on tracking
assert.match(lastLog(), /^error: .*FAILED .*network down/);

process.stdout.write("meta-capi checks OK\n");
