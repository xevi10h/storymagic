import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Safety-net cron: guarantees paid orders reach Gelato even if the customer
 * closed the checkout-success tab (the primary, client-triggered completion).
 *
 * It sweeps orders stuck at `status="paid"` whose story hasn't been completed,
 * and re-triggers POST /api/stories/{id}/complete (which accepts a server-to-
 * server call via its guest/service-role path — it just re-verifies the paid
 * order). The complete route is idempotent: it gates on story status and
 * Gelato's orderReferenceId, so re-runs are safe.
 *
 * Scheduled in vercel.json. Vercel sends `Authorization: Bearer $CRON_SECRET`.
 */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Tuning
const MAX_PER_RUN = 2; // books completed per invocation (each can take minutes)
const THROTTLE_MIN = 5; // don't re-trigger a story touched < 5 min ago
const STALE_COMPLETING_MIN = 8; // a "completing" story idle longer than this = crashed mid-run
const MAX_AGE_HOURS = 6; // stop auto-retrying after this; surfaces for manual handling

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Missing Supabase service config");
  return createSupabaseAdmin<Database>(url, serviceKey);
}

function baseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return `https://${prod}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3013";
}

export async function GET(request: Request) {
  // Auth — Vercel cron injects `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let admin: ReturnType<typeof createServiceClient>;
  try {
    admin = createServiceClient();
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }

  const now = Date.now();

  // Candidate orders: paid but not yet fulfilled (oldest first).
  const { data: orders, error } = await admin
    .from("orders")
    .select("id, story_id, created_at")
    .eq("status", "paid")
    .order("created_at", { ascending: true })
    .limit(25);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const triggered: Array<{ storyId: string; httpStatus: number }> = [];
  const stuck: string[] = []; // paid + unfulfilled past MAX_AGE_HOURS → needs manual attention
  const base = baseUrl();

  for (const order of orders ?? []) {
    if (triggered.length >= MAX_PER_RUN) break;

    const ageHours = (now - new Date(order.created_at).getTime()) / 3_600_000;
    if (ageHours > MAX_AGE_HOURS) {
      stuck.push(order.id);
      continue;
    }

    const { data: story } = await admin
      .from("stories")
      .select("status, updated_at")
      .eq("id", order.story_id)
      .single();
    if (!story) continue;

    // Already fulfilled (shouldn't still be "paid", but be safe).
    if (story.status === "ready" || story.status === "ordered" || story.status === "shipped") continue;

    const idleMin = (now - new Date(story.updated_at).getTime()) / 60_000;

    // In-flight completion (started < STALE_COMPLETING_MIN ago) — let it finish.
    if (story.status === "completing" && idleMin < STALE_COMPLETING_MIN) continue;

    // Recently attempted — throttle to avoid hammering / cost runaway.
    if (idleMin < THROTTLE_MIN) continue;

    // Only "preview" (abandoned/failed-and-reset) or stale "completing" reach here → fulfil.
    try {
      const res = await fetch(`${base}/api/stories/${order.story_id}/complete`, {
        method: "POST",
        headers: { "x-cron-fulfillment": "1" },
      });
      triggered.push({ storyId: order.story_id, httpStatus: res.status });
      if (!res.ok) {
        console.error(`[cron/fulfill] complete failed for story ${order.story_id} → HTTP ${res.status}`);
      }
    } catch (e) {
      console.error(`[cron/fulfill] complete threw for story ${order.story_id}:`, e);
      triggered.push({ storyId: order.story_id, httpStatus: 0 });
    }
  }

  if (stuck.length > 0) {
    console.error(`[cron/fulfill] ${stuck.length} paid order(s) unfulfilled past ${MAX_AGE_HOURS}h — manual attention: ${stuck.join(", ")}`);
  }

  return NextResponse.json({
    scanned: orders?.length ?? 0,
    triggered,
    stuckNeedsManual: stuck,
  });
}
