import { NextResponse, after } from "next/server";
import { z } from "zod";
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { renderChildSheet, type ImageReference } from "@/lib/ai/book-images";
import { optionalReference } from "@/lib/ai/preview-book";
import {
  CHARACTER_PREPS_TABLE,
  PREP_STALE_MS,
  bibleHash,
  prepBible,
  prepFingerprint,
  type PrepRow,
} from "@/lib/ai/character-prep";
import { providerOutageRetryAfter, tripOnProviderOutage } from "@/lib/ai/provider-outage";
import { uploadGeneratedImage } from "@/lib/supabase/storage";
import { checkMemoryRateLimit, checkRateLimit } from "@/lib/rate-limit";
import { PhotoUnavailableError, deleteChildPhoto, loadChildPhoto } from "@/lib/privacy/child-photo";
import { isOwnedPhotoPath, isPhotoUploadEnabled, isValidPhotoPath } from "@/lib/privacy/child-photo-policy";
import { ownedPortraitPath } from "@/lib/storage/illustration-urls";
import { avatarAssetPathSchema, avatarAssetUrl, characterLookShape } from "@/lib/character-look";
import { isMockGeneration } from "@/lib/ai/story-generator";

// The child sheet (gpt-image-2.5-flare, medium, 1536×1024) takes ~15–25 s and
// runs in after(), which lives for this route's maxDuration.
export const maxDuration = 120;

const prepareInputSchema = z
  .object({
    // Same look fields as POST /api/stories (client: characterLookPayload), so the
    // Bible hash of the prep equals the story's.
    ...characterLookShape,
    /** Pre-rendered watercolor avatar base, e.g. "/images/avatar/girl/light/brown-bob.webp" */
    avatarAssetPath: avatarAssetPathSchema.optional(),
    /** AI portrait from POST /api/characters/portrait (signed URL or path); only the caller's own is used */
    portraitUrl: z.string().max(2000).optional(),
    /** Object path in the private `child-photos` bucket ({userId}/{uuid}.jpg) */
    photoPath: z.string().max(200).refine(isValidPhotoPath, "invalid photoPath").optional(),
  })
  .refine((d) => !(d.avatarAssetPath && d.portraitUrl), "Send either avatarAssetPath or portraitUrl, not both");


const RATE_LIMITED = { error: "rate_limited", message: "Too many character generations. Please try again later." };
const PROVIDER_UNAVAILABLE = { error: "provider_unavailable" };

/**
 * POST /api/characters/prepare
 *
 * Starts rendering the child's preview character sheet (child only: four
 * views + expressions) from the traits + avatar (+ optional private photo),
 * BEFORE the story exists. Returns immediately; the render continues in
 * after(). Pass the returned id as `characterPrepId` to POST /api/stories and
 * the generate route reuses the sheet when the traits/avatar still match.
 *
 * Idempotent: the same traits + avatar + photo return the same prep (no new
 * render) while it is rendering or ready; a failed or dead prep is re-rendered.
 * Costs like a portrait, so it shares the portrait budget (IP window + the
 * durable `generate_portrait` per-user limit) and the provider-outage breaker.
 *
 * Request:  { gender, age, skinTone?, hairColor?, eyeColor?, hairstyle?, favoriteColor?, glasses?, freckles?,
 *             avatarAssetPath? | portraitUrl?, photoPath? }
 * Response: 202 { characterPrepId, status: "rendering" | "ready" }
 *           200 { characterPrepId: null, status: "skipped" } in MOCK_MODE
 *           400 invalid input / photo_upload_disabled · 401 no session · 403 photo not the caller's ·
 *           410 photo_unavailable (already used/deleted → re-upload) · 429 rate_limited · 503 provider_unavailable
 *
 * The photo is downloaded (bytes, ownership + open consent checked) BEFORE the
 * response, used only as a reference of this one render, then deleted.
 */
export async function POST(request: Request) {
  const outageRetryAfter = providerOutageRetryAfter();
  if (outageRetryAfter > 0) {
    return NextResponse.json(PROVIDER_UNAVAILABLE, { status: 503, headers: { "Retry-After": String(outageRetryAfter) } });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = prepareInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const input = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (input.photoPath) {
    if (!isPhotoUploadEnabled()) return NextResponse.json({ error: "photo_upload_disabled" }, { status: 400 });
    if (!isOwnedPhotoPath(input.photoPath, user.id)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  // Only the caller's own portrait (private bucket path) may anchor the sheet.
  const portraitPath = input.portraitUrl ? ownedPortraitPath(input.portraitUrl, user.id) : null;
  if (input.portraitUrl && !portraitPath) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  if (isMockGeneration()) {
    return NextResponse.json({ characterPrepId: null, status: "skipped" });
  }

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const bible = prepBible(input);
  const hash = bibleHash(bible);
  const avatarRef = input.avatarAssetPath ?? portraitPath;
  const fingerprint = prepFingerprint(hash, avatarRef, input.photoPath ?? null);

  // ── Idempotency: an equal prep that is ready or still rendering is reused ──
  const { data: existing, error: lookupErr } = await admin
    .from(CHARACTER_PREPS_TABLE)
    .select("id, user_id, status, bible_hash, avatar_ref, child_sheet_url, started_at")
    .eq("user_id", user.id)
    .eq("fingerprint", fingerprint)
    .maybeSingle<PrepRow>();
  if (lookupErr) {
    console.error("[Prepare] lookup failed:", lookupErr.message);
    return NextResponse.json({ error: "prepare_failed" }, { status: 500 });
  }
  if (existing && (existing.status === "ready" || (existing.status === "rendering" && !isStale(existing.started_at)))) {
    return NextResponse.json({ characterPrepId: existing.id, status: existing.status }, { status: 202 });
  }

  // ── A new render costs money: portrait budget ────────────────────────────
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipLimit = checkMemoryRateLimit(`portrait:${clientIp}`, { maxRequests: 30, windowSeconds: 3600 });
  if (!ipLimit.allowed) {
    return NextResponse.json(RATE_LIMITED, { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds ?? 3600) } });
  }
  const userLimit = await checkRateLimit(user.id, "generate_portrait");
  if (!userLimit.allowed) {
    return NextResponse.json(RATE_LIMITED, { status: 429, headers: { "Retry-After": String(userLimit.retryAfterSeconds ?? 3600) } });
  }

  // The photo's bytes are read now (410 when already used/deleted/withdrawn, so the
  // UI can ask for it again) and only live in this function's memory.
  let photo: ImageReference | null = null;
  if (input.photoPath) {
    try {
      photo = await loadChildPhoto(input.photoPath, user.id);
    } catch (err) {
      if (err instanceof PhotoUnavailableError) return NextResponse.json({ error: "photo_unavailable" }, { status: 410 });
      console.error(`[Prepare] photo load failed: ${err instanceof Error ? err.message : "unknown"}`);
      return NextResponse.json({ error: "prepare_failed" }, { status: 500 });
    }
  }

  const prepId = existing ? await reclaim(admin, existing) : await insert(admin, user.id, fingerprint, hash, bible, avatarRef, !!input.photoPath);
  if (!prepId.claimed) {
    // Another request claimed it between our read and write: that one renders.
    return NextResponse.json({ characterPrepId: prepId.id, status: "rendering" }, { status: 202 });
  }

  const avatarUrl = input.avatarAssetPath ? avatarAssetUrl(input.avatarAssetPath, new URL(request.url).origin) : portraitPath;
  after(() => renderPrep(admin, prepId.id, user.id, { avatarUrl, photo, photoPath: input.photoPath ?? null }, bible));
  return NextResponse.json({ characterPrepId: prepId.id, status: "rendering" }, { status: 202 });
}

function isStale(startedAt: string): boolean {
  return Date.now() - new Date(startedAt).getTime() > PREP_STALE_MS;
}

async function insert(
  admin: SupabaseClient,
  userId: string,
  fingerprint: string,
  hash: string,
  bible: ReturnType<typeof prepBible>,
  avatarRef: string | null,
  hadPhoto: boolean,
): Promise<{ id: string; claimed: boolean }> {
  const { data, error } = await admin
    .from(CHARACTER_PREPS_TABLE)
    .insert({ user_id: userId, fingerprint, bible_hash: hash, bible, avatar_ref: avatarRef, had_photo: hadPhoto, status: "rendering" })
    .select("id")
    .single<{ id: string }>();
  if (data) return { id: data.id, claimed: true };
  if (error?.code === "23505") {
    // Unique (user_id, fingerprint): a concurrent identical request inserted first.
    const { data: row } = await admin.from(CHARACTER_PREPS_TABLE).select("id").eq("user_id", userId).eq("fingerprint", fingerprint).single<{ id: string }>();
    if (row) return { id: row.id, claimed: false };
  }
  throw new Error(`character_preps insert failed: ${error?.message ?? "no row"}`);
}

/** Atomically take over a failed / dead prep (conditional UPDATE, like the story claim). */
async function reclaim(admin: SupabaseClient, row: PrepRow): Promise<{ id: string; claimed: boolean }> {
  const staleBefore = new Date(Date.now() - PREP_STALE_MS).toISOString();
  const { data } = await admin
    .from(CHARACTER_PREPS_TABLE)
    .update({ status: "rendering", started_at: new Date().toISOString(), finished_at: null, error: null, child_sheet_url: null })
    .eq("id", row.id)
    .or(`status.eq.failed,and(status.eq.rendering,started_at.lt.${staleBefore})`)
    .select("id");
  return { id: row.id, claimed: (data?.length ?? 0) > 0 };
}

async function renderPrep(
  admin: SupabaseClient,
  prepId: string,
  userId: string,
  anchors: { avatarUrl: string | null; photo: ImageReference | null; photoPath: string | null },
  bible: ReturnType<typeof prepBible>,
): Promise<void> {
  const started = Date.now();
  const { photo, photoPath } = anchors;
  try {
    const avatar = await optionalReference(anchors.avatarUrl, "avatar");
    const result = await renderChildSheet(bible, "preview", { avatar, photo }, { label: `prep ${prepId.slice(0, 8)}`, deadline: started + 110_000 });
    const url = await uploadGeneratedImage(admin, `character-preps/${prepId}`, "sheet-child", result.image, result.mime);
    const { error } = await admin
      .from(CHARACTER_PREPS_TABLE)
      .update({ status: "ready", child_sheet_url: url, model: result.model, cost_usd: result.costUsd, finished_at: new Date().toISOString() })
      .eq("id", prepId);
    if (error) throw new Error(`character_preps update failed: ${error.message}`);
    console.log(`[Prepare] ${prepId} ready in ${((Date.now() - started) / 1000).toFixed(1)}s ($${result.costUsd.toFixed(3)})`);
    // The photo's only job was the sheet's likeness: delete it now.
    if (photoPath) {
      const deleted = await deleteChildPhoto(photoPath, userId, admin);
      if (!deleted.ok) console.error(`[Prepare] ${prepId} child photo deletion failed (the purge cron removes it)`);
    }
  } catch (err) {
    tripOnProviderOutage(err);
    console.error(`[Prepare] ${prepId} failed:`, err instanceof Error ? err.message : err);
    await admin
      .from(CHARACTER_PREPS_TABLE)
      .update({ status: "failed", error: (err instanceof Error ? err.message : String(err)).slice(0, 500), finished_at: new Date().toISOString() })
      .eq("id", prepId);
  }
}
