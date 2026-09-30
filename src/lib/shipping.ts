// Delivery times and order cut-offs for printed books (feeds "¿Llega a tiempo para
// Reyes?"). Shared by client and server — no server-only imports.
//
// Source: live Gelato quotes (POST /v4/orders:quote, 30 inner pages, cheapest
// method = the one createPrintOrder picks), 2026-09-28: 7-8 days door to door.
// Customer copy promises 7-10 business days; cut-offs use the measured days + buffer.
// Both formats quote identically today; kept per format because they may diverge.
// Re-quote before each campaign (Gelato publishes peak-season cut-offs in November).

import type { PhysicalFormat } from "./pricing";

/** Where we ship (decision 2026-09-28: Spain without Canarias, Ceuta, Melilla). */
export type ShippingRegion = "peninsula" | "baleares";
export const SHIPPING_REGIONS: ShippingRegion[] = ["peninsula", "baleares"];

export const DELIVERY_DAYS: Record<PhysicalFormat, Record<ShippingRegion, { min: number; max: number }>> = {
  hardcover: { peninsula: { min: 7, max: 8 }, baleares: { min: 7, max: 8 } },
  softcover: { peninsula: { min: 7, max: 8 }, baleares: { min: 7, max: 8 } },
};

/** Extra margin in peak season (carrier backlog, 8 Dec / 25 Dec / 1 Jan holidays). */
export const PEAK_BUFFER_DAYS = 6;

/** Reyes: the book must be home on 5 January. */
export function reyesDeliverBy(year: number): string {
  return `${year}-01-05`;
}

/** Last day (YYYY-MM-DD) to order so the book arrives by `deliverBy` (YYYY-MM-DD). */
export function lastOrderDate(deliverBy: string, format: PhysicalFormat, region: ShippingRegion, bufferDays = PEAK_BUFFER_DAYS): string {
  const d = new Date(`${deliverBy}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - DELIVERY_DAYS[format][region].max - bufferDays);
  return d.toISOString().slice(0, 10);
}

/** Every cut-off for one deadline, for the Reyes page / banner. */
export function orderCutoffs(deliverBy: string): Array<{ format: PhysicalFormat; region: ShippingRegion; lastOrderDate: string }> {
  return (Object.keys(DELIVERY_DAYS) as PhysicalFormat[]).flatMap((format) =>
    (Object.keys(DELIVERY_DAYS[format]) as ShippingRegion[]).map((region) => ({
      format,
      region,
      lastOrderDate: lastOrderDate(deliverBy, format, region),
    })),
  );
}

// ── Gift season (Christmas + Reyes) ───────────────────────────────────────────
// Pure date logic for the /christmas-delivery page and the seasonal banner. All
// dates are Spanish calendar days as "YYYY-MM-DD" strings (ISO strings compare
// correctly with < / >). A season runs from 6 January to the next 5 January:
// on 6 January it rolls over to the next Christmas.

/** Route of the "¿Llega a tiempo para Reyes?" page (linked from the banner, footer, SEO pages). */
export const CHRISTMAS_DELIVERY_PATH = "/christmas-delivery";

export type SeasonOccasion = "christmas" | "reyes";
export const SEASON_OCCASIONS: SeasonOccasion[] = ["christmas", "reyes"];

/** Today's date (YYYY-MM-DD) in Spain, whatever the server/browser time zone. */
export function spainToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Whole days from `from` to `to` (both YYYY-MM-DD); negative when `to` is past. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export interface GiftSeason {
  /** Year of the Christmas in this season (Reyes falls on 5 Jan of the next year). */
  christmasYear: number;
  /** Date the book must be home by, per occasion. */
  deliverBy: Record<SeasonOccasion, string>;
  /** First day the seasonal banner shows. */
  bannerFrom: string;
  /** Last day of the season (Reyes eve); the next day rolls over. */
  ends: string;
}

/** The season `today` belongs to (up to 5 Jan = the running one, from 6 Jan = the next). */
export function giftSeason(today: string): GiftSeason {
  const year = Number(today.slice(0, 4));
  const christmasYear = today <= reyesDeliverBy(year) ? year - 1 : year;
  const reyes = reyesDeliverBy(christmasYear + 1);
  return {
    christmasYear,
    deliverBy: { christmas: `${christmasYear}-12-24`, reyes },
    bannerFrom: `${christmasYear}-11-01`,
    ends: reyes,
  };
}

export interface FormatDeadline {
  /** Regions sharing this cut-off (grouped so identical dates show once). */
  regions: ShippingRegion[];
  lastOrderDate: string;
  /** Days left to order (0 = today is the last day, < 0 = closed). */
  daysLeft: number;
  open: boolean;
}

/** Cut-offs for one printed format and occasion in the season of `today`, grouped by date. */
export function formatDeadlines(today: string, format: PhysicalFormat, occasion: SeasonOccasion): FormatDeadline[] {
  const deliverBy = giftSeason(today).deliverBy[occasion];
  const byDate = new Map<string, ShippingRegion[]>();
  for (const c of orderCutoffs(deliverBy)) {
    if (c.format !== format) continue;
    byDate.set(c.lastOrderDate, [...(byDate.get(c.lastOrderDate) ?? []), c.region]);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([lastOrderDate, regions]) => {
      const daysLeft = daysBetween(today, lastOrderDate);
      return { regions, lastOrderDate, daysLeft, open: daysLeft >= 0 };
    });
}

export interface NextCutoff {
  occasion: SeasonOccasion;
  lastOrderDate: string;
  daysLeft: number;
}

/**
 * The nearest printed-book cut-off still open this season (Christmas first, then
 * Reyes). Within an occasion it is the earliest cut-off still open across formats
 * and regions. null = no printed book arrives in time any more (PDF only).
 */
export function nextPhysicalCutoff(today: string): NextCutoff | null {
  const season = giftSeason(today);
  for (const occasion of SEASON_OCCASIONS) {
    const open = orderCutoffs(season.deliverBy[occasion])
      .map((c) => c.lastOrderDate)
      .filter((d) => d >= today)
      .sort();
    if (open.length > 0) return { occasion, lastOrderDate: open[0], daysLeft: daysBetween(today, open[0]) };
  }
  return null;
}

export type SeasonBanner =
  | { kind: "physical"; occasion: SeasonOccasion; lastOrderDate: string; daysLeft: number }
  | { kind: "digital"; occasion: SeasonOccasion }
  | null;

/**
 * What the site-wide seasonal banner shows: nothing outside 1 Nov – 5 Jan, the
 * nearest printed cut-off while one is open, then the instant PDF until Reyes.
 */
export function seasonBanner(today: string): SeasonBanner {
  const season = giftSeason(today);
  if (today < season.bannerFrom || today > season.ends) return null;
  const next = nextPhysicalCutoff(today);
  if (next) return { kind: "physical", ...next };
  return { kind: "digital", occasion: today <= season.deliverBy.christmas ? "christmas" : "reyes" };
}

/** Dev-only "?now=YYYY-MM-DD" override (callers must gate on NODE_ENV). */
export function parseDateOverride(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value ? value : null;
}

// ── Delivery window shown on the paywall ("Llega entre el 9 y el 14 de octubre") ──
// Follows the customer promise (7-10 business days, as in the checkout and legal
// copy), not the measured Gelato days above: the promise is what we must keep.

/** Business days from order to door, as promised to the customer, per printed format. */
export const PROMISED_BUSINESS_DAYS: Record<PhysicalFormat, { min: number; max: number }> = {
  hardcover: { min: 7, max: 10 },
  softcover: { min: 7, max: 10 },
};

/** Easter Sunday (YYYY-MM-DD), anonymous Gregorian algorithm. */
function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Spanish national public holidays (fixed dates + Good Friday) for a year. */
export function spanishNationalHolidays(year: number): Set<string> {
  const fixed = ["01-01", "01-06", "05-01", "08-15", "10-12", "11-01", "12-06", "12-08", "12-25"];
  return new Set([...fixed.map((md) => `${year}-${md}`), addDays(easterSunday(year), -2)]);
}

/** Whether a YYYY-MM-DD date is a working day (Mon-Fri, not a national holiday). */
export function isBusinessDay(date: string): boolean {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  return !spanishNationalHolidays(Number(date.slice(0, 4))).has(date);
}

/** The date `days` business days after `from` (the order day itself never counts). */
export function addBusinessDays(from: string, days: number): string {
  let date = from;
  let left = days;
  while (left > 0) {
    date = addDays(date, 1);
    if (isBusinessDay(date)) left--;
  }
  return date;
}

/** Earliest and latest arrival (YYYY-MM-DD) for a printed book ordered on `today`. */
export function deliveryWindow(today: string, format: PhysicalFormat): { from: string; to: string } {
  const { min, max } = PROMISED_BUSINESS_DAYS[format];
  return { from: addBusinessDays(today, min), to: addBusinessDays(today, max) };
}
