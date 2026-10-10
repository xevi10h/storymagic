import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let serviceClient: SupabaseClient | null = null;

/** Lazy so importing this module never requires env vars (e.g. unit tests). */
function getServiceClient(): SupabaseClient {
  if (!serviceClient) {
    serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return serviceClient;
}

export interface RateLimitConfig {
  /** Max requests allowed in the time window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
}

const LIMITS: Record<string, RateLimitConfig> = {
  generate_story: { maxRequests: 3, windowSeconds: 300 },   // 3 per 5 min
  generate_pdf: { maxRequests: 5, windowSeconds: 60 },       // 5 per minute
  complete_story: { maxRequests: 3, windowSeconds: 300 },    // 3 per 5 min
  generate_portrait: { maxRequests: 10, windowSeconds: 3600 }, // 10 per hour
  upload_photo: { maxRequests: 10, windowSeconds: 3600 },      // 10 per hour (same budget as portraits)
  send_preview: { maxRequests: 3, windowSeconds: 3600 },        // 3 preview emails per hour
  // Per recipient (subject = rateLimitSubject(email)): the relay cannot be aimed at
  // one inbox from many throwaway guest accounts. Rows are kept 24 h (cleanup_old_rate_limits).
  send_preview_recipient: { maxRequests: 3, windowSeconds: 86_400 },
  delete_account: { maxRequests: 5, windowSeconds: 3600 },      // 5 erasure attempts per hour
  // Free Reyes printables, per hashed IP (subject = rateLimitSubject("tools:<ip>")): free, but CPU-bound.
  tool_pdf: { maxRequests: 40, windowSeconds: 3600 },
  // Gift voucher Checkout Sessions, per hashed IP (subject = rateLimitSubject("voucher:<ip>")).
  gift_voucher_checkout: { maxRequests: 10, windowSeconds: 3600 },
};

/**
 * Stable UUID-shaped id for a non-user rate-limit subject (e.g. a recipient email),
 * so it fits rate_limits.user_id (uuid) without storing the raw value.
 */
export function rateLimitSubject(key: string): string {
  const h = createHash("sha256").update(`meapica:rate-limit:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/**
 * Check if a user has exceeded their rate limit for an action.
 * Returns { allowed: true } or { allowed: false, retryAfterSeconds }.
 */
export async function checkRateLimit(
  userId: string,
  action: string,
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const config = LIMITS[action];
  if (!config) return { allowed: true };

  const windowStart = new Date(
    Date.now() - config.windowSeconds * 1000,
  ).toISOString();

  const supabase = getServiceClient();
  const { count, error } = await supabase
    .from("rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action", action)
    .gte("created_at", windowStart);

  if (error) {
    console.error("[rate-limit] Error checking:", error);
    return { allowed: true }; // Fail open on DB errors
  }

  if ((count ?? 0) >= config.maxRequests) {
    return { allowed: false, retryAfterSeconds: config.windowSeconds };
  }

  // Record this request
  await supabase.from("rate_limits").insert({ user_id: userId, action });

  // Opportunistic cleanup (non-blocking)
  void supabase.rpc("cleanup_old_rate_limits");

  return { allowed: true };
}

// ── In-memory fixed-window limiter (defense-in-depth, e.g. per-IP) ──────────
// ponytail: per-instance limiter, move to durable store if abuse appears

interface MemoryWindow {
  count: number;
  windowStart: number;
}

const memoryWindows = new Map<string, MemoryWindow>();
const MEMORY_MAP_MAX_ENTRIES = 10_000;

/**
 * Fixed-window counter held in the memory of ONE server instance (best effort).
 * On Vercel every function instance has its own map and instances come and go, so
 * this only slows a naive loop that keeps hitting the same warm instance (keyed by
 * IP, it does survive anonymous-session cycling there). It is NOT a global limit:
 * every paid call must also pass the durable per-user limiter (checkRateLimit,
 * rate_limits table). `now` is injectable for tests.
 */
export function checkMemoryRateLimit(
  key: string,
  config: RateLimitConfig,
  now: number = Date.now(),
): { allowed: boolean; retryAfterSeconds?: number } {
  const windowMs = config.windowSeconds * 1000;
  const entry = memoryWindows.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    // New window — opportunistically prune expired entries if the map grows
    if (memoryWindows.size >= MEMORY_MAP_MAX_ENTRIES) {
      for (const [k, v] of memoryWindows) {
        if (now - v.windowStart >= windowMs) memoryWindows.delete(k);
      }
    }
    memoryWindows.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((entry.windowStart + windowMs - now) / 1000),
      ),
    };
  }

  entry.count += 1;
  return { allowed: true };
}
