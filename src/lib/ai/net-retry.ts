// Network-failure classification + a small retrying fetch for server-side
// downloads (reference images, QA images, the approved avatar).
//
// "Network error" = the request never produced an HTTP response: DNS failure,
// refused / reset connection, unreachable host. Node's fetch (undici) reports
// all of them as `TypeError: fetch failed` with the real reason in `err.cause`;
// node:https reports them as plain Errors with a `code`. They are transient by
// nature (a laptop switching Wi-Fi, a DNS hiccup, a dropped keep-alive socket)
// and are safe to retry. Timeouts are NOT network errors here: callers decide
// separately whether a slow request is worth repeating.

const NETWORK_CODES = new Set([
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "ECONNABORTED",
  "EPIPE",
  "ENETUNREACH",
  "ENETDOWN",
  "EHOSTUNREACH",
  "EHOSTDOWN",
  "ETIMEDOUT", // TCP connect timeout (OS level), not our AbortSignal timeout
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
  "UND_ERR_CLOSED",
]);

function codeOf(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const e = err as { code?: unknown; cause?: unknown; errors?: unknown };
  if (typeof e.code === "string") return e.code;
  const fromCause = codeOf(e.cause);
  if (fromCause) return fromCause;
  // AggregateError (happy-eyeballs: IPv4 + IPv6 both failed)
  if (Array.isArray(e.errors)) for (const inner of e.errors) {
    const c = codeOf(inner);
    if (c) return c;
  }
  return undefined;
}

/** Our own AbortSignal.timeout() fired (or the caller aborted). */
export function isTimeoutError(err: unknown): boolean {
  return err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
}

/** The request failed before any HTTP response (see header). */
export function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error) || isTimeoutError(err)) return false;
  const code = codeOf(err);
  if (code && NETWORK_CODES.has(code)) return true;
  return /fetch failed|socket hang up|other side closed|network (error|socket)/i.test(err.message);
}

/** "fetch failed (ENOTFOUND api.openai.com)" — the undici cause is what tells a DNS blip from a reset. */
export function describeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = (err as { cause?: unknown }).cause;
  const causeText =
    cause instanceof Error ? cause.message : cause && typeof cause === "object" && "code" in cause ? String((cause as { code: unknown }).code) : "";
  return causeText && !err.message.includes(causeText) ? `${err.message} (${causeText})` : err.message;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface FetchRetryOptions {
  /** Per-attempt timeout */
  timeoutMs: number;
  /** Total attempts (default 3) */
  attempts?: number;
  /** First backoff; doubles every retry (default 1 s → 1 s, 2 s, …) */
  baseDelayMs?: number;
  /** Log tag */
  label: string;
}

/**
 * GET with retries on network errors, timeouts, 429 and 5xx. Resolves with the
 * last Response (which may be a non-OK 4xx/5xx: the caller decides what it
 * means); throws the last network/timeout error when every attempt failed
 * before a response.
 */
export async function fetchWithRetry(url: string, opts: FetchRetryOptions): Promise<Response> {
  const attempts = Math.max(1, opts.attempts ?? 3);
  const base = opts.baseDelayMs ?? 1_000;
  let lastErr: unknown;
  for (let n = 1; n <= attempts; n++) {
    let outcome: string;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(opts.timeoutMs) });
      if (!(res.status === 429 || res.status >= 500) || n === attempts) return res;
      await res.body?.cancel().catch(() => undefined);
      outcome = `HTTP ${res.status}`;
    } catch (err) {
      if (!isNetworkError(err) && !isTimeoutError(err)) throw err;
      lastErr = err;
      if (n === attempts) break;
      outcome = isTimeoutError(err) ? `timed out after ${Math.round(opts.timeoutMs / 1000)}s` : describeError(err);
    }
    const wait = base * 2 ** (n - 1);
    console.warn(`[net] ${opts.label}: ${outcome} — retry ${n + 1}/${attempts} in ${(wait / 1000).toFixed(1)}s`);
    await sleep(wait);
  }
  throw lastErr instanceof Error ? new Error(`${opts.label}: ${describeError(lastErr)}`, { cause: lastErr }) : new Error(`${opts.label}: download failed`);
}
