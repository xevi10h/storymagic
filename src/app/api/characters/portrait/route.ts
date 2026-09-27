import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { buildCharacterBible, renderPortrait } from "@/lib/ai/book-images";
import { uploadGeneratedImage } from "@/lib/supabase/storage";
import { portraitFolder } from "@/lib/storage/illustration-refs";
import { ILLUSTRATION_URL_TTL, getIllustrationUrl, userAccess } from "@/lib/storage/illustration-urls";
import { getMockPortraitUrl } from "@/lib/ai/mock-story";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, checkMemoryRateLimit } from "@/lib/rate-limit";
import { providerOutageRetryAfter, tripOnProviderOutage } from "@/lib/ai/provider-outage";
import { isOwnedPhotoPath, isPhotoUploadEnabled, isValidPhotoPath } from "@/lib/privacy/child-photo-policy";
import { PhotoUnavailableError, deleteChildPhoto, loadChildPhoto } from "@/lib/privacy/child-photo";

// OpenAI portrait (gpt-image-2.5-flare, medium) takes ~15–25 s.
export const maxDuration = 60;

const portraitInputSchema = z.object({
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
  /**
   * Optional child photo (POST /api/characters/photo → photoPath in the private
   * child-photos bucket). Facial likeness only. Read server-side as bytes, never
   * as a URL. Requires NEXT_PUBLIC_PHOTO_UPLOAD_ENABLED=true.
   */
  photoPath: z.string().max(200).refine(isValidPhotoPath, "invalid photoPath").optional(),
  /**
   * true = the caller renders the early child character sheet with the photo next
   * and deletes it itself (deleteChildPhoto). Default false: the photo is deleted
   * as soon as the portrait is stored.
   */
  keepPhotoForSheet: z.boolean().optional(),
});

/**
 * POST /api/characters/portrait
 *
 * Generates the child's AVATAR portrait in the book's watercolor style with the
 * OpenAI image engine (portrait stage: PORTRAIT_IMAGE_MODEL / _QUALITY, default
 * gpt-image-2.5-flare medium). The prompt is the Character Bible description —
 * the exact same bytes used later for the character sheet and every scene, so
 * the avatar shows the same child and the same outfit as the book.
 *
 * The image is stored in our own storage (versioned path) and saved by the UI
 * as character.avatar_url; the book's character sheets use it as the face anchor.
 *
 * With `photoPath`, the child's photo (private bucket, owned by the caller, consent
 * not withdrawn) is passed to OpenAI as a facial-likeness reference and deleted
 * right after the portrait is stored, unless `keepPhotoForSheet` (then the early
 * sheet step deletes it). A failed generation keeps the photo so the parent can
 * retry; the hourly purge deletes it within 24 h regardless.
 *
 * Returns: { portraitUrl (24 h signed URL of portraits/<userId>/…), recraftStyleId: null, photoDeleted } (recraftStyleId kept
 * for UI compatibility; photoDeleted only when a photo was sent).
 * Errors: 400 invalid / photo_upload_disabled · 401 · 403 photo not the caller's ·
 * 410 photo_unavailable (deleted/withdrawn/purged → re-upload) · 429 · 503 · 500.
 */
const RATE_LIMITED_RESPONSE = {
  error: "rate_limited",
  message: "Too many portrait generations. Please try again later.",
};

// Provider-outage circuit breaker: shared with /api/characters/prepare (src/lib/ai/provider-outage.ts).
const PROVIDER_UNAVAILABLE_RESPONSE = { error: "provider_unavailable" };

export async function POST(request: Request) {
  const outageRetryAfter = providerOutageRetryAfter();
  if (outageRetryAfter > 0) {
    return NextResponse.json(PROVIDER_UNAVAILABLE_RESPONSE, {
      status: 503,
      headers: { "Retry-After": String(outageRetryAfter) },
    });
  }

  try {
    // ── Abuse guards — every call costs real money (~$0.03) ─────────────────────
    // 1. Per-IP fixed window (first hop of x-forwarded-for). In-memory: catches
    //    naive loops even when the caller cycles anonymous sessions.
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipLimit = checkMemoryRateLimit(`portrait:${clientIp}`, {
      maxRequests: 30,
      windowSeconds: 3600,
    });
    if (!ipLimit.allowed) {
      return NextResponse.json(RATE_LIMITED_RESPONSE, {
        status: 429,
        headers: { "Retry-After": String(ipLimit.retryAfterSeconds ?? 3600) },
      });
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = portraitInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    // 2. Require a Supabase session — the creation flow signs guests in
    //    anonymously before calling, so this never blocks legitimate users.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3. Per-user durable fixed window (rate_limits table): 10 portraits/hour.
    const userLimit = await checkRateLimit(user.id, "generate_portrait");
    if (!userLimit.allowed) {
      return NextResponse.json(RATE_LIMITED_RESPONSE, {
        status: 429,
        headers: { "Retry-After": String(userLimit.retryAfterSeconds ?? 3600) },
      });
    }

    const {
      gender, age, skinTone, hairColor, eyeColor, hairstyle, favoriteColor, photoPath, keepPhotoForSheet,
    } = parsed.data;

    if (photoPath) {
      if (!isPhotoUploadEnabled()) return NextResponse.json({ error: "photo_upload_disabled" }, { status: 400 });
      if (!isOwnedPhotoPath(photoPath, user.id)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const photoResult = async () =>
      photoPath ? { photoDeleted: keepPhotoForSheet ? false : (await deleteChildPhoto(photoPath, user.id)).ok } : {};

    if (process.env.MOCK_MODE === "true") {
      return NextResponse.json({ portraitUrl: getMockPortraitUrl(), recraftStyleId: null, ...(await photoResult()) });
    }

    const photo = photoPath ? await loadChildPhoto(photoPath, user.id) : null;
    const bible = buildCharacterBible({ gender, age, skinTone, hairColor, eyeColor, hairstyle, favoriteColor });
    const result = await renderPortrait(bible, photo, { label: `portrait user ${user.id.slice(0, 8)}`, deadline: Date.now() + 55_000 });

    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    // Private bucket, owner encoded in the path (portraits/<userId>/...). The client
    // gets a 24 h signed URL; POST /api/stories stores the path parsed from it.
    const portraitPath = await uploadGeneratedImage(admin, portraitFolder(user.id, crypto.randomUUID()), "portrait", result.image, result.mime);
    const portraitUrl = await getIllustrationUrl(portraitPath, { ttl: ILLUSTRATION_URL_TTL.creation, allow: userAccess({ userId: user.id }) });
    if (!portraitUrl) throw new Error(`Portrait stored but could not be signed: ${portraitPath}`);
    // Owner decision: the photo lives only until the avatar exists.
    return NextResponse.json({ portraitUrl, recraftStyleId: null, ...(await photoResult()) });
  } catch (error: unknown) {
    if (error instanceof PhotoUnavailableError) {
      return NextResponse.json({ error: "photo_unavailable" }, { status: 410 });
    }
    // Message only — never the error object (it could carry request payloads).
    console.error(`[Portrait] Generation failed: ${error instanceof Error ? error.message : String(error)}`);
    // Never leak provider/backend error text to the client (parents see a
    // localized message keyed off `error`).
    if (tripOnProviderOutage(error)) {
      return NextResponse.json(PROVIDER_UNAVAILABLE_RESPONSE, { status: 503 });
    }
    return NextResponse.json({ error: "generation_failed" }, { status: 500 });
  }
}
