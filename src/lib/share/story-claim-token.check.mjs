// Runnable check for the "continue your book" claim token (no deps, no test runner):
//   node --experimental-strip-types src/lib/share/story-claim-token.check.mjs
import assert from "node:assert/strict";

process.env.SUPABASE_SERVICE_ROLE_KEY ??= "check-only-service-role-key";
const { CLAIM_LINK_TTL_DAYS, createStoryClaimToken, verifyStoryClaimToken, storyClaimUrl } = await import("./story-claim-token.ts");
const { createPreviewShareToken, verifyPreviewShareToken } = await import("./preview-share-token.ts");

const A = "3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b";
const B = "11111111-2222-4333-8444-555555555555";
const NOW = new Date("2026-11-21T10:00:00Z");
const DAY = 86_400_000;

// Valid: round trip, story id, exact 30-day expiry (no rounding up past the guest purge).
const { token, expiresAt } = createStoryClaimToken(A, "Marta@Example.com", NOW);
assert.match(token, /^[A-Za-z0-9_-]{60}$/);
assert.equal(CLAIM_LINK_TTL_DAYS, 30);
assert.equal(expiresAt.getTime(), NOW.getTime() + 30 * DAY);
const ok = verifyStoryClaimToken(token, { now: NOW });
assert.equal(ok.ok, true);
assert.equal(ok.storyId, A);
assert.equal(verifyStoryClaimToken(token, { now: NOW, email: " marta@example.com " }).ok, true, "same address, normalised");

// No PII in the URL.
assert.ok(!token.includes("marta") && !storyClaimUrl("https://meapica.es/", "es", token).includes("@"));
assert.equal(storyClaimUrl("https://meapica.es/", "ca", token), `https://meapica.es/ca/continue/${token}`);

// Expired: valid until the last millisecond, dead from exp on.
assert.equal(verifyStoryClaimToken(token, { now: new Date(expiresAt.getTime() - 1) }).ok, true);
assert.deepEqual(verifyStoryClaimToken(token, { now: expiresAt }), { ok: false, reason: "expired" });

// Wrong address.
assert.deepEqual(verifyStoryClaimToken(token, { now: NOW, email: "other@example.com" }), { ok: false, reason: "invalid" });

// Wrong story: re-pointing the story bytes (or any byte) breaks the MAC.
const raw = Buffer.from(token, "base64url");
const forged = Buffer.from(raw);
Buffer.from(B.replace(/-/g, ""), "hex").copy(forged, 1);
assert.deepEqual(verifyStoryClaimToken(forged.toString("base64url"), { now: NOW }), { ok: false, reason: "invalid" });
for (const i of [0, 5, 18, 25, 30, 44]) {
  const t = Buffer.from(raw);
  t[i] ^= 0x01;
  assert.equal(verifyStoryClaimToken(t.toString("base64url"), { now: NOW }).ok, false, `tampered byte ${i}`);
}
// Extended expiry without a new MAC.
const later = Buffer.from(raw);
later.writeUInt32BE(later.readUInt32BE(17) + 86_400, 17);
assert.equal(verifyStoryClaimToken(later.toString("base64url"), { now: NOW }).ok, false, "tampered expiry");

// Malformed input.
for (const bad of ["", "abc", token.slice(0, -1), `${token}A`, token.replace(/.$/, "*"), null, 42]) {
  assert.equal(verifyStoryClaimToken(bad, { now: NOW }).ok, false);
}
// Each story gets its own token; a token for B verifies as B, never as A.
const tb = createStoryClaimToken(B, "marta@example.com", NOW).token;
assert.equal(verifyStoryClaimToken(tb, { now: NOW }).storyId, B);

// Domain separation: a read-only share link never claims, a claim link never shares.
const share = createPreviewShareToken(A, NOW).token;
assert.equal(verifyStoryClaimToken(share, { now: NOW }).ok, false);
assert.equal(verifyPreviewShareToken(token, NOW).ok, false);

// Bad input to create.
assert.throws(() => createStoryClaimToken("not-a-uuid", "a@b.c"));
assert.throws(() => createStoryClaimToken(A, "  "));

console.log("story-claim-token: all checks passed");
