import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMockIllustrationUrl } from "@/lib/ai/mock-story";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { advanceStoryFulfilment } from "@/lib/fulfilment/pipeline";

// Each invocation advances the book as far as the budget allows and checkpoints
// every step (see src/lib/fulfilment/pipeline.ts). The cron re-invokes it until
// the book is generated and sent to print, so it never has to fit in one call.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Stop starting/awaiting work after this; leaves headroom before the 300 s kill. */
const WORK_BUDGET_MS = 270_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAID_ORDER_STATUSES = ["paid", "producing", "shipped", "delivered"];

function isCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  const startedAt = Date.now();
  const { storyId } = await params;

  if (!UUID_RE.test(storyId)) {
    return NextResponse.json({ error: "Invalid story ID" }, { status: 400 });
  }

  let admin: ReturnType<typeof createFulfilmentClient>;
  try {
    admin = createFulfilmentClient();
  } catch (err) {
    console.error("[Complete] Supabase service config missing:", err);
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  // ── Authorization: cron (bearer secret) · story owner · guest with a paid order ──
  if (!isCronRequest(request)) {
    const userSupabase = await createClient();
    const { data: { user } } = await userSupabase.auth.getUser();

    if (user) {
      const { checkRateLimit } = await import("@/lib/rate-limit");
      const rl = await checkRateLimit(user.id, "complete_story");
      if (!rl.allowed) {
        return NextResponse.json(
          { error: "Too many requests. Please wait." },
          { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds ?? 300) } },
        );
      }
      const { data: owned } = await admin
        .from("stories")
        .select("id")
        .eq("id", storyId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!owned) return NextResponse.json({ error: "Story not found" }, { status: 404 });
    } else {
      // Guest (checkout success page without a session): a paid order is the proof.
      // Safe to expose: the call only advances an already-paid, idempotent job.
      const { data: paidOrder } = await admin
        .from("orders")
        .select("id")
        .eq("story_id", storyId)
        .in("status", PAID_ORDER_STATUSES)
        .limit(1)
        .maybeSingle();
      if (!paidOrder) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // MOCK MODE (local dev only): fill pending illustrations and mark ready.
  // Safety: NEVER allowed when Stripe is in live mode.
  const isMockMode = process.env.MOCK_MODE === "true" && process.env.STRIPE_ENVIRONMENT !== "live";
  if (isMockMode) {
    const { data: pendingIlls } = await admin
      .from("story_illustrations")
      .select("scene_number")
      .eq("story_id", storyId)
      .eq("status", "pending")
      .order("scene_number");

    if (pendingIlls && pendingIlls.length > 0) {
      await Promise.all(
        pendingIlls.map((ill) =>
          admin
            .from("story_illustrations")
            .update({ image_url: getMockIllustrationUrl(ill.scene_number - 1), status: "ready" })
            .eq("story_id", storyId)
            .eq("scene_number", ill.scene_number)
        )
      );
    }

    await admin.from("stories").update({ status: "ready", pdf_url: null }).eq("id", storyId);
    return NextResponse.json({ status: "ready" });
  }

  try {
    const result = await advanceStoryFulfilment(admin, storyId, { deadline: startedAt + WORK_BUDGET_MS });

    switch (result.state) {
      case "not_found":
        return NextResponse.json({ error: "Story not found" }, { status: 404 });
      case "not_paid":
        return NextResponse.json({ error: "No paid order found for this story" }, { status: 402 });
      case "not_completable":
        return NextResponse.json({ error: "Story is not in a completable state" }, { status: 400 });
      case "done":
        return NextResponse.json({ status: "ready" });
      default:
        // in_progress / busy / blocked: the book keeps being produced in the
        // background (cron) and the customer gets an email when it's ready.
        // Provider/Gelato details are never surfaced to the customer.
        return NextResponse.json(
          { status: result.generationDone ? "ready" : "processing" },
          { status: result.generationDone ? 200 : 202 },
        );
    }
  } catch (error) {
    console.error(`[Complete] Unexpected failure for story ${storyId}:`, error);
    return NextResponse.json({ error: "Completion failed" }, { status: 500 });
  }
}
