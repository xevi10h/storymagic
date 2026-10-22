// Reyes deadline reminder run (server-only). Driven by /api/cron/reyes-reminders.
//
// Promise of the opt-in (tools.common.reminderHint): ONE email before the last day to order
// a printed book that arrives for Reyes, nothing else. Outside the window
// (reyesReminderWindow: cut-off − REYES_REMINDER_LEAD_DAYS … cut-off) the run does nothing;
// inside it, every consent given this season and not yet served gets the email once, so a
// late opt-in (after sendFrom) still gets it on the next daily run. Each send is claimed
// through newsletter_subscribers.reyes_reminder_sent_at; a failed send releases the claim.
//
// Before migration 20261022120000 is applied the scan fails with "column does not exist":
// the run reports { migrationPending: true } and sends nothing.

import type { FulfilmentClient } from "@/lib/fulfilment/db";
import { sendEmail, getSiteUrl } from "@/lib/email/send";
import { buildReyesReminderEmail } from "@/lib/email/reyes-reminder";
import { reyesReminderWindow, spainToday } from "@/lib/shipping";
import { isMissingSchemaError } from "@/lib/reviews/schema";
import { isSuppressed, suppressedAmong, unsubscribeLinks } from "./suppression";
import { normalizeEmail } from "./unsubscribe-token";

const SCAN_LIMIT = 1000;

export interface ReyesReminderSummary {
  dryRun: boolean;
  migrationPending: boolean;
  /** false = today is outside the send window (nothing scanned). */
  inWindow: boolean;
  sendFrom: string;
  cutoff: string;
  scanned: number;
  sent: number;
  wouldSend: number;
  failed: number;
  deferred: number;
  suppressed: number;
  claimedElsewhere: number;
}

export async function runReyesReminders(
  supabase: FulfilmentClient,
  opts: { now: number; dryRun: boolean; limit: number; budgetMs: number },
): Promise<ReyesReminderSummary> {
  const startedAt = Date.now();
  const today = spainToday(new Date(opts.now));
  const window = reyesReminderWindow(today);
  const summary: ReyesReminderSummary = {
    dryRun: opts.dryRun,
    migrationPending: false,
    inWindow: today >= window.sendFrom && today <= window.cutoff,
    sendFrom: window.sendFrom,
    cutoff: window.cutoff,
    scanned: 0,
    sent: 0,
    wouldSend: 0,
    failed: 0,
    deferred: 0,
    suppressed: 0,
    claimedElsewhere: 0,
  };

  const { data, error } = await supabase
    .from("newsletter_subscribers")
    .select("id, email, locale")
    .gte("reyes_reminder_consent_at", window.seasonStart)
    .is("reyes_reminder_sent_at", null)
    .order("reyes_reminder_consent_at")
    .limit(SCAN_LIMIT);
  if (error && isMissingSchemaError(error)) {
    summary.migrationPending = true;
    return summary;
  }
  if (error) throw new Error(`reyes reminder candidates: ${error.message}`);
  const rows = data ?? [];
  summary.scanned = rows.length;
  // Scanned outside the window too, so a dry run shows how many opt-ins are waiting.
  if (!summary.inWindow || rows.length === 0) return summary;

  const suppressed = await suppressedAmong(
    supabase,
    rows.map((r) => r.email),
  );

  for (const row of rows) {
    if (suppressed.has(normalizeEmail(row.email) ?? "")) {
      summary.suppressed++;
      continue;
    }
    if (summary.sent + summary.wouldSend + summary.failed >= opts.limit || Date.now() - startedAt > opts.budgetMs) {
      summary.deferred++;
      continue;
    }
    if (opts.dryRun) {
      summary.wouldSend++;
      continue;
    }
    // Exactly once across concurrent runs.
    const { data: claimed, error: claimErr } = await supabase
      .from("newsletter_subscribers")
      .update({ reyes_reminder_sent_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("reyes_reminder_sent_at", null)
      .select("id");
    if (claimErr) {
      console.error(`[reyes-reminder] Could not claim subscriber ${row.id}: ${claimErr.message}`);
      summary.failed++;
      continue;
    }
    if (!claimed || claimed.length === 0) {
      summary.claimedElsewhere++;
      continue;
    }

    let ok = false;
    try {
      if (await isSuppressed(supabase, row.email)) {
        summary.suppressed++;
        continue; // the claim stays: this address is never written to
      }
      ok = await sendReminder(row.email, row.locale ?? "es", window.cutoff);
    } catch (err) {
      console.error(`[reyes-reminder] Subscriber ${row.id} failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
    if (ok) {
      summary.sent++;
    } else {
      summary.failed++;
      await supabase.from("newsletter_subscribers").update({ reyes_reminder_sent_at: null }).eq("id", row.id);
    }
  }
  return summary;
}

async function sendReminder(email: string, locale: string, cutoff: string): Promise<boolean> {
  const loc = locale === "ca" ? "ca" : "es";
  const links = unsubscribeLinks(email, loc);
  if (!links) return false;
  const built = buildReyesReminderEmail({
    locale: loc,
    cutoff,
    createUrl: `${getSiteUrl()}/${loc}/create?utm_source=email&utm_medium=email&utm_campaign=reyes_reminder`,
    unsubscribeUrl: links.pageUrl,
  });
  return sendEmail({ to: email.trim(), subject: built.subject, html: built.html, text: built.text, headers: links.headers });
}
