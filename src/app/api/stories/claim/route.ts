import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { mergeGuestIntoUser } from "@/lib/auth/guest-merge";
import { checkMemoryRateLimit, checkRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/guest-caps";
import { verifyStoryClaimToken } from "@/lib/share/story-claim-token";

const NO_STORE = { "Cache-Control": "no-store" };
const bodySchema = z.object({ token: z.string().max(100) });
/** Paid-ever order states: such a book is never moved by a link (login claims it by email). */
const PAID_STATUSES = ["paid", "producing", "shipped", "delivered", "refunded"];

/**
 * POST /api/stories/claim { token } — "continue your book" link from the owner's own email
 * (src/lib/share/story-claim-token.ts). Called by /[locale]/continue/[token] once the
 * visitor has a session (ensureGuestSession: BotID + per-IP caps), so a mail scanner that
 * only GETs the link never moves anything.
 *
 * The story (and its unpaid draft order, character, prep) moves to the current user when it
 * is still a preview owned by a guest. Never moved: a story of a registered account, or a
 * book with a paid order — those land on the preview page, which offers the login.
 *
 * 200 { storyId, claimed } (the client always goes to /create/{storyId}/preview)
 * 401 unauthorized · 410 invalid_link (bad, expired or deleted: no hint which) ·
 * 429 rate_limited · 503 claim_failed
 */
export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_link" }, { status: 410, headers: NO_STORE });
  }
  const parsed = bodySchema.safeParse(json);
  const verified = parsed.success ? verifyStoryClaimToken(parsed.data.token) : null;
  if (!verified?.ok) return NextResponse.json({ error: "invalid_link" }, { status: 410, headers: NO_STORE });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });

  if (!checkMemoryRateLimit(`story_claim:${clientIp(request)}`, { maxRequests: 30, windowSeconds: 3600 }).allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: NO_STORE });
  }

  const db = createFulfilmentClient();
  const { storyId } = verified;
  const { data: story, error: storyErr } = await db.from("stories").select("id, user_id, status").eq("id", storyId).maybeSingle();
  if (storyErr) {
    console.error(`[stories/claim] story read failed for ${storyId}: ${storyErr.message}`);
    return NextResponse.json({ error: "claim_failed" }, { status: 503, headers: NO_STORE });
  }
  if (!story) return NextResponse.json({ error: "invalid_link" }, { status: 410, headers: NO_STORE });
  if (story.user_id === user.id) return NextResponse.json({ storyId, claimed: false }, { headers: NO_STORE });

  // Only previews move; anything else lands on the preview page as it is.
  if (story.status !== "preview") return NextResponse.json({ storyId, claimed: false }, { headers: NO_STORE });
  const { count: paid, error: paidErr } = await db
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("story_id", storyId)
    .in("status", PAID_STATUSES);
  if (paidErr) {
    console.error(`[stories/claim] order read failed for ${storyId}: ${paidErr.message}`);
    return NextResponse.json({ error: "claim_failed" }, { status: 503, headers: NO_STORE });
  }
  if ((paid ?? 0) > 0) return NextResponse.json({ storyId, claimed: false }, { headers: NO_STORE });

  const rl = await checkRateLimit(user.id, "story_claim");
  if (!rl.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: NO_STORE });

  try {
    // Refuses (null) when the owner is a registered account: never taken from an account.
    const moved = await mergeGuestIntoUser(story.user_id, user.id, [storyId]);
    if (!moved) return NextResponse.json({ storyId, claimed: false }, { headers: NO_STORE });
  } catch (err) {
    console.error(`[stories/claim] move failed for ${storyId}: ${err instanceof Error ? err.message : "unknown"}`);
    return NextResponse.json({ error: "claim_failed" }, { status: 503, headers: NO_STORE });
  }
  // Claiming is activity: the guest purge (30 days idle) counts from here.
  const { error: touchErr } = await db.from("stories").update({ updated_at: new Date().toISOString() }).eq("id", storyId);
  if (touchErr) console.error(`[stories/claim] activity not recorded for ${storyId}: ${touchErr.message}`);
  console.log(`[stories/claim] story ${storyId} moved to ${user.is_anonymous ? "guest" : "account"} ${user.id}`);
  return NextResponse.json({ storyId, claimed: true }, { headers: NO_STORE });
}
