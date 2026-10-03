// Abandoned-preview reminders run (server-only). Driven every 15 min by
// /api/cron/preview-reminders.
//
// A row of preview_reminders is the parent's express consent (LSSI 21.1 / RGPD 6.1.a)
// to be reminded about ONE story, plus the state of its sequence. Per run, for every
// open row (not stopped, stage < 3):
//   1. stop rules (pure reminderDecision): bought, unsubscribed, story gone, too late;
//   2. otherwise, when a reminder is due (1 h / 24 h / 72 h after the consent) and it is
//      not night in Spain, claim it with an optimistic `stage = previous` UPDATE (exactly
//      once across concurrent runs), re-check the suppression list, send, and release
//      the claim if the send fails so the next run retries.
// One story never gets more than three reminders, whatever happens (stage only grows).
// Logs carry ids and counts only, never addresses or names.

import type { FulfilmentClient, PreviewReminderRow } from "@/lib/fulfilment/db";
import { sendEmail, getSiteUrl } from "@/lib/email/send";
import { mailSafeName } from "@/lib/email/mail-safe-name";
import { buildPreviewReminderEmail, reminderDeadline, type ReminderDeadline } from "@/lib/email/preview-reminder";
import { createPreviewShareToken, previewShareUrl } from "@/lib/share/preview-share-token";
import { giftSeason, nextPhysicalCutoff, spainToday } from "@/lib/shipping";
import { isSuppressed, suppressedAmong, unsubscribeLinks } from "./suppression";
import {
  PREVIEW_REMINDER_CONSENT_VERSION,
  REMINDER_OFFSETS_MS,
  isQuietHour,
  reminderDecision,
  type ReminderStage,
  type ReminderStopReason,
} from "./preview-reminder-schedule";
import { normalizeEmail } from "./unsubscribe-token";

/** Orders in these statuses are paid (a refund sets refunded_at / status refunded). */
const PAID_STATUSES = ["paid", "producing", "shipped", "delivered"];
/** Open sequences examined per run. */
const SCAN_LIMIT = 500;

export interface PreviewReminderSummary {
  dryRun: boolean;
  quietHours: boolean;
  scanned: number;
  due: number;
  sent: number;
  wouldSend: number;
  failed: number;
  /** Due reminders left for a later run (limit, time budget or quiet hours). */
  deferred: number;
  stopped: Partial<Record<ReminderStopReason, number>>;
  claimedElsewhere: number;
}

type ReminderScanRow = Pick<PreviewReminderRow, "id" | "story_id" | "email" | "locale" | "consent_at" | "stage" | "last_sent_at">;

interface StoryFacts {
  status: string;
  cover: boolean;
  childName: string;
  childGender: string | null;
}

/** Cover picture for an email: a capability URL that redirects to a fresh signed image. */
export function previewCoverImageUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/api/preview-image/${encodeURIComponent(token)}`;
}

/** What today's reminder says about arriving on time (src/lib/shipping.ts is the single source). */
export function currentReminderDeadline(now: number): ReminderDeadline {
  const today = spainToday(new Date(now));
  const season = giftSeason(today);
  const inSeason = today >= season.bannerFrom && today <= season.ends;
  return reminderDeadline(nextPhysicalCutoff(today), inSeason, today <= season.deliverBy.christmas ? "christmas" : "reyes");
}

/**
 * Record (or refresh) the consent for one story. Idempotent per story: a second request
 * updates the address and the consent, never restarts the sequence. Returns false when
 * it could not be stored (e.g. the table is not there yet): the caller carries on.
 */
export async function recordPreviewReminderConsent(
  supabase: FulfilmentClient,
  p: { storyId: string; email: string; locale: string; now?: Date },
): Promise<boolean> {
  const email = normalizeEmail(p.email);
  if (!email) return false;
  const now = (p.now ?? new Date()).toISOString();
  const consent = { email, locale: p.locale, consent_at: now, consent_version: PREVIEW_REMINDER_CONSENT_VERSION, updated_at: now };
  try {
    const { data: existing, error: readErr } = await supabase
      .from("preview_reminders")
      .select("id, stage, stopped_at")
      .eq("story_id", p.storyId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (existing) {
      // Same story again: keep the sequence where it is (never more than 3 emails per story).
      // A new consent only re-anchors the clock while nothing has been sent yet.
      const patch = existing.stage === 0 && !existing.stopped_at ? consent : { email, locale: p.locale, updated_at: now };
      const { error } = await supabase.from("preview_reminders").update(patch).eq("id", existing.id);
      if (error) throw new Error(error.message);
      return !existing.stopped_at && existing.stage < 3;
    }
    const { error } = await supabase.from("preview_reminders").insert({ story_id: p.storyId, ...consent });
    // 23505: a concurrent request stored the consent for this story first.
    if (error && error.code !== "23505") throw new Error(error.message);
    return true;
  } catch (err) {
    console.error(`[preview-reminders] Could not record consent for story ${p.storyId}: ${err instanceof Error ? err.message : "unknown"}`);
    return false;
  }
}

export async function runPreviewReminders(
  supabase: FulfilmentClient,
  opts: { now: number; dryRun: boolean; limit: number; budgetMs: number; ignoreQuietHours?: boolean },
): Promise<PreviewReminderSummary> {
  const startedAt = Date.now();
  const { now, dryRun, limit } = opts;
  const quiet = !opts.ignoreQuietHours && isQuietHour(now);
  const summary: PreviewReminderSummary = {
    dryRun,
    quietHours: quiet,
    scanned: 0,
    due: 0,
    sent: 0,
    wouldSend: 0,
    failed: 0,
    deferred: 0,
    stopped: {},
    claimedElsewhere: 0,
  };

  // Everything that may be due (first reminder at +1 h) or must be closed.
  const { data, error } = await supabase
    .from("preview_reminders")
    .select("id, story_id, email, locale, consent_at, stage, last_sent_at")
    .is("stopped_at", null)
    .lt("stage", 3)
    .lte("consent_at", new Date(now - REMINDER_OFFSETS_MS[1]).toISOString())
    .order("consent_at", { ascending: true })
    .limit(SCAN_LIMIT);
  if (error) throw new Error(`preview_reminders scan: ${error.message}`);
  const rows = (data ?? []) as ReminderScanRow[];
  summary.scanned = rows.length;
  if (rows.length === 0) return summary;

  const storyIds = [...new Set(rows.map((r) => r.story_id))];
  const stories = new Map<string, StoryFacts>();
  const paidStories = new Set<string>();
  for (let i = 0; i < storyIds.length; i += 100) {
    const chunk = storyIds.slice(i, i + 100);
    const { data: storyRows, error: storyErr } = await supabase
      .from("stories")
      .select("id, status, cover_image_url, characters(name, gender)")
      .in("id", chunk);
    if (storyErr) throw new Error(`preview_reminders stories: ${storyErr.message}`);
    for (const s of storyRows ?? []) {
      const rel = s.characters as unknown as { name?: string; gender?: string } | { name?: string; gender?: string }[] | null;
      const character = Array.isArray(rel) ? rel[0] : rel;
      stories.set(s.id, {
        status: s.status,
        cover: !!s.cover_image_url,
        childName: mailSafeName(character?.name ?? ""),
        childGender: character?.gender ?? null,
      });
    }
    const { data: orderRows, error: orderErr } = await supabase
      .from("orders")
      .select("story_id")
      .in("story_id", chunk)
      .in("status", PAID_STATUSES)
      .is("refunded_at", null);
    if (orderErr) throw new Error(`preview_reminders orders: ${orderErr.message}`);
    for (const o of orderRows ?? []) if (o.story_id) paidStories.add(o.story_id);
  }
  const suppressed = await suppressedAmong(
    supabase,
    rows.map((r) => r.email),
  );

  const stop = async (row: ReminderScanRow, reason: ReminderStopReason) => {
    summary.stopped[reason] = (summary.stopped[reason] ?? 0) + 1;
    if (dryRun) return;
    const { error: stopErr } = await supabase
      .from("preview_reminders")
      .update({ stopped_at: new Date().toISOString(), stop_reason: reason, updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("stopped_at", null);
    if (stopErr) console.error(`[preview-reminders] Could not stop ${row.id}: ${stopErr.message}`);
  };

  const deadline = currentReminderDeadline(now);
  const site = getSiteUrl();

  for (const row of rows) {
    const story = stories.get(row.story_id) ?? null;
    const decision = reminderDecision({
      stage: row.stage,
      consentAt: Date.parse(row.consent_at),
      now,
      storyStatus: story?.status ?? null,
      hasPaidOrder: paidStories.has(row.story_id),
      suppressed: suppressed.has(row.email),
    });
    if (decision.action === "stop") {
      await stop(row, decision.reason);
      continue;
    }
    if (decision.action === "wait") continue;
    // A story without a usable name cannot be written about: close it rather than send a broken email.
    if (!story || !story.childName) {
      await stop(row, "story_unavailable");
      continue;
    }

    summary.due++;
    if (quiet || summary.sent + summary.wouldSend + summary.failed >= limit || Date.now() - startedAt > opts.budgetMs) {
      summary.deferred++;
      continue;
    }
    if (dryRun) {
      summary.wouldSend++;
      continue;
    }

    // Exactly once across concurrent runs: only the run that moves `stage` forward sends.
    const sentAt = new Date().toISOString();
    const { data: claimed, error: claimErr } = await supabase
      .from("preview_reminders")
      .update({ stage: decision.stage, last_sent_at: sentAt, updated_at: sentAt })
      .eq("id", row.id)
      .eq("stage", row.stage)
      .is("stopped_at", null)
      .select("id");
    if (claimErr) {
      console.error(`[preview-reminders] Could not claim ${row.id}: ${claimErr.message}`);
      summary.failed++;
      continue;
    }
    if (!claimed || claimed.length === 0) {
      summary.claimedElsewhere++;
      continue;
    }

    let ok = false;
    try {
      // An unsubscribe since the selection wins (the claim stays: nothing more is sent).
      if (await isSuppressed(supabase, row.email)) {
        await stop(row, "unsubscribed");
        continue;
      }
      ok = await sendReminder(row, story, decision.stage, { site, deadline });
    } catch (err) {
      console.error(`[preview-reminders] ${row.id} failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
    if (ok) {
      summary.sent++;
      console.log(`[preview-reminders] Sent reminder ${decision.stage} for story ${row.story_id}`);
    } else {
      summary.failed++;
      // Release the claim so the next run retries (only if nothing else moved it meanwhile).
      await supabase
        .from("preview_reminders")
        .update({ stage: row.stage, last_sent_at: row.last_sent_at, updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("stage", decision.stage)
        .eq("last_sent_at", sentAt);
    }
  }
  return summary;
}

async function sendReminder(
  row: ReminderScanRow,
  story: StoryFacts,
  stage: ReminderStage,
  ctx: { site: string; deadline: ReminderDeadline },
): Promise<boolean> {
  const links = unsubscribeLinks(row.email, row.locale);
  if (!links) return false; // no unsubscribe link, no commercial email
  const { token } = createPreviewShareToken(row.story_id);
  const built = buildPreviewReminderEmail({
    locale: row.locale,
    stage,
    childName: story.childName,
    childGender: story.childGender,
    previewUrl: previewShareUrl(ctx.site, row.locale, token),
    coverUrl: story.cover ? previewCoverImageUrl(ctx.site, token) : null,
    deadline: ctx.deadline,
    unsubscribeUrl: links.pageUrl,
  });
  return sendEmail({ to: row.email, subject: built.subject, html: built.html, text: built.text, headers: links.headers });
}
