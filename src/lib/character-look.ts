// Character look — request validation shared by POST /api/characters/prepare and
// POST /api/stories (the client builds both bodies with characterLookPayload in
// src/lib/creation-flow.ts). Pure: safe on client and server.

import { z } from "zod";
import { AVATAR_GLASSES_OPTIONS, type AvatarGlasses } from "@/lib/avatar/manifest";
import { getSiteUrl } from "@/lib/email/send";
import { isValidPhotoPath } from "@/lib/privacy/child-photo-policy";

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
 * Body of POST /api/characters/portrait (legacy AI portrait, not called by the v2 UI).
 * It never takes the child's photo: the only photo path is /api/characters/photo-portrait.
 * Any photo field is a 400.
 */
export const portraitInputSchema = z.object({
  childName: z.string().min(1).max(50),
  gender: z.enum(["boy", "girl", "neutral"]),
  age: z.number().int().min(1).max(12),
  skinTone: z.string().max(20).optional(),
  hairColor: z.string().max(20).optional(),
  eyeColor: z.string().max(20).optional(),
  hairstyle: z.string().max(30).optional(),
  interests: z.array(z.string().max(50)).max(4).optional(),
  favoriteColor: z.string().max(20).optional(),
  favoriteCompanion: z.string().max(100).optional(),
  futureDream: z.string().max(150).optional(),
  city: z.string().max(100).optional(),
  photoPath: z.never().optional(),
  keepPhotoForSheet: z.never().optional(),
});

/** Body of POST /api/characters/prepare (client: characterPrepareBody in src/lib/creation-flow.ts). */
export const prepareInputSchema = z
  .object({
    // Same look fields as POST /api/stories (client: characterLookPayload), so the
    // Bible hash of the prep equals the story's.
    ...characterLookShape,
    /** Pre-rendered watercolor avatar base, e.g. "/images/avatar/girl/light/brown-bob.webp" */
    avatarAssetPath: avatarAssetPathSchema.optional(),
    /**
     * The caller's own portrait (signed URL or object path): the photo-mode drawing from
     * POST /api/characters/photo-portrait (or a legacy AI portrait). Only the caller's own is used.
     */
    portraitUrl: z.string().max(2000).optional(),
    /** Not accepted since 2026-11-09: the photo is deleted once its portrait is drawn, the sheet anchors on that portrait. */
    photoPath: z.never().optional(),
  })
  .refine((d) => !(d.avatarAssetPath && d.portraitUrl), "Send either avatarAssetPath or portraitUrl, not both");

/**
 * Body of POST /api/characters/photo-portrait: the uploaded photo + what the parent chose
 * on screen 1 (gender, age) and the favourite colour (the outfit's jacket). Nothing about
 * the look: that comes from the photo.
 */
export const photoPortraitInputSchema = z.object({
  photoPath: z.string().max(200).refine(isValidPhotoPath, "invalid photoPath"),
  gender: characterLookShape.gender,
  age: characterLookShape.age,
  favoriteColor: characterLookShape.favoriteColor,
});

/**
 * Absolute URL the server downloads an avatar asset from: our own public site
 * (NEXT_PUBLIC_SITE_URL, default https://meapica.es). Never derived from the
 * request (Host / forwarded headers are client-influenced → SSRF). The path must
 * pass the strict avatar regex. Returns null for anything else. Server code loads
 * avatars through loadAvatarReference (book-images.ts), which reads the file from
 * /public when present (local dev) and only downloads from this URL otherwise.
 */
export function avatarAssetUrl(ref: string | null | undefined): string | null {
  return isAvatarAssetPath(ref) ? `${getSiteUrl()}${ref}` : null;
}
