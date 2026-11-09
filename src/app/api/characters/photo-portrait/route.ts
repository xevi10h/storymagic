import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { renderPhotoPortrait } from "@/lib/ai/book-images";
import { deriveTraitsFromPortrait } from "@/lib/ai/photo-traits";
import { uploadGeneratedImage } from "@/lib/supabase/storage";
import { portraitFolder } from "@/lib/storage/illustration-refs";
import { ILLUSTRATION_URL_TTL, getIllustrationUrl, userAccess } from "@/lib/storage/illustration-urls";
import { getMockPortraitUrl } from "@/lib/ai/mock-story";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, checkMemoryRateLimit } from "@/lib/rate-limit";
import { providerOutageRetryAfter, tripOnProviderOutage } from "@/lib/ai/provider-outage";
import { photoPortraitInputSchema } from "@/lib/character-look";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { DAILY_CAP_ERROR, isDailyPreviewCapFull } from "@/lib/preview-cap-server";
import { checkGuestIpCap, isGuest } from "@/lib/guest-caps";
import { refuseBot } from "@/lib/botid/server";
import { PhotoUnavailableError, childPhotoAdmin, deleteChildPhoto, loadChildPhoto } from "@/lib/privacy/child-photo";
import { isOwnedPhotoPath, isPhotoUploadEnabled } from "@/lib/privacy/child-photo-policy";
import { defaultPhotoTraits } from "@/lib/photo-traits";

// Portrait (gpt-image-2.5-flare, medium) ~15–25 s + the traits read ~3–8 s.
export const maxDuration = 90;

/**
 * POST /api/characters/photo-portrait
 *
 * Photo mode, right after the upload: draws the child's illustrated portrait in the
 * book's style with the photo as the ONLY identity reference (no trait text), deletes
 * the photo, then reads the traits FROM THE DRAWING (one vision call restricted to the
 * builder's ids). The drawing is the face anchor of the character sheet and the book
 * (sent as `portraitUrl` to /api/characters/prepare and /api/stories); the traits only
 * write the Character Bible text.
 *
 * Request:  { photoPath, gender, age, favoriteColor? }
 * Response: 200 { portraitUrl (24 h signed URL), portraitPath (portraits/<uid>/…), traits }
 * Errors:   400 invalid / photo_upload_disabled · 401 · 403 bot / not the caller's photo ·
 *           410 photo_unavailable (already used, withdrawn or purged → upload again) ·
 *           429 rate_limited · 503 provider_unavailable / daily cap · 500 generation_failed
 *
 * Photo lifecycle: deleted the moment the render returns (success), before anything else
 * can fail. A render that fails keeps it so the parent can retry with the same upload;
 * the hourly purge cron removes anything older than 24 h either way.
 */
const RATE_LIMITED = { error: "rate_limited" };
const PROVIDER_UNAVAILABLE = { error: "provider_unavailable" };

export async function POST(request: Request) {
  const outageRetryAfter = providerOutageRetryAfter();
  if (outageRetryAfter > 0) {
    return NextResponse.json(PROVIDER_UNAVAILABLE, { status: 503, headers: { "Retry-After": String(outageRetryAfter) } });
  }

  // Per-IP window shared with the other portrait routes (per instance, best effort).
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipLimit = checkMemoryRateLimit(`portrait:${clientIp}`, { maxRequests: 30, windowSeconds: 3600 });
  if (!ipLimit.allowed) {
    return NextResponse.json(RATE_LIMITED, { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds ?? 3600) } });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = photoPortraitInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { photoPath, gender, age, favoriteColor } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Vercel BotID (invisible): bot → 403 before anything is spent.
  const bot = await refuseBot("photo_portrait");
  if (bot) return bot;

  if (!isPhotoUploadEnabled()) return NextResponse.json({ error: "photo_upload_disabled" }, { status: 400 });
  if (!isOwnedPhotoPath(photoPath, user.id)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Durable per-user window (rate_limits), the portrait budget shared with prepare: 10/hour.
  const userLimit = await checkRateLimit(user.id, "generate_portrait");
  if (!userLimit.allowed) {
    return NextResponse.json(RATE_LIMITED, { status: 429, headers: { "Retry-After": String(userLimit.retryAfterSeconds ?? 3600) } });
  }

  if (process.env.MOCK_MODE === "true") {
    // Free local QA: placeholder drawing + builder defaults, and the photo is deleted like in production.
    const deleted = await deleteChildPhoto(photoPath, user.id);
    if (!deleted.ok) console.error("[PhotoPortrait] mock: child photo deletion failed (the purge cron removes it)");
    const portraitUrl = getMockPortraitUrl();
    return NextResponse.json({ portraitUrl, portraitPath: portraitUrl, traits: defaultPhotoTraits(gender) });
  }

  // Global daily preview cap full: no paid portrait either.
  if (await isDailyPreviewCapFull(createFulfilmentClient())) {
    return NextResponse.json({ error: DAILY_CAP_ERROR }, { status: 503 });
  }
  // Guests: per-IP daily cap, second layer behind BotID.
  if (isGuest(user)) {
    const cap = await checkGuestIpCap(request, "guest_ip_portrait");
    if (!cap.allowed) {
      return NextResponse.json(RATE_LIMITED, { status: 429, headers: { "Retry-After": String(cap.retryAfterSeconds ?? 86_400) } });
    }
  }

  const admin = childPhotoAdmin();
  const label = `photo-portrait user ${user.id.slice(0, 8)}`;
  let photoDeleted = false;
  try {
    // Bytes only (ownership + open consent checked), never a URL; they live in this function's memory.
    let photo;
    try {
      photo = await loadChildPhoto(photoPath, user.id, admin);
    } catch (err) {
      if (err instanceof PhotoUnavailableError) return NextResponse.json({ error: "photo_unavailable" }, { status: 410 });
      throw err;
    }

    const started = Date.now();
    const render = await renderPhotoPortrait(photo, { gender, age, favoriteColor }, { label, deadline: started + 65_000 });

    // The photo's only job is done: delete it before anything else can fail.
    const deleted = await deleteChildPhoto(photoPath, user.id, admin);
    photoDeleted = true;
    if (!deleted.ok) console.error(`[PhotoPortrait] ${label}: child photo deletion failed (the purge cron removes it)`);

    // Store the drawing (private bucket, owner in the path) while the traits are read from it.
    const [portraitPath, read] = await Promise.all([
      uploadGeneratedImage(admin, portraitFolder(user.id, crypto.randomUUID()), "portrait", render.image, render.mime),
      deriveTraitsFromPortrait(render.image, gender, { label }),
    ]);
    const portraitUrl = await getIllustrationUrl(portraitPath, { ttl: ILLUSTRATION_URL_TTL.creation, allow: userAccess({ userId: user.id }) });
    if (!portraitUrl) throw new Error(`Portrait stored but could not be signed: ${portraitPath}`);

    console.log(
      `[PhotoPortrait] ${label} ready in ${((Date.now() - started) / 1000).toFixed(1)}s · image $${render.costUsd.toFixed(4)} · traits $${read.costUsd.toFixed(4)}${read.fallback ? " (defaults)" : ""}`,
    );
    return NextResponse.json({ portraitUrl, portraitPath, traits: read.traits });
  } catch (error: unknown) {
    // Message only, never the error object (it could carry request payloads).
    console.error(`[PhotoPortrait] ${label} failed${photoDeleted ? " after the render" : ""}: ${error instanceof Error ? error.message : String(error)}`);
    if (tripOnProviderOutage(error)) return NextResponse.json(PROVIDER_UNAVAILABLE, { status: 503 });
    return NextResponse.json({ error: "generation_failed" }, { status: 500 });
  }
}
