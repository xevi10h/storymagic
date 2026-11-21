// The owner's emails carry the "continue your book" claim link (not the read-only share link),
// and every link sent stamps stories.updated_at (guest purge alignment). Runs the real
// reminder run against an in-memory fake of Supabase and a stubbed Resend fetch: nothing
// leaves the machine. Run: npx tsx scripts/check-claim-link-emails.mts
import assert from "node:assert/strict";

process.env.SUPABASE_SERVICE_ROLE_KEY = "check-only-service-role-key";
process.env.RESEND_API_KEY = "re_check_only";
process.env.NEXT_PUBLIC_SITE_URL = "https://meapica.es";

const { runPreviewReminders } = await import("../src/lib/marketing/preview-reminders.ts");
const { issueStoryClaimLink } = await import("../src/lib/share/story-claim-link.ts");
const { verifyStoryClaimToken } = await import("../src/lib/share/story-claim-token.ts");

const STORY = "3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b";
const EMAIL = "marta@example.com";
const NOW = Date.parse("2026-11-21T12:00:00Z"); // 13:00 Madrid: not quiet hours

// Minimal chainable fake: records updates, answers selects per table.
type Op = { table: string; op: string; patch?: Record<string, unknown>; filters: [string, string, unknown][] };
const ops: Op[] = [];
const rows: Record<string, unknown[]> = {
  preview_reminders: [{ id: "r1", story_id: STORY, email: EMAIL, locale: "ca", consent_at: new Date(NOW - 2 * 3_600_000).toISOString(), stage: 0, last_sent_at: null, checkout_abandoned_at: null }],
  stories: [{ id: STORY, status: "preview", cover_image_url: "x", characters: { name: "Olívia", gender: "girl" } }],
  orders: [],
  email_suppressions: [],
};
function from(table: string) {
  const o: Op = { table, op: "select", filters: [] };
  ops.push(o);
  const b: Record<string, unknown> = {};
  const chain = (name: string) => (...args: unknown[]) => {
    if (["eq", "neq", "is", "in", "lt", "lte"].includes(name)) o.filters.push([name, String(args[0]), args[1]]);
    return b;
  };
  for (const m of ["select", "eq", "neq", "is", "in", "lt", "lte", "order", "limit"]) b[m] = chain(m);
  b.update = (patch: Record<string, unknown>) => ((o.op = "update"), (o.patch = patch), b);
  b.maybeSingle = () => Promise.resolve({ data: null, error: null });
  b.then = (resolve: (v: unknown) => void) =>
    resolve(o.op === "update" ? { data: [{ id: "r1" }], error: null } : { data: rows[table] ?? [], error: null });
  return b;
}
const db = { from } as never;

const sent: { to: string; html: string; text: string }[] = [];
globalThis.fetch = (async (_url: string, init: { body: string }) => {
  sent.push(JSON.parse(init.body));
  return new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
}) as typeof fetch;

// ── Reminder run ────────────────────────────────────────────────────────────
const summary = await runPreviewReminders(db, { now: NOW, dryRun: false, limit: 10, budgetMs: 60_000 });
assert.equal(summary.sent, 1, JSON.stringify(summary));
assert.equal(sent.length, 1);
const mail = sent[0];
assert.deepEqual([mail.to].flat(), [EMAIL]);
const claim = mail.html.match(/https:\/\/meapica\.es\/ca\/continue\/([A-Za-z0-9_-]{60})/);
assert.ok(claim, "the reminder button is the claim link");
assert.ok(mail.text.includes(claim[0]), "text part too");
assert.ok(!/\/preview\/[A-Za-z0-9_-]{50}["\s]/.test(mail.html), "no read-only share link as the CTA");
assert.ok(/\/api\/preview-image\//.test(mail.html), "the cover still goes through the share-token image proxy");
const v = verifyStoryClaimToken(claim[1], { email: EMAIL });
assert.ok(v.ok && v.storyId === STORY, "bound to this story and this address");
assert.equal(verifyStoryClaimToken(claim[1], { email: "someone@else.com" }).ok, false);
const touch = ops.find((o) => o.table === "stories" && o.op === "update");
assert.ok(touch && typeof touch.patch?.updated_at === "string", "activity stamped");
assert.deepEqual(touch.filters, [["eq", "id", STORY], ["neq", "status", "generating"]]);

// ── Link helper used by send-preview ────────────────────────────────────────
ops.length = 0;
const url = await issueStoryClaimLink(db, { storyId: STORY, email: EMAIL, locale: "es", siteUrl: "https://meapica.es/" });
assert.match(url, /^https:\/\/meapica\.es\/es\/continue\/[A-Za-z0-9_-]{60}$/);
assert.equal(ops.filter((o) => o.table === "stories" && o.op === "update").length, 1);

console.log("claim-link emails: all checks passed");
