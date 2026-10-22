import { NextResponse } from "next/server";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { runReyesReminders } from "@/lib/marketing/reyes-reminders";

/**
 * Reyes deadline reminder (src/lib/marketing/reyes-reminders.ts). Daily at 09:00 UTC
 * (vercel.json); it only sends inside the window before the printed Reyes cut-off, one
 * email per opt-in. Before migration 20261022120000 is applied the run answers
 * { migrationPending: true } with 200 and sends nothing.
 *
 *   ?dry_run=1   read-only: window + counts, nothing is claimed or sent
 *   ?limit=N     emails per run (default 200, max 500)
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET`. Logs subscriber ids and counts only.
 */
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;
/** Stop starting new sends after this, leaving headroom before the 300 s kill. */
const BUDGET_MS = 240_000;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/reyes-reminders] CRON_SECRET not configured — Reyes reminders disabled");
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
    const summary = await runReyesReminders(createFulfilmentClient(), { now: Date.now(), dryRun, limit, budgetMs: BUDGET_MS });
    console.log(`[cron/reyes-reminders] ${JSON.stringify(summary)}`);
    return NextResponse.json(summary, { status: summary.failed > 0 ? 500 : 200 });
  } catch (err) {
    console.error(`[cron/reyes-reminders] failed: ${err instanceof Error ? err.message : "unknown"}`);
    return NextResponse.json({ error: "reyes_reminders_failed" }, { status: 500 });
  }
}
