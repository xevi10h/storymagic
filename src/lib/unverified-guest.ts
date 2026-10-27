// Guests who could not pass Cloudflare Turnstile in the background (in-app
// browsers, blocked script, a challenge that wanted an interaction) still get a
// session from POST /api/auth/guest-session, flagged in app_metadata. Paid AI work
// for them runs under a stricter per-IP daily cap instead of being blocked.
// app_metadata is writable by the service role only, so the flag cannot be removed
// by the browser.

import type { User } from "@supabase/supabase-js";
import { checkRateLimit, rateLimitSubject } from "@/lib/rate-limit";

export const UNVERIFIED_FLAG_KEY = "guest_captcha";
export const UNVERIFIED_FLAG_VALUE = "unverified";

export type UnverifiedAction =
  | "unverified_guest_session"
  | "unverified_prepare"
  | "unverified_portrait"
  | "unverified_preview";

export function isUnverifiedGuest(user: Pick<User, "app_metadata"> | null | undefined): boolean {
  return user?.app_metadata?.[UNVERIFIED_FLAG_KEY] === UNVERIFIED_FLAG_VALUE;
}

/** First hop of x-forwarded-for (Vercel sets it), same convention as the other per-IP limits. */
export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * Durable per-IP daily cap for an unverified guest (rate_limits table, rolling 24 h).
 * Logs every decision with a short hashed IP so the unverified path can be measured
 * in the Vercel logs (`[unverified]`).
 */
export async function checkUnverifiedCap(
  request: Request,
  action: UnverifiedAction,
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const subject = rateLimitSubject(`unverified:${clientIp(request)}`);
  const result = await checkRateLimit(subject, action);
  console.warn(`[unverified] ${action} ${result.allowed ? "allowed" : "refused"} ip=${subject.slice(0, 8)}`);
  return result;
}
