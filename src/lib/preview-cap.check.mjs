// Runnable check for the global daily preview cap decision logic (no deps):
//   node --experimental-strip-types src/lib/preview-cap.check.mjs
import assert from "node:assert/strict";
import {
  DEFAULT_DAILY_PREVIEW_CAP,
  dailyCapAlertKey,
  dailyCapDecision,
  isDailyCapFull,
  parseDailyPreviewCap,
  utcDay,
  warnThreshold,
} from "./preview-cap.ts";

// ── DAILY_PREVIEW_CAP parsing: unset/invalid → default, "0" → disabled ──────
assert.equal(DEFAULT_DAILY_PREVIEW_CAP, 300);
assert.equal(parseDailyPreviewCap(undefined), 300);
assert.equal(parseDailyPreviewCap(null), 300);
assert.equal(parseDailyPreviewCap(""), 300);
assert.equal(parseDailyPreviewCap("   "), 300);
assert.equal(parseDailyPreviewCap("0"), null);
assert.equal(parseDailyPreviewCap(" 0 "), null);
assert.equal(parseDailyPreviewCap("1"), 1);
assert.equal(parseDailyPreviewCap("500"), 500);
assert.equal(parseDailyPreviewCap("-5"), 300); // a typo never removes the ceiling
assert.equal(parseDailyPreviewCap("12.5"), 300);
assert.equal(parseDailyPreviewCap("abc"), 300);
assert.equal(parseDailyPreviewCap("1e3"), 300);
assert.equal(parseDailyPreviewCap("99999999999999999999"), 300);

// ── UTC day boundaries ───────────────────────────────────────────────────────
assert.equal(utcDay(new Date("2026-09-30T23:59:59.999Z")), "2026-09-30");
assert.equal(utcDay(new Date("2026-10-01T00:00:00.000Z")), "2026-10-01");
// 01:30 in Madrid (CEST, UTC+2) is still the previous UTC day
assert.equal(utcDay(new Date("2026-10-01T01:30:00+02:00")), "2026-09-30");

// ── Warning threshold = 80 % rounded up, at least 1 ──────────────────────────
assert.equal(warnThreshold(300), 240);
assert.equal(warnThreshold(10), 8);
assert.equal(warnThreshold(7), 6); // 5.6 → 6
assert.equal(warnThreshold(1), 1);

// ── Decisions (cap 300) ──────────────────────────────────────────────────────
assert.deepEqual(dailyCapDecision(1, 300), { allowed: true, alert: null });
assert.deepEqual(dailyCapDecision(239, 300), { allowed: true, alert: null });
assert.deepEqual(dailyCapDecision(240, 300), { allowed: true, alert: "warning" });
assert.deepEqual(dailyCapDecision(299, 300), { allowed: true, alert: "warning" });
assert.deepEqual(dailyCapDecision(300, 300), { allowed: true, alert: "reached" }); // last one allowed
assert.deepEqual(dailyCapDecision(null, 300), { allowed: false, alert: "reached" }); // atomic claim refused
assert.deepEqual(dailyCapDecision(301, 300), { allowed: false, alert: "reached" }); // fallback count overshoot

// ── Cap 1: the single preview is both the warning and the last one ───────────
assert.deepEqual(dailyCapDecision(1, 1), { allowed: true, alert: "reached" });
assert.deepEqual(dailyCapDecision(null, 1), { allowed: false, alert: "reached" });
assert.deepEqual(dailyCapDecision(2, 1), { allowed: false, alert: "reached" });

// ── Read-only gate for character sheet / portrait calls ──────────────────────
assert.equal(isDailyCapFull(0, 300), false);
assert.equal(isDailyCapFull(299, 300), false);
assert.equal(isDailyCapFull(300, 300), true);
assert.equal(isDailyCapFull(10_000, null), false); // cap disabled

// ── One alert per kind per day ───────────────────────────────────────────────
assert.equal(dailyCapAlertKey("reached", "2026-09-30"), "daily-preview-cap:reached:2026-09-30");
assert.notEqual(dailyCapAlertKey("warning", "2026-09-30"), dailyCapAlertKey("warning", "2026-10-01"));
assert.notEqual(dailyCapAlertKey("warning", "2026-09-30"), dailyCapAlertKey("reached", "2026-09-30"));

console.log("preview-cap checks passed");
