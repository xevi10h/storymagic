// Today's date (Spain) for the Advent routes, with the dev-only "?now=YYYY-MM-DD" preview
// override used across the season features (ignored in production). API routes do not get
// the middleware's x-season-now header, so they read the query themselves.

import { parseDateOverride, spainToday } from "@/lib/shipping";

export function adventToday(override?: string | null, now: Date = new Date()): string {
  if (process.env.NODE_ENV !== "production") {
    const forced = parseDateOverride(override ?? null);
    if (forced) return forced;
  }
  return spainToday(now);
}
