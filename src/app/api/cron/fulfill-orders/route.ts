import { NextResponse } from "next/server";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { adminOrderUrl, alertOperator } from "@/lib/fulfilment/alerts";
import { applyGelatoStatus } from "@/lib/fulfilment/gelato-status";
import { sendOrderEmailOnce } from "@/lib/fulfilment/emails";
import {
  fulfilmentAgeHours,
  GELATO_MAX_ATTEMPTS,
  GELATO_STUCK_PRODUCING_HOURS,
  isOrderForActiveStripeMode,
} from "@/lib/fulfilment/logic";
import { getPrintOrder } from "@/lib/gelato/orders";

/**
 * Fulfilment driver. Every 5 min it finds paid orders that still need work and
 * invokes POST /api/stories/{id}/complete for each story IN PARALLEL (one
 * function instance per story, each with its own 300 s budget). /complete is
 * resumable + idempotent: it takes a per-story lease, continues from the last
 * checkpoint and returns before its deadline, so a book is finished across as
 * many invocations as it needs.
 *
 * Swept regardless of story status: an order stays "paid" until Gelato accepts
 * it, so a Gelato failure after the story is "ready" is retried here (with the
 * order's own backoff) instead of being stranded.
 *
 * Scheduled in vercel.json. Vercel sends `Authorization: Bearer $CRON_SECRET`,
 * which is forwarded to /complete as proof of a trusted caller.
 */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const MAX_PARALLEL = 5; // stories advanced per tick (each in its own invocation)
const CALL_TIMEOUT_MS = 290_000; // /complete returns within ~270 s
/**
 * Only auto-process recent orders; older unfinished ones are escalated, never auto-spent on.
 * "Recent" counts from the purchase OR from an operator re-queue in /admin
 * (orders.fulfilment_requeued_at), so a manual re-send works for an order of any age.
 */
const AUTO_PROCESS_MAX_AGE_HOURS = 48;
/** Escalate still-unfinished orders up to this age (older rows are legacy/test data). */
const ESCALATE_MAX_AGE_HOURS = 7 * 24;
/** Stop auto-retrying a story after this many consecutive failed runs and alert. */
const MAX_COMPLETION_INVOCATIONS = 12;

function baseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return `https://${prod}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3013";
}

/** Orders already at Gelato are reconciled for this long after purchase. */
const RECONCILE_MAX_AGE_DAYS = 45;

const isFuture =(iso: string | null, now: number) => !!iso && new Date(iso).getTime() > now;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // /complete trusts the bearer secret; without it the cron can't authenticate.
    console.error("[cron/fulfill] CRON_SECRET not configured — fulfilment driver disabled");
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let admin: ReturnType<typeof createFulfilmentClient>;
  try {
    admin = createFulfilmentClient();
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }

  const now = Date.now();
  const escalateSince = new Date(now - ESCALATE_MAX_AGE_HOURS * 3_600_000).toISOString();

  // Paid = not yet handed to Gelato (physical) or not yet delivered digitally.
  const { data: orders, error } = await admin
    .from("orders")
    .select(
      "id, story_id, format, created_at, fulfilment_requeued_at, stripe_checkout_session_id, gelato_submit_attempts, gelato_next_attempt_at, fulfilment_alerted_at",
    )
    .eq("status", "paid")
    .is("gelato_order_id", null)
    .is("fulfilment_hold_reason", null) // on hold (chargeback): an operator resumes it
    .not("story_id", "is", null)
    .or(`created_at.gte."${escalateSince}",fulfilment_requeued_at.gte."${escalateSince}"`)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const candidateStories: string[] = [];
  const escalate: typeof orders = [];
  const skipped: Array<{ orderId: string; reason: string }> = [];

  for (const order of orders ?? []) {
    if (!isOrderForActiveStripeMode(order)) {
      skipped.push({ orderId: order.id, reason: "other Stripe mode / mock order" });
      continue;
    }
    if (!order.story_id) {
      // The book was deleted with its account; the order row is kept as an accounting record.
      skipped.push({ orderId: order.id, reason: "story deleted" });
      continue;
    }
    if (fulfilmentAgeHours(order, now) > AUTO_PROCESS_MAX_AGE_HOURS) {
      escalate.push(order);
      continue;
    }
    if (order.gelato_submit_attempts >= GELATO_MAX_ATTEMPTS) {
      skipped.push({ orderId: order.id, reason: "gelato retries exhausted (operator alerted)" });
      continue;
    }
    if (isFuture(order.gelato_next_attempt_at, now)) {
      skipped.push({ orderId: order.id, reason: "gelato backoff" });
      continue;
    }
    if (order.story_id && !candidateStories.includes(order.story_id)) candidateStories.push(order.story_id);
  }

  // Story-level filters: lease held by a live run, backoff after a failure, cap.
  const toRun: string[] = [];
  if (candidateStories.length > 0) {
    const { data: stories, error: storiesErr } = await admin
      .from("stories")
      .select("id, status, completion_lease_until, completion_next_attempt_at, completion_attempts, completion_last_error")
      .in("id", candidateStories);
    if (storiesErr) return NextResponse.json({ error: storiesErr.message }, { status: 500 });

    for (const storyId of candidateStories) {
      const story = stories?.find((s) => s.id === storyId);
      if (!story) continue;
      if (isFuture(story.completion_lease_until, now)) {
        skipped.push({ orderId: storyId, reason: "story in progress (lease held)" });
        continue;
      }
      if (isFuture(story.completion_next_attempt_at, now)) {
        skipped.push({ orderId: storyId, reason: "story backoff" });
        continue;
      }
      if (story.completion_attempts >= MAX_COMPLETION_INVOCATIONS) {
        await alertOperator(admin, {
          key: `completion-capped:${storyId}`,
          subject: `Paid book stopped auto-completing after ${story.completion_attempts} failed runs (story ${storyId})`,
          lines: [
            `Story status: ${story.status}`,
            `Last error: ${story.completion_last_error ?? "none recorded"}`,
            "Fix the cause, then use \"Reintentar generación\" on the order in the admin panel (/admin, search the story id).",
          ],
          dedupeSeconds: 24 * 3600,
        });
        skipped.push({ orderId: storyId, reason: "completion invocation cap" });
        continue;
      }
      toRun.push(storyId);
      if (toRun.length >= MAX_PARALLEL) break;
    }
  }

  // Escalate stranded orders past the auto-processing window (deduped per order).
  for (const order of escalate ?? []) {
    await alertOperator(admin, {
      key: `order-stranded:${order.id}`,
      subject: `Paid order ${order.id} still not fulfilled after ${AUTO_PROCESS_MAX_AGE_HOURS} h`,
      lines: [
        `Story: ${order.story_id} · format: ${order.format} · created: ${order.created_at}`,
        `Gelato attempts: ${order.gelato_submit_attempts}`,
        "Automatic processing stopped for this order. Investigate, then use \"Reenviar a Gelato\" (or \"Reintentar generación\") in the admin panel: it re-queues the order for another 48 h.",
        `Admin: ${adminOrderUrl(order.id)}`,
      ],
      dedupeSeconds: 24 * 3600,
    });
  }

  // Fan out: one /complete invocation per story, in parallel.
  const base = baseUrl();
  const results = await Promise.allSettled(
    toRun.map(async (storyId) => {
      const res = await fetch(`${base}/api/stories/${storyId}/complete`, {
        method: "POST",
        headers: { authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      });
      const body = (await res.json().catch(() => null)) as { status?: string; error?: string } | null;
      return { storyId, httpStatus: res.status, status: body?.status ?? body?.error ?? null };
    }),
  );

  const triggered = results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { storyId: toRun[i], httpStatus: 0, status: r.reason instanceof Error ? r.reason.message : String(r.reason) },
  );
  for (const t of triggered) {
    if (t.httpStatus === 0 || t.httpStatus >= 500) {
      console.error(`[cron/fulfill] /complete for story ${t.storyId} → HTTP ${t.httpStatus} (${t.status})`);
    }
  }

  // Hourly (first tick of the hour): reconcile orders already at Gelato. Gelato
  // retries a failed webhook only 3× in 15 s, so a missed event would otherwise
  // leave the order (and the customer's tracking) stuck forever.
  const reconciled = new Date(now).getUTCMinutes() < 5 ? await reconcileGelatoOrders(admin, now) : null;

  return NextResponse.json({
    scanned: orders?.length ?? 0,
    triggered,
    skipped,
    escalated: (escalate ?? []).map((o) => o.id),
    reconciled,
  });
}

async function reconcileGelatoOrders(admin: ReturnType<typeof createFulfilmentClient>, now: number) {
  const since = new Date(now - RECONCILE_MAX_AGE_DAYS * 24 * 3_600_000).toISOString();
  const { data: active, error } = await admin
    .from("orders")
    .select("id, story_id, user_id, status, created_at, fulfilment_requeued_at, gelato_order_id, gelato_status, stripe_checkout_session_id")
    .in("status", ["producing", "shipped"])
    .not("gelato_order_id", "is", null)
    .or(`created_at.gte."${since}",fulfilment_requeued_at.gte."${since}"`)
    .limit(100);
  if (error) {
    console.error("[cron/fulfill] reconcile query failed:", error.message);
    return { error: error.message };
  }

  const result = { checked: 0, failed: 0, stuck: 0 };
  for (const order of active ?? []) {
    if (!order.gelato_order_id || !isOrderForActiveStripeMode(order)) continue;
    result.checked++;
    let remoteStatus = order.gelato_status ?? "";
    try {
      const remote = await getPrintOrder(order.gelato_order_id);
      remoteStatus = remote.fulfillmentStatus?.toLowerCase() ?? remoteStatus;
      const pkg = remote.shipment?.packages?.find((p) => p.trackingCode);
      await applyGelatoStatus(
        admin,
        order.gelato_order_id,
        remote.fulfillmentStatus,
        pkg ? { trackingNumber: pkg.trackingCode, trackingUrl: pkg.trackingUrl || null } : undefined,
      );
    } catch (err) {
      result.failed++;
      console.error(`[cron/fulfill] reconcile ${order.gelato_order_id} failed:`, err);
    }

    // A reprint counts from its re-queue, not from the original purchase.
    const ageHours = fulfilmentAgeHours(order, now);
    const shipped = ["shipped", "in_transit", "delivered"].includes(remoteStatus);
    if (order.status === "producing" && !shipped && ageHours > GELATO_STUCK_PRODUCING_HOURS) {
      result.stuck++;
      await alertOperator(admin, {
        key: `gelato-stuck:${order.id}`,
        subject: `Order ${order.id} still not shipped ${Math.round(ageHours / 24)} days after purchase`,
        lines: [
          `Gelato order ${order.gelato_order_id} · Gelato status: ${remoteStatus || "unknown"} · story ${order.story_id}`,
          "Check it in the Gelato dashboard (approval pending? file problem? production delay?) and tell the customer if it will be late.",
          `Admin: ${adminOrderUrl(order.id)}`,
        ],
        dedupeSeconds: 48 * 3600,
      });
      // …and the customer hears it from us before they have to ask (once per order).
      await sendOrderEmailOnce(admin, { order, column: "delay_email_sent_at", event: "print_delayed" });
    }
  }
  return result;
}
