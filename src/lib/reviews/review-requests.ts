// Review-request run (server-only). Driven by /api/cron/review-requests.
//
// Selection in SQL (cheap, partial indexes from 20261019150000_reviews.sql): printed orders
// shipped in the scan window and PDF orders whose book_ready email went out in theirs,
// not yet asked, not refunded, not follow-on offers. The final decision per order is the
// pure reviewRequestDecision (review-schedule.ts). Each send is claimed exactly once
// through orders.review_request_sent_at; a failed send releases the claim.
//
// Before the migration is applied, the scan fails with "column does not exist": the run
// reports { migrationPending: true } and sends nothing (the cron must not 500 every hour).

import type { FulfilmentClient } from "@/lib/fulfilment/db";
import { sendEmail, getSiteUrl } from "@/lib/email/send";
import { buildReviewRequestEmail } from "@/lib/email/review-request";
import { resolveBuyerName } from "@/lib/email/notify-order";
import { mailSafeName } from "@/lib/email/mail-safe-name";
import { isAuthLocale } from "@/lib/auth/next-path";
import { TRANSIT_BUSINESS_DAYS } from "@/lib/product-facts";
import type { NameGender } from "@/lib/name-grammar";
import { isSuppressed, suppressedAmong, unsubscribeLinks } from "@/lib/marketing/suppression";
import { normalizeEmail } from "@/lib/marketing/unsubscribe-token";
import { reviewRequestDecision, reviewScanWindow, type ReviewOrderRow, type ReviewSkipReason } from "./review-schedule";
import { reviewKey, reviewPageUrl, signReviewToken } from "./review-token";
import { isMissingSchemaError } from "./schema";

const LIVE_STATUSES = ["paid", "producing", "shipped", "delivered"];
const SCAN_LIMIT = 500;
const COLUMNS =
  "id, user_id, story_id, format, status, customer_email, refunded_at, disputed_at, problem_email_sent_at, offer, total, marketing_opt_out, ready_email_sent_at, shipped_at, delivered_at, review_request_sent_at, stripe_checkout_session_id";

type CandidateRow = ReviewOrderRow & { user_id: string | null; stripe_checkout_session_id: string | null };

export interface ReviewRunSummary {
  dryRun: boolean;
  migrationPending: boolean;
  scanned: number;
  eligible: number;
  sent: number;
  wouldSend: number;
  failed: number;
  deferred: number;
  skipped: Partial<Record<ReviewSkipReason | "claimed_elsewhere", number>>;
}

export async function runReviewRequests(
  supabase: FulfilmentClient,
  opts: { now: number; dryRun: boolean; limit: number; budgetMs: number },
): Promise<ReviewRunSummary> {
  const startedAt = Date.now();
  const { now, dryRun, limit } = opts;
  const transit = TRANSIT_BUSINESS_DAYS.max;
  const window = reviewScanWindow(now, transit);
  const summary: ReviewRunSummary = {
    dryRun,
    migrationPending: false,
    scanned: 0,
    eligible: 0,
    sent: 0,
    wouldSend: 0,
    failed: 0,
    deferred: 0,
    skipped: {},
  };
  const skip = (reason: ReviewSkipReason | "claimed_elsewhere") => {
    summary.skipped[reason] = (summary.skipped[reason] ?? 0) + 1;
  };

  const base = () =>
    supabase
      .from("orders")
      .select(COLUMNS)
      .is("review_request_sent_at", null)
      .is("refunded_at", null)
      .is("offer", null)
      .gt("total", 0)
      .in("status", LIVE_STATUSES)
      .not("story_id", "is", null)
      .not("customer_email", "is", null);
  const [printed, pdf] = await Promise.all([
    base().neq("format", "digital_pdf").gte("shipped_at", window.from).lte("shipped_at", window.to).order("shipped_at").limit(SCAN_LIMIT),
    base().eq("format", "digital_pdf").gte("ready_email_sent_at", window.pdfFrom).lte("ready_email_sent_at", window.pdfTo).order("ready_email_sent_at").limit(SCAN_LIMIT),
  ]);
  for (const res of [printed, pdf]) {
    if (res.error && isMissingSchemaError(res.error)) {
      summary.migrationPending = true;
      return summary;
    }
    if (res.error) throw new Error(`review candidates: ${res.error.message}`);
  }
  const rows = [...(printed.data ?? []), ...(pdf.data ?? [])] as CandidateRow[];
  summary.scanned = rows.length;
  if (rows.length === 0) return summary;

  const suppressed = await suppressedAmong(
    supabase,
    rows.map((r) => r.customer_email as string),
  );
  const due = rows.filter((row) => {
    const decision = reviewRequestDecision(row, {
      now,
      suppressed: suppressed.has(normalizeEmail(row.customer_email) ?? ""),
      transitBusinessDays: transit,
    });
    if (!decision.send) skip(decision.reason);
    return decision.send;
  });
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
    // Exactly once across concurrent runs; the opt-out and refund are re-checked in the same UPDATE.
    const { data: claimed, error: claimErr } = await supabase
      .from("orders")
      .update({ review_request_sent_at: new Date().toISOString() })
      .eq("id", order.id)
      .is("review_request_sent_at", null)
      .is("refunded_at", null)
      .or("marketing_opt_out.is.null,marketing_opt_out.eq.false")
      .select("id");
    if (claimErr) {
      console.error(`[review-request] Could not claim order ${order.id}: ${claimErr.message}`);
      summary.failed++;
      continue;
    }
    if (!claimed || claimed.length === 0) {
      skip("claimed_elsewhere");
      continue;
    }

    let ok = false;
    try {
      if (await isSuppressed(supabase, email)) {
        skip("suppressed");
        continue; // the claim stays: this order is never asked
      }
      ok = await sendRequest(supabase, order, email);
    } catch (err) {
      console.error(`[review-request] Order ${order.id} failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
    if (ok) {
      summary.sent++;
    } else {
      summary.failed++;
      await supabase.from("orders").update({ review_request_sent_at: null }).eq("id", order.id);
    }
  }
  return summary;
}

async function sendRequest(supabase: FulfilmentClient, order: CandidateRow, email: string): Promise<boolean> {
  const { data: story, error } = await supabase
    .from("stories")
    .select("locale, characters(name, gender)")
    .eq("id", order.story_id as string)
    .maybeSingle();
  if (error || !story) return false;
  const rel = story.characters as { name?: string | null; gender?: string | null } | { name?: string | null; gender?: string | null }[] | null;
  const character = Array.isArray(rel) ? rel[0] : rel;
  const locale = isAuthLocale(story.locale ?? "") ? (story.locale as string) : "es";
  const links = unsubscribeLinks(email, locale);
  if (!links) return false;
  const buyerName = order.user_id ? await resolveBuyerName(supabase, order.user_id, order.stripe_checkout_session_id) : null;
  const token = signReviewToken("review", order.id, reviewKey("review"));
  const built = buildReviewRequestEmail({
    locale,
    buyerName,
    childName: mailSafeName(character?.name ?? ""),
    childGender: (character?.gender ?? null) as NameGender,
    printed: order.format !== "digital_pdf",
    reviewUrl: reviewPageUrl(getSiteUrl(), locale, token),
    unsubscribeUrl: links.pageUrl,
  });
  const ok = await sendEmail({ to: email, subject: built.subject, html: built.html, text: built.text, headers: links.headers });
  if (ok) console.log(`[review-request] Sent for order ${order.id}`);
  return ok;
}
