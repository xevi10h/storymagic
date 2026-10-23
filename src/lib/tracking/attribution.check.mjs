// Runnable check for the first-touch attribution parser (no deps, no test runner):
//   node --experimental-strip-types src/lib/tracking/attribution.check.mjs
import assert from "node:assert/strict";
import { getFirstTouch, parseAttribution } from "./attribution.ts";

// UTMs (lower-cased, trimmed, capped), ad-click id name only, referrer host only.
assert.deepEqual(
  parseAttribution({
    search: "?utm_source=Instagram&utm_medium=Paid_Social&utm_campaign=reyes-26&utm_content=%20reel-3%20&utm_term=x&fbclid=SECRET123",
    pathname: "/es/regalos",
    referrer: "https://l.instagram.com/?u=https%3A%2F%2Fmeapica.es",
  }),
  {
    utm_source: "instagram",
    utm_medium: "paid_social",
    utm_campaign: "reyes-26",
    utm_content: "reel-3",
    click_id: "fbclid",
    referrer_host: "l.instagram.com",
    landing_path: "/es/regalos",
  },
);
assert.ok(!JSON.stringify(parseAttribution({ search: "?fbclid=SECRET123", pathname: "/", referrer: "" })).includes("SECRET"));

// Organic referral: host without www, path and query dropped.
assert.deepEqual(parseAttribution({ search: "", pathname: "/ca", referrer: "https://www.Google.es/search?q=conte+personalitzat" }), {
  referrer_host: "google.es",
  landing_path: "/ca",
});

// Direct visit: only the landing path.
assert.deepEqual(parseAttribution({ search: "", pathname: "/", referrer: "" }), { landing_path: "/" });

// Empty / malformed values are ignored; long values are capped.
assert.deepEqual(parseAttribution({ search: "?utm_source=%20%20&utm_campaign=", pathname: "", referrer: "not a url" }), {});
const long = parseAttribution({ search: `?utm_campaign=${"a".repeat(500)}`, pathname: `/${"b".repeat(500)}`, referrer: "" });
assert.equal(long.utm_campaign.length, 100);
assert.equal(long.landing_path.length, 200);

// Server-side (no window): nothing captured.
assert.equal(getFirstTouch(), null);

console.log("attribution.check: ok");
