// Runnable check for the Christmas / Reyes season date logic (no deps):
//   node --experimental-strip-types src/lib/shipping.check.mjs
import assert from "node:assert/strict";
import {
  daysBetween,
  formatDeadlines,
  giftSeason,
  nextPhysicalCutoff,
  parseDateOverride,
  seasonBanner,
  spainToday,
} from "./shipping.ts";

// Today's cut-offs: 24 Dec − 8 days − 6 buffer = 10 Dec; 5 Jan − 14 = 22 Dec.

// ── Out of season (late September): countdown to Christmas, no banner ───────
assert.equal(giftSeason("2026-09-29").christmasYear, 2026);
assert.equal(seasonBanner("2026-09-29"), null);
assert.equal(seasonBanner("2026-10-31"), null);
assert.deepEqual(nextPhysicalCutoff("2026-09-29"), { occasion: "christmas", lastOrderDate: "2026-12-10", daysLeft: 72 });

// ── Mid-November: banner on, nearest cut-off = Christmas ─────────────────────
assert.deepEqual(seasonBanner("2026-11-01"), { kind: "physical", occasion: "christmas", lastOrderDate: "2026-12-10", daysLeft: 39 });
assert.deepEqual(seasonBanner("2026-11-15"), { kind: "physical", occasion: "christmas", lastOrderDate: "2026-12-10", daysLeft: 25 });
assert.deepEqual(formatDeadlines("2026-11-15", "hardcover", "christmas"), [
  { regions: ["peninsula", "baleares"], lastOrderDate: "2026-12-10", daysLeft: 25, open: true },
]);
assert.deepEqual(formatDeadlines("2026-11-15", "softcover", "reyes"), [
  { regions: ["peninsula", "baleares"], lastOrderDate: "2026-12-22", daysLeft: 37, open: true },
]);

// ── The day of a cut-off is still open (0 days left) ─────────────────────────
assert.deepEqual(seasonBanner("2026-12-10"), { kind: "physical", occasion: "christmas", lastOrderDate: "2026-12-10", daysLeft: 0 });
assert.equal(formatDeadlines("2026-12-10", "hardcover", "christmas")[0].open, true);
// next day: Christmas closed, banner moves to Reyes
assert.equal(formatDeadlines("2026-12-11", "hardcover", "christmas")[0].open, false);
assert.deepEqual(seasonBanner("2026-12-11"), { kind: "physical", occasion: "reyes", lastOrderDate: "2026-12-22", daysLeft: 11 });
assert.deepEqual(seasonBanner("2026-12-22"), { kind: "physical", occasion: "reyes", lastOrderDate: "2026-12-22", daysLeft: 0 });

// ── After every printed cut-off, before 5 Jan: PDF only ─────────────────────
assert.equal(nextPhysicalCutoff("2026-12-23"), null);
assert.deepEqual(seasonBanner("2026-12-23"), { kind: "digital", occasion: "christmas" });
assert.deepEqual(seasonBanner("2026-12-24"), { kind: "digital", occasion: "christmas" });
assert.deepEqual(seasonBanner("2026-12-28"), { kind: "digital", occasion: "reyes" });
assert.equal(giftSeason("2027-01-02").christmasYear, 2026);
assert.deepEqual(seasonBanner("2027-01-05"), { kind: "digital", occasion: "reyes" });
assert.equal(formatDeadlines("2027-01-05", "softcover", "reyes")[0].daysLeft, -14);

// ── From 6 Jan: rollover to next season ──────────────────────────────────────
assert.equal(seasonBanner("2027-01-06"), null);
assert.deepEqual(giftSeason("2027-01-06").deliverBy, { christmas: "2027-12-24", reyes: "2028-01-05" });
assert.deepEqual(nextPhysicalCutoff("2027-01-06"), { occasion: "christmas", lastOrderDate: "2027-12-10", daysLeft: 338 });
assert.equal(formatDeadlines("2027-01-06", "hardcover", "reyes")[0].lastOrderDate, "2027-12-22");

// ── Helpers ──────────────────────────────────────────────────────────────────
// 23:30 UTC on 10 Dec is already 11 Dec in Madrid (CET = UTC+1)
assert.equal(spainToday(new Date("2026-12-10T23:30:00Z")), "2026-12-11");
assert.equal(spainToday(new Date("2026-12-10T22:30:00Z")), "2026-12-10");
// summer time (CEST = UTC+2)
assert.equal(spainToday(new Date("2026-07-01T22:30:00Z")), "2026-07-02");
assert.equal(daysBetween("2026-12-31", "2027-01-01"), 1);
assert.equal(daysBetween("2026-03-28", "2026-03-30"), 2); // across DST change
assert.equal(parseDateOverride("2026-12-11"), "2026-12-11");
for (const bad of ["2026-02-30", "2026-13-01", "tomorrow", "", null, undefined]) assert.equal(parseDateOverride(bad), null);

console.log("shipping.check: all assertions passed");
