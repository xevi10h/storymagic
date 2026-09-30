// Server-only: signed, read-only share tokens for a story PREVIEW (/[locale]/preview/[token]).
//
// Stateless HMAC token (no table): base64url( v | storyId(16) | exp(u32 BE, unix s) | mac(16) )
//   - mac = HMAC-SHA256(key, v | storyId | exp) truncated to 128 bits → unforgeable, so
//     story ids cannot be enumerated (an invalid token never reaches the database);
//   - key = HKDF-SHA256(SUPABASE_SERVICE_ROLE_KEY, info "meapica:story-preview-share:v1"):
//     an existing server secret with domain separation. Rotating that key invalidates
//     every share link (acceptable: owners can create a new one in one tap);
//   - exp = now + 30 days rounded UP to the next UTC midnight, so the same story gets
//     the same link all day (sharing twice does not produce two different links).
// Revocation: deleting the story (or rotating the key) kills its links. Per-link
// revocation would need a table — see docs/technical-architecture.md.
//
// The token only grants the PREVIEW (lib/share/shared-preview.ts): never paid content.

import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

const VERSION = 1;
const MAC_BYTES = 16;
const PAYLOAD_BYTES = 1 + 16 + 4;
const TOKEN_BYTES = PAYLOAD_BYTES + MAC_BYTES; // 37 → 50 base64url chars
const TOKEN_RE = /^[A-Za-z0-9_-]{50}$/;
const DAY_S = 24 * 60 * 60;

export const SHARE_LINK_TTL_DAYS = 30;

/** Story statuses whose preview can be shared (same as the "send me the preview" email). */
export const SHAREABLE_STORY_STATUSES = ["preview", "ready", "ordered", "shipped"] as const;

let cachedKey: Buffer | null = null;

function shareKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY (share-token key material)");
  cachedKey = Buffer.from(hkdfSync("sha256", secret, "", "meapica:story-preview-share:v1", 32));
  return cachedKey;
}

function mac(payload: Buffer): Buffer {
  return createHmac("sha256", shareKey()).update(payload).digest().subarray(0, MAC_BYTES);
}

function uuidToBytes(uuid: string): Buffer | null {
  const hex = uuid.replace(/-/g, "");
  return /^[0-9a-f]{32}$/i.test(hex) ? Buffer.from(hex, "hex") : null;
}

function bytesToUuid(b: Buffer): string {
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function createPreviewShareToken(storyId: string, now: Date = new Date()): { token: string; expiresAt: Date } {
  const id = uuidToBytes(storyId);
  if (!id) throw new Error("invalid_story_id");
  const exp = Math.ceil((Math.floor(now.getTime() / 1000) + SHARE_LINK_TTL_DAYS * DAY_S) / DAY_S) * DAY_S;
  const payload = Buffer.alloc(PAYLOAD_BYTES);
  payload.writeUInt8(VERSION, 0);
  id.copy(payload, 1);
  payload.writeUInt32BE(exp, 17);
  const token = Buffer.concat([payload, mac(payload)]).toString("base64url");
  return { token, expiresAt: new Date(exp * 1000) };
}

export type ShareTokenResult =
  | { ok: true; storyId: string; expiresAt: Date }
  | { ok: false; reason: "invalid" | "expired" };

export function verifyPreviewShareToken(token: string, now: Date = new Date()): ShareTokenResult {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return { ok: false, reason: "invalid" };
  const raw = Buffer.from(token, "base64url");
  // Canonical encoding only (the last char carries spare bits: one token, one string).
  if (raw.length !== TOKEN_BYTES || raw.toString("base64url") !== token || raw.readUInt8(0) !== VERSION) {
    return { ok: false, reason: "invalid" };
  }
  const payload = raw.subarray(0, PAYLOAD_BYTES);
  if (!timingSafeEqual(raw.subarray(PAYLOAD_BYTES), mac(payload))) return { ok: false, reason: "invalid" };
  const exp = payload.readUInt32BE(17);
  if (exp * 1000 <= now.getTime()) return { ok: false, reason: "expired" };
  return { ok: true, storyId: bytesToUuid(payload.subarray(1, 17)), expiresAt: new Date(exp * 1000) };
}

/** Absolute share URL for a story preview in the given locale. */
export function previewShareUrl(siteUrl: string, locale: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/${locale}/preview/${token}`;
}
