// "PDF → papel" reminder run (server-only). Driven daily by /api/cron/upsell-reminders.
//
// Selection in SQL (cheap, uses orders_upsell_reminder_due_idx): paid PDF orders whose
// book_ready email went out 7-10 days ago, not refunded, not yet reminded, opt-out
// explicitly not ticked, attached to a user + story, with a checkout email. The final
// decision per order is the pure upgradeReminderDecision (src/lib/upsell.ts): the
// upgrade must still be on offer (no printed copy bought since, Stripe Prices live) and
// the address not suppressed. Each send is claimed exactly once through
// orders.upsell_reminder_sent_at; a failed send releases the claim for the next run.

import type { FulfilmentClient } from "@/lib/fulfilment/db";
import { isPdfUpgradeAvailable } from "@/lib/stripe";
import { sendEmail } from "@/lib/email/send";
import { buildUpgradeReminderEmail } from "@/lib/email/upsell-reminder";
import { loadStoryEmailContext, resolveBuyerName } from "@/lib/email/notify-order";
import {
  REMINDER_CATCH_UP_DAYS,
  UPGRADE_REMINDER_DELAY_DAYS,
  upgradeReminderDecision,
  type ReminderOrderRow,
  type ReminderSkipReason,
  type UpsellOrderRow,
} from "@/lib/upsell";
import { isSuppressed, suppressedAmong, unsubscribeLinks } from "./suppression";
import { normalizeEmail } from "./unsubscribe-token";

const DAY_MS = 86_400_000;
const LIVE_STATUSES = ["paid", "producing", "shipped", "delivered"];
/** Rows examined per run (the window is 3 days of PDF orders). */
const SCAN_LIMIT = 500;

export interface ReminderRunSummary {
  dryRun: boolean;
  upgradeAvailable: boolean;
  scanned: number;
  eligible: number;
  sent: number;
  wouldSend: number;
  failed: number;
  /** Eligible orders left for the next run (limit or time budget reached). */
  deferred: number;
  skipped: Partial<Record<ReminderSkipReason | "claimed_elsewhere", number>>;
}

export async function runUpgradeReminders(
  supabase: FulfilmentClient,
  opts: { now: number; dryRun: boolean; limit: number; budgetMs: number },
): Promise<ReminderRunSummary> {
  const startedAt = Date.now();
  const { now, dryRun, limit } = opts;
  const from = new Date(now - (UPGRADE_REMINDER_DELAY_DAYS + REMINDER_CATCH_UP_DAYS) * DAY_MS).toISOString();
  const to = new Date(now - UPGRADE_REMINDER_DELAY_DAYS * DAY_MS).toISOString();

  const { data: candidates, error } = await supabase
    .from("orders")
    .select(
      "id, user_id, story_id, format, status, refunded_at, created_at, offer, customer_email, ready_email_sent_at, marketing_opt_out, upsell_reminder_sent_at, stripe_checkout_session_id",
    )
    .eq("format", "digital_pdf")
    .eq("marketing_opt_out", false)
    .is("upsell_reminder_sent_at", null)
    .is("refunded_at", null)
    .in("status", LIVE_STATUSES)
    .not("user_id", "is", null)
    .not("story_id", "is", null)
    .not("customer_email", "is", null)
    .gte("ready_email_sent_at", from)
    .lte("ready_email_sent_at", to)
    .order("ready_email_sent_at", { ascending: true })
    .limit(SCAN_LIMIT);
  if (error) throw new Error(`reminder candidates: ${error.message}`);
  const rows = candidates ?? [];

  const summary: ReminderRunSummary = {
    dryRun,
    upgradeAvailable: false,
    scanned: rows.length,
    eligible: 0,
    sent: 0,
    wouldSend: 0,
    failed: 0,
    deferred: 0,
    skipped: {},
  };
  const skip = (reason: ReminderSkipReason | "claimed_elsewhere") => {
    summary.skipped[reason] = (summary.skipped[reason] ?? 0) + 1;
  };
  if (rows.length === 0) return summary;

  summary.upgradeAvailable = await isPdfUpgradeAvailable();

  // Every order of the buyers involved (a printed copy bought since ends the offer).
  const userIds = [...new Set(rows.map((r) => r.user_id as string))];
  const storyOrders = new Map<string, UpsellOrderRow[]>();
  for (let i = 0; i < userIds.length; i += 100) {
    const { data, error: ordersErr } = await supabase
      .from("orders")
      .select("id, user_id, story_id, format, status, refunded_at, created_at, offer")
      .in("user_id", userIds.slice(i, i + 100));
    if (ordersErr) throw new Error(`reminder story orders: ${ordersErr.message}`);
    for (const o of data ?? []) {
      const key = `${o.user_id}:${o.story_id}`;
      storyOrders.set(key, [...(storyOrders.get(key) ?? []), o as UpsellOrderRow]);
    }
  }
  const suppressed = await suppressedAmong(
    supabase,
    rows.map((r) => r.customer_email as string),
  );

  const due: typeof rows = [];
  for (const row of rows) {
    const decision = upgradeReminderDecision(row as ReminderOrderRow, storyOrders.get(`${row.user_id}:${row.story_id}`) ?? [], {
      now,
      upgradeAvailable: summary.upgradeAvailable,
      suppressed: suppressed.has(normalizeEmail(row.customer_email) ?? ""),
    });
    if (decision.send) due.push(row);
    else skip(decision.reason);
  }
  summary.eligible = due.length;

  for (const order of due) {
    if (summary.sent + summary.wouldSend + summary.failed >= limit || Date.now() - startedAt > opts.budgetMs) {
      summary.deferred++;
      continue;
    }
    if (dryRun) {
      summary.wouldSend++;
      continue;
    }
    const email = (order.customer_email as string).trim();
    // Exactly once across concurrent runs; the opt-out is re-checked in the same UPDATE.
    const { data: claimed, error: claimErr } = await supabase
      .from("orders")
      .update({ upsell_reminder_sent_at: new Date().toISOString() })
      .eq("id", order.id)
      .is("upsell_reminder_sent_at", null)
      .eq("marketing_opt_out", false)
      .select("id");
    if (claimErr) {
      console.error(`[upsell-reminder] Could not claim order ${order.id}: ${claimErr.message}`);
      summary.failed++;
      continue;
    }
    if (!claimed || claimed.length === 0) {
      skip("claimed_elsewhere");
      continue;
    }

    let ok = false;
    try {
      // An unsubscribe since the selection wins.
      if (await isSuppressed(supabase, email)) {
        skip("suppressed");
        continue; // the claim stays: this order is never reminded
      }
      ok = await sendReminder(supabase, order, email);
    } catch (err) {
      console.error(`[upsell-reminder] Order ${order.id} failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
    if (ok) {
      summary.sent++;
    } else {
      summary.failed++;
      await supabase.from("orders").update({ upsell_reminder_sent_at: null }).eq("id", order.id);
    }
  }
  return summary;
}

async function sendReminder(
  supabase: FulfilmentClient,
  order: { id: string; user_id: string | null; story_id: string | null; stripe_checkout_session_id: string | null },
  email: string,
): Promise<boolean> {
  const story = await loadStoryEmailContext(supabase, order.story_id as string);
  if (!story) return false;
  const links = unsubscribeLinks(email, story.locale);
  if (!links) return false;
  const buyerName = await resolveBuyerName(supabase, order.user_id as string, order.stripe_checkout_session_id);
  const built = buildUpgradeReminderEmail({
    locale: story.locale,
    buyerName,
    childName: story.childName,
    bookTitle: story.bookTitle,
    recipientEmail: email,
    unsubscribeUrl: links.pageUrl,
  });
  const ok = await sendEmail({ to: email, subject: built.subject, html: built.html, text: built.text, headers: links.headers });
  if (ok) console.log(`[upsell-reminder] Sent to order ${order.id}`);
  return ok;
}
