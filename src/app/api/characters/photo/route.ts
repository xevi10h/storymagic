import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, checkMemoryRateLimit } from "@/lib/rate-limit";
import { isPhotoUploadEnabled, isOwnedPhotoPath } from "@/lib/privacy/child-photo-policy";
import {
  PhotoRejectedError,
  childPhotoAdmin,
  deleteChildPhoto,
  normalizeChildPhoto,
  parsePhotoUploadForm,
  storeChildPhoto,
} from "@/lib/privacy/child-photo";

// sharp (native) → Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const RATE_LIMITED = { error: "rate_limited" };

/** Status per validation error (the UI maps `error` to localized copy). */
const ERROR_STATUS: Record<string, number> = {
  consent_required: 400,
  consent_version_mismatch: 400,
  invalid_locale: 400,
  missing_file: 400,
  too_large: 413,
  unsupported_type: 415,
  invalid_image: 422,
  too_small: 422,
};

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * POST /api/characters/photo — upload the child's photo (multipart/form-data).
 *
 * Fields: photo (file ≤ 4 MB, JPEG/PNG/WebP), consent="true",
 * consentVersion=PHOTO_CONSENT_VERSION, locale=es|ca|en|fr.
 * Auth: Supabase session (the creation flow signs guests in anonymously).
 *
 * The image is re-encoded server-side (JPEG, ≤ 1536 px, ALL metadata incl.
 * EXIF/GPS stripped) into the private child-photos bucket, and the parental
 * consent is recorded in photo_consents. The photo is deleted right after the
 * avatar/child sheet is created and at most 24 h later (purge cron).
 *
 * 200 { photoPath }  ·  400/413/415/422 { error }  ·  401  ·  404 (feature off)  ·  429  ·  500
 */
export async function POST(request: Request) {
  if (!isPhotoUploadEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipLimit = checkMemoryRateLimit(`photo:${clientIp}`, { maxRequests: 30, windowSeconds: 3600 });
  if (!ipLimit.allowed) {
    return NextResponse.json(RATE_LIMITED, { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds ?? 3600) } });
  }

  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }
  const parsed = parsePhotoUploadForm(form);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: ERROR_STATUS[parsed.error] ?? 400 });

  const userLimit = await checkRateLimit(userId, "upload_photo");
  if (!userLimit.allowed) {
    return NextResponse.json(RATE_LIMITED, { status: 429, headers: { "Retry-After": String(userLimit.retryAfterSeconds ?? 3600) } });
  }

  try {
    const { data } = await normalizeChildPhoto(Buffer.from(await parsed.file.arrayBuffer()));
    const photoPath = await storeChildPhoto(childPhotoAdmin(), userId, data, parsed.consent);
    console.log(`[photo] stored ${photoPath} (consent ${parsed.consent.consentVersion}/${parsed.consent.locale})`);
    return NextResponse.json({ photoPath });
  } catch (error: unknown) {
    if (error instanceof PhotoRejectedError) {
      return NextResponse.json({ error: error.reason }, { status: ERROR_STATUS[error.reason] ?? 400 });
    }
    // Message only: never the request body or image bytes.
    console.error(`[photo] upload failed for user ${userId}: ${error instanceof Error ? error.message : "unknown"}`);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
}

const deleteSchema = z.object({ photoPath: z.string().max(200) });

/**
 * DELETE /api/characters/photo — withdraw consent: delete the photo now.
 * Body: { photoPath }. Idempotent (an already-deleted photo returns 200).
 * Not gated by the feature flag: withdrawal must always work.
 *
 * 200 { deleted: true }  ·  400  ·  401  ·  403 (not the caller's)  ·  500 (purge cron retries)
 */
export async function DELETE(request: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  if (!isOwnedPhotoPath(parsed.data.photoPath, userId)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { ok } = await deleteChildPhoto(parsed.data.photoPath, userId);
  if (!ok) return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
