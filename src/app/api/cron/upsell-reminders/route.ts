import { NextResponse } from "next/server";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { runUpgradeReminders } from "@/lib/marketing/upgrade-reminder";

/**
 * "PDF → papel" reminder (src/lib/marketing/upgrade-reminder.ts). Daily (vercel.json):
 * one commercial email per PDF order, 7 days after its book_ready email, only to
 * buyers who may receive offers.
 *
 *   ?dry_run=1   read-only: selection + counts, nothing is claimed or sent
 *   ?limit=N     emails per run (default 50, max 200)
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET`. Logs order ids and counts only.
 */
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
/** Stop starting new sends after this, leaving headroom before the 300 s kill. */
const BUDGET_MS = 240_000;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/upsell-reminders] CRON_SECRET not configured — reminders disabled");
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = ["1", "true"].includes(url.searchParams.get("dry_run") ?? "");
  const limitParam = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), MAX_LIMIT) : DEFAULT_LIMIT;

  try {
    const summary = await runUpgradeReminders(createFulfilmentClient(), { now: Date.now(), dryRun, limit, budgetMs: BUDGET_MS });
    console.log(`[cron/upsell-reminders] ${JSON.stringify(summary)}`);
    return NextResponse.json(summary, { status: summary.failed > 0 ? 500 : 200 });
  } catch (err) {
    console.error(`[cron/upsell-reminders] failed: ${err instanceof Error ? err.message : "unknown"}`);
    return NextResponse.json({ error: "reminders_failed" }, { status: 500 });
  }
}
