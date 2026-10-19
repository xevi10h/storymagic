// Signed links for reviews (pure crypto, no I/O). Same scheme as the unsubscribe token
// (src/lib/marketing/unsubscribe-token.ts): HKDF of SUPABASE_SERVICE_ROLE_KEY with a
// label per purpose, so no extra env var and a token of one purpose never verifies as
// another.
//
//   <purpose>.<uuid>.<base64url HMAC-SHA256, first 16 bytes>
//
//   r1 = review link in the review-request email; names the ORDER. One-time by
//        construction: reviews.order_id is unique, a second submit is refused.
//   m1 = moderation link in the owner's alert email; names the REVIEW. It only opens a
//        confirm page (POST hides / republishes), so mail scanners can't act on it.
// No expiry: the link is useless once the review exists, and the moderation link must
// keep working for the life of the review.

import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

export type ReviewTokenPurpose = "review" | "moderate";

const PREFIX: Record<ReviewTokenPurpose, string> = { review: "r1", moderate: "m1" };
const LABEL: Record<ReviewTokenPurpose, string> = {
  review: "meapica:review-link:v1",
  moderate: "meapica:review-moderation:v1",
};
const MAC_BYTES = 16;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function deriveReviewKey(secret: string, purpose: ReviewTokenPurpose): Buffer {
  if (!secret) throw new Error("review key material missing");
  return Buffer.from(hkdfSync("sha256", secret, "", LABEL[purpose], 32));
}

const cachedKeys = new Map<ReviewTokenPurpose, Buffer>();
/** Server key from SUPABASE_SERVICE_ROLE_KEY (throws when missing). */
export function reviewKey(purpose: ReviewTokenPurpose): Buffer {
  let key = cachedKeys.get(purpose);
  if (!key) {
    key = deriveReviewKey(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "", purpose);
    cachedKeys.set(purpose, key);
  }
  return key;
}

function mac(key: Buffer, payload: string): string {
  return createHmac("sha256", key).update(payload).digest().subarray(0, MAC_BYTES).toString("base64url");
}

export function signReviewToken(purpose: ReviewTokenPurpose, id: string, key: Buffer): string {
  const normalized = id.trim().toLowerCase();
  if (!UUID_RE.test(normalized)) throw new Error("invalid id");
  const payload = `${PREFIX[purpose]}.${normalized}`;
  return `${payload}.${mac(key, payload)}`;
}

/** The id (lowercase uuid) when the token is authentic and of this purpose, else null. */
export function verifyReviewToken(purpose: ReviewTokenPurpose, token: string | null | undefined, key: Buffer): string | null {
  if (typeof token !== "string" || token.length > 200) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [prefix, id, sig] = parts;
  if (prefix !== PREFIX[purpose] || !UUID_RE.test(id) || !/^[A-Za-z0-9_-]+$/.test(sig)) return null;
  const expected = Buffer.from(mac(key, `${prefix}.${id}`));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return id;
}

/** Review page the email links to. */
export function reviewPageUrl(siteUrl: string, locale: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/${locale}/review?t=${encodeURIComponent(token)}`;
}

/** Owner's confirm page to hide / republish a review. */
export function moderationUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/api/reviews/moderate?t=${encodeURIComponent(token)}`;
}
