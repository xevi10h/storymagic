import { NextResponse } from "next/server";
import { checkMemoryRateLimit } from "@/lib/rate-limit";
import { refuseBot } from "@/lib/botid/server";
import { checkGuestIpCap, clientIp, forwardedForHeaders } from "@/lib/guest-caps";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * POST /api/auth/guest-session — the only way a guest session is created
 * (src/lib/guest-session.ts). Nobody ever sees a captcha.
 *
 * 1. Vercel BotID (src/lib/botid/server.ts): bot → 403 bot_detected.
 * 2. Per-IP caps: in-memory 20/h (best effort) + durable 20 per rolling 24 h.
 * 3. Anonymous sign-up with the service role. Supabase Auth skips its own CAPTCHA
 *    check for service-role requests (supabase/auth internal/api/middleware.go
 *    verifyCaptcha → requireAdminCredentials), so this works whether the project's
 *    CAPTCHA protection is on or off. Keeping it ON means nobody can mint guests
 *    straight from Supabase with the public anon key, around BotID.
 *
 * Supabase's "anonymous sign-ins per hour per IP" limit sees Vercel's IP here
 * (shared by every visitor) unless Sb-Forwarded-For is honoured: keep it generous
 * (Auth → Rate Limits, 300/h since 2026-10-27).
 *
 * Response: 200 { access_token, refresh_token } (the browser calls auth.setSession)
 *           403 bot_detected · 429 rate_limited · 503 guest_session_unavailable
 */
export async function POST(request: Request) {
  const refused = await refuseBot("guest_session");
  if (refused) return refused;

  const ip = clientIp(request);
  if (!checkMemoryRateLimit(`guest_session:${ip}`, { maxRequests: 20, windowSeconds: 3600 }).allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: NO_STORE });
  }
  const cap = await checkGuestIpCap(request, "guest_ip_session");
  if (!cap.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(cap.retryAfterSeconds ?? 86_400) } },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  let session: { access_token?: string; refresh_token?: string; error_code?: string };
  try {
    const res = await fetch(`${url}/auth/v1/signup`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        ...forwardedForHeaders(request),
      },
      body: JSON.stringify({ data: {} }),
      signal: AbortSignal.timeout(10_000),
    });
    session = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`[guest-session] sign-up refused by Supabase: ${res.status} ${session.error_code ?? "unknown"}`);
      const status = res.status === 429 ? 429 : 503;
      return NextResponse.json({ error: status === 429 ? "rate_limited" : "guest_session_unavailable" }, { status, headers: NO_STORE });
    }
  } catch (err) {
    console.error("[guest-session] sign-up failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "guest_session_unavailable" }, { status: 503, headers: NO_STORE });
  }

  if (!session.access_token || !session.refresh_token) {
    console.error("[guest-session] sign-up returned no session");
    return NextResponse.json({ error: "guest_session_unavailable" }, { status: 503, headers: NO_STORE });
  }

  return NextResponse.json(
    { access_token: session.access_token, refresh_token: session.refresh_token },
    { headers: NO_STORE },
  );
}
