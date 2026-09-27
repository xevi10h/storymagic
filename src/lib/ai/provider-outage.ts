// Provider-outage circuit breaker for the character-creation image routes
// (/api/characters/portrait, /api/characters/prepare).
//
// When the image provider is out of credits / rejecting our key, every retry
// fails the same way. Routes short-circuit BEFORE the durable per-user rate
// limit so parents who tap "retry" don't burn their hourly quota on a known
// outage. Per-instance memory: good enough to stop retry storms; a cold
// instance just makes one real attempt and re-opens the breaker if the outage
// persists.

import { isProviderUnavailableError } from "@/lib/fulfilment/provider-errors";

const PROVIDER_OUTAGE_COOLDOWN_MS = 10 * 60 * 1000;
let providerOutageUntil = 0;

/** Seconds until the breaker closes again, or 0 when it is closed. */
export function providerOutageRetryAfter(): number {
  const left = providerOutageUntil - Date.now();
  return left > 0 ? Math.ceil(left / 1000) : 0;
}

export function isProviderOutageError(error: unknown): boolean {
  if (isProviderUnavailableError(error)) return true;
  const msg = error instanceof Error ? error.message : String(error);
  return /NO[ _]CREDITS|insufficient|credit|billing|quota|\b402\b|\b401\b|\b403\b/i.test(msg);
}

/** Opens the breaker when `error` is an outage; returns whether it was one. */
export function tripOnProviderOutage(error: unknown): boolean {
  if (!isProviderOutageError(error)) return false;
  providerOutageUntil = Date.now() + PROVIDER_OUTAGE_COOLDOWN_MS;
  return true;
}
