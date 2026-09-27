// Child photo policy — pure, dependency-free (safe to import from client code
// and from `node --experimental-strip-types` checks).
//
// Owner decision 2026-09-27: the child's photo is used ONLY to create the avatar
// portrait and the early child character sheet, then deleted immediately. An
// hourly cron purges any leftover older than PHOTO_MAX_AGE_HOURS. Preview and
// final book never see the photo. Upload ships behind
// NEXT_PUBLIC_PHOTO_UPLOAD_ENABLED (default off) until the DPIA + OpenAI DPA exist.

export const CHILD_PHOTO_BUCKET = "child-photos";

/**
 * Version of the consent copy (crear.photo.* in src/messages). Bump it whenever
 * that copy changes; the upload route rejects any other value so every consent
 * row points at the exact wording the parent accepted.
 */
export const PHOTO_CONSENT_VERSION = "2026-09-27";

export const PHOTO_LOCALES = ["es", "ca", "en", "fr"] as const;
export type PhotoLocale = (typeof PHOTO_LOCALES)[number];

/**
 * Max upload size. Vercel Functions reject request bodies above 4.5 MB before our
 * code runs, so the UI must downscale on the client (e.g. canvas → JPEG, long
 * edge ≤ 2048 px) before posting; 4 MB leaves room for multipart overhead.
 */
export const PHOTO_MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
/** Long edge of the stored (re-encoded) photo. */
export const PHOTO_MAX_EDGE = 1536;
/** Smallest accepted short edge: below this a face can't guide the portrait. */
export const PHOTO_MIN_EDGE = 256;
/** Public promise: "la borramos en menos de 24 horas". */
export const PHOTO_MAX_AGE_HOURS = 24;

/** Decoded formats we accept (sharp `metadata().format`). HEIC is not decodable by sharp's prebuilt libvips. */
export const PHOTO_ACCEPTED_FORMATS = ["jpeg", "png", "webp"] as const;

/** Feature flag (build-time inlined on the client). Default off. */
export function isPhotoUploadEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PHOTO_UPLOAD_ENABLED === "true";
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PHOTO_PATH_RE = new RegExp(`^(${UUID})/(${UUID})\\.jpg$`);

/** `{userId}/{uuid}.jpg` */
export function buildPhotoPath(userId: string, id: string): string {
  const path = `${userId}/${id}.jpg`;
  if (!PHOTO_PATH_RE.test(path)) throw new Error("Invalid photo path components");
  return path;
}

/** Syntactically valid photo path (no traversal, no other folders, lowercase uuids). */
export function isValidPhotoPath(path: unknown): path is string {
  return typeof path === "string" && PHOTO_PATH_RE.test(path);
}

/** The path belongs to this user (first folder = their auth id). */
export function isOwnedPhotoPath(path: unknown, userId: string): path is string {
  if (!isValidPhotoPath(path)) return false;
  return path.slice(0, path.indexOf("/")) === userId.toLowerCase();
}

export type PhotoConsentError = "consent_required" | "consent_version_mismatch" | "invalid_locale";

export interface PhotoConsent {
  consentVersion: string;
  locale: PhotoLocale;
}

/** Validates the consent fields posted with the photo. */
export function parsePhotoConsent(fields: {
  consent: unknown;
  consentVersion: unknown;
  locale: unknown;
}): { ok: true; consent: PhotoConsent } | { ok: false; error: PhotoConsentError } {
  if (fields.consent !== "true" && fields.consent !== true) return { ok: false, error: "consent_required" };
  if (fields.consentVersion !== PHOTO_CONSENT_VERSION) return { ok: false, error: "consent_version_mismatch" };
  if (typeof fields.locale !== "string" || !(PHOTO_LOCALES as readonly string[]).includes(fields.locale)) {
    return { ok: false, error: "invalid_locale" };
  }
  return { ok: true, consent: { consentVersion: fields.consentVersion, locale: fields.locale as PhotoLocale } };
}

/** Cutoff for the purge: anything created before this instant must be gone. */
export function photoPurgeCutoff(now: number): Date {
  return new Date(now - PHOTO_MAX_AGE_HOURS * 3_600_000);
}
