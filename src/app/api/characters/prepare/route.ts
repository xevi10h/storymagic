import { NextResponse, after } from "next/server";
import { z } from "zod";
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { loadReference, renderChildSheet, type ImageReference } from "@/lib/ai/book-images";
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
import { deleteChildPhoto, loadChildPhoto } from "@/lib/privacy/child-photo";
import { isMockGeneration } from "@/lib/ai/story-generator";

// The child sheet (gpt-image-2.5-flare, medium, 1536×1024) takes ~15–25 s and
// runs in after(), which lives for this route's maxDuration.
export const maxDuration = 120;

const STORAGE_PREFIX = () => `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim()}/storage/v1/object/`;

const prepareInputSchema = z
  .object({
    gender: z.enum(["boy", "girl", "neutral"]),
    age: z.number().int().min(1).max(12),
    skinTone: z.string().max(20).optional(),
    hairColor: z.string().max(20).optional(),
    eyeColor: z.string().max(20).optional(),
    hairstyle: z.string().max(30).optional(),
    favoriteColor: z.string().max(20).optional(),
    /** Pre-rendered public watercolor avatar, e.g. "/images/avatar/girl-curly-dark-2.jpg" */
    avatarAssetPath: z
      .string()
      .max(200)
      .regex(/^\/images\/avatar\/[A-Za-z0-9/_-]+\.(png|jpe?g|webp)$/, "avatarAssetPath must be under /images/avatar/")
      .optional(),
    /** AI portrait from POST /api/characters/portrait (our storage only — no SSRF) */
    portraitUrl: z
      .string()
      .max(500)
      .refine((u) => u.startsWith(STORAGE_PREFIX()), "portraitUrl must be a Meapica storage URL")
      .optional(),
    /** Object path in the private `child-photos` bucket (ownership enforced by loadChildPhoto) */
    photoPath: z
      .string()
      .max(300)
      .regex(/^[A-Za-z0-9/._-]+$/, "invalid photoPath")
      .refine((p) => !p.includes(".."), "invalid photoPath")
      .optional(),
  })
  .refine((d) => !(d.avatarAssetPath && d.portraitUrl), "Send either avatarAssetPath or portraitUrl, not both");

type PrepareInput = z.infer<typeof prepareInputSchema>;

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
 * Request:  { gender, age, skinTone?, hairColor?, eyeColor?, hairstyle?, favoriteColor?,
 *             avatarAssetPath? | portraitUrl?, photoPath? }
 * Response: 202 { characterPrepId, status: "rendering" | "ready" }
 *           200 { characterPrepId: null, status: "skipped" } in MOCK_MODE
 *           400 invalid input · 401 no session · 429 rate_limited · 503 provider_unavailable
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

  if (isMockGeneration()) {
    return NextResponse.json({ characterPrepId: null, status: "skipped" });
  }

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const bible = prepBible(input);
  const hash = bibleHash(bible);
  const avatarRef = input.avatarAssetPath ?? input.portraitUrl ?? null;
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

  const prepId = existing ? await reclaim(admin, existing) : await insert(admin, user.id, fingerprint, hash, bible, avatarRef, !!input.photoPath);
  if (!prepId.claimed) {
    // Another request claimed it between our read and write: that one renders.
    return NextResponse.json({ characterPrepId: prepId.id, status: "rendering" }, { status: 202 });
  }

  const origin = new URL(request.url).origin;
  after(() => renderPrep(admin, prepId.id, user.id, input, bible, origin));
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

async function loadPhoto(photoPath: string, userId: string): Promise<ImageReference> {
  const photo = await loadChildPhoto(photoPath, userId);
  return { data: photo.data, mime: photo.mime === "image/png" || photo.mime === "image/webp" ? photo.mime : "image/jpeg" };
}

async function renderPrep(
  admin: SupabaseClient,
  prepId: string,
  userId: string,
  input: PrepareInput,
  bible: ReturnType<typeof prepBible>,
  origin: string,
): Promise<void> {
  const started = Date.now();
  try {
    const [avatar, photo] = await Promise.all([
      input.avatarAssetPath
        ? loadReference(new URL(input.avatarAssetPath, origin).toString()).catch((err) => {
            console.warn(`[Prepare] avatar asset unavailable (${err instanceof Error ? err.message : err}) — continuing without it`);
            return null;
          })
        : optionalReference(input.portraitUrl, "portrait"),
      input.photoPath ? loadPhoto(input.photoPath, userId) : Promise.resolve(null),
    ]);
    const result = await renderChildSheet(bible, "preview", { avatar, photo }, { label: `prep ${prepId.slice(0, 8)}`, deadline: started + 110_000 });
    const url = await uploadGeneratedImage(admin, `character-preps/${prepId}`, "sheet-child", result.image, result.mime);
    const { error } = await admin
      .from(CHARACTER_PREPS_TABLE)
      .update({ status: "ready", child_sheet_url: url, model: result.model, cost_usd: result.costUsd, finished_at: new Date().toISOString() })
      .eq("id", prepId);
    if (error) throw new Error(`character_preps update failed: ${error.message}`);
    console.log(`[Prepare] ${prepId} ready in ${((Date.now() - started) / 1000).toFixed(1)}s ($${result.costUsd.toFixed(3)})`);
    // The photo's only job was the sheet's likeness: delete it now.
    if (input.photoPath) {
      const deleted = await deleteChildPhoto(input.photoPath, userId, admin);
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
