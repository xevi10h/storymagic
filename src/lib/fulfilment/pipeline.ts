// Resumable, idempotent post-purchase fulfilment of one story.
//
// Why: the old /complete did everything in one request (~875 s) inside a 300 s
// function; the cron re-ran it from scratch, regenerating all 12 premium scenes
// every time and never delivering. Now each invocation does as much as fits in
// its time budget and checkpoints every step, so a re-run continues where the
// previous one stopped:
//
//   lease → final images via src/lib/ai/final-book.ts (final sheet → 12 scenes +
//   print-size cover + hero portrait, each checkpointed → QA passes on all of them, checkpointed)
//   → finalize (story 'ready') → customer book PDF (every format, book-pdfs)
//   → per order: "book ready" email with its tokenised download link
//   → per physical order: build print files → validation gate → Gelato submit
//
// Concurrency: a story-level lease (conditional UPDATE, affected rows checked).
// A function killed mid-run can't release it, so the lease simply expires
// (LEASE_MS > maxDuration) and the next run RESUMES from the checkpoints.
//
// Image generation is treated as an opaque "render scene N" call so the image
// engine can be swapped without touching this orchestration.

import { randomUUID } from "node:crypto";
import { advanceFinalImages, shotName, type FinalBookState, type FinalBookStore } from "@/lib/ai/final-book";
import { finalRenderStage, type BookImageAssets, type BookImagePlan } from "@/lib/ai/book-images";
import type { GeneratedStory } from "@/lib/ai/story-generator";
import {
  uploadBookPdf,
  uploadInteriorPdf,
  uploadCoverSpreadPdf,
  getSignedPdfUrlForGelato,
} from "@/lib/supabase/storage";
import {
  renderBookPdf,
  renderPrintFiles,
  PrintValidationError,
  prefetchAllIllustrations,
  prefetchImageAsDataUri,
  type BookPdfInput,
} from "@/lib/pdf";
import { createPrintOrder, findOrdersByReference, getPrintOrder } from "@/lib/gelato/orders";
import { GelatoApiError } from "@/lib/gelato/client";
import { notifyOrderEmail } from "@/lib/email/notify-order";
import { getSiteUrl } from "@/lib/email/send";
import type { FulfilmentClient, FulfilmentDatabase } from "./db";
import { adminOrderUrl, alertOperator, alertProviderUnavailable } from "./alerts";
import { sendOrderEmailOnce } from "./emails";
import { closeExcludedAreaOrder } from "./excluded-area";
import { classifyProviderError } from "./provider-errors";
import { cancelGelatoForRefund } from "./payments";
import { ensureReferralCode, referralLink, type ReferralLink } from "@/lib/growth/referrals";
import {
  backoffMs,
  gelatoOrderReference,
  GELATO_ALERT_AFTER_ATTEMPTS,
  GELATO_MAX_ATTEMPTS,
  isAdoptableGelatoOrder,
  isExcludedSpanishPostcode,
  isFinalStage,
  isOrderForActiveStripeMode,
  isUsableStoredImage,
  validateSourceImages,
  type SceneRow,
} from "./logic";

// ── Tuning ───────────────────────────────────────────────────────────────────

/** Longer than the route's maxDuration (300 s): an expired lease ⇒ the holder is dead. */
const LEASE_MS = 330_000;
// Image-stage budgets (sheet / scene / QA pass) live in src/lib/ai/final-book.ts.
/** PDF render (32 pages, 12 print-res images) + 3 uploads. */
const PRINT_BUILD_MIN_MS = 100_000;
/** Customer PDF only (one render + upload). */
const BOOK_PDF_MIN_MS = 60_000;
const GELATO_SUBMIT_MIN_MS = 45_000;
/** Alert the operator after this many failed completion invocations of one story. */
const COMPLETION_ALERT_AFTER_ATTEMPTS = 6;
/** Retry delay after a provider outage (no money is spent while it's down). */
const PROVIDER_OUTAGE_RETRY_MS = 15 * 60_000;

const GENERATION_DONE_STATUSES = new Set(["ready", "ordered", "shipped", "delivered"]);
const ACTIVE_ORDER_STATUSES = ["paid", "producing", "shipped", "delivered"];
const PHYSICAL_FORMATS = new Set(["softcover", "hardcover"]);
const FINAL_SCENES = Array.from({ length: 12 }, (_, i) => i + 1);

// ── Types ────────────────────────────────────────────────────────────────────

type Tables = FulfilmentDatabase["public"]["Tables"];
type OrderRow = Tables["orders"]["Row"];
type CharacterRow = Tables["characters"]["Row"];
type StoryRow = Tables["stories"]["Row"] & { characters: CharacterRow | null };

/** generated_text as saved by the preview (src/lib/ai/preview-book.ts). */
interface ImageGeneratedText extends GeneratedStory {
  imagePlan?: BookImagePlan;
  imageAssets?: BookImageAssets;
}

const IMAGE_PROVIDER = "openai";

export type AdvanceState =
  | "done" // book generated; nothing left to do right now (Gelato may be in backoff)
  | "in_progress" // progress made, more work remains (next run continues)
  | "busy" // another run holds the lease
  | "blocked" // provider unavailable / failure recorded; retried later with backoff
  | "not_found"
  | "not_paid"
  | "not_completable";

export interface AdvanceResult {
  state: AdvanceState;
  generationDone: boolean;
  detail?: string;
}

interface RunContext {
  supabase: FulfilmentClient;
  storyId: string;
  runId: string;
  deadline: number;
  story: StoryRow;
  orders: OrderRow[];
  supabaseUrl: string;
}

const remaining = (ctx: RunContext) => ctx.deadline - Date.now();
const nowIso = () => new Date().toISOString();

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isMockOrder(order: Pick<OrderRow, "stripe_checkout_session_id">): boolean {
  return (order.stripe_checkout_session_id ?? "").startsWith("mock_");
}

// ── Entry point ──────────────────────────────────────────────────────────────

/**
 * Advance fulfilment of `storyId` as far as the time budget allows.
 * Caller is responsible for authorization. Never throws for expected failures:
 * they are recorded on the row (backoff) and escalated to the operator.
 */
export async function advanceStoryFulfilment(
  supabase: FulfilmentClient,
  storyId: string,
  opts: { deadline: number },
): Promise<AdvanceResult> {
  const { data: story, error: storyErr } = await supabase
    .from("stories")
    .select("*, characters(*)")
    .eq("id", storyId)
    .maybeSingle();
  if (storyErr) throw new Error(`Failed to load story ${storyId}: ${storyErr.message}`);
  if (!story) return { state: "not_found", generationDone: false };

  const { data: orderRows, error: ordersErr } = await supabase
    .from("orders")
    .select("*")
    .eq("story_id", storyId)
    .in("status", ACTIVE_ORDER_STATUSES)
    .order("created_at", { ascending: true });
  if (ordersErr) throw new Error(`Failed to load orders for story ${storyId}: ${ordersErr.message}`);

  const allowMock = process.env.MOCK_MODE === "true" && process.env.STRIPE_ENVIRONMENT !== "live";
  // Orders on hold (e.g. a chargeback) are neither generated nor printed until cleared.
  const orders = (orderRows ?? []).filter(
    (o) => !o.fulfilment_hold_reason && ((allowMock && isMockOrder(o)) || isOrderForActiveStripeMode(o)),
  );
  const generationDoneAtStart = GENERATION_DONE_STATUSES.has(story.status);
  if (orders.length === 0) return { state: "not_paid", generationDone: generationDoneAtStart };

  if (!generationDoneAtStart && story.status !== "preview" && story.status !== "completing") {
    return { state: "not_completable", generationDone: false, detail: `story status ${story.status}` };
  }

  // ── Acquire the lease (conditional update; affected rows checked) ──────────
  // completion_attempts = consecutive runs without success. It is incremented on
  // claim and reset only by a run that finishes cleanly, so a run killed mid-way
  // (no release) counts as a failure.
  const runId = randomUUID();
  const now = nowIso();
  const { data: claimed, error: claimErr } = await supabase
    .from("stories")
    .update({
      completion_lease_until: new Date(Date.now() + LEASE_MS).toISOString(),
      completion_lease_owner: runId,
      completion_attempts: story.completion_attempts + 1,
    })
    .eq("id", storyId)
    .eq("completion_attempts", story.completion_attempts)
    .or(`completion_lease_until.is.null,completion_lease_until.lt."${now}"`)
    .select("id");
  if (claimErr) throw new Error(`Failed to claim story ${storyId}: ${claimErr.message}`);
  if (!claimed || claimed.length === 0) return { state: "busy", generationDone: generationDoneAtStart };

  const ctx: RunContext = {
    supabase,
    storyId,
    runId,
    deadline: opts.deadline,
    story: { ...(story as StoryRow), completion_attempts: story.completion_attempts + 1 },
    orders,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  };

  try {
    // ── Generation ────────────────────────────────────────────────────────────
    if (!GENERATION_DONE_STATUSES.has(ctx.story.status)) {
      if (ctx.story.status === "preview") {
        await supabase.from("stories").update({ status: "completing" }).eq("id", storyId).eq("status", "preview");
        ctx.story.status = "completing";
      }
      const finished = await runGeneration(ctx);
      if (!finished) {
        await releaseLease(ctx, SUCCESSFUL_RUN);
        return { state: "in_progress", generationDone: false };
      }
    }

    // ── Post-generation (idempotent per order) ─────────────────────────────────
    const pending = await runOrderFulfilment(ctx);
    await releaseLease(ctx, SUCCESSFUL_RUN);
    return { state: pending ? "in_progress" : "done", generationDone: true };
  } catch (err) {
    const generationDone = GENERATION_DONE_STATUSES.has(ctx.story.status);
    const providerErr = classifyProviderError(err, IMAGE_PROVIDER);
    if (providerErr) {
      await alertProviderUnavailable(supabase, providerErr, `completing story ${storyId}`);
      await releaseLease(ctx, {
        completion_last_error: providerErr.message.slice(0, 1000),
        completion_next_attempt_at: new Date(Date.now() + PROVIDER_OUTAGE_RETRY_MS).toISOString(),
        // An outage is alerted on its own (hourly) and isn't this book's fault:
        // don't let it exhaust the story's failure budget.
        completion_attempts: Math.max(0, ctx.story.completion_attempts - 1),
      });
      return { state: "blocked", generationDone, detail: `provider ${providerErr.kind}` };
    }

    const attempts = ctx.story.completion_attempts;
    const message = errorMessage(err);
    console.error(`[fulfilment] Story ${storyId} run failed (attempt ${attempts}):`, err);
    await releaseLease(ctx, {
      completion_last_error: message.slice(0, 1000),
      completion_next_attempt_at: new Date(Date.now() + backoffMs(attempts)).toISOString(),
    });
    if (attempts >= COMPLETION_ALERT_AFTER_ATTEMPTS) {
      await alertOperator(supabase, {
        key: `completion-failing:${storyId}`,
        subject: `Paid book keeps failing to complete (story ${storyId})`,
        lines: [
          `Attempts: ${attempts}`,
          `Last error: ${message.slice(0, 500)}`,
          `Orders: ${ctx.orders.map((o) => `${o.id} (${o.format})`).join(", ")}`,
          "Retries continue with exponential backoff (max 6 h between attempts).",
        ],
        dedupeSeconds: 6 * 3600,
      });
    }
    return { state: "blocked", generationDone, detail: message };
  }
}

/** A run that made progress (or had nothing to do) resets the failure streak. */
const SUCCESSFUL_RUN = { completion_last_error: null, completion_next_attempt_at: null, completion_attempts: 0 };

async function releaseLease(
  ctx: RunContext,
  extra: {
    completion_last_error: string | null;
    completion_next_attempt_at: string | null;
    completion_attempts?: number;
  },
): Promise<void> {
  const { error } = await ctx.supabase
    .from("stories")
    .update({ completion_lease_until: null, completion_lease_owner: null, ...extra })
    .eq("id", ctx.storyId)
    .eq("completion_lease_owner", ctx.runId);
  if (error) console.error(`[fulfilment] Failed to release lease for story ${ctx.storyId}:`, error.message);
}

// ── Generation ───────────────────────────────────────────────────────────────

/** Returns true when generation is finished (story is 'ready'); false = continue next run. */
async function runGeneration(ctx: RunContext): Promise<boolean> {
  const generated = ctx.story.generated_text as unknown as ImageGeneratedText | null;
  if (!generated?.scenes?.length) throw new Error("Story has no generated text");
  if (!generated.imagePlan) {
    // Stories previewed by the removed FLUX/Recraft engines have no frozen plan.
    throw new Error("Story predates the OpenAI image engine (no imagePlan) — regenerate its preview before fulfilment");
  }

  const rows = await loadSceneRows(ctx);
  const finalScenes = new Map<number, string>();
  for (const r of rows) {
    if (r.status === "ready" && isFinalStage(r.render_stage) && isUsableStoredImage(r.image_url, ctx.supabaseUrl)) {
      finalScenes.set(r.scene_number, r.image_url as string);
    }
  }
  const state: FinalBookState = {
    storyId: ctx.storyId,
    plan: generated.imagePlan,
    assets: generated.imageAssets ?? {},
    story: generated,
    locale: ctx.story.locale ?? undefined,
    childName: ctx.story.characters?.name,
    finalScenes,
    qaPass: ctx.story.final_qa_pass,
    qaDone: !!ctx.story.final_qa_done_at,
  };

  const progress = await advanceFinalImages({ state, store: finalBookStore(ctx, generated), storage: ctx.supabase, deadline: ctx.deadline });
  console.log(
    `[fulfilment] Story ${ctx.storyId}: images ${progress.done ? "done" : "in progress"} — rendered [${progress.rendered.map(shotName).join(", ")}], repaired [${progress.repaired.map(shotName).join(", ")}], $${progress.costUsd.toFixed(2)} this run`,
  );
  if (!progress.done) return false;

  await finalizeGeneration(ctx);
  return true;
}

/** Every save is a checkpoint: a later run resumes from exactly this state. */
function finalBookStore(ctx: RunContext, generated: ImageGeneratedText): FinalBookStore {
  return {
    async saveAssets(assets) {
      generated.imageAssets = assets;
      const { error } = await ctx.supabase
        .from("stories")
        .update({ generated_text: JSON.parse(JSON.stringify(generated)) })
        .eq("id", ctx.storyId);
      if (error) throw new Error(`Failed to checkpoint image assets: ${error.message}`);
    },
    async saveScene(sceneNumber, url, prompt) {
      await persistScene(ctx, sceneNumber, url, prompt);
    },
    async saveCover(url, assets) {
      generated.imageAssets = assets;
      const { error } = await ctx.supabase
        .from("stories")
        .update({ cover_image_url: url, generated_text: JSON.parse(JSON.stringify(generated)) })
        .eq("id", ctx.storyId);
      if (error) throw new Error(`Failed to checkpoint cover: ${error.message}`);
      ctx.story.cover_image_url = url;
    },
    async saveQaPass(pass) {
      const { error } = await ctx.supabase.from("stories").update({ final_qa_pass: pass }).eq("id", ctx.storyId);
      if (error) throw new Error(`Failed to checkpoint QA pass: ${error.message}`);
      ctx.story.final_qa_pass = pass;
    },
    async saveQaDone() {
      const doneAt = nowIso();
      const { error } = await ctx.supabase.from("stories").update({ final_qa_done_at: doneAt }).eq("id", ctx.storyId);
      if (error) throw new Error(`Failed to checkpoint QA completion: ${error.message}`);
      ctx.story.final_qa_done_at = doneAt;
    },
    async onQaSkipped(reason) {
      await alertOperator(ctx.supabase, {
        key: `qa-skipped:${ctx.storyId}`,
        subject: `Paid book shipped WITHOUT illustration QA (story ${ctx.storyId})`,
        lines: [`Reason: ${reason}`, "Check OPENAI_API_KEY / QA_JUDGE_MODEL, then review the book's images manually."],
        dedupeSeconds: 24 * 3600,
      });
    },
  };
}

async function loadSceneRows(ctx: RunContext): Promise<SceneRow[]> {
  const { data, error } = await ctx.supabase
    .from("story_illustrations")
    .select("scene_number, status, image_url, render_stage")
    .eq("story_id", ctx.storyId)
    .lte("scene_number", 12)
    .order("scene_number");
  if (error) throw new Error(`Failed to load illustrations: ${error.message}`);
  return data ?? [];
}

/** Persist one final-stage scene — this row update IS the checkpoint. Storage paths are versioned (no stale CDN). */
async function persistScene(ctx: RunContext, sceneNumber: number, imageUrl: string, prompt: string): Promise<void> {
  const fields = { image_url: imageUrl, status: "ready", render_stage: finalRenderStage(), rendered_at: nowIso(), prompt_used: prompt };
  const { data, error } = await ctx.supabase
    .from("story_illustrations")
    .update(fields)
    .eq("story_id", ctx.storyId)
    .eq("scene_number", sceneNumber)
    .select("id");
  if (error) throw new Error(`Failed to checkpoint scene ${sceneNumber}: ${error.message}`);
  if (data && data.length > 0) return;
  const { error: insertErr } = await ctx.supabase.from("story_illustrations").insert({ story_id: ctx.storyId, scene_number: sceneNumber, ...fields });
  if (insertErr) throw new Error(`Failed to insert scene ${sceneNumber}: ${insertErr.message}`);
}

async function finalizeGeneration(ctx: RunContext): Promise<void> {
  const generatedAt = nowIso();
  const { error } = await ctx.supabase
    .from("stories")
    .update({ status: "ready", pdf_url: null, final_generated_at: generatedAt })
    .eq("id", ctx.storyId)
    .is("final_generated_at", null);
  if (error) throw new Error(`Failed to finalize story: ${error.message}`);
  ctx.story.status = "ready";
  ctx.story.final_generated_at = generatedAt;
  ctx.story.pdf_url = null;
  console.log(`[fulfilment] Story ${ctx.storyId}: final generation complete`);
}

// ── Orders ───────────────────────────────────────────────────────────────────

/** Per-order download link for emails: the token IS the credential (guests have no account). */
export function orderDownloadUrl(order: Pick<OrderRow, "download_token">): string {
  return `${getSiteUrl()}/api/downloads/${order.download_token}`;
}

/** Returns true when some order still has work that a later run must do soon. */
async function runOrderFulfilment(ctx: RunContext): Promise<boolean> {
  // Fresh statuses: an order refunded while the images were rendering must not get
  // the "ready" email or reach Gelato.
  const { data: fresh, error } = await ctx.supabase
    .from("orders")
    .select("*")
    .in("id", ctx.orders.map((o) => o.id))
    .in("status", ACTIVE_ORDER_STATUSES);
  if (error) throw new Error(`Failed to reload orders: ${error.message}`);
  ctx.orders = (fresh ?? []).filter((o) => !o.fulfilment_hold_reason);
  if (ctx.orders.length === 0) return false;

  // The customer PDF (digital edition, included with every format) is built once
  // per story here, stored in book-pdfs and only ever served by signed URL.
  if (!ctx.story.pdf_url) {
    if (remaining(ctx) < BOOK_PDF_MIN_MS) return true;
    await buildCustomerPdf(ctx);
  }

  let pending = false;
  for (const order of ctx.orders) {
    const isPhysical = PHYSICAL_FORMATS.has(order.format);

    // "Your book is ready" — only for books finished by this pipeline (legacy
    // 'ready' stories predate it and must not re-email old customers).
    if (ctx.story.final_generated_at && !order.ready_email_sent_at) {
      const sent = await sendOrderEmailOnce(ctx.supabase, {
        order,
        column: "ready_email_sent_at",
        event: "book_ready",
        downloadUrl: orderDownloadUrl(order),
        isPhysical,
      });
      if (sent) order.ready_email_sent_at = nowIso();
      else pending = true; // retried by the next run
    }

    // Digital orders are fulfilled by the email + download; only then leave 'paid'
    // (the cron only picks up 'paid', so an unsent email would never be retried).
    if (!isPhysical && order.status === "paid" && order.ready_email_sent_at) {
      await ctx.supabase.from("orders").update({ status: "producing" }).eq("id", order.id).eq("status", "paid");
    }

    if (isPhysical && order.status === "paid" && !order.gelato_order_id) {
      const result = await fulfilPhysicalOrder(ctx, order);
      if (result === "deferred") pending = true;
    }
  }
  return pending;
}

async function buildCustomerPdf(ctx: RunContext): Promise<void> {
  const input = await buildPdfInput(ctx);
  const pdf = await renderBookPdf(input, undefined, { edition: "digital" }); // trim-size reader edition (no bleed)
  const path = await uploadBookPdf(ctx.supabase, ctx.story.user_id, ctx.storyId, pdf);
  const { error } = await ctx.supabase.from("stories").update({ pdf_url: path }).eq("id", ctx.storyId);
  if (error) throw new Error(`Failed to save customer PDF path: ${error.message}`);
  ctx.story.pdf_url = path;
  console.log(`[fulfilment] Story ${ctx.storyId}: customer PDF stored (${(pdf.byteLength / 1_048_576).toFixed(1)} MB)`);
}

/**
 * Referral code printed on the last inner page: the order's own (print files), else the
 * story's first paid order's (the customer PDF is one file per story). Created here if
 * the webhook could not. Best-effort: any problem prints the plain meapica.shop QR.
 */
async function referralForPdf(ctx: RunContext, order?: OrderRow): Promise<ReferralLink | null> {
  const byDate = [...ctx.orders].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const candidates = (order ? [order, ...byDate.filter((o) => o.id !== order.id)] : byDate).filter((o) => !isMockOrder(o));
  try {
    for (const o of candidates) {
      const row = await ensureReferralCode(ctx.supabase, o, { email: o.customer_email, locale: ctx.story.locale });
      if (row?.stripe_promotion_code_id) return referralLink(row.code, ctx.story.locale ?? "es");
      if (!row) return null; // programme not set up on this Stripe account
    }
  } catch (err) {
    console.warn(`[fulfilment] Story ${ctx.storyId}: no referral QR (${errorMessage(err)})`);
  }
  return null;
}

/** Renderer input shared by the customer PDF and the print files (images as data URIs). */
async function buildPdfInput(ctx: RunContext, order?: OrderRow): Promise<BookPdfInput> {
  const { supabase, storyId, story } = ctx;
  const character = story.characters;
  if (!character) throw new Error("Story has no character");
  const rawGenerated = story.generated_text as unknown as GeneratedStory | null;
  if (!rawGenerated?.scenes?.length) throw new Error("Story has no generated text");
  const generatedText: GeneratedStory = story.title ? { ...rawGenerated, bookTitle: story.title } : rawGenerated;

  const { data: rows, error } = await supabase
    .from("story_illustrations")
    .select("scene_number, image_url")
    .eq("story_id", storyId)
    .order("scene_number");
  if (error) throw new Error(`Failed to load illustrations: ${error.message}`);

  // Page 27 portrait: the print-size hero render; books finished before it existed
  // use the cover art (print resolution too) — never the ~107 dpi avatar.
  const assets = (rawGenerated as ImageGeneratedText).imageAssets;
  const heroUrl = assets?.finalHero?.url ?? null;
  // Pages 28–29: the adventure map + its game; books without one print a patterned endpaper.
  const mapUrl = assets?.finalMap && assets.mapGame ? assets.finalMap.url : null;
  const [referral, prefetched, coverImageUrl, heroImageUrl, mapImageUrl] = await Promise.all([
    referralForPdf(ctx, order),
    prefetchAllIllustrations((rows ?? []).map((r) => ({ sceneNumber: r.scene_number, imageUrl: r.image_url }))),
    story.cover_image_url ? prefetchImageAsDataUri(story.cover_image_url) : Promise.resolve(null),
    heroUrl ? prefetchImageAsDataUri(heroUrl) : Promise.resolve(null),
    mapUrl ? prefetchImageAsDataUri(mapUrl) : Promise.resolve(null),
  ]);

  return {
    story: generatedText,
    templateId: story.template_id,
    characterName: character.name,
    characterAge: character.age,
    characterGender: character.gender,
    characterCity: character.city,
    characterInterests: character.interests ?? [],
    favoriteColor: character.favorite_color,
    favoriteCompanion: character.favorite_companion,
    futureDream: character.future_dream,
    dedicationText: story.dedication_text, // printed verbatim
    senderName: story.sender_name,
    storyId,
    coverImageUrl,
    portraitUrl: heroImageUrl ?? coverImageUrl,
    mapImageUrl,
    mapGame: mapUrl ? (assets?.mapGame ?? null) : null,
    illustrations: prefetched,
    locale: story.locale,
    referral,
  };
}

type OrderStepResult = "submitted" | "deferred" | "backoff" | "failed" | "gave_up";

async function fulfilPhysicalOrder(ctx: RunContext, order: OrderRow): Promise<OrderStepResult> {
  if (order.gelato_submit_attempts >= GELATO_MAX_ATTEMPTS) return "gave_up";
  if (order.gelato_next_attempt_at && new Date(order.gelato_next_attempt_at).getTime() > Date.now()) return "backoff";

  // 0. Shipping area (Checkout can only restrict by country). recordPaidSession
  // already refunds these at payment; this catches orders paid before that existed.
  const postcode = (order.shipping_address as { postal_code?: string } | null)?.postal_code;
  if (isExcludedSpanishPostcode(postcode)) {
    const closed = await closeExcludedAreaOrder(ctx.supabase, {
      order,
      postcode: postcode ?? "",
      paymentId: order.stripe_payment_id,
      amountCents: Math.round((order.total ?? 0) * 100),
      email: order.customer_email,
    });
    // Refund failed (operator alerted, order on hold): park it so no run submits it.
    if (!closed.ok) {
      await ctx.supabase
        .from("orders")
        .update({ gelato_submit_attempts: GELATO_MAX_ATTEMPTS, gelato_last_error: `excluded shipping area (postcode ${postcode}): ${closed.error}`.slice(0, 1000) })
        .eq("id", order.id);
    }
    return "gave_up";
  }

  // 1. Print files (built + validated once per order).
  if (!order.print_files_validated_at || !order.print_interior_path || !order.print_cover_path) {
    if (remaining(ctx) < PRINT_BUILD_MIN_MS) return "deferred";
    let built: { interiorPath: string; coverPath: string } | { problems: string[] };
    try {
      built = await buildAndValidatePrintFiles(ctx, order);
    } catch (err) {
      await recordGelatoFailure(ctx, order, `print file build failed: ${errorMessage(err)}`, { alertNow: false, countAttempt: true });
      return "failed";
    }
    if ("problems" in built) {
      await recordGelatoFailure(ctx, order, `validation gate: ${built.problems.join("; ")}`, { alertNow: true, countAttempt: true });
      return "failed";
    }
    order.print_interior_path = built.interiorPath;
    order.print_cover_path = built.coverPath;
    order.print_files_validated_at = nowIso();
  }

  // 2. Gelato submission.
  if (remaining(ctx) < GELATO_SUBMIT_MIN_MS) return "deferred";
  return submitToGelato(ctx, order);
}

async function buildAndValidatePrintFiles(
  ctx: RunContext,
  order: OrderRow,
): Promise<{ interiorPath: string; coverPath: string } | { problems: string[] }> {
  const { supabase, storyId, story } = ctx;
  const productUid = process.env[order.format === "hardcover" ? "GELATO_PRODUCT_UID_HARDCOVER" : "GELATO_PRODUCT_UID_SOFTCOVER"];
  if (!productUid) throw new Error("Gelato product UID not configured");

  const { data: allIllustrations, error } = await supabase
    .from("story_illustrations")
    .select("scene_number, status, image_url, render_stage")
    .eq("story_id", storyId)
    .order("scene_number");
  if (error) throw new Error(`Failed to load illustrations: ${error.message}`);

  // Source gate (cheap, before rendering): every scene is a final-stage image
  // from our own storage — never a preview-quality or placeholder picture.
  const sourceProblems = validateSourceImages({
    expectedScenes: FINAL_SCENES,
    scenes: allIllustrations ?? [],
    requireFinalStage: !!story.final_generated_at,
    isUsable: (url) => isUsableStoredImage(url, ctx.supabaseUrl),
  });
  if (sourceProblems.length > 0) return { problems: sourceProblems };

  const pdfInput = await buildPdfInput(ctx, order);

  // Print gate: geometry from Gelato → validate → render → re-validate (DPI,
  // page count/size, cover layout). Throws PrintValidationError instead of
  // producing a file that would print wrong.
  let files: Awaited<ReturnType<typeof renderPrintFiles>>;
  try {
    files = await renderPrintFiles({ input: pdfInput, productUid });
  } catch (err) {
    if (err instanceof PrintValidationError) {
      return { problems: err.result.errors.map((e) => e.message) };
    }
    throw err;
  }
  for (const w of files.validation.warnings) {
    console.warn(`[fulfilment] Print warning for order ${order.id}: ${w.message}`);
  }

  // files.bookPdf is ignored: the customer PDF was already stored by buildCustomerPdf.
  const ownerId = story.user_id;
  const [interiorPath, coverPath] = await Promise.all([
    uploadInteriorPdf(supabase, ownerId, storyId, order.id, files.interiorPdf),
    uploadCoverSpreadPdf(supabase, ownerId, storyId, order.id, files.coverPdf),
  ]);

  const { error: saveErr } = await supabase
    .from("orders")
    .update({ print_interior_path: interiorPath, print_cover_path: coverPath, print_files_validated_at: nowIso() })
    .eq("id", order.id);
  if (saveErr) throw new Error(`Failed to save print file paths: ${saveErr.message}`);
  return { interiorPath, coverPath };
}

function buildShippingAddress(order: OrderRow) {
  if (process.env.GELATO_FULFILLMENT_MODE !== "direct" || !order.shipping_address) return undefined;
  const addr = order.shipping_address as {
    line1?: string; line2?: string; city?: string; state?: string; postal_code?: string; country?: string; phone?: string;
  };
  const [firstName, ...rest] = (order.shipping_name ?? "").split(" ");
  return {
    firstName: firstName ?? "",
    lastName: rest.join(" "),
    addressLine1: addr.line1 ?? "",
    addressLine2: addr.line2 || undefined,
    city: addr.city ?? "",
    state: addr.state || undefined,
    postCode: addr.postal_code ?? "",
    country: addr.country ?? "ES",
    email: order.customer_email ?? "",
    phone: addr.phone || undefined,
  };
}

async function submitToGelato(ctx: RunContext, order: OrderRow): Promise<OrderStepResult> {
  const { supabase } = ctx;
  const orderReferenceId = gelatoOrderReference(order.id, order.gelato_reprint_count);

  // Claim this attempt (compare-and-set on the attempt counter; the story lease
  // already serializes runs, this also guards any out-of-band caller).
  const attempt = order.gelato_submit_attempts + 1;
  const { data: claimed, error: claimErr } = await supabase
    .from("orders")
    .update({ gelato_submit_attempts: attempt, gelato_submit_started_at: nowIso() })
    .eq("id", order.id)
    .eq("status", "paid")
    .is("gelato_order_id", null)
    .is("fulfilment_hold_reason", null)
    .eq("gelato_submit_attempts", order.gelato_submit_attempts)
    .select("id");
  if (claimErr) throw new Error(`Failed to claim Gelato submission: ${claimErr.message}`);
  if (!claimed || claimed.length === 0) return "deferred"; // someone else progressed it
  order.gelato_submit_attempts = attempt;

  try {
    // Gelato does NOT dedupe orderReferenceId → always look first. This adopts an
    // order created by a previous attempt that died before recording its id.
    // Dead ends (cancelled / failed / returned) are skipped: a reprint gets a new order.
    const existing = (await findOrdersByReference(orderReferenceId)).filter((o) => isAdoptableGelatoOrder(o.fulfillmentStatus));
    // Split (connected) orders share our reference but are one purchase, not duplicates.
    const connected = existing.length > 1 ? new Set((await getPrintOrder(existing[0].id)).connectedOrderIds ?? []) : new Set<string>();
    if (existing.slice(1).some((o) => !connected.has(o.id))) {
      await alertOperator(supabase, {
        key: `gelato-duplicate:${order.id}`,
        subject: `Duplicate Gelato orders for ${orderReferenceId}`,
        lines: [`Gelato ids: ${existing.map((o) => o.id).join(", ")}`, "Adopting the first one; cancel the others in the Gelato dashboard."],
        dedupeSeconds: 24 * 3600,
      });
    }

    let gelatoOrderId: string;
    let gelatoStatus: string;
    if (existing.length > 0) {
      gelatoOrderId = existing[0].id;
      gelatoStatus = existing[0].fulfillmentStatus;
      console.log(`[fulfilment] Adopting existing Gelato order ${gelatoOrderId} for ${orderReferenceId}`);
    } else {
      const [interiorUrl, coverUrl] = await Promise.all([
        getSignedPdfUrlForGelato(supabase, order.print_interior_path as string),
        getSignedPdfUrlForGelato(supabase, order.print_cover_path as string),
      ]);
      const addons: unknown[] = Array.isArray(order.addons) ? order.addons : [];
      const created = await createPrintOrder({
        orderReferenceId,
        storyId: ctx.storyId,
        format: order.format as "softcover" | "hardcover",
        interiorPdfUrl: interiorUrl,
        coverSpreadPdfUrl: coverUrl,
        shippingAddress: buildShippingAddress(order),
        quantity: addons.includes("extra_copy") ? 2 : 1,
      });
      gelatoOrderId = created.id;
      gelatoStatus = created.fulfillmentStatus;
      console.log(`[fulfilment] Gelato order created: ${gelatoOrderId} (${gelatoStatus}) for ${orderReferenceId}`);
    }

    // Record it — only if nobody recorded one meanwhile.
    const { data: recorded, error: recordErr } = await supabase
      .from("orders")
      .update({
        status: "producing",
        gelato_order_id: gelatoOrderId,
        gelato_status: gelatoStatus,
        gelato_submit_started_at: null,
        gelato_next_attempt_at: null,
        gelato_last_error: null,
      })
      .eq("id", order.id)
      .eq("status", "paid")
      .is("gelato_order_id", null)
      .select("id");
    if (recordErr) throw new Error(`Gelato order ${gelatoOrderId} created but not recorded: ${recordErr.message}`);
    if (!recorded || recorded.length === 0) {
      // Refunded while we were submitting → the print must not go ahead.
      const { data: now } = await supabase.from("orders").select("status, gelato_order_id").eq("id", order.id).maybeSingle();
      if (now?.status === "refunded") {
        await supabase.from("orders").update({ gelato_order_id: gelatoOrderId, gelato_status: gelatoStatus }).eq("id", order.id).is("gelato_order_id", null);
        await cancelGelatoForRefund(supabase, order.id, gelatoOrderId, "paid (refunded during Gelato submission)");
      }
      return "submitted";
    }
    order.status = "producing";
    order.gelato_order_id = gelatoOrderId;

    await supabase.from("stories").update({ status: "ordered" }).eq("id", ctx.storyId).eq("status", "ready");

    // Exactly-once: only the run that recorded the id sends it. The Gelato
    // "created" webhook then sees 'producing' already and skips a duplicate.
    await notifyOrderEmail({
      supabase,
      event: "in_production",
      storyId: ctx.storyId,
      userId: order.user_id ?? ctx.story.user_id,
      orderId: order.id,
    });
    return "submitted";
  } catch (err) {
    // 4xx from Gelato = request rejected (nothing created) → needs a human soon.
    const rejected = err instanceof GelatoApiError && err.status >= 400 && err.status < 500;
    await recordGelatoFailure(ctx, order, errorMessage(err), { alertNow: rejected, nothingCreated: rejected });
    return "failed";
  }
}

async function recordGelatoFailure(
  ctx: RunContext,
  order: OrderRow,
  message: string,
  opts: {
    alertNow: boolean;
    /** Failure happened before the submit claim (print build / gate) → count it here. */
    countAttempt?: boolean;
    /** Gelato definitely created nothing (e.g. 4xx) → clear the in-flight marker. */
    nothingCreated?: boolean;
  },
): Promise<void> {
  const countedAttempts = opts.countAttempt ? order.gelato_submit_attempts + 1 : Math.max(order.gelato_submit_attempts, 1);
  const gaveUp = countedAttempts >= GELATO_MAX_ATTEMPTS;

  const update: Tables["orders"]["Update"] = {
    gelato_last_error: message.slice(0, 1000),
    gelato_next_attempt_at: gaveUp ? null : new Date(Date.now() + backoffMs(countedAttempts)).toISOString(),
  };
  if (opts.countAttempt) update.gelato_submit_attempts = countedAttempts;
  if (opts.nothingCreated) update.gelato_submit_started_at = null;
  if (gaveUp) update.fulfilment_alerted_at = nowIso();
  const { error } = await ctx.supabase.from("orders").update(update).eq("id", order.id);
  if (error) console.error(`[fulfilment] Failed to record Gelato failure for order ${order.id}:`, error.message);
  console.error(`[fulfilment] Order ${order.id} fulfilment failed (attempt ${countedAttempts}/${GELATO_MAX_ATTEMPTS}): ${message}`);

  if (gaveUp || opts.alertNow || countedAttempts >= GELATO_ALERT_AFTER_ATTEMPTS) {
    await alertOperator(ctx.supabase, {
      key: gaveUp ? `gelato-gave-up:${order.id}` : `gelato-failing:${order.id}`,
      subject: gaveUp
        ? `Order ${order.id} NOT sent to print — automatic retries exhausted`
        : `Order ${order.id} failing to reach Gelato (attempt ${countedAttempts})`,
      lines: [
        `Story: ${ctx.storyId} · format: ${order.format}`,
        `Error: ${message.slice(0, 800)}`,
        gaveUp
          ? "The order stays 'paid'. Fix the cause, then use \"Reenviar a Gelato\" in the admin panel (tick \"regenerar ficheros de impresión\" if the print files must be rebuilt)."
          : `Next automatic retry in ~${Math.round(backoffMs(countedAttempts) / 60_000)} min.`,
        `Admin: ${adminOrderUrl(order.id)}`,
      ],
      dedupeSeconds: 6 * 3600,
    });
  }
}
