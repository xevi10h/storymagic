import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface RateLimitConfig {
  /** Max requests allowed in the time window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
}

const LIMITS: Record<string, RateLimitConfig> = {
  generate_story: { maxRequests: 3, windowSeconds: 300 },   // 3 per 5 min
  generate_pdf: { maxRequests: 5, windowSeconds: 60 },       // 5 per minute
  complete_story: { maxRequests: 3, windowSeconds: 300 },    // 3 per 5 min
};

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
