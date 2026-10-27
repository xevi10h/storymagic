import { NextResponse } from "next/server";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { runAdventEmails } from "@/lib/advent/send-run";
import { adventToday } from "@/lib/advent/today";

/**
 * Advent calendar daily email (src/lib/advent/send-run.ts). Runs every 15 min from 06:00
 * to 11:45 UTC (07:00–12:45 Madrid in December, vercel.json); each run sends today's door
 * to the subscriptions still owed it, so later runs pick up what an earlier one deferred.
 * Sends only on 1–24 December (Spain date). Before migration 20261027120000 is applied the
 * run answers { migrationPending: true } with 200 and sends nothing.
 *
 *   ?dry_run=1   read-only: door + counts, nothing is claimed or sent
 *   ?limit=N     emails per run (default 150, max 400)
 *   ?now=YYYY-MM-DD  dev only (ignored in production)
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET`. Logs ids and counts only.
 */
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 150;
const MAX_LIMIT = 400;
/** Stop starting new sends after this, leaving headroom before the 300 s kill. */
const BUDGET_MS = 240_000;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/advent] CRON_SECRET not configured — Advent emails disabled");
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
    const summary = await runAdventEmails(createFulfilmentClient(), {
      now: Date.now(),
      dryRun,
      limit,
      budgetMs: BUDGET_MS,
      today: adventToday(url.searchParams.get("now")),
    });
    console.log(`[cron/advent] ${JSON.stringify(summary)}`);
    return NextResponse.json(summary, { status: summary.failed > 0 ? 500 : 200 });
  } catch (err) {
    console.error(`[cron/advent] failed: ${err instanceof Error ? err.message : "unknown"}`);
    return NextResponse.json({ error: "advent_failed" }, { status: 500 });
  }
}
