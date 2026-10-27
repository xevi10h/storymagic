/* eslint-disable @typescript-eslint/no-explicit-any -- loose in-memory mock of the Supabase query builder */
// Mocked run of the Advent daily email + double opt-in (in-memory DB, Resend stubbed through
// fetch; reads the art from /public). Never touches a real database or sends real email:
//   npx tsx --tsconfig tsconfig.json src/lib/advent/send-run.check.mts
import assert from "node:assert/strict";
import { runAdventEmails } from "@/lib/advent/send-run";
import { subscribe, confirmByToken } from "@/lib/advent/subscriptions";
process.env.RESEND_API_KEY = "re_test"; process.env.SUPABASE_SERVICE_ROLE_KEY = "x";
type Row = Record<string, any>;
const tables: Record<string, Row[]> = {
  advent_subscriptions: [
    { id: "s1", season: 2026, email: "ana@ejemplo.com", user_id: "u1", character_id: "c1", child_name: "Noa", gender: "girl", locale: "es", unsubscribe_token: "a".repeat(32), unsubscribed_at: null, confirmed_at: "x", last_sent_day: 0, created_at: "1" },
    { id: "s2", season: 2026, email: "pere@exemple.cat", user_id: null, character_id: null, child_name: "Pau", gender: "boy", locale: "ca", unsubscribe_token: "b".repeat(32), unsubscribed_at: null, confirmed_at: "x", last_sent_day: 0, created_at: "2" },
    { id: "s3", season: 2026, email: "baja@ejemplo.com", user_id: null, character_id: null, child_name: "Leo", gender: "neutral", locale: "es", unsubscribe_token: "c".repeat(32), unsubscribed_at: null, confirmed_at: "x", last_sent_day: 0, created_at: "3" },
    { id: "s4", season: 2026, email: "fuera@ejemplo.com", user_id: null, character_id: null, child_name: "Ot", gender: "boy", locale: "es", unsubscribe_token: "d".repeat(32), unsubscribed_at: "2026-12-01", confirmed_at: "x", last_sent_day: 0, created_at: "4" },
    { id: "s5", season: 2026, email: "otro@ejemplo.com", user_id: "u1", character_id: "c1", child_name: "Noa", gender: "girl", locale: "es", unsubscribe_token: "e".repeat(32), unsubscribed_at: null, confirmed_at: "x", last_sent_day: 0, created_at: "5" },
    { id: "s6", season: 2026, email: "pendiente@ejemplo.com", user_id: null, character_id: null, child_name: "Ona", gender: "girl", locale: "ca", unsubscribe_token: "f".repeat(32), confirm_token: "g".repeat(32), unsubscribed_at: null, confirmed_at: null, last_sent_day: 0, created_at: "6" },
  ],
  email_suppressions: [{ email: "baja@ejemplo.com" }],
  characters: [{ id: "c1", user_id: "u1", name: "Noa", gender: "girl", age: 9, skin_tone: "#fce4d6", hair_color: "#d84315", hairstyle: "curly", eye_color: "#558b2f", glasses: "none", freckles: true }],
};
function q(table: string) {
  const filters: ((r: Row) => boolean)[] = []; let patch: Row | null = null; let insertRow: Row | null = null; let wantSelect = false; let limit = 1e9; let single = false;
  const api: any = {
    select() { wantSelect = true; return api; }, update(p: Row) { patch = p; return api; },
    eq(k: string, v: any) { filters.push((r) => r[k] === v); return api; }, is(k: string, v: any) { filters.push((r) => (r[k] ?? null) === v); return api; },
    not(k: string, _op: string, v: any) { filters.push((r) => (r[k] ?? null) !== v); return api; },
    or(expr: string) { // only "col.is.null,col.lte.\"iso\""
      const m = /^(\w+)\.is\.null,\1\.lte\."([^"]+)"$/.exec(expr); if (!m) throw new Error("mock or: " + expr);
      filters.push((r) => r[m[1]] == null || r[m[1]] <= m[2]); return api; },
    insert(row: Row) { insertRow = row; return api; },
    lt(k: string, v: any) { filters.push((r) => r[k] < v); return api; }, in(k: string, vs: any[]) { filters.push((r) => vs.includes(r[k])); return api; },
    order() { return api; }, limit(n: number) { limit = n; return api; }, maybeSingle() { single = true; return api; },
    then(res: any, rej: any) {
      if (insertRow) {
        const dup = tables[table].some((r) => r.season === insertRow!.season && r.email === insertRow!.email);
        if (dup) return Promise.resolve({ data: null, error: { code: "23505", message: "dup" } }).then(res, rej);
        tables[table].push({ id: "n" + tables[table].length, last_sent_day: 0, created_at: "9", ...insertRow });
        return Promise.resolve({ data: null, error: null }).then(res, rej);
      }
      const rows = tables[table].filter((r) => filters.every((f) => f(r))).slice(0, limit);
      if (patch) rows.forEach((r) => Object.assign(r, patch));
      const data = single ? rows[0] ?? null : rows.map((r) => ({ ...r }));
      return Promise.resolve({ data: patch && !wantSelect ? null : data, error: null }).then(res, rej);
    },
  };
  return api;
}
const users: Record<string, any> = { u1: { id: "u1", email: "ana@ejemplo.com", email_confirmed_at: "x", is_anonymous: false } };
const db: any = { from: q, auth: { admin: { getUserById: async (id: string) => ({ data: { user: users[id] ?? null }, error: null }) } } };
const sent: any[] = []; let failNext = false;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: any, init: any) => {
  if (String(url).startsWith("https://api.resend.com")) {
    const body = JSON.parse(init.body); if (failNext) { failNext = false; return new Response("boom", { status: 500 }); }
    sent.push(body); return new Response("{}", { status: 200 });
  }
  return realFetch(url, init);
}) as any;
const opts = { now: Date.now(), dryRun: false, limit: 100, budgetMs: 60_000 };
// outside the window
let s = await runAdventEmails(db, { ...opts, today: "2026-11-30" }); assert.equal(s.door, null); assert.equal(sent.length, 0);
// dry run
s = await runAdventEmails(db, { ...opts, dryRun: true, today: "2026-12-05" }); assert.equal(s.wouldSend, 3); assert.equal(s.suppressed, 1); assert.equal(sent.length, 0);
// first send fails for s1 → claim released
failNext = true;
s = await runAdventEmails(db, { ...opts, today: "2026-12-05" });
assert.equal(s.failed, 1); assert.equal(s.sent, 2); assert.equal(tables.advent_subscriptions[0].last_sent_day, 0, "failed send released");
assert.equal(tables.advent_subscriptions[1].last_sent_day, 5);
// retry run: only s1, no duplicates
s = await runAdventEmails(db, { ...opts, today: "2026-12-05" });
assert.equal(s.sent, 1); assert.equal(s.withPortrait, 1);
s = await runAdventEmails(db, { ...opts, today: "2026-12-05" }); assert.equal(s.sent, 0, "idempotent per day");
const byTo = (to: string) => sent.filter((m) => m.to[0] === to);
assert.equal(byTo("ana@ejemplo.com").length, 1); assert.equal(byTo("pere@exemple.cat").length, 1); assert.equal(byTo("otro@ejemplo.com").length, 1);
assert.equal(byTo("baja@ejemplo.com").length, 0); assert.equal(byTo("fuera@ejemplo.com").length, 0);
const ana = byTo("ana@ejemplo.com")[0], pere = byTo("pere@exemple.cat")[0], otro = byTo("otro@ejemplo.com")[0];
assert.ok(ana.attachments.some((a: any) => a.content_id === "advent-portrait"), "portrait for the account's own email");
assert.ok(!otro.attachments.some((a: any) => a.content_id), "linked account but different email → name-only");
assert.ok(!pere.attachments.some((a: any) => a.content_id));
assert.equal(pere.subject, "Porta 5: En Pau i el camell que no sabia estar-se quiet");
assert.equal(pere.attachments[0].filename, "pau-porta-05.pdf");
assert.ok(ana.headers["List-Unsubscribe"].includes("/api/advent/unsubscribe?t=")); assert.equal(ana.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
// late sign-up on the 24th: today's door only + the compilation
s = await runAdventEmails(db, { ...opts, today: "2026-12-24" });
const last = sent.filter((m) => m.to[0] === "pere@exemple.cat").at(-1);
assert.equal(last.attachments.length, 2); assert.equal(last.attachments[1].filename, "pau-llibre-d-advent.pdf");
assert.equal(sent.filter((m) => m.to[0] === "pendiente@ejemplo.com").length, 0, "pending row never emailed");

// ── Double opt-in sign-up ──
const before = sent.length;
const base = { childName: "Martí", gender: "boy" as const, locale: "ca" as const, userId: null, characterId: null };
let r1 = await subscribe(db, { ...base, email: "nou@exemple.cat", verifiedSelf: false });
assert.deepEqual(r1, { ok: true, state: "pending" });
const conf = sent.slice(before);
assert.equal(conf.length, 1); assert.ok(!conf[0].attachments, "confirmation: no PDF"); assert.ok(!conf[0].headers, "confirmation: not commercial");
assert.ok(conf[0].html.includes("/ca/advent/confirm?t=") && conf[0].text.includes("per a en Martí"), "ca confirmation copy");
assert.ok(!/oferta|IVA/i.test(conf[0].html), "no offer in the confirmation");
r1 = await subscribe(db, { ...base, email: "nou@exemple.cat", verifiedSelf: false });
assert.equal(r1.ok && r1.state, "pending"); assert.equal(sent.length, before + 1, "no re-send within 10 min");
const nou = tables.advent_subscriptions.find((x) => x.email === "nou@exemple.cat")!;
nou.confirm_sent_at = new Date(Date.now() - 11 * 60_000).toISOString();
await subscribe(db, { ...base, email: "nou@exemple.cat", verifiedSelf: false });
assert.equal(sent.length, before + 2, "re-sent after 10 min");
// pending: the cron skips it
s = await runAdventEmails(db, { ...opts, today: "2026-12-06" });
assert.equal(sent.filter((m) => m.to[0] === "nou@exemple.cat" && m.attachments).length, 0);
// confirm (scanner-proof page POSTs the token) → next door is sent
assert.equal(await confirmByToken(db, nou.confirm_token), "ok"); assert.ok(nou.confirmed_at, "confirmed_at = consent proof");
assert.equal(await confirmByToken(db, "z".repeat(32)), "invalid");
s = await runAdventEmails(db, { ...opts, today: "2026-12-07" });
assert.equal(sent.filter((m) => m.to[0] === "nou@exemple.cat" && m.attachments).length, 1);
// a guest cannot change a confirmed subscription
const n0 = sent.length;
const r2 = await subscribe(db, { ...base, childName: "Intrús", email: "nou@exemple.cat", verifiedSelf: false });
assert.equal(r2.ok && r2.state, "already"); assert.equal(nou.child_name, "Martí"); assert.equal(sent.length, n0);
// the account's own verified email: active at once, no confirmation email
const r3 = await subscribe(db, { ...base, email: "propia@ejemplo.com", verifiedSelf: true, userId: "u9" });
assert.equal(r3.ok && r3.state, "active"); assert.equal(sent.length, n0, "single opt-in sends nothing");
assert.ok(tables.advent_subscriptions.find((x) => x.email === "propia@ejemplo.com")!.confirmed_at);

console.log("cron mock: all checks passed", { sentTotal: sent.length, pdfKB: Math.round(Buffer.from(pere.attachments[0].content, "base64").length / 1024), compKB: Math.round(Buffer.from(last.attachments[1].content, "base64").length / 1024) });
