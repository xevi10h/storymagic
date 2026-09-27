import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { buildCharacterBible, renderPortrait } from "@/lib/ai/book-images";
import { optionalReference } from "@/lib/ai/preview-book";
import { uploadGeneratedImage } from "@/lib/supabase/storage";
import { isIllustrationRef, portraitFolder } from "@/lib/storage/illustration-refs";
import { ILLUSTRATION_URL_TTL, getIllustrationUrl, userAccess } from "@/lib/storage/illustration-urls";
import { getMockPortraitUrl } from "@/lib/ai/mock-story";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, checkMemoryRateLimit } from "@/lib/rate-limit";
import { isProviderUnavailableError } from "@/lib/fulfilment/provider-errors";

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
  /** Future feature: a real photo of the child — facial likeness only. Only our own storage (no SSRF). */
  photoUrl: z
    .string()
    .max(500)
    .refine((u) => u.startsWith(`${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim()}/storage/v1/object/`), "photoUrl must be a Meapica storage URL")
    // Never the illustrations bucket: the server downloads it with the service role.
    .refine((u) => !isIllustrationRef(u), "photoUrl must not point at generated illustrations")
    .optional(),
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
 * Returns: { portraitUrl (24 h signed URL), recraftStyleId: null } (recraftStyleId kept for UI compatibility).
 */
const RATE_LIMITED_RESPONSE = {
  error: "rate_limited",
  message: "Too many portrait generations. Please try again later.",
};

// ── Provider-outage circuit breaker ─────────────────────────────────────────
// When the image provider is out of credits / rejecting our key, every retry
// fails the same way. Short-circuit BEFORE the durable per-user rate limit so
// parents who tap "retry" don't burn their hourly quota on a known outage.
// Per-instance memory: good enough to stop retry storms; a cold instance just
// makes one real attempt and re-opens the breaker if the outage persists.
const PROVIDER_OUTAGE_COOLDOWN_MS = 10 * 60 * 1000;
let providerOutageUntil = 0;

function isProviderOutageError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /NO[ _]CREDITS|insufficient|credit|billing|quota|\b402\b|\b401\b|\b403\b/i.test(msg);
}

const PROVIDER_UNAVAILABLE_RESPONSE = { error: "provider_unavailable" };

export async function POST(request: Request) {
  if (Date.now() < providerOutageUntil) {
    return NextResponse.json(PROVIDER_UNAVAILABLE_RESPONSE, {
      status: 503,
      headers: { "Retry-After": String(Math.ceil((providerOutageUntil - Date.now()) / 1000)) },
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
      gender, age, skinTone, hairColor, eyeColor, hairstyle, favoriteColor, photoUrl,
    } = parsed.data;

    if (process.env.MOCK_MODE === "true") {
      return NextResponse.json({ portraitUrl: getMockPortraitUrl(), recraftStyleId: null });
    }

    const bible = buildCharacterBible({ gender, age, skinTone, hairColor, eyeColor, hairstyle, favoriteColor }, photoUrl ?? null);
    const photo = await optionalReference(photoUrl, "photo");
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
    return NextResponse.json({ portraitUrl, recraftStyleId: null });
  } catch (error: unknown) {
    console.error("[Portrait] Generation failed:", error);
    // Never leak provider/backend error text to the client (parents see a
    // localized message keyed off `error`).
    if (isProviderUnavailableError(error) || isProviderOutageError(error)) {
      providerOutageUntil = Date.now() + PROVIDER_OUTAGE_COOLDOWN_MS;
      return NextResponse.json(PROVIDER_UNAVAILABLE_RESPONSE, { status: 503 });
    }
    return NextResponse.json({ error: "generation_failed" }, { status: 500 });
  }
}
