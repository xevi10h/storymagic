// Child photo storage — SERVER ONLY (service role).
//
// Lifecycle (owner decision 2026-09-27):
//   POST /api/characters/photo    → normalizeChildPhoto → storeChildPhoto (+ consent row)
//   POST /api/characters/portrait → loadChildPhoto (bytes, never a URL) → avatar
//                                 → deleteChildPhoto (unless the early child sheet follows,
//                                   whose step then calls deleteChildPhoto itself)
//   DELETE /api/characters/photo  → deleteChildPhoto (consent withdrawn)
//   GET /api/cron/purge-photos    → purgeExpiredChildPhotos (hourly, > 24 h)
//
// Privacy rules: bytes never leave the server except to OpenAI (as request body);
// no public/signed URL is ever created; logs carry only ids and counts, never
// image data or URLs.
//
// Only relative + package imports (no "@/" alias) so the runnable check
// (child-photo.check.mjs) can import this module directly with Node.

import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ImageReference } from "../ai/openai-image";
import {
  CHILD_PHOTO_BUCKET,
  PHOTO_ACCEPTED_FORMATS,
  PHOTO_MAX_EDGE,
  PHOTO_MAX_UPLOAD_BYTES,
  PHOTO_MIN_EDGE,
  buildPhotoPath,
  isOwnedPhotoPath,
  parsePhotoConsent,
  photoPurgeCutoff,
  type PhotoConsent,
  type PhotoConsentError,
} from "./child-photo-policy";

// ── Errors ───────────────────────────────────────────────────────────────────

export type PhotoRejectReason = "missing_file" | "too_large" | "unsupported_type" | "invalid_image" | "too_small";

/** The uploaded file is not an acceptable photo (maps to a 4xx). */
export class PhotoRejectedError extends Error {
  readonly reason: PhotoRejectReason;
  constructor(reason: PhotoRejectReason) {
    super(`Photo rejected: ${reason}`);
    this.reason = reason;
    this.name = "PhotoRejectedError";
  }
}

/** The photo is gone (deleted, withdrawn, purged) or not the caller's (maps to 410). */
export class PhotoUnavailableError extends Error {
  constructor() {
    super("Child photo unavailable");
    this.name = "PhotoUnavailableError";
  }
}

// ── Service client ───────────────────────────────────────────────────────────

let adminClient: SupabaseClient | null = null;

/** Lazy service-role client (bypasses RLS; child-photos has no client policies). */
export function childPhotoAdmin(): SupabaseClient {
  if (!adminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !key) throw new Error("Supabase service role not configured");
    adminClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return adminClient;
}

// ── Upload parsing + normalization ───────────────────────────────────────────

export type ParsedPhotoUpload =
  | { ok: true; file: Blob; consent: PhotoConsent }
  | { ok: false; error: PhotoConsentError | PhotoRejectReason };

/**
 * Validates the multipart form of POST /api/characters/photo:
 *   photo (file), consent ("true"), consentVersion, locale.
 * Consent is checked BEFORE the file, so no bytes are processed without it.
 */
export function parsePhotoUploadForm(form: FormData): ParsedPhotoUpload {
  const consent = parsePhotoConsent({
    consent: form.get("consent"),
    consentVersion: form.get("consentVersion"),
    locale: form.get("locale"),
  });
  if (!consent.ok) return { ok: false, error: consent.error };
  const file = form.get("photo");
  if (!(file instanceof Blob) || file.size === 0) return { ok: false, error: "missing_file" };
  if (file.size > PHOTO_MAX_UPLOAD_BYTES) return { ok: false, error: "too_large" };
  return { ok: true, file, consent: consent.consent };
}

/**
 * Decodes the upload (whatever its declared MIME type — the real format is
 * sniffed by libvips), applies the EXIF orientation, downsizes to
 * PHOTO_MAX_EDGE and re-encodes as a plain sRGB JPEG. sharp drops ALL metadata
 * (EXIF incl. GPS, XMP, IPTC, ICC, comments) unless asked to keep it — we never ask.
 */
export async function normalizeChildPhoto(input: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  if (input.length === 0) throw new PhotoRejectedError("missing_file");
  if (input.length > PHOTO_MAX_UPLOAD_BYTES) throw new PhotoRejectedError("too_large");
  let format: string | undefined;
  try {
    // limitInputPixels guards against decompression bombs (~50 MP covers any phone camera).
    const meta = await sharp(input, { limitInputPixels: 50_000_000 }).metadata();
    format = meta.format;
  } catch {
    throw new PhotoRejectedError("invalid_image");
  }
  if (!format || !(PHOTO_ACCEPTED_FORMATS as readonly string[]).includes(format)) {
    throw new PhotoRejectedError("unsupported_type");
  }
  try {
    const { data, info } = await sharp(input, { limitInputPixels: 50_000_000, failOn: "error" })
      .autoOrient()
      .resize({ width: PHOTO_MAX_EDGE, height: PHOTO_MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    if (Math.min(info.width, info.height) < PHOTO_MIN_EDGE) throw new PhotoRejectedError("too_small");
    return { data, width: info.width, height: info.height };
  } catch (err) {
    if (err instanceof PhotoRejectedError) throw err;
    throw new PhotoRejectedError("invalid_image");
  }
}

// ── Storage ──────────────────────────────────────────────────────────────────

/**
 * Stores the normalized JPEG at child-photos/{userId}/{uuid}.jpg and records the
 * parental consent. If the consent row can't be written, the object is removed
 * (no photo without a consent record). Returns the object path.
 */
export async function storeChildPhoto(
  admin: SupabaseClient,
  userId: string,
  jpeg: Buffer,
  consent: PhotoConsent,
): Promise<string> {
  const photoPath = buildPhotoPath(userId.toLowerCase(), randomUUID());
  const { error: uploadErr } = await admin.storage
    .from(CHILD_PHOTO_BUCKET)
    .upload(photoPath, jpeg, { contentType: "image/jpeg", upsert: false, cacheControl: "no-store" });
  if (uploadErr) throw new Error(`child photo upload failed: ${uploadErr.message}`);

  const { error: consentErr } = await admin.from("photo_consents").insert({
    user_id: userId,
    photo_path: photoPath,
    consent_version: consent.consentVersion,
    locale: consent.locale,
  });
  if (consentErr) {
    await admin.storage.from(CHILD_PHOTO_BUCKET).remove([photoPath]);
    throw new Error(`photo consent insert failed: ${consentErr.message}`);
  }
  return photoPath;
}

/**
 * Downloads the photo bytes for an OpenAI reference (never a URL). Throws
 * PhotoUnavailableError when the path is not the user's, consent was withdrawn,
 * or the photo was already deleted.
 */
export async function loadChildPhoto(
  photoPath: string,
  userId: string,
  admin: SupabaseClient = childPhotoAdmin(),
): Promise<ImageReference> {
  if (!isOwnedPhotoPath(photoPath, userId)) throw new PhotoUnavailableError();
  const { data: row, error } = await admin
    .from("photo_consents")
    .select("id")
    .eq("photo_path", photoPath)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`photo consent lookup failed: ${error.message}`);
  if (!row) throw new PhotoUnavailableError();
  const { data: blob, error: dlErr } = await admin.storage.from(CHILD_PHOTO_BUCKET).download(photoPath);
  if (dlErr || !blob) throw new PhotoUnavailableError();
  return { data: Buffer.from(await blob.arrayBuffer()), mime: "image/jpeg" };
}

/**
 * Deletes the child's photo NOW and marks the consent row deleted. Idempotent
 * (deleting an already-deleted photo is a no-op success) and never throws: a
 * failure is logged (ids only) and left to the hourly purge.
 *
 * Callers: the portrait route (right after the avatar), the early child sheet
 * step (right after the sheet), DELETE /api/characters/photo (withdrawal).
 */
export async function deleteChildPhoto(
  photoPath: string,
  userId: string,
  admin?: SupabaseClient,
): Promise<{ ok: boolean }> {
  if (!isOwnedPhotoPath(photoPath, userId)) return { ok: false };
  try {
    const client = admin ?? childPhotoAdmin();
    const { error: rmErr } = await client.storage.from(CHILD_PHOTO_BUCKET).remove([photoPath]);
    if (rmErr) {
      console.error(`[child-photo] delete failed for ${photoPath} (${rmErr.message}); purge cron will retry`);
      return { ok: false };
    }
    const { error: updErr } = await client
      .from("photo_consents")
      .update({ deleted_at: new Date().toISOString() })
      .eq("photo_path", photoPath)
      .eq("user_id", userId)
      .is("deleted_at", null);
    if (updErr) console.error(`[child-photo] deleted ${photoPath} but could not mark consent row (${updErr.message})`);
    return { ok: true };
  } catch (err) {
    console.error(`[child-photo] delete error for ${photoPath}: ${err instanceof Error ? err.message : "unknown"}`);
    return { ok: false };
  }
}

// ── Purge (hourly cron) ──────────────────────────────────────────────────────

export interface PurgeResult {
  cutoff: string;
  /** Objects removed (or confirmed absent) this run */
  removed: number;
  /** Consent rows newly marked deleted */
  consentsMarked: number;
  /** Paths whose removal failed (retried next hour) */
  failed: number;
}

const REMOVE_CHUNK = 100;
const PURGE_LIMIT = 500;

/**
 * Deletes every child photo older than 24 h: all objects in the bucket past the
 * cutoff (orphans included) plus every still-open consent row past the cutoff
 * (its object may already be gone — remove() on a missing object is a no-op).
 * Marks those consent rows deleted_at. Logs counts only.
 */
export async function purgeExpiredChildPhotos(admin: SupabaseClient, now: number = Date.now()): Promise<PurgeResult> {
  const cutoff = photoPurgeCutoff(now).toISOString();

  const { data: objects, error: listErr } = await admin.rpc("list_expired_child_photos", {
    p_older_than: cutoff,
    p_limit: PURGE_LIMIT,
  });
  if (listErr) throw new Error(`list_expired_child_photos failed: ${listErr.message}`);

  const { data: rows, error: rowsErr } = await admin
    .from("photo_consents")
    .select("photo_path")
    .is("deleted_at", null)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(PURGE_LIMIT);
  if (rowsErr) throw new Error(`photo_consents sweep failed: ${rowsErr.message}`);

  const paths = new Set<string>();
  for (const o of (objects ?? []) as Array<{ name: string }>) paths.add(o.name);
  for (const r of (rows ?? []) as Array<{ photo_path: string }>) paths.add(r.photo_path);

  const all = [...paths];
  const removed: string[] = [];
  let failed = 0;
  for (let i = 0; i < all.length; i += REMOVE_CHUNK) {
    const chunk = all.slice(i, i + REMOVE_CHUNK);
    const { error } = await admin.storage.from(CHILD_PHOTO_BUCKET).remove(chunk);
    if (error) {
      failed += chunk.length;
      console.error(`[purge-photos] remove failed for ${chunk.length} object(s): ${error.message}`);
    } else {
      removed.push(...chunk);
    }
  }

  let consentsMarked = 0;
  for (let i = 0; i < removed.length; i += REMOVE_CHUNK) {
    const chunk = removed.slice(i, i + REMOVE_CHUNK);
    const { data: marked, error } = await admin
      .from("photo_consents")
      .update({ deleted_at: new Date(now).toISOString() })
      .in("photo_path", chunk)
      .is("deleted_at", null)
      .select("id");
    if (error) console.error(`[purge-photos] could not mark ${chunk.length} consent row(s): ${error.message}`);
    else consentsMarked += marked?.length ?? 0;
  }

  return { cutoff, removed: removed.length, consentsMarked, failed };
}
