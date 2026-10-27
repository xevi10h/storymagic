import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { refuseBot } from "@/lib/botid/server";
import { checkMemoryRateLimit, checkRateLimit, rateLimitSubject } from "@/lib/rate-limit";
import { clientIp, forwardedForHeaders } from "@/lib/guest-caps";
import { sanitizeNextPath } from "@/lib/auth/next-path";

const NO_STORE = { "Cache-Control": "no-store" };

const bodySchema = z.object({
  email: z.string().trim().max(254).regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/),
  locale: z.enum(["es", "ca", "en", "fr"]),
  next: z.string().max(512).optional(),
});

function fail(status: number, errorCode: string, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json({ error_code: errorCode }, { status, headers: { ...NO_STORE, ...extraHeaders } });
}

/**
 * POST /api/auth/email-otp — sends the sign-in email (link + code) for
 * src/components/auth/EmailSignIn.tsx. Server-side so it can be guarded without
 * a visible captcha:
 * 1. Vercel BotID (src/lib/botid/server.ts): bot → 403 bot_detected.
 * 2. Caps: 10 per IP per hour, 5 per recipient per hour (rate_limits), plus
 *    Supabase's own per-email resend limit.
 * 3. Supabase /otp with the service role (skips Supabase's CAPTCHA check, so it works
 *    with that protection on or off). The link carries token_hash and is verified by
 *    GET /api/auth/confirm, so no PKCE verifier is needed in this browser.
 *
 * Supabase's per-IP "sign-ins" limit sees Vercel's IP for these calls unless
 * Sb-Forwarded-For is honoured: shared by every visitor (Auth → Rate Limits).
 *
 * Body:     { email, locale, next? }   next = locale-less path after login
 * Response: 200 { ok: true } · 400/403/429/5xx { error_code } (auth-errors.ts maps it)
 */
export async function POST(request: NextRequest) {
  const refused = await refuseBot("email_otp");
  if (refused) return fail(403, "bot_detected");

  let parsed: z.infer<typeof bodySchema>;
  try {
    const result = bodySchema.safeParse(await request.json());
    if (!result.success) return fail(400, "email_address_invalid");
    parsed = result.data;
  } catch {
    return fail(400, "validation_failed");
  }
  const email = parsed.email.toLowerCase();

  const ip = clientIp(request);
  if (!checkMemoryRateLimit(`email_otp:${ip}`, { maxRequests: 10, windowSeconds: 3600 }).allowed) {
    return fail(429, "over_request_rate_limit");
  }
  for (const [subject, action] of [
    [rateLimitSubject(`otp-ip:${ip}`), "email_otp_ip"],
    [rateLimitSubject(`otp:${email}`), "email_otp_recipient"],
  ] as const) {
    const limit = await checkRateLimit(subject, action);
    if (!limit.allowed) {
      console.warn(`[email-otp] ${action} refused subject=${subject.slice(0, 8)}`);
      return fail(429, "over_request_rate_limit", { "Retry-After": String(limit.retryAfterSeconds ?? 3600) });
    }
  }

  const next = sanitizeNextPath(parsed.next);
  const confirmUrl = `${request.nextUrl.origin}/api/auth/confirm?locale=${parsed.locale}&next=${encodeURIComponent(next)}`;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  try {
    const res = await fetch(`${url}/auth/v1/otp?redirect_to=${encodeURIComponent(confirmUrl)}`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        ...forwardedForHeaders(request),
      },
      body: JSON.stringify({ email, create_user: true, data: { locale: parsed.locale } }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error_code?: string; code?: string | number };
      const code = body.error_code ?? (typeof body.code === "string" ? body.code : "unknown");
      console.warn(`[email-otp] Supabase refused: ${res.status} ${code}`);
      // 5xx = the email could not be sent (SMTP); 4xx codes are mapped by the browser.
      return res.status >= 500 ? fail(502, "email_send_failed") : fail(res.status, code);
    }
  } catch (err) {
    console.error("[email-otp] request failed:", err instanceof Error ? err.message : err);
    return fail(502, "request_timeout");
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
