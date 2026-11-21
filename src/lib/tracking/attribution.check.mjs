// Runnable check for the first-touch attribution parser (no deps, no test runner):
//   node --experimental-strip-types src/lib/tracking/attribution.check.mjs
import assert from "node:assert/strict";
import { browserOf, carriedParams, funnelSource, getFirstTouch, parseAttribution } from "./attribution.ts";

// Browser family from the User-Agent (server side).
const UA = {
  instagramIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 357.0.0.25.101 (iPhone15,3; iOS 18_1; es_ES; es; scale=3.00; 1290x2796; 653035045) NW/3",
  instagramAndroid: "Mozilla/5.0 (Linux; Android 14; SM-S911B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.102 Mobile Safari/537.36 Instagram 357.0.0.48.83 Android (34/14; 480dpi; 1080x2340; samsung; SM-S911B; dm1q; qcom; es_ES; 653035045)",
  facebookIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/490.0.0.41.109;FBBV/662340110;FBDV/iPhone15,3;FBMD/iPhone;FBSN/iOS;FBSV/18.1;FBSS/3;FBCR/;FBID/phone;FBLC/es_ES;FBOP/80]",
  facebookAndroid: "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240905.003; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.102 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/490.0.0.52.109;]",
  tiktok: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_37.5.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/es Region/ES",
  androidWebView: "Mozilla/5.0 (Linux; Android 13; SM-A536B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile Safari/537.36",
  safari: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  chromeAndroid: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  desktop: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};
assert.equal(browserOf(UA.instagramIos), "instagram");
assert.equal(browserOf(UA.instagramAndroid), "instagram");
assert.equal(browserOf(UA.facebookIos), "facebook");
assert.equal(browserOf(UA.facebookAndroid), "facebook");
assert.equal(browserOf(UA.tiktok), "tiktok");
assert.equal(browserOf(UA.androidWebView), "in_app_other");
assert.equal(browserOf(UA.safari), "web");
assert.equal(browserOf(UA.chromeAndroid), "web");
assert.equal(browserOf(UA.desktop), "web");
assert.equal(browserOf(null), "web");
assert.equal(browserOf(""), "web");

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

// Funnel source: paid Meta = utm_source=meta or Zernio's zrn; organic Facebook/Instagram stays "other".
assert.equal(funnelSource("?utm_source=meta&utm_medium=paid&utm_campaign=reyes_q4-26"), "meta");
assert.equal(funnelSource("?utm_source=%20META%20"), "meta");
assert.equal(funnelSource("?zrn=120252257133430661&fbclid=x"), "meta");
assert.equal(funnelSource("?utm_source=facebook&utm_medium=organic_social"), "other");
assert.equal(funnelSource("?fbclid=x"), "other");
assert.equal(funnelSource(""), "other");

// Carried into /create: UTMs + zrn only (no click ids, no other params), empty values dropped.
assert.deepEqual(
  carriedParams("?utm_source=meta&utm_medium=paid&utm_campaign=q4&utm_content=soy-yo&utm_term=x&zrn=123&fbclid=SECRET&name=Leo&utm_source2=y"),
  { utm_source: "meta", utm_medium: "paid", utm_campaign: "q4", utm_content: "soy-yo", zrn: "123" },
);
assert.deepEqual(carriedParams("?utm_source=%20&fbclid=x"), {});
assert.deepEqual(carriedParams(""), {});

// Server-side (no window): nothing captured.
assert.equal(getFirstTouch(), null);

console.log("attribution.check: ok");
