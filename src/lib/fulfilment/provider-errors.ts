// Typed AI-provider failures that retrying cannot fix (no credits, bad/locked key,
// placeholder output in production). Callers fail fast on these instead of burning
// retries, and the operator is alerted (see alerts.ts → alertProviderUnavailable).
//
// Provider clients currently throw plain Errors; classifyProviderError() maps their
// messages/status codes onto this type so it works without touching them. New
// provider code can throw ProviderUnavailableError directly.

export type ProviderUnavailableKind = "out_of_credits" | "auth" | "locked" | "misconfigured";

export class ProviderUnavailableError extends Error {
  readonly provider: string;
  readonly kind: ProviderUnavailableKind;
  readonly status?: number;

  constructor(provider: string, kind: ProviderUnavailableKind, message: string, status?: number) {
    super(message);
    this.name = "ProviderUnavailableError";
    this.provider = provider;
    this.kind = kind;
    this.status = status;
  }
}

export function isProviderUnavailableError(err: unknown): err is ProviderUnavailableError {
  return err instanceof ProviderUnavailableError;
}

const CREDIT_PATTERNS = [
  /no credits/i,
  /insufficient (?:credits|funds|balance)/i,
  /exhausted balance/i,
  /out of credits/i,
  /payment required/i,
  /quota exceeded|exceeded your (?:current )?quota/i,
];
const LOCKED_PATTERN = /\b(?:user|account) is locked\b|\baccount (?:locked|suspended)\b/i;
// "BFL API 402: …", "fal fal-ai/flux-2-flex 403: …", "status 402", "HTTP 401"
const STATUS_PATTERN = /(?:\bAPI|\bfal\S*|\bstatus|\bHTTP)\s*:?\s*(401|402|403)\b/i;

/**
 * Map an unknown thrown value to a ProviderUnavailableError when it is a
 * non-retryable provider condition; returns null for ordinary (retryable) errors.
 */
export function classifyProviderError(err: unknown, provider: string): ProviderUnavailableError | null {
  if (err instanceof ProviderUnavailableError) return err;
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (!message) return null;

  const statusMatch = message.match(STATUS_PATTERN);
  const status = statusMatch ? Number(statusMatch[1]) : undefined;

  if (LOCKED_PATTERN.test(message)) {
    return new ProviderUnavailableError(provider, "locked", message, status);
  }
  if (CREDIT_PATTERNS.some((re) => re.test(message)) || status === 402) {
    return new ProviderUnavailableError(provider, "out_of_credits", message, status);
  }
  if (status === 401 || status === 403) {
    return new ProviderUnavailableError(provider, "auth", message, status);
  }
  return null;
}
