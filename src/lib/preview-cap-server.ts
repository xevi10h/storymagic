// Global daily ceiling on paid AI previews (server side, service role).
//
// Guests are anonymous Supabase users, so a bot can create unlimited "users" and
// per-user rate limits never bound total spend. This caps NEW previews started
// per UTC day across everyone (env DAILY_PREVIEW_CAP, default 300, "0" = off).
// Paid-order completion (/complete, fulfilment cron) never calls this.
//
// Counting: public.claim_daily_preview (atomic slot claim, migration
// 20260930170000_daily_preview_cap.sql). Until that migration is applied, the
// fallback counts today's `generate_story` rows in rate_limits (written by
// checkRateLimit just before): approximate under concurrency, but a ceiling.
// If both fail the request is allowed (fail open, like checkRateLimit).

import { after } from "next/server";
import type { FulfilmentClient } from "@/lib/fulfilment/db";
import { alertOperator } from "@/lib/fulfilment/alerts";
import {
  dailyCapAlertKey,
  dailyCapDecision,
  isDailyCapFull,
  parseDailyPreviewCap,
  utcDay,
  warnThreshold,
  type DailyCapAlert,
} from "@/lib/preview-cap";

export { DAILY_CAP_ERROR } from "@/lib/preview-cap";

/** Alerts already handed to alertOperator by this instance (it dedupes durably too). */
const alertedThisInstance = new Set<string>();

function dailyPreviewCap(): number | null {
  return parseDailyPreviewCap(process.env.DAILY_PREVIEW_CAP);
}

function utcMidnightIso(day: string): string {
  return `${day}T00:00:00.000Z`;
}

/** Fallback count: preview requests that passed the per-user limiter today. */
async function countFromRateLimits(db: FulfilmentClient, day: string): Promise<number | null> {
  const { count, error } = await db
    .from("rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("action", "generate_story")
    .gte("created_at", utcMidnightIso(day));
  if (error) {
    console.error(`[preview-cap] fallback count failed: ${error.message}`);
    return null;
  }
  return count ?? 0;
}

function scheduleAlert(db: FulfilmentClient, alert: DailyCapAlert, day: string, cap: number, slot: number | null) {
  const key = dailyCapAlertKey(alert, day);
  if (alertedThisInstance.has(key)) return;
  alertedThisInstance.add(key);
  const subject =
    alert === "reached"
      ? `Daily preview cap reached (${cap}/${cap} on ${day} UTC)`
      : `Daily preview cap at ${Math.round((warnThreshold(cap) / cap) * 100)}% (${slot ?? "?"}/${cap} on ${day} UTC)`;
  const lines =
    alert === "reached"
      ? [
          `${cap} AI previews have been started today (UTC). New previews now get "high demand, come back tomorrow" until 00:00 UTC.`,
          "Paid orders are NOT affected: completion and the fulfilment cron are never capped.",
          "If this is real demand, raise DAILY_PREVIEW_CAP in Vercel (Production) and redeploy. If it looks like abuse, check Supabase Auth (anonymous sign-ups, CAPTCHA) and the stories created today.",
        ]
      : [
          `${slot ?? "?"} of ${cap} daily AI previews have been started today (UTC).`,
          "At the cap, new previews are refused until 00:00 UTC (paid orders are never affected).",
          "If this is real demand, consider raising DAILY_PREVIEW_CAP in Vercel. If not, check anonymous sign-ups and today's stories for abuse.",
        ];
  after(async () => {
    await alertOperator(db, { key, subject, lines, dedupeSeconds: 2 * 86_400 });
  });
}

/**
 * Take one preview slot for today. Call right before the paid AI work starts,
 * after the request is known to start a new preview. `allowed: false` → answer
 * 503 { error: DAILY_CAP_ERROR } and spend nothing.
 */
export async function claimDailyPreviewSlot(db: FulfilmentClient, now: Date = new Date()): Promise<{ allowed: boolean }> {
  const cap = dailyPreviewCap();
  if (cap === null) return { allowed: true };
  const day = utcDay(now);

  let slot: number | null;
  const { data, error } = await db.rpc("claim_daily_preview", { p_day: day, p_cap: cap });
  if (!error) {
    slot = typeof data === "number" ? data : null;
  } else {
    console.warn(`[preview-cap] claim_daily_preview unavailable (${error.message}); using the rate_limits count`);
    const counted = await countFromRateLimits(db, day);
    if (counted === null) return { allowed: true }; // fail open: never block on a DB outage
    slot = counted;
  }

  const decision = dailyCapDecision(slot, cap);
  if (decision.alert) scheduleAlert(db, decision.alert, day, cap, slot);
  if (!decision.allowed) console.warn(`[preview-cap] refused: daily cap ${cap} reached for ${day}`);
  return { allowed: decision.allowed };
}

/**
 * Read-only: is today's cap already full? For other paid AI calls that belong to
 * a preview (character sheet, portrait) so they do not spend once previews stop.
 */
export async function isDailyPreviewCapFull(db: FulfilmentClient, now: Date = new Date()): Promise<boolean> {
  const cap = dailyPreviewCap();
  if (cap === null) return false;
  const day = utcDay(now);
  const { data, error } = await db.from("daily_preview_counts").select("count").eq("day", day).maybeSingle();
  if (!error) return isDailyCapFull(data?.count ?? 0, cap);
  const counted = await countFromRateLimits(db, day);
  return counted !== null && isDailyCapFull(counted, cap);
}
