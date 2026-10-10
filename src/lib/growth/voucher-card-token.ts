// Server-only: unforgeable link to a gift voucher's printable card
// (/[locale]/gift-voucher/card/[token]). Stateless, same construction as the preview
// share token (lib/share/preview-share-token.ts): base64url( voucherId(16) | mac(16) ),
// mac = HMAC-SHA256 truncated to 128 bits, key = HKDF(SUPABASE_SERVICE_ROLE_KEY,
// "meapica:gift-voucher-card:v1"). No expiry: the card is only the printable copy of what
// the buyer already received by email; ids cannot be enumerated without the key.

import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

const MAC_BYTES = 16;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/; // 32 bytes → 43 base64url chars

let cachedKey: Buffer | null = null;
function key(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY (voucher-card key material)");
  cachedKey = Buffer.from(hkdfSync("sha256", secret, "", "meapica:gift-voucher-card:v1", 32));
  return cachedKey;
}

const mac = (id: Buffer) => createHmac("sha256", key()).update(id).digest().subarray(0, MAC_BYTES);

export function createVoucherCardToken(voucherId: string): string {
  const hex = voucherId.replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(hex)) throw new Error("invalid_voucher_id");
  const id = Buffer.from(hex, "hex");
  return Buffer.concat([id, mac(id)]).toString("base64url");
}

/** The voucher id behind a card token, or null when the token is not ours. */
export function verifyVoucherCardToken(token: string): string | null {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return null;
  const raw = Buffer.from(token, "base64url");
  if (raw.length !== 32 || raw.toString("base64url") !== token) return null;
  const id = raw.subarray(0, 16);
  if (!timingSafeEqual(raw.subarray(16), mac(id))) return null;
  const h = id.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
