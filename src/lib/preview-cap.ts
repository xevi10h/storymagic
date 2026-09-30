// Global daily ceiling on paid AI previews: pure decision logic (no I/O).
// I/O lives in preview-cap-server.ts; runnable check: preview-cap.check.mjs.

/** Previews per UTC day when DAILY_PREVIEW_CAP is unset (~1 $ each). */
export const DEFAULT_DAILY_PREVIEW_CAP = 300;
/** Share of the cap that triggers the early-warning operator alert. */
export const DAILY_CAP_WARN_RATIO = 0.8;
/** Error code of the 503 the creation UI maps to a friendly message. */
export const DAILY_CAP_ERROR = "daily_cap_reached";

/**
 * DAILY_PREVIEW_CAP → cap, or null when disabled ("0"). Unset, blank or invalid
 * values fall back to the default: a typo must never remove the ceiling.
 */
export function parseDailyPreviewCap(raw: string | undefined | null): number | null {
  const value = raw?.trim();
  if (!value) return DEFAULT_DAILY_PREVIEW_CAP;
  if (!/^\d+$/.test(value)) return DEFAULT_DAILY_PREVIEW_CAP;
  const cap = Number(value);
  if (!Number.isSafeInteger(cap)) return DEFAULT_DAILY_PREVIEW_CAP;
  return cap === 0 ? null : cap;
}

/** UTC calendar day ("YYYY-MM-DD") the cap resets on. */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** First preview number that triggers the warning alert (80 % of the cap, at least 1). */
export function warnThreshold(cap: number): number {
  return Math.max(1, Math.ceil(cap * DAILY_CAP_WARN_RATIO));
}

export type DailyCapAlert = "warning" | "reached";

export interface DailyCapDecision {
  allowed: boolean;
  /** Operator alert to send (deduplicated per day by the caller), if any. */
  alert: DailyCapAlert | null;
}

/**
 * Decision for one preview start.
 * `slot` = this preview's number today (1-based, counting itself), or null when
 * the atomic claim was refused because the cap is already full.
 */
export function dailyCapDecision(slot: number | null, cap: number): DailyCapDecision {
  if (slot === null || slot > cap) return { allowed: false, alert: "reached" };
  if (slot === cap) return { allowed: true, alert: "reached" };
  if (slot >= warnThreshold(cap)) return { allowed: true, alert: "warning" };
  return { allowed: true, alert: null };
}

/** Read-only gate for other paid AI calls (character sheet, portrait): no slot is taken. */
export function isDailyCapFull(startedToday: number, cap: number | null): boolean {
  return cap !== null && startedToday >= cap;
}

/** Dedupe key for alertOperator: one email per alert kind per UTC day. */
export function dailyCapAlertKey(alert: DailyCapAlert, day: string): string {
  return `daily-preview-cap:${alert}:${day}`;
}
