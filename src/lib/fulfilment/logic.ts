// Pure fulfilment decision logic (no I/O, no path aliases) so it can be exercised
// by `node --experimental-strip-types src/lib/fulfilment/logic.check.ts`.

// ── Order status ranking (Gelato webhook) ────────────────────────────────────

/** Forward-only lifecycle of a paid order. Higher rank = further along. */
export const ORDER_STATUS_RANK: Readonly<Record<string, number>> = {
  pending: 0,
  paid: 1,
  producing: 2,
  shipped: 3,
  delivered: 4,
};

/** Gelato fulfillmentStatus → internal order status. Unlisted statuses are ignored. */
const GELATO_TO_ORDER_STATUS: Readonly<Record<string, string>> = {
  created: "producing",
  uploading: "producing",
  passed: "producing",
  in_production: "producing",
  printed: "producing",
  shipped: "shipped",
  in_transit: "shipped",
  delivered: "delivered",
};

/** Gelato statuses that need a human (no automatic status change). */
const GELATO_EXCEPTION_STATUSES = new Set(["canceled", "cancelled", "failed", "returned"]);

/**
 * Gelato statuses where the order is paused waiting on us (manual approval in the
 * dashboard, merchant action, store connection). The order keeps its status; the
 * operator is alerted.
 */
const GELATO_ATTENTION_STATUSES = new Set(["pending_approval", "on_hold", "not_connected"]);

export type GelatoTransition =
  | { kind: "advance"; to: string }
  | { kind: "same"; to: string }
  | { kind: "stale"; to: string }
  | { kind: "exception"; gelatoStatus: string }
  | { kind: "attention"; gelatoStatus: string }
  | { kind: "unknown"; gelatoStatus: string };

/**
 * Decide what a Gelato status event does to an order currently at `currentStatus`.
 * Late/out-of-order events can never move an order backwards ("stale").
 */
export function decideGelatoTransition(currentStatus: string, gelatoStatus: string): GelatoTransition {
  const status = gelatoStatus.trim().toLowerCase();
  if (GELATO_EXCEPTION_STATUSES.has(status)) return { kind: "exception", gelatoStatus: status };
  if (GELATO_ATTENTION_STATUSES.has(status)) return { kind: "attention", gelatoStatus: status };
  const to = GELATO_TO_ORDER_STATUS[status];
  if (!to) return { kind: "unknown", gelatoStatus: status };
  const currentRank = ORDER_STATUS_RANK[currentStatus];
  // Unknown current status (e.g. "cancelled" checkout) → never touch it automatically.
  if (currentRank === undefined) return { kind: "stale", to };
  const targetRank = ORDER_STATUS_RANK[to];
  if (targetRank > currentRank) return { kind: "advance", to };
  if (targetRank === currentRank) return { kind: "same", to };
  return { kind: "stale", to };
}

/**
 * An order handed to Gelato but not shipped after this long is escalated.
 * Gelato's own quote for ES photobooks is 7-8 days door to door (2026-09-28),
 * i.e. ~3-4 days in production, so 5 days means something is wrong.
 */
export const GELATO_STUCK_PRODUCING_HOURS = 5 * 24;

/** First tracking code in a Gelato order_status_updated items[].fulfillments[] list. */
export function pickTracking(
  items: ReadonlyArray<{ fulfillments?: ReadonlyArray<{ trackingCode?: string | null; trackingUrl?: string | null }> }> | undefined,
): { trackingNumber: string; trackingUrl: string | null } | null {
  for (const item of items ?? []) {
    for (const f of item.fulfillments ?? []) {
      if (f.trackingCode) return { trackingNumber: f.trackingCode, trackingUrl: f.trackingUrl || null };
    }
  }
  return null;
}

/**
 * Gelato orders that can be adopted on (re)submission. Dead ends (cancelled,
 * failed, returned) are ignored so a reprint creates a fresh Gelato order.
 */
export function isAdoptableGelatoOrder(fulfillmentStatus: string | null | undefined): boolean {
  return !["canceled", "cancelled", "failed", "returned"].includes((fulfillmentStatus ?? "").trim().toLowerCase());
}

/**
 * Send the "tracking update" email? Only when the order is (still) 'shipped', it
 * had no tracking code before, a code arrives now, and this event did NOT itself
 * move the order to 'shipped' (that transition sends the shipped email, which
 * already carries the code).
 */
export function shouldSendTrackingUpdate(input: {
  status: string;
  previousTrackingNumber: string | null | undefined;
  newTrackingNumber: string | null | undefined;
  advancedByThisEvent: boolean;
}): boolean {
  return (
    input.status === "shipped" &&
    !input.advancedByThisEvent &&
    !input.previousTrackingNumber &&
    !!input.newTrackingNumber
  );
}

// ── Refunds ──────────────────────────────────────────────────────────────────

const PHYSICAL_FORMATS = new Set(["softcover", "hardcover"]);

export type RefundDecision =
  /** Already closed (refunded / cancelled / never paid): nothing to do. */
  | { kind: "noop" }
  /** The book is out of the door (goodwill refund): keep the status history, only record refunded_at. */
  | { kind: "record_only" }
  /** Stop everything: status → refunded (download dies, cron skips it), cancel at Gelato if submitted. */
  | { kind: "close"; cancelAtGelato: boolean };

/**
 * What a FULL refund does to an order. A physical book that already left the
 * printer (our status shipped/delivered, or Gelato says so while our status
 * lags) can't be cancelled: the refund is a goodwill gesture and the order keeps
 * its history. Anything earlier is a cancellation.
 */
export function decideFullRefund(order: {
  status: string;
  format: string;
  gelato_order_id: string | null;
  gelato_status: string | null;
}): RefundDecision {
  if (["refunded", "cancelled", "pending"].includes(order.status)) return { kind: "noop" };
  if (PHYSICAL_FORMATS.has(order.format)) {
    const gelato = (order.gelato_status ?? "").toLowerCase();
    const outOfTheDoor =
      order.status === "shipped" ||
      order.status === "delivered" ||
      ["shipped", "in_transit", "delivered", "returned"].includes(gelato);
    if (outOfTheDoor) return { kind: "record_only" };
  }
  return { kind: "close", cancelAtGelato: !!order.gelato_order_id };
}

// ── Purchases ────────────────────────────────────────────────────────────────

/** Story statuses a Checkout may start from: the preview, or a finished book (another copy). */
const PURCHASABLE_STORY_STATUSES = new Set(["preview", "ready", "ordered", "shipped", "delivered"]);

/**
 * Can this story be bought in this format? A finished book already includes the
 * PDF (every earlier order came with it), so a second digital order is refused;
 * printed copies can be ordered again at the normal price.
 */
export function purchaseEligibility(storyStatus: string, format: string): "ok" | "not_ready" | "already_owned" {
  if (!PURCHASABLE_STORY_STATUSES.has(storyStatus)) return "not_ready";
  if (storyStatus !== "preview" && !PHYSICAL_FORMATS.has(format)) return "already_owned";
  return "ok";
}

// ── Shipping area ────────────────────────────────────────────────────────────

/**
 * Decision 2026-09-28: Spain only, and not Canarias (35, 38), Ceuta (51) or
 * Melilla (52): they are outside the EU VAT area (IGIC / customs on delivery).
 * Stripe Checkout can only restrict by country, so this is enforced after payment.
 */
export function isExcludedSpanishPostcode(postcode: string | null | undefined): boolean {
  return /^(35|38|51|52)\d{3}$/.test((postcode ?? "").replace(/\s/g, ""));
}

// ── Retry backoff ────────────────────────────────────────────────────────────

/** Operator is alerted from this many failed Gelato attempts on… */
export const GELATO_ALERT_AFTER_ATTEMPTS = 3;
/** …and automatic retries stop here (order stays 'paid', operator handles it). */
export const GELATO_MAX_ATTEMPTS = 8;

const BACKOFF_BASE_MS = 5 * 60_000;
const BACKOFF_MAX_MS = 6 * 60 * 60_000;

/** Exponential backoff after the `attempt`-th failure (1-based): 5m, 10m, 20m … capped at 6h. */
export function backoffMs(attempt: number): number {
  const n = Math.max(1, Math.floor(attempt));
  return Math.min(BACKOFF_BASE_MS * 2 ** (n - 1), BACKOFF_MAX_MS);
}

// ── Scene checkpointing ──────────────────────────────────────────────────────

/** Prefix of `story_illustrations.render_stage` for images produced by the final stage. */
export const FINAL_STAGE_PREFIX = "final";

export function finalStageMarker(provider: string | undefined, model: string | undefined): string {
  return `${FINAL_STAGE_PREFIX}:${provider || "default"}:${model || "default"}`;
}

export function isFinalStage(renderStage: string | null | undefined): boolean {
  return !!renderStage && (renderStage === FINAL_STAGE_PREFIX || renderStage.startsWith(`${FINAL_STAGE_PREFIX}:`));
}

/**
 * A stored image is usable for print only if it lives in our own storage
 * (not a temporary provider URL, not a picsum/mock placeholder):
 *  - an object path of the private `illustrations` bucket (what the code stores
 *    since 2026-09-27; same rule as illustrationPath() in
 *    src/lib/storage/illustration-refs.ts — duplicated because this module must
 *    stay import-free for `node --experimental-strip-types`), or
 *  - a legacy / showcase public URL of our own Supabase project.
 */
export function isUsableStoredImage(url: string | null | undefined, supabaseUrl: string): boolean {
  if (!url) return false;
  const value = url.trim();
  if (/picsum\.photos/i.test(value)) return false;
  const isBarePath =
    !/^[a-z][a-z0-9+.-]*:/i.test(value) && !value.startsWith("/") && !value.split("/").some((seg) => seg === "" || seg === "." || seg === "..");
  if (isBarePath) return value.includes("/") && !value.startsWith("mock/");
  const base = supabaseUrl.trim().replace(/\/+$/, "");
  if (!base) return false;
  return value.startsWith(`${base}/storage/v1/object/public/`);
}

export interface SceneRow {
  scene_number: number;
  status: string;
  image_url: string | null;
  render_stage: string | null;
}

/**
 * Which scenes still need a final render. A scene is done when it was rendered by
 * the final stage (checkpoint) — or, when two-speed mode is OFF, when the preview
 * already produced a usable image with the same model.
 */
export function selectScenesToRender(
  rows: readonly SceneRow[],
  sceneNumbers: readonly number[],
  opts: { twoSpeed: boolean; isUsable: (url: string | null) => boolean },
): number[] {
  const byScene = new Map(rows.map((r) => [r.scene_number, r]));
  return sceneNumbers.filter((n) => {
    const row = byScene.get(n);
    if (!row) return true;
    const readyAndUsable = row.status === "ready" && opts.isUsable(row.image_url);
    if (!readyAndUsable) return true;
    if (isFinalStage(row.render_stage)) return false;
    return opts.twoSpeed;
  });
}

// ── Pre-submit source gate ───────────────────────────────────────────────────
// PDF-level checks (DPI, page count/size, cover geometry) live in the PDF
// module's validatePrintableBook, run by renderPrintFiles. This gate only
// checks where the art comes from, before spending time on a render.

export interface SourceValidationInput {
  /** Scene numbers that must be present (1..12). */
  expectedScenes: readonly number[];
  scenes: readonly SceneRow[];
  requireFinalStage: boolean;
  isUsable: (url: string | null) => boolean;
}

/** Returns a list of human-readable problems. Empty list = art is fit for print. */
export function validateSourceImages(input: SourceValidationInput): string[] {
  const problems: string[] = [];
  const byScene = new Map(input.scenes.map((r) => [r.scene_number, r]));
  for (const n of input.expectedScenes) {
    const row = byScene.get(n);
    if (!row || row.status !== "ready" || !input.isUsable(row.image_url)) {
      problems.push(`scene ${n}: missing or placeholder illustration`);
    } else if (input.requireFinalStage && !isFinalStage(row.render_stage)) {
      problems.push(`scene ${n}: still the preview-quality image`);
    }
  }
  return problems;
}


/**
 * Local dev and prod share one database: a test-mode order must never be
 * fulfilled by a live deployment (real OpenAI spend + a REAL Gelato print), nor a
 * live order by a test one. The Checkout Session id carries the mode.
 */
export function isOrderForActiveStripeMode(order: { stripe_checkout_session_id: string | null }): boolean {
  const live = process.env.STRIPE_ENVIRONMENT?.trim() === "live";
  return (order.stripe_checkout_session_id ?? "").startsWith(live ? "cs_live_" : "cs_test_");
}
