import { NextResponse } from "next/server";
import { checkMemoryRateLimit } from "@/lib/rate-limit";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { UNVERIFIED_FLAG_KEY, UNVERIFIED_FLAG_VALUE, checkUnverifiedCap, clientIp } from "@/lib/unverified-guest";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * POST /api/auth/guest-session — fallback guest session for a visitor whose
 * background Turnstile check did not produce a token Supabase accepts
 * (src/lib/guest-session.ts). Nobody is ever blocked by a captcha in the create flow.
 *
 * Supabase Auth skips its CAPTCHA check for service-role requests
 * (supabase/auth internal/api/middleware.go verifyCaptcha → requireAdminCredentials),
 * so the anonymous sign-up is made here with the service role, then flagged
 * `app_metadata.guest_captcha = "unverified"`: paid generations of that user run under
 * the per-IP daily caps of src/lib/unverified-guest.ts.
 *
 * Note: Supabase's own "anonymous sign-ins per hour per IP" limit sees the server's
 * IP for these calls (shared by every unverified visitor): keep it generous in
 * Auth → Rate Limits.
 *
 * Response: 200 { access_token, refresh_token } (the browser calls auth.setSession)
 *           429 rate_limited · 503 guest_session_unavailable
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!checkMemoryRateLimit(`guest_session:${ip}`, { maxRequests: 10, windowSeconds: 3600 }).allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: NO_STORE });
  }
  const cap = await checkUnverifiedCap(request, "unverified_guest_session");
  if (!cap.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(cap.retryAfterSeconds ?? 86_400) } },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  let session: { access_token?: string; refresh_token?: string; user?: { id?: string } };
  try {
    const res = await fetch(`${url}/auth/v1/signup`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ data: {} }),
      signal: AbortSignal.timeout(10_000),
    });
    session = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = (session as { error_code?: string }).error_code ?? "unknown";
      console.error(`[unverified] guest sign-up refused by Supabase: ${res.status} ${code}`);
      return NextResponse.json({ error: "guest_session_unavailable" }, { status: 503, headers: NO_STORE });
    }
  } catch (err) {
    console.error("[unverified] guest sign-up failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "guest_session_unavailable" }, { status: 503, headers: NO_STORE });
  }

  const userId = session.user?.id;
  if (!userId || !session.access_token || !session.refresh_token) {
    console.error("[unverified] guest sign-up returned no session");
    return NextResponse.json({ error: "guest_session_unavailable" }, { status: 503, headers: NO_STORE });
  }

  // Without the flag the user would get the verified limits: never hand that session out.
  const admin = createFulfilmentClient();
  const { error: flagError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { [UNVERIFIED_FLAG_KEY]: UNVERIFIED_FLAG_VALUE },
  });
  if (flagError) {
    console.error("[unverified] flagging the guest failed:", flagError.message);
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    return NextResponse.json({ error: "guest_session_unavailable" }, { status: 503, headers: NO_STORE });
  }

  return NextResponse.json(
    { access_token: session.access_token, refresh_token: session.refresh_token },
    { headers: NO_STORE },
  );
}
