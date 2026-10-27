// Advent calendar 2026 (es + ca only): which doors are open on a given Spain date, which
// door the daily email sends, and when the site announces it. Pure and import-free
// (client, server and advent.check.mjs). Dates are "YYYY-MM-DD" in Europe/Madrid
// (spainToday() in src/lib/shipping.ts at the call site).
//
// Rules (owner, 2026-10-27): door n opens on n December; past doors stay open; future
// doors are locked. Before 1 December the page is a teaser + sign-up. After the 24th every
// door stays open (the calendar becomes a 24-story book).

export const ADVENT_YEAR = 2026;
export const ADVENT_DOORS_COUNT = 24;
export const ADVENT_LOCALES = ["es", "ca"] as const;
export type AdventPageLocale = (typeof ADVENT_LOCALES)[number];

export const ADVENT_PATH = "/advent";
export const ADVENT_UNSUBSCRIBE_PATH = "/advent/unsubscribe";
export const ADVENT_CONFIRM_PATH = "/advent/confirm";

/** First day the nav links to the calendar; last day = 24 December. */
export const ADVENT_ANNOUNCE_FROM = `${ADVENT_YEAR}-11-15`;
export const ADVENT_START = `${ADVENT_YEAR}-12-01`;
export const ADVENT_END = `${ADVENT_YEAR}-12-24`;

/** Bump when the consent text of the daily email changes (stored with every sign-up). */
export const ADVENT_CONSENT_VERSION = "2026-10-27";

export function isAdventLocale(locale: string): locale is AdventPageLocale {
  return (ADVENT_LOCALES as readonly string[]).includes(locale);
}

/**
 * How many doors are open on `today`: 0 before 1 December, n on n December, 24 from the
 * 24th on (and in later years: the 2026 calendar stays a finished book).
 */
export function openDoorCount(today: string): number {
  if (today < ADVENT_START) return 0;
  if (today > ADVENT_END) return ADVENT_DOORS_COUNT;
  return Number(today.slice(8, 10));
}

export type DoorState = "locked" | "today" | "open";

export function doorState(door: number, today: string): DoorState {
  const open = openDoorCount(today);
  if (door > open) return "locked";
  return door === open && today >= ADVENT_START && today <= ADVENT_END ? "today" : "open";
}

export function isDoorOpen(door: number, today: string): boolean {
  return Number.isInteger(door) && door >= 1 && door <= ADVENT_DOORS_COUNT && door <= openDoorCount(today);
}

/** "YYYY-12-DD" of a door (the day it opens). */
export function doorDate(door: number): string {
  return `${ADVENT_YEAR}-12-${String(door).padStart(2, "0")}`;
}

/**
 * The door the daily email sends on `today`, or null outside 1–24 December. A subscriber
 * gets only today's door (a sign-up on the 10th starts with door 10, no backfill).
 */
export function emailDoorFor(today: string): number | null {
  if (today < ADVENT_START || today > ADVENT_END) return null;
  return Number(today.slice(8, 10));
}

/**
 * Whether a subscription is still owed today's door: idempotent per subscriber and day
 * through last_sent_day (the claim moves it forward; a failed send moves it back).
 */
export function owesDoor(
  sub: { last_sent_day: number; unsubscribed_at: string | null; confirmed_at: string | null },
  door: number | null,
): boolean {
  return door !== null && sub.confirmed_at !== null && sub.unsubscribed_at === null && sub.last_sent_day < door;
}

/** Double opt-in: a pending sign-up re-sends its confirmation at most this often. */
export const CONFIRM_RESEND_MINUTES = 10;

/** Whether a (re-)sign-up of a pending address may send the confirmation email again. */
export function mayResendConfirmation(lastSentAt: string | null, now: Date): boolean {
  return !lastSentAt || now.getTime() - Date.parse(lastSentAt) >= CONFIRM_RESEND_MINUTES * 60_000;
}

/** Nav link + entry points: es/ca only, from mid-November through 24 December. */
export function adventAnnounced(today: string, locale: string): boolean {
  return isAdventLocale(locale) && today >= ADVENT_ANNOUNCE_FROM && today <= ADVENT_END;
}

/** Sitemap lastmod: bump when the stories or the page copy change, never on a plain deploy. */
export const ADVENT_CONTENT_UPDATED = "2026-10-27";

/** hreflang map: es + ca, x-default = es. */
export function adventAlternates(baseUrl: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const loc of ADVENT_LOCALES) languages[loc] = `${baseUrl}/${loc}${ADVENT_PATH}`;
  languages["x-default"] = `${baseUrl}/es${ADVENT_PATH}`;
  return languages;
}

/** Language switcher: en/fr have no calendar, so they go to the home page. */
export function adventFallbackPath(pathname: string, targetLocale: string): string | null {
  if (isAdventLocale(targetLocale)) return null;
  return pathname === ADVENT_PATH || pathname.startsWith(`${ADVENT_PATH}/`) ? "/" : null;
}

/** The 24-story compilation ("Su libro de Adviento") once every door is open. */
export function compilationReady(today: string): boolean {
  return openDoorCount(today) === ADVENT_DOORS_COUNT;
}
