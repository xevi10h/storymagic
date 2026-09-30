// Runnable check for the pure auth helpers (no deps, no test runner):
//   node --experimental-strip-types src/lib/auth/auth.check.mjs
import assert from "node:assert/strict";
import { DEFAULT_NEXT_PATH, localizedPath, loginHref, orderAccessUrl, sanitizeNextPath } from "./next-path.ts";
import { deriveMergeKey, signMergeToken, verifyMergeToken } from "./merge-token.ts";
import { authErrorKey, isExistingAccountError, queryErrorKey } from "./auth-errors.ts";

// ── next sanitiser: only same-origin relative paths survive ──────────────────
const D = DEFAULT_NEXT_PATH;
assert.equal(sanitizeNextPath("/dashboard"), "/dashboard");
assert.equal(sanitizeNextPath("/dashboard?tab=orders"), "/dashboard?tab=orders");
assert.equal(sanitizeNextPath("/crear/abc/preview"), "/crear/abc/preview");
assert.equal(sanitizeNextPath("%2Fcrear%2Fabc%2Fpreview"), "/crear/abc/preview");
assert.equal(sanitizeNextPath("/ca/dashboard"), "/dashboard", "leading locale stripped");
assert.equal(sanitizeNextPath("/fr"), "/");
assert.equal(sanitizeNextPath("/es-mx/x"), "/es-mx/x", "not a locale prefix");
assert.equal(sanitizeNextPath("/perfil#frag"), "/perfil", "hash dropped");
for (const bad of [
  null,
  undefined,
  "",
  "   ",
  "https://evil.com",
  "//evil.com",
  "//evil.com/dashboard",
  "/\\evil.com",
  "\\\\evil.com",
  "/%5Cevil.com",
  "%2F%2Fevil.com",
  "javascript:alert(1)",
  "/\tevil",
  "/\nlocation",
  "dashboard",
  "/auth/login",
  "/ca/auth/callback?next=/x",
  "/api/account",
  "/" + "a".repeat(600),
]) {
  assert.equal(sanitizeNextPath(bad), D, `rejects ${JSON.stringify(bad)}`);
}
// Percent-encoded backslash decodes to a path segment, never to a host.
assert.ok(!sanitizeNextPath("/%5C%5Cevil.com").startsWith("//"));
assert.equal(sanitizeNextPath("//evil.com", "/"), "/", "custom fallback");

assert.equal(localizedPath("ca", "/dashboard?tab=orders"), "/ca/dashboard?tab=orders");
assert.equal(localizedPath("en", "/"), "/en");
assert.equal(localizedPath("xx", "//evil.com"), "/es/dashboard");

assert.equal(loginHref("/dashboard"), "/auth/login");
assert.equal(loginHref("/crear/1/preview", "a@b.com"), "/auth/login?next=%2Fcrear%2F1%2Fpreview&email=a%40b.com");
assert.equal(loginHref("https://evil.com"), "/auth/login");

const orderUrl = new URL(orderAccessUrl("https://meapica.com/", "ca", "ana+test@x.com"));
assert.equal(orderUrl.origin + orderUrl.pathname, "https://meapica.com/ca/auth/login");
assert.equal(orderUrl.searchParams.get("email"), "ana+test@x.com");
assert.equal(sanitizeNextPath(orderUrl.searchParams.get("next")), "/dashboard?tab=orders");
assert.equal(new URL(orderAccessUrl("https://meapica.com", "de", null)).pathname, "/es/auth/login");

// ── guest-merge token: HMAC sign / verify ────────────────────────────────────
const key = deriveMergeKey("service-role-secret");
const otherKey = deriveMergeKey("another-secret");
const ANON = "0b0e4f2a-1c2d-4e5f-8a9b-0c1d2e3f4a5b";
const now = 1_800_000_000_000;
const token = signMergeToken(ANON.toUpperCase(), key, now, 3600);
assert.equal(verifyMergeToken(token, key, now), ANON);
assert.equal(verifyMergeToken(token, key, now + 3599_000), ANON, "valid until expiry");
assert.equal(verifyMergeToken(token, key, now + 3600_000), null, "expired");
assert.equal(verifyMergeToken(token, otherKey, now), null, "other key");
const [v, id, exp, sig] = token.split(".");
const OTHER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
assert.equal(verifyMergeToken(`${v}.${OTHER}.${exp}.${sig}`, key, now), null, "id swapped");
assert.equal(verifyMergeToken(`${v}.${id}.${Number(exp) + 9999}.${sig}`, key, now), null, "expiry extended");
assert.equal(verifyMergeToken(`${v}.${id}.${exp}.${sig.slice(0, -2)}xx`, key, now), null, "sig tampered");
assert.equal(verifyMergeToken(`v2.${id}.${exp}.${sig}`, key, now), null, "version");
for (const bad of [null, undefined, "", "a.b.c", "v1.not-a-uuid.1.x", token + ".x", "x".repeat(500)]) {
  assert.equal(verifyMergeToken(bad, key, now), null);
}
assert.throws(() => signMergeToken("not-a-uuid", key, now));
assert.throws(() => deriveMergeKey(""));

// ── auth error mapping (no raw provider text) ────────────────────────────────
assert.equal(authErrorKey({ code: "otp_expired", message: "Token has expired or is invalid" }), "invalidCode");
assert.equal(authErrorKey({ message: "Token has expired or is invalid", status: 403 }), "invalidCode");
assert.equal(authErrorKey({ code: "over_email_send_rate_limit" }), "rateLimited");
assert.equal(authErrorKey({ status: 429 }), "rateLimited");
assert.equal(authErrorKey({ code: "email_address_invalid" }), "invalidEmail");
assert.equal(authErrorKey({ name: "AuthRetryableFetchError", status: 0 }), "network");
assert.equal(authErrorKey({ code: "weird_new_code", message: "Something in English" }), "generic");
assert.equal(authErrorKey(new TypeError("Failed to fetch")), "network");
assert.equal(authErrorKey(null), "generic");
// Supabase CAPTCHA protection refusal + our own Turnstile failure (CaptchaError)
assert.equal(authErrorKey({ code: "captcha_failed", status: 400, message: "captcha protection: request disallowed (no captcha_token found)" }), "captchaFailed");
assert.equal(authErrorKey({ name: "CaptchaError", message: "captcha_failed" }), "captchaFailed");
assert.equal(isExistingAccountError({ code: "email_exists" }), true);
assert.equal(isExistingAccountError({ message: "A user with this email address has already been registered" }), true);
assert.equal(isExistingAccountError({ code: "manual_linking_disabled" }), true);
assert.equal(isExistingAccountError({ code: "over_email_send_rate_limit" }), false);
assert.equal(queryErrorKey("link_invalid"), "linkInvalid");
assert.equal(queryErrorKey("<script>"), null);

console.log("auth helpers: all checks passed");
