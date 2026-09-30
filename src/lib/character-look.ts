// Character look — request validation shared by POST /api/characters/prepare and
// POST /api/stories (the client builds both bodies with characterLookPayload in
// src/lib/creation-flow.ts). Pure: safe on client and server.

import { z } from "zod";
import { AVATAR_GLASSES_OPTIONS, type AvatarGlasses } from "@/lib/avatar/manifest";
import { getSiteUrl } from "@/lib/email/send";

export const glassesSchema = z.enum(AVATAR_GLASSES_OPTIONS as [AvatarGlasses, ...AvatarGlasses[]]);

/** The fields the Character Bible is built from (same limits as the stories/portrait routes). */
export const characterLookShape = {
  gender: z.enum(["boy", "girl", "neutral"]),
  age: z.number().int().min(1).max(12),
  skinTone: z.string().max(20).optional(),
  hairColor: z.string().max(20).optional(),
  eyeColor: z.string().max(20).optional(),
  hairstyle: z.string().max(30).optional(),
  favoriteColor: z.string().max(20).optional(),
  glasses: glassesSchema.optional(),
  freckles: z.boolean().optional(),
};

/**
 * Pre-rendered watercolor avatar base served from /public (src/lib/avatar/manifest.ts),
 * e.g. "/images/avatar/girl/light/brown-bob.webp". Never a query string, never "..".
 */
export const AVATAR_ASSET_PATH_RE = /^\/images\/avatar\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\.(?:webp|png|jpe?g)$/;

export function isAvatarAssetPath(value: unknown): value is string {
  return typeof value === "string" && value.length <= 200 && AVATAR_ASSET_PATH_RE.test(value);
}

export const avatarAssetPathSchema = z.string().max(200).regex(AVATAR_ASSET_PATH_RE, "avatarAssetPath must be under /images/avatar/");

/**
 * Absolute URL the server downloads an avatar asset from: our own public site
 * (NEXT_PUBLIC_SITE_URL, default https://meapica.shop). Never derived from the
 * request (Host / forwarded headers are client-influenced → SSRF). The path must
 * pass the strict avatar regex. Returns null for anything else. Server code loads
 * avatars through loadAvatarReference (book-images.ts), which reads the file from
 * /public when present (local dev) and only downloads from this URL otherwise.
 */
export function avatarAssetUrl(ref: string | null | undefined): string | null {
  return isAvatarAssetPath(ref) ? `${getSiteUrl()}${ref}` : null;
}
