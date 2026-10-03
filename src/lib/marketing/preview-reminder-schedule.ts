// Abandoned-preview reminders: pure schedule + stop rules (no I/O, no imports).
//
// A parent who ticked "recordádmelo" next to the "send me the preview" field gets at
// most three emails about that story: 1 h, 24 h and 72 h after the consent. The
// sequence ends on purchase, unsubscribe or once it is too late to be useful.
// Runner: src/lib/marketing/preview-reminders.ts (cron /api/cron/preview-reminders).

const HOUR_MS = 3_600_000;

/**
 * Version of the consent text shown beside the checkbox (crear.sendPreview.remind* in
 * src/messages). Bump it whenever that text changes: it is stored with every consent.
 */
export const PREVIEW_REMINDER_CONSENT_VERSION = "2026-10-03";

export type ReminderStage = 1 | 2 | 3;

/** Delay after the consent for reminder 1, 2 and 3. */
export const REMINDER_OFFSETS_MS: Record<ReminderStage, number> = {
  1: 1 * HOUR_MS,
  2: 24 * HOUR_MS,
  3: 72 * HOUR_MS,
};

/** A reminder not sent this long after the last one was due is dropped (cron outage, quiet hours). */
export const REMINDER_EXPIRY_MS = REMINDER_OFFSETS_MS[3] + 48 * HOUR_MS;

/** No email between 22:00 and 08:00 in Spain: a night-time reminder waits for the morning. */
export const QUIET_HOURS = { from: 22, to: 8 } as const;

export type ReminderStopReason = "purchased" | "unsubscribed" | "expired" | "story_unavailable";

export type ReminderDecision =
  | { action: "send"; stage: ReminderStage }
  | { action: "wait" }
  | { action: "stop"; reason: ReminderStopReason };

/** Story statuses in which the preview exists and has not been bought. */
const PREVIEW_STATUSES = new Set(["preview"]);
/** Story statuses only a paid story reaches. */
const PURCHASED_STATUSES = new Set(["completing", "ready", "ordered", "shipped", "delivered"]);

export interface ReminderFacts {
  /** Last reminder sent (0-3). */
  stage: number;
  consentAt: number;
  now: number;
  /** null = the story no longer exists. */
  storyStatus: string | null;
  /** A paid (not refunded) order exists for the story. */
  hasPaidOrder: boolean;
  /** The address is in email_suppressions. */
  suppressed: boolean;
}

/** The reminder due at `now` for a sequence at `stage`, skipping the ones already overtaken. */
export function dueStage(stage: number, consentAt: number, now: number): ReminderStage | null {
  const elapsed = now - consentAt;
  const due = ([3, 2, 1] as const).find((s) => elapsed >= REMINDER_OFFSETS_MS[s]);
  return due && due > stage ? due : null;
}

/** What to do with one open sequence. Stop rules win over sending. */
export function reminderDecision(facts: ReminderFacts): ReminderDecision {
  if (facts.suppressed) return { action: "stop", reason: "unsubscribed" };
  if (facts.hasPaidOrder || (facts.storyStatus !== null && PURCHASED_STATUSES.has(facts.storyStatus))) {
    return { action: "stop", reason: "purchased" };
  }
  if (facts.storyStatus === null || !PREVIEW_STATUSES.has(facts.storyStatus)) return { action: "stop", reason: "story_unavailable" };
  if (facts.stage >= 3) return { action: "wait" }; // sequence complete: nothing left to send
  if (facts.now - facts.consentAt > REMINDER_EXPIRY_MS) return { action: "stop", reason: "expired" };
  const stage = dueStage(facts.stage, facts.consentAt, facts.now);
  return stage ? { action: "send", stage } : { action: "wait" };
}

/** Hour (0-23) in Spain at `now`. */
export function madridHour(now: number): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hourCycle: "h23" }).format(new Date(now)));
}

export function isQuietHour(now: number): boolean {
  const hour = madridHour(now);
  return hour >= QUIET_HOURS.from || hour < QUIET_HOURS.to;
}
