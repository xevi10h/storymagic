import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkMemoryRateLimit, checkRateLimit } from "@/lib/rate-limit";
import { eraseAccount, erasureServiceClient } from "@/lib/privacy/account-erasure";
import { SUPPORT_EMAIL } from "@/lib/support";

/**
 * DELETE /api/account — body { "confirm": true }.
 * Erases the caller's account and everything linked to it (stories, the child's
 * characters and images, PDFs, photos, consents, newsletter row, profile, auth
 * user). Paid orders are kept, anonymised (accounting duty). Works for registered
 * and anonymous (guest) sessions alike.
 *
 * 200 { ok: true }
 * 400 { error: "confirm_required" }
 * 401 { error: "unauthorized" }
 * 409 { error: "order_in_progress", orderReference, message } — a paid book not yet shipped
 * 429 { error: "rate_limited" }
 * 500 { error: "erasure_failed", message }
 */
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipLimit = checkMemoryRateLimit(`delete_account:${clientIp}`, { maxRequests: 10, windowSeconds: 3600 });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds ?? 3600) } },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { confirm?: unknown } | null;
  if (body?.confirm !== true) return NextResponse.json({ error: "confirm_required" }, { status: 400 });

  const rl = await checkRateLimit(user.id, "delete_account");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds ?? 3600) } },
    );
  }

  let result;
  try {
    result = await eraseAccount(erasureServiceClient(), user.id, { trigger: "self_service" });
  } catch (err) {
    console.error(`[account/delete] erasure failed for ${user.id}: ${err instanceof Error ? err.message : "unknown"}`);
    return NextResponse.json(
      {
        error: "erasure_failed",
        message: `No hemos podido borrar tu cuenta. Inténtalo de nuevo en unos minutos o escríbenos a ${SUPPORT_EMAIL}.`,
      },
      { status: 500 },
    );
  }

  if (result.state === "blocked") {
    console.log(`[account/delete] blocked for ${user.id}: order ${result.orderId} (${result.orderStatus})`);
    const orderReference = result.orderId.replace(/-/g, "").slice(0, 8).toUpperCase();
    return NextResponse.json(
      {
        error: "order_in_progress",
        orderReference,
        message: `Tienes un pedido en preparación (${orderReference}). Podrás borrar tu cuenta cuando te llegue el libro. Si lo necesitas antes, escríbenos a ${SUPPORT_EMAIL}.`,
      },
      { status: 409 },
    );
  }

  console.log(`[account/delete] ${result.state} for ${user.id} (anonymous: ${user.is_anonymous ?? false})`);

  // The auth user is gone: drop the session cookies locally (no server call).
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Cookies may already be unusable; the client signs out too.
  }

  return NextResponse.json({ ok: true });
}
