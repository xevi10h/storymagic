import { NextResponse } from "next/server";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { runPreviewReminders } from "@/lib/marketing/preview-reminders";

/**
 * Abandoned-preview reminders (src/lib/marketing/preview-reminders.ts). Every 15 min
 * (vercel.json): up to three emails per story (1 h, 24 h, 72 h after the parent asked to
 * be reminded), only with the consent stored in preview_reminders, until they buy or
 * unsubscribe. Nothing is sent between 22:00 and 08:00 (Spain).
 *
 *   ?dry_run=1        read-only: selection + counts, nothing is claimed, stopped or sent
 *   ?limit=N          emails per run (default 50, max 200)
 *   ?ignore_quiet=1   send during quiet hours too (manual runs / tests)
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET`. Logs story ids and counts only.
 */
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
/** Stop starting new sends after this, leaving headroom before the 300 s kill. */
const BUDGET_MS = 240_000;

const flag = (value: string | null) => ["1", "true"].includes(value ?? "");

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/preview-reminders] CRON_SECRET not configured — reminders disabled");
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), MAX_LIMIT) : DEFAULT_LIMIT;

  try {
    const summary = await runPreviewReminders(createFulfilmentClient(), {
      now: Date.now(),
      dryRun: flag(url.searchParams.get("dry_run")),
      limit,
      budgetMs: BUDGET_MS,
      ignoreQuietHours: flag(url.searchParams.get("ignore_quiet")),
    });
    console.log(`[cron/preview-reminders] ${JSON.stringify(summary)}`);
    return NextResponse.json(summary, { status: summary.failed > 0 ? 500 : 200 });
  } catch (err) {
    console.error(`[cron/preview-reminders] failed: ${err instanceof Error ? err.message : "unknown"}`);
    return NextResponse.json({ error: "reminders_failed" }, { status: 500 });
  }
}
