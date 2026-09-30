// Guest-merge proof — signed, short-lived token kept in an HttpOnly cookie.
//
// When a guest (anonymous Supabase session) starts logging in, the server checks
// that the CURRENT session is that anonymous user and only then issues
//   v1.<anonUserId>.<expiresAtUnixSec>.<base64url HMAC-SHA256>
// After the login completes (code, email link or Google), the server verifies the
// token and moves the guest's books into the permanent account. A session alone can
// never claim someone else's guest data: the anon id comes only from this token, and
// the token is only minted for whoever held that anonymous session.
//
// Key: HKDF of SUPABASE_SERVICE_ROLE_KEY with its own label (same pattern as the
// preview share tokens), so no extra env var is needed. Pure crypto, no I/O.

import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

export const GUEST_MERGE_COOKIE = "meapica_guest_merge";
export const GUEST_MERGE_TTL_SEC = 60 * 60; // matches the email OTP validity (1 h)

const VERSION = "v1";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function deriveMergeKey(secret: string): Buffer {
  if (!secret) throw new Error("guest-merge key material missing");
  return Buffer.from(hkdfSync("sha256", secret, "", "meapica:guest-merge:v1", 32));
}

let cachedKey: Buffer | null = null;
/** Server key from SUPABASE_SERVICE_ROLE_KEY (throws when missing). */
export function mergeKey(): Buffer {
  if (!cachedKey) cachedKey = deriveMergeKey(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "");
  return cachedKey;
}

function mac(key: Buffer, payload: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function signMergeToken(anonUserId: string, key: Buffer, nowMs: number = Date.now(), ttlSec: number = GUEST_MERGE_TTL_SEC): string {
  const id = anonUserId.toLowerCase();
  if (!UUID_RE.test(id)) throw new Error("invalid anonymous user id");
  const exp = Math.floor(nowMs / 1000) + ttlSec;
  const payload = `${VERSION}.${id}.${exp}`;
  return `${payload}.${mac(key, payload)}`;
}

/** Returns the anonymous user id when the token is authentic and unexpired, else null. */
export function verifyMergeToken(token: string | null | undefined, key: Buffer, nowMs: number = Date.now()): string | null {
  if (typeof token !== "string" || token.length > 200) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [version, id, expRaw, sig] = parts;
  if (version !== VERSION || !UUID_RE.test(id) || !/^\d{1,12}$/.test(expRaw)) return null;
  const expected = Buffer.from(mac(key, `${version}.${id}.${expRaw}`));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  if (Number(expRaw) * 1000 <= nowMs) return null;
  return id;
}
