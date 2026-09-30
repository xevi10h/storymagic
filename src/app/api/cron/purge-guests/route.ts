import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { eraseAccount, erasureServiceClient } from "@/lib/privacy/account-erasure";
import {
  GUEST_INACTIVE_DAYS,
  PAID_EVER_STATUSES,
  selectGuestsToPurge,
  type GuestCandidate,
} from "@/lib/privacy/retention-policy";

/**
 * Guest retention. Daily (vercel.json): anonymous users with no paid order and no
 * activity (sign-in, story edit) for 30 days are erased with the same routine as
 * DELETE /api/account. Registered users keep their library.
 *
 *   ?dry_run=1   read-only: selection + per-user counts, nothing is written
 *   ?limit=N     users per run (default 25, max 100)
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET`. Logs ids and counts only.
 */
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const USERS_PAGE = 1000;
const MAX_USER_PAGES = 100; // 100k users; beyond that move the selection into SQL
/** Stop starting new erasures after this, leaving headroom before the 300 s kill. */
const BUDGET_MS = 240_000;

async function listAllUsers(admin: SupabaseClient): Promise<GuestCandidate[]> {
  const users: GuestCandidate[] = [];
  for (let page = 1; page <= MAX_USER_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: USERS_PAGE });
    if (error) throw new Error(`listUsers: ${error.message}`);
    for (const u of data.users) {
      users.push({
        id: u.id,
        is_anonymous: u.is_anonymous ?? false,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
      });
    }
    if (data.users.length < USERS_PAGE) return users;
  }
  throw new Error("listUsers: too many users for the in-memory selection");
}

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Every row of a query, paged (PostgREST caps one response at 1000 rows). */
async function pageAll<T>(what: string, fetchPage: (from: number, to: number) => Page<T>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await fetchPage(from, from + 999);
    if (error) throw new Error(`${what} read: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/purge-guests] CRON_SECRET not configured — purge disabled");
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = ["1", "true"].includes(url.searchParams.get("dry_run") ?? "");
  const limitParam = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), MAX_LIMIT) : DEFAULT_LIMIT;
  const startedAt = Date.now();

  try {
    const admin = erasureServiceClient();
    const users = await listAllUsers(admin);
    const anonymousIds = new Set(users.filter((u) => u.is_anonymous).map((u) => u.id));

    const stories = await pageAll<{ user_id: string; updated_at: string; is_showcase: boolean | null }>("stories", (from, to) =>
      admin.from("stories").select("user_id, updated_at, is_showcase").order("id").range(from, to),
    );
    const orders = await pageAll<{ user_id: string | null; status: string; stripe_payment_id: string | null }>("orders", (from, to) =>
      admin.from("orders").select("user_id, status, stripe_payment_id").not("user_id", "is", null).order("id").range(from, to),
    );

    const latestStoryUpdate = new Map<string, string>();
    const showcaseUserIds = new Set<string>();
    for (const s of stories) {
      if (!anonymousIds.has(s.user_id)) continue;
      const prev = latestStoryUpdate.get(s.user_id);
      if (!prev || s.updated_at > prev) latestStoryUpdate.set(s.user_id, s.updated_at);
      if (s.is_showcase) showcaseUserIds.add(s.user_id);
    }
    const paidUserIds = new Set(
      orders.filter((o) => o.user_id && (PAID_EVER_STATUSES.has(o.status) || o.stripe_payment_id)).map((o) => o.user_id as string),
    );

    const selection = selectGuestsToPurge({ users, latestStoryUpdate, paidUserIds, showcaseUserIds }, startedAt, { limit });

    const totals = { stories: 0, characters: 0, storageObjects: 0, ordersAnonymised: 0, ordersDeleted: 0 };
    let processed = 0;
    let failed = 0;
    let blocked = 0;
    for (const userId of selection.selected) {
      if (Date.now() - startedAt > BUDGET_MS) break;
      try {
        const result = await eraseAccount(admin, userId, { trigger: "guest_purge", dryRun, now: startedAt });
        if (result.state === "blocked") {
          blocked++;
          continue;
        }
        if (result.state === "not_found") continue;
        processed++;
        for (const k of Object.keys(totals) as Array<keyof typeof totals>) totals[k] += result.counts[k];
      } catch (err) {
        failed++;
        console.error(`[cron/purge-guests] erasure failed for ${userId}: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }

    const summary = {
      dryRun,
      inactiveDays: GUEST_INACTIVE_DAYS,
      users: users.length,
      anonymous: anonymousIds.size,
      eligible: selection.eligible,
      skippedPaid: selection.skippedPaid,
      skippedShowcase: selection.skippedShowcase,
      skippedActive: selection.skippedActive,
      selected: selection.selected.length,
      [dryRun ? "wouldErase" : "erased"]: processed,
      blocked,
      failed,
      totals,
      remaining: Math.max(0, selection.eligible - processed),
    };
    console.log(`[cron/purge-guests] ${JSON.stringify(summary)}`);
    return NextResponse.json(summary, { status: failed > 0 ? 500 : 200 });
  } catch (err) {
    console.error(`[cron/purge-guests] failed: ${err instanceof Error ? err.message : "unknown"}`);
    return NextResponse.json({ error: "purge_failed" }, { status: 500 });
  }
}
