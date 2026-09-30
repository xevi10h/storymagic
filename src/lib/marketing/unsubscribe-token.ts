// Unsubscribe links for commercial email (LSSI art. 21.2 / 22.1, RFC 8058).
//
// Stateless, signed token that names the address to suppress:
//   v1.<base64url(normalised email)>.<base64url HMAC-SHA256, first 16 bytes>
// No expiry on purpose: an unsubscribe link in an old email must keep working.
// The token only allows ONE thing (adding that address to email_suppressions), so a
// leaked link can at worst unsubscribe its own recipient.
//
// Key: HKDF of SUPABASE_SERVICE_ROLE_KEY with its own label (same pattern as the
// guest-merge and preview-share tokens), so no extra env var. Pure crypto, no I/O.

import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

const VERSION = "v1";
const MAC_BYTES = 16;
const MAX_EMAIL_LENGTH = 254;
const MAX_TOKEN_LENGTH = 512;

/** Lowercase + trim (the form stored in email_suppressions). Null if it isn't an address. */
export function normalizeEmail(email: string | null | undefined): string | null {
  const value = email?.trim().toLowerCase() ?? "";
  if (!value || value.length > MAX_EMAIL_LENGTH || !/^[^\s@]+@[^\s@]+$/.test(value)) return null;
  return value;
}

export function deriveUnsubscribeKey(secret: string): Buffer {
  if (!secret) throw new Error("unsubscribe key material missing");
  return Buffer.from(hkdfSync("sha256", secret, "", "meapica:email-unsubscribe:v1", 32));
}

let cachedKey: Buffer | null = null;
/** Server key from SUPABASE_SERVICE_ROLE_KEY (throws when missing). */
export function unsubscribeKey(): Buffer {
  if (!cachedKey) cachedKey = deriveUnsubscribeKey(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "");
  return cachedKey;
}

function mac(key: Buffer, payload: string): string {
  return createHmac("sha256", key).update(payload).digest().subarray(0, MAC_BYTES).toString("base64url");
}

export function signUnsubscribeToken(email: string, key: Buffer): string {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error("invalid email");
  const payload = `${VERSION}.${Buffer.from(normalized, "utf8").toString("base64url")}`;
  return `${payload}.${mac(key, payload)}`;
}

/** The (normalised) address when the token is authentic, else null. */
export function verifyUnsubscribeToken(token: string | null | undefined, key: Buffer): string | null {
  if (typeof token !== "string" || token.length > MAX_TOKEN_LENGTH) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [version, encoded, sig] = parts;
  if (version !== VERSION || !/^[A-Za-z0-9_-]+$/.test(encoded) || !/^[A-Za-z0-9_-]+$/.test(sig)) return null;
  const expected = Buffer.from(mac(key, `${version}.${encoded}`));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const email = Buffer.from(encoded, "base64url").toString("utf8");
  // Canonical form only: one address, one token string.
  if (normalizeEmail(email) !== email || Buffer.from(email, "utf8").toString("base64url") !== encoded) return null;
  return email;
}

/** "marta.garcia@gmail.com" → "m•••@gmail.com" (shown on the confirmation page). */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "•••";
  return `${email[0]}•••${email.slice(at)}`;
}

/** Page with the confirm button (what the link in the email body opens). */
export function unsubscribePageUrl(siteUrl: string, locale: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/${locale}/unsubscribe?t=${encodeURIComponent(token)}`;
}

/** RFC 8058 one-click endpoint (List-Unsubscribe header; POST only). */
export function oneClickUnsubscribeUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/api/email/unsubscribe?t=${encodeURIComponent(token)}`;
}

/**
 * Headers for an email that carries commercial content: an HTTPS one-click URI plus
 * a mailto (LSSI 22.1 asks for a valid electronic address to object).
 */
export function listUnsubscribeHeaders(oneClickUrl: string, mailbox: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${oneClickUrl}>, <mailto:${mailbox}?subject=unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
