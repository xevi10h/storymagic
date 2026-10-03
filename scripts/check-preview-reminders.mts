// Self-check for the abandoned-preview reminders: schedule + stop rules, the deadline
// line and the four-language emails (nothing leaves the machine).
// Run: npx tsx scripts/check-preview-reminders.mts
import assert from "node:assert/strict";
import {
  REMINDER_EXPIRY_MS,
  dueStage,
  isQuietHour,
  madridHour,
  reminderDecision,
  type ReminderFacts,
} from "../src/lib/marketing/preview-reminder-schedule.ts";
import { buildPreviewReminderEmail, reminderDeadline } from "../src/lib/email/preview-reminder.ts";
import { nextPhysicalCutoff } from "../src/lib/shipping.ts";

const HOUR = 3_600_000;
const T0 = Date.parse("2026-10-05T10:00:00Z");

// ── Schedule: 1 h, 24 h, 72 h after the consent; an overtaken reminder is skipped ──
assert.equal(dueStage(0, T0, T0 + 59 * 60_000), null, "nothing before 1 h");
assert.equal(dueStage(0, T0, T0 + HOUR), 1);
assert.equal(dueStage(1, T0, T0 + 2 * HOUR), null, "reminder 1 is never sent twice");
assert.equal(dueStage(1, T0, T0 + 24 * HOUR), 2);
assert.equal(dueStage(0, T0, T0 + 25 * HOUR), 2, "cron outage: only the latest due reminder goes out");
assert.equal(dueStage(2, T0, T0 + 72 * HOUR), 3);
assert.equal(dueStage(3, T0, T0 + 500 * HOUR), null, "never a fourth email");

// ── Stop rules win over sending ─────────────────────────────────────────────
const facts = (over: Partial<ReminderFacts> = {}): ReminderFacts => ({
  stage: 0,
  consentAt: T0,
  now: T0 + 2 * HOUR,
  storyStatus: "preview",
  hasPaidOrder: false,
  suppressed: false,
  ...over,
});
assert.deepEqual(reminderDecision(facts()), { action: "send", stage: 1 });
assert.deepEqual(reminderDecision(facts({ now: T0 + 30 * 60_000 })), { action: "wait" });
assert.deepEqual(reminderDecision(facts({ suppressed: true })), { action: "stop", reason: "unsubscribed" });
assert.deepEqual(reminderDecision(facts({ hasPaidOrder: true })), { action: "stop", reason: "purchased" });
for (const status of ["completing", "ready", "ordered", "shipped", "delivered"]) {
  assert.deepEqual(reminderDecision(facts({ storyStatus: status })), { action: "stop", reason: "purchased" }, status);
}
assert.deepEqual(reminderDecision(facts({ storyStatus: null })), { action: "stop", reason: "story_unavailable" });
assert.deepEqual(reminderDecision(facts({ storyStatus: "draft" })), { action: "stop", reason: "story_unavailable" });
assert.deepEqual(reminderDecision(facts({ stage: 2, now: T0 + REMINDER_EXPIRY_MS + 1 })), { action: "stop", reason: "expired" });
assert.deepEqual(reminderDecision(facts({ stage: 2, now: T0 + REMINDER_EXPIRY_MS - HOUR })), { action: "send", stage: 3 });
assert.deepEqual(reminderDecision(facts({ stage: 3, now: T0 + 80 * HOUR })), { action: "wait" });
// An unsubscribed buyer is recorded as unsubscribed (the stricter reason).
assert.deepEqual(reminderDecision(facts({ suppressed: true, hasPaidOrder: true })), { action: "stop", reason: "unsubscribed" });

// ── Quiet hours (Spain) ─────────────────────────────────────────────────────
assert.equal(madridHour(Date.parse("2026-10-05T20:30:00Z")), 22, "CEST = UTC+2");
assert.equal(isQuietHour(Date.parse("2026-10-05T20:30:00Z")), true);
assert.equal(isQuietHour(Date.parse("2026-10-05T05:59:00Z")), true, "07:59 in Madrid");
assert.equal(isQuietHour(Date.parse("2026-10-05T06:00:00Z")), false, "08:00 in Madrid");
assert.equal(madridHour(Date.parse("2026-12-05T22:30:00Z")), 23, "CET = UTC+1");

// ── Deadline line (single source: src/lib/shipping.ts) ──────────────────────
const october = reminderDeadline(nextPhysicalCutoff("2026-10-03"), false, "christmas");
assert.deepEqual(october, { kind: "printed", occasion: "christmas", lastOrderDate: "2026-12-10", daysLeft: 68 });
assert.equal(reminderDeadline(nextPhysicalCutoff("2026-03-01"), false, "christmas"), null, "no Christmas cut-off quoted in March");
const afterChristmasCutoff = reminderDeadline(nextPhysicalCutoff("2026-12-15"), true, "christmas");
assert.equal(afterChristmasCutoff?.kind === "printed" && afterChristmasCutoff.occasion, "reyes");
assert.deepEqual(reminderDeadline(nextPhysicalCutoff("2026-12-28"), true, "reyes"), { kind: "pdf_only", occasion: "reyes" });

// ── Emails: 4 locales × 3 reminders ─────────────────────────────────────────
const UNSUB = "https://meapica.shop/es/unsubscribe?t=v1.abc.def";
const PREVIEW = "https://meapica.shop/es/preview/TOKEN";
const COVER = "https://meapica.shop/api/preview-image/TOKEN";
const VAT = { es: "IVA incluido", ca: "IVA inclòs", en: "VAT included", fr: "TVA incluse" } as const;
for (const locale of ["es", "ca", "en", "fr"] as const) {
  for (const stage of [1, 2, 3] as const) {
    const mail = buildPreviewReminderEmail({
      locale,
      stage,
      childName: "Olívia",
      childGender: "girl",
      previewUrl: PREVIEW,
      coverUrl: COVER,
      deadline: october,
      unsubscribeUrl: UNSUB,
    });
    const where = `${locale}/${stage}`;
    assert.equal(mail.commercial, true, where);
    assert.ok(mail.subject.includes("Olívia"), `${where} subject names the child`);
    assert.ok(!/[—–]/.test(mail.subject + mail.text), `${where} no dashes (email voice)`);
    assert.ok(mail.html.includes(UNSUB.replace("&", "&amp;")) && mail.text.includes(UNSUB), `${where} unsubscribe link`);
    assert.ok(mail.html.includes("NIF 41649433K") && mail.text.includes("NIF 41649433K"), `${where} seller identity (LSSI 20.1)`);
    assert.ok(mail.html.includes("hola@meapica.shop"), `${where} address to object (LSSI 22.1)`);
    assert.ok(mail.html.includes(`src="${COVER}"`), `${where} cover image`);
    assert.ok(mail.html.split(PREVIEW).length >= 3 && mail.text.includes(PREVIEW), `${where} preview link (image + button)`);
    assert.ok(/10 (de |d')?(diciembre|desembre|December|décembre)/.test(mail.text), `${where} printed cut-off date: ${mail.text}`);
    if (stage === 2) assert.ok(mail.text.includes(VAT[locale]), `${where} prices carry their VAT treatment`);
    assert.ok(!mail.text.includes("<strong>"), `${where} plain text has no markup`);
  }
}
// Catalan grammar + HTML escaping of the name; no cover, no deadline.
const ca = buildPreviewReminderEmail({
  locale: "ca",
  stage: 1,
  childName: "Pau",
  childGender: "boy",
  previewUrl: PREVIEW,
  coverUrl: null,
  deadline: null,
  unsubscribeUrl: UNSUB,
});
assert.equal(ca.subject, "El conte d'en Pau continua aquí");
assert.ok(!ca.html.includes("<img src=\"https://meapica.shop/api/preview-image"), "no cover → no picture");
const pdfOnly = buildPreviewReminderEmail({
  locale: "es",
  stage: 3,
  childName: "D'Artagnan",
  previewUrl: PREVIEW,
  coverUrl: null,
  deadline: { kind: "pdf_only", occasion: "reyes" },
  unsubscribeUrl: UNSUB,
});
assert.ok(pdfOnly.html.includes("D&#39;Artagnan") && !pdfOnly.html.includes("D'Artagnan"), "name escaped in HTML");
assert.ok(pdfOnly.text.includes("ya no llega a tiempo para Reyes"));
// Unknown locale falls back to Spanish.
assert.ok(buildPreviewReminderEmail({ locale: "de", stage: 1, childName: "Leo", previewUrl: PREVIEW, coverUrl: null, deadline: null, unsubscribeUrl: UNSUB }).subject.startsWith("El cuento de Leo"));

console.log("preview-reminders checks OK");
