import { useSyncExternalStore } from "react";
import { parseDateOverride, spainToday } from "@/lib/shipping";
import { DISMISS_KEY } from "./season-scripts";

// Client helpers shared by the seasonal banner and the /christmas-delivery page.

const INTL_LOCALE: Record<string, string> = { es: "es-ES", ca: "ca-ES", en: "en-GB", fr: "fr-FR" };

/** "jueves, 10 de diciembre" / "10 de diciembre" for a YYYY-MM-DD date. */
export function formatSeasonDate(date: string, locale: string, withWeekday = false): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale] ?? "es-ES", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    ...(withWeekday ? { weekday: "long" } : {}),
  }).format(new Date(`${date}T00:00:00Z`));
}

function clientToday(): string {
  // Dev-only "?now=YYYY-MM-DD" to preview any day of the season.
  if (process.env.NODE_ENV !== "production") {
    try {
      const override = parseDateOverride(new URLSearchParams(window.location.search).get("now"));
      if (override) return override;
    } catch {
      /* ignore */
    }
  }
  return spainToday();
}

function subscribeToClock(onChange: () => void): () => void {
  // Re-check every minute so the countdown turns over at midnight (Spain).
  const id = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(id);
}

/**
 * Today's date in Spain (YYYY-MM-DD), live. `serverToday` is what the server
 * rendered with (null = render nothing until hydrated).
 */
export function useSeasonToday(serverToday: string | null): string | null {
  return useSyncExternalStore(subscribeToClock, clientToday, () => serverToday);
}

// ── Banner dismissal (localStorage, with an in-memory fallback) ──────────────
// Before hydration, DISMISSED_HEAD_SCRIPT + SeasonalBanner's <style> hide a
// closed banner; after it, this store unmounts it.

const DISMISS_EVENT = "meapica:season-banner";
let memoryDismissed: string | null = null;

function readDismissed(): string | null {
  try {
    return window.localStorage.getItem(DISMISS_KEY) ?? memoryDismissed;
  } catch {
    return memoryDismissed;
  }
}

function subscribeToDismissed(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(DISMISS_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(DISMISS_EVENT, onChange);
  };
}

/** The dismissed banner id; null during SSR/hydration (render it, CSS hides a closed one). */
export function useDismissedBanner(): string | null {
  return useSyncExternalStore(subscribeToDismissed, readDismissed, () => null);
}

export function dismissBanner(id: string): void {
  memoryDismissed = id;
  try {
    window.localStorage.setItem(DISMISS_KEY, id);
  } catch {
    /* private mode / blocked storage: the in-memory value hides it for this page view */
  }
  window.dispatchEvent(new Event(DISMISS_EVENT));
}
