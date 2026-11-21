// Server-only: signed "continue your book" links (/[locale]/continue/[token]) sent to the
// OWNER's own inbox (send-preview email + abandoned-preview reminders). Unlike the read-only
// share token (./preview-share-token.ts), this one moves the story to whoever opens it, so
// a parent who made the book in Instagram's in-app browser can buy it from Gmail or Safari.
//
// Stateless HMAC token (no table): base64url( v | storyId(16) | exp(u32 BE) | emailTag(8) | mac(16) )
//   - key = HKDF-SHA256(SUPABASE_SERVICE_ROLE_KEY, info "meapica:story-claim:v1"): its own
//     key, so a share token can never pass as a claim token (or the reverse);
//   - emailTag = HMAC(key, "email:" + address) truncated to 64 bits: the link is bound to
//     the address it was sent to without putting that address in the URL;
//   - mac = HMAC(key, payload) truncated to 128 bits, compared in constant time;
//   - exp = issue time + 30 days, NOT rounded up: every link-carrying send also touches
//     stories.updated_at, so the guest purge (30 days without activity) can never delete
//     the story while one of its links still works.
// The claim itself (src/app/api/stories/claim/route.ts) only ever moves a story that is
// still a preview owned by a guest; a registered account or a paid book is never moved.

import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

const VERSION = 1;
const MAC_BYTES = 16;
const TAG_BYTES = 8;
const PAYLOAD_BYTES = 1 + 16 + 4 + TAG_BYTES;
const TOKEN_BYTES = PAYLOAD_BYTES + MAC_BYTES; // 45 → 60 base64url chars
const TOKEN_RE = /^[A-Za-z0-9_-]{60}$/;
const UUID_HEX_RE = /^[0-9a-f]{32}$/i;

export const CLAIM_LINK_TTL_DAYS = 30;

let cachedKey: Buffer | null = null;

function claimKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY (claim-token key material)");
  cachedKey = Buffer.from(hkdfSync("sha256", secret, "", "meapica:story-claim:v1", 32));
  return cachedKey;
}

const hmac = (data: Buffer | string, bytes: number) => createHmac("sha256", claimKey()).update(data).digest().subarray(0, bytes);
const emailTag = (email: string) => hmac(`email:${email.trim().toLowerCase()}`, TAG_BYTES);

export function createStoryClaimToken(storyId: string, email: string, now: Date = new Date()): { token: string; expiresAt: Date } {
  const hex = storyId.replace(/-/g, "");
  if (!UUID_HEX_RE.test(hex)) throw new Error("invalid_story_id");
  if (!email.trim()) throw new Error("invalid_email");
  const exp = Math.floor(now.getTime() / 1000) + CLAIM_LINK_TTL_DAYS * 86_400;
  const payload = Buffer.alloc(PAYLOAD_BYTES);
  payload.writeUInt8(VERSION, 0);
  Buffer.from(hex, "hex").copy(payload, 1);
  payload.writeUInt32BE(exp, 17);
  emailTag(email).copy(payload, 21);
  return { token: Buffer.concat([payload, hmac(payload, MAC_BYTES)]).toString("base64url"), expiresAt: new Date(exp * 1000) };
}

export type ClaimTokenResult = { ok: true; storyId: string; expiresAt: Date } | { ok: false; reason: "invalid" | "expired" };

/** `email`, when given, must be the address the link was sent to. */
export function verifyStoryClaimToken(token: string, opts: { now?: Date; email?: string } = {}): ClaimTokenResult {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return { ok: false, reason: "invalid" };
  const raw = Buffer.from(token, "base64url");
  if (raw.length !== TOKEN_BYTES || raw.toString("base64url") !== token || raw.readUInt8(0) !== VERSION) {
    return { ok: false, reason: "invalid" };
  }
  const payload = raw.subarray(0, PAYLOAD_BYTES);
  if (!timingSafeEqual(raw.subarray(PAYLOAD_BYTES), hmac(payload, MAC_BYTES))) return { ok: false, reason: "invalid" };
  if (opts.email !== undefined && !timingSafeEqual(payload.subarray(21), emailTag(opts.email))) return { ok: false, reason: "invalid" };
  const exp = payload.readUInt32BE(17);
  if (exp * 1000 <= (opts.now ?? new Date()).getTime()) return { ok: false, reason: "expired" };
  const h = payload.subarray(1, 17).toString("hex");
  const storyId = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  return { ok: true, storyId, expiresAt: new Date(exp * 1000) };
}

/** Absolute "continue your book" URL in the given locale. */
export function storyClaimUrl(siteUrl: string, locale: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/${locale}/continue/${token}`;
}
