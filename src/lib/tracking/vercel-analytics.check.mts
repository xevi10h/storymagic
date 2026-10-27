// Runnable check for what leaves the browser towards Vercel Web Analytics:
//   npx tsx src/lib/tracking/vercel-analytics.check.mts
import assert from "node:assert/strict";
import { beforeSend, redactPath, sanitizeUrl } from "./vercel-analytics";

const ID = "3f2b8c1a-9d4e-4f6a-8b7c-1e2d3c4b5a69";

// Only utm_source / utm_campaign / utm_content survive; everything else and the hash go.
assert.equal(
  sanitizeUrl("https://meapica.es/es?utm_source=meta&utm_medium=paid&utm_campaign=reyes_q4-26&utm_content=2026-10-27-la-cueva&zrn=1202&fbclid=SECRET&name=Noa&email=a%40b.c#x"),
  "https://meapica.es/es?utm_source=meta&utm_campaign=reyes_q4-26&utm_content=2026-10-27-la-cueva",
);
assert.equal(sanitizeUrl("https://meapica.es/es/create?name=Noa"), "https://meapica.es/es/create");
assert.equal(sanitizeUrl("https://meapica.es/es/checkout/success?session_id=cs_live_123"), "https://meapica.es/es/checkout/success");
assert.equal(sanitizeUrl("https://meapica.es/unsubscribe?token=abc&email=x%40y.z"), "https://meapica.es/unsubscribe");
assert.equal(sanitizeUrl(`https://meapica.es/es?utm_content=${"a".repeat(300)}`)!.length, "https://meapica.es/es?utm_content=".length + 100);

// Ids in paths become placeholders; referral codes too.
assert.equal(sanitizeUrl(`https://meapica.es/es/create/${ID}/generate`), "https://meapica.es/es/create/[id]/generate");
assert.equal(sanitizeUrl(`https://meapica.es/create/${ID.toUpperCase()}/preview?step=5`), "https://meapica.es/create/[id]/preview");
assert.equal(redactPath("/ca/r/MARIA-7Q2"), "/ca/r/[code]");
assert.equal(redactPath("/r/MARIA-7Q2"), "/r/[code]");
assert.equal(redactPath("/es/examples/noa"), "/es/examples/noa");

// Capability URLs send nothing.
assert.equal(sanitizeUrl("https://meapica.es/es/preview/tok_abc123"), null);
assert.equal(sanitizeUrl("https://meapica.es/preview/tok_abc123"), null);
assert.equal(sanitizeUrl("https://meapica.es/fr/gift-voucher/card/tok_abc"), null);
assert.equal(sanitizeUrl("not a url"), null);

// beforeSend keeps the rest of the event (custom event payload) and only rewrites the URL.
const ev = { type: "event" as const, url: `https://meapica.es/es/create/${ID}/preview?x=1`, payload: { name: "create_step" } };
assert.deepEqual(beforeSend(ev), { ...ev, url: "https://meapica.es/es/create/[id]/preview" });
assert.equal(beforeSend({ type: "pageview", url: "https://meapica.es/es/preview/tok" }), null);

console.log("vercel-analytics.check: ok");
