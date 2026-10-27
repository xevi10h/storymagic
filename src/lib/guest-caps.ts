// Per-IP daily caps for guests (anonymous users), the second layer behind Vercel
// BotID (src/lib/botid/server.ts). They bound what any one IP can spend even if a
// bot passes BotID or BotID is in monitor mode. Accounts (signed-in email/Google)
// are not capped per IP, only per user (src/lib/rate-limit.ts).
//
// Values are generous on purpose: Spanish mobile carriers share IPv4 addresses
// (CGNAT) between many subscribers, and a family may make several books.

import { isIP } from "node:net";
import type { User } from "@supabase/supabase-js";
import { checkRateLimit, rateLimitSubject } from "@/lib/rate-limit";

/** Rolling-24 h limits live in src/lib/rate-limit.ts LIMITS. */
export type GuestIpAction = "guest_ip_session" | "guest_ip_prepare" | "guest_ip_portrait" | "guest_ip_preview";

export function isGuest(user: Pick<User, "is_anonymous"> | null | undefined): boolean {
  return user?.is_anonymous === true;
}

/** First hop of x-forwarded-for (Vercel sets it), same convention as the other per-IP limits. */
export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * Headers that let Supabase Auth rate-limit a server-side call by the visitor's IP
 * (`Sb-Forwarded-For`, honoured only when the project enables it; ignored otherwise).
 */
export function forwardedForHeaders(request: Request): Record<string, string> {
  const ip = clientIp(request);
  return isIP(ip) ? { "Sb-Forwarded-For": ip } : {};
}

/** Durable per-IP cap (rate_limits table). Logs refusals with a short hashed IP. */
export async function checkGuestIpCap(
  request: Request,
  action: GuestIpAction,
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const subject = rateLimitSubject(`guest:${clientIp(request)}`);
  const result = await checkRateLimit(subject, action);
  if (!result.allowed) console.warn(`[guest-cap] ${action} refused ip=${subject.slice(0, 8)}`);
  return result;
}
