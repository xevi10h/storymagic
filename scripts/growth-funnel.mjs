#!/usr/bin/env node
// Consent-independent growth funnel for Meapica, straight from the production database.
//
// Cohort view by the Europe/Madrid calendar day a story was created:
//   stories created → generation started → preview ready → order created → paid
// plus refunded stories, paid revenue (EUR, IVA incluido: B2C prices) and a per-locale split.
// Unlike PostHog / GA4 / pixels it does not depend on cookie consent: it counts our own rows.
//
// Data: Supabase Management API, read-only endpoint
//   POST https://api.supabase.com/v1/projects/<ref>/database/query/read-only
// (runs as supabase_read_only_user, so this script can never write).
// Token: env SUPABASE_PAT, else SUPABASE_PAT in .env.local, else ~/.config/supabase-profiles/meapica.
// Project ref: from NEXT_PUBLIC_SUPABASE_URL (env or .env.local).
//
// Steps:
//   generation started = stories.generation_started_at (when the column exists), else status <> 'draft'
//                        or preview reached
//   preview ready      = stories.preview_ready_at (when the column exists), else status in
//                        preview/ready/ordered, or the story has an order
//   order created      = any orders row for the story (incl. expired checkouts: status cancelled/pending)
//   paid               = an order in paid/producing/shipped/delivered, not refunded
// Excluded: showcase stories and test/e2e/admin traffic (TEST_EMAIL_PATTERNS, ADMIN_EMAILS, --exclude-email,
// paid orders of 0 € = promo-code tests). A user with ANY excluded email (account, profile or an order's
// checkout email) or a 0 € paid order is excluded with all their stories. Anonymous guests are kept.
//
// Usage:
//   node scripts/growth-funnel.mjs                        # last 28 days, table
//   node scripts/growth-funnel.mjs --days 7
//   node scripts/growth-funnel.mjs --from 2026-09-01 --to 2026-09-30
//   node scripts/growth-funnel.mjs --json                 # machine-readable (weekly growth report)
//   node scripts/growth-funnel.mjs --exclude-email someone@gmail.com --exclude-email '^qa\.'
//   node scripts/growth-funnel.mjs --help

import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Test / e2e / internal addresses (case-insensitive POSIX regexes, matched against the whole address).
 * One list for the whole script; add more with --exclude-email (regex or plain address).
 */
const TEST_EMAIL_PATTERNS = [
  "@casmar\\.tech$",
  "@optimtech\\.es$",
  "@eleva-ai\\.com$",
  "@resend\\.dev$",
  "@example\\.(com|org|net)$",
  "@test\\.",
  "^[^@]*\\+e2e[^@]*@",
  "^[^@]*e2e[^@]*@",
  "^[^@]*test[^@]*@",
  "^[^@]*prueba[^@]*@",
  "^[^@]*xavi[^@]*@",
  "^[^@]*huix[^@]*@",
  "^meapica@gmail\\.com$", // brand account used for owner test orders
];
const PAID_STATUSES = ["paid", "producing", "shipped", "delivered"];
const PREVIEW_STATUSES = ["preview", "ready", "ordered"];
const TZ = "Europe/Madrid";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
};
const optAll = (name) => argv.flatMap((a, i) => (a === name && argv[i + 1] !== undefined ? [argv[i + 1]] : []));

if (flag("--help") || flag("-h")) {
  console.log(`Meapica growth funnel (prod DB, read-only, consent-independent)

  node scripts/growth-funnel.mjs [--days N | --from YYYY-MM-DD --to YYYY-MM-DD] [--json] [--exclude-email X]...

  --days N            last N Madrid days including today (default 28)
  --from / --to       explicit cohort range (Madrid calendar days, inclusive); --to defaults to today
  --json              JSON output for reports
  --exclude-email X   extra address or regex to treat as test traffic (repeatable)
  ADMIN_EMAILS        env, comma-separated, always excluded (default admin@casmar.tech)`);
  process.exit(0);
}

const JSON_OUT = flag("--json");
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function die(msg) {
  console.error(`growth-funnel: ${msg}`);
  process.exit(1);
}

// ───────── config ─────────
function readEnvLocal() {
  const file = join(ROOT, ".env.local");
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}
const envLocal = readEnvLocal();
function token() {
  if (process.env.SUPABASE_PAT) return process.env.SUPABASE_PAT.trim();
  if (envLocal.SUPABASE_PAT) return envLocal.SUPABASE_PAT;
  const profile = join(homedir(), ".config", "supabase-profiles", "meapica");
  if (existsSync(profile)) return readFileSync(profile, "utf8").trim();
  return die("no Supabase token (SUPABASE_PAT env, .env.local or ~/.config/supabase-profiles/meapica)");
}
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || envLocal.NEXT_PUBLIC_SUPABASE_URL || "";
const REF = supabaseUrl.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ?? die("NEXT_PUBLIC_SUPABASE_URL missing or not *.supabase.co");
const PAT = token();

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const adminEmails = (process.env.ADMIN_EMAILS ?? "admin@casmar.tech")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
const extra = optAll("--exclude-email").map((e) => (e.includes("@") && !/[\^$\\[(|*+?]/.test(e) ? `^${escapeRegex(e.toLowerCase())}$` : e));
const PATTERNS = [...TEST_EMAIL_PATTERNS, ...adminEmails.map((e) => `^${escapeRegex(e)}$`), ...extra];

// ───────── date window (Madrid calendar days) ─────────
const madridToday = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
const addDays = (ymd, n) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
let from;
let to = opt("--to", madridToday);
if (opt("--from")) {
  from = opt("--from");
} else {
  const days = Number(opt("--days", "28"));
  if (!Number.isInteger(days) || days < 1 || days > 3650) die("--days must be an integer 1..3650");
  from = addDays(to, -(days - 1));
}
if (!DATE_RE.test(from) || !DATE_RE.test(to)) die("--from / --to must be YYYY-MM-DD");
if (from > to) die("--from is after --to");

// ───────── query ─────────
async function sql(query, parameters = []) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query/read-only`, {
    method: "POST",
    headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, parameters }),
    signal: AbortSignal.timeout(60_000),
  });
  const body = await res.text();
  if (!res.ok) die(`Management API ${res.status}: ${body.slice(0, 500)}`);
  return JSON.parse(body);
}

const cols = await sql(
  `select column_name from information_schema.columns
   where table_schema = 'public' and table_name = 'stories' and column_name in ('generation_started_at', 'preview_ready_at')`,
);
const hasCol = new Set(cols.map((c) => c.column_name));
const timestampMode = hasCol.has("generation_started_at") && hasCol.has("preview_ready_at");

const previewExpr = `(${hasCol.has("preview_ready_at") ? "s.preview_ready_at is not null or " : ""}s.status = any($4::text[]) or so.order_created)`;
const startedExpr = `(${hasCol.has("generation_started_at") ? "s.generation_started_at is not null or " : ""}s.status <> 'draft' or ${previewExpr})`;

// $1 from, $2 to, $3 patterns, $4 preview statuses, $5 paid statuses
const QUERY = `
with bad_users as (
  select u.id from auth.users u where lower(u.email) ~* any($3::text[])
  union
  select p.id from public.profiles p where lower(p.email) ~* any($3::text[])
  union
  select o.user_id from public.orders o
  where o.user_id is not null
    and (lower(o.customer_email) ~* any($3::text[]) or (o.total = 0 and o.status = any($5::text[])))
),
bad_stories as (
  select o.story_id from public.orders o
  where o.story_id is not null
    and (lower(o.customer_email) ~* any($3::text[]) or (o.total = 0 and o.status = any($5::text[])))
),
cohort as (
  select s.*, (s.created_at at time zone '${TZ}')::date as day,
         (s.user_id in (select id from bad_users) or s.id in (select story_id from bad_stories)) as excluded
  from public.stories s
  where not coalesce(s.is_showcase, false)
    and (s.created_at at time zone '${TZ}')::date between $1::date and $2::date
),
story_orders as (
  select o.story_id,
         true as order_created,
         bool_or(o.status = any($5::text[]) and o.refunded_at is null) as paid,
         bool_or(o.refunded_at is not null or o.status = 'refunded') as refunded,
         coalesce(sum(o.total) filter (where o.status = any($5::text[]) and o.refunded_at is null), 0) as revenue,
         count(*) filter (where o.status = any($5::text[]) and o.refunded_at is null) as paid_orders
  from public.orders o
  where o.story_id in (select id from cohort)
  group by o.story_id
),
flags as (
  select s.day, coalesce(s.locale, '?') as locale, s.excluded,
         ${startedExpr} as started,
         ${previewExpr} as preview,
         coalesce(so.order_created, false) as ordered,
         coalesce(so.paid, false) as paid,
         coalesce(so.refunded, false) as refunded,
         coalesce(so.revenue, 0) as revenue,
         coalesce(so.paid_orders, 0) as paid_orders
  from cohort s left join story_orders so on so.story_id = s.id
)
select day::text, locale, excluded,
       count(*)::int as created,
       count(*) filter (where started)::int as started,
       count(*) filter (where preview)::int as preview,
       count(*) filter (where ordered)::int as ordered,
       count(*) filter (where paid)::int as paid,
       count(*) filter (where refunded)::int as refunded,
       sum(paid_orders)::int as paid_orders,
       sum(revenue)::numeric(12,2)::text as revenue
from flags
group by 1, 2, 3
order by 1, 2`;

const rows = await sql(QUERY, [from, to, PATTERNS, PREVIEW_STATUSES, PAID_STATUSES]);

// ───────── aggregate ─────────
const STEPS = ["created", "started", "preview", "ordered", "paid"];
const empty = () => ({ created: 0, started: 0, preview: 0, ordered: 0, paid: 0, refunded: 0, paid_orders: 0, revenue: 0 });
const add = (acc, r) => {
  for (const k of [...STEPS, "refunded", "paid_orders"]) acc[k] += r[k];
  acc.revenue = Math.round((acc.revenue + Number(r.revenue)) * 100) / 100;
  return acc;
};
const byDay = new Map();
for (let d = from; d <= to; d = addDays(d, 1)) byDay.set(d, empty());
const byLocale = new Map();
const totals = empty();
const excluded = empty();
for (const r of rows) {
  if (r.excluded) {
    add(excluded, r);
    continue;
  }
  add(byDay.get(r.day) ?? byDay.set(r.day, empty()).get(r.day), r);
  add(byLocale.get(r.locale) ?? byLocale.set(r.locale, empty()).get(r.locale), r);
  add(totals, r);
}
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
const conversion = (t) => ({
  started_of_created: pct(t.started, t.created),
  preview_of_started: pct(t.preview, t.started),
  ordered_of_preview: pct(t.ordered, t.preview),
  paid_of_ordered: pct(t.paid, t.ordered),
  paid_of_preview: pct(t.paid, t.preview),
  paid_of_created: pct(t.paid, t.created),
});

const report = {
  generated_at: new Date().toISOString(),
  timezone: TZ,
  from,
  to,
  mode: timestampMode ? "timestamps" : "status_fallback",
  currency: "EUR",
  vat: "included",
  definitions: {
    started: timestampMode ? "stories.generation_started_at set" : "status <> 'draft' or preview reached",
    preview: timestampMode ? "stories.preview_ready_at set" : `status in (${PREVIEW_STATUSES.join(", ")}) or has an order`,
    ordered: "any orders row for the story (incl. abandoned checkouts)",
    paid: `an order in (${PAID_STATUSES.join(", ")}) and not refunded`,
  },
  totals: { ...totals, conversion: conversion(totals) },
  by_locale: Object.fromEntries([...byLocale].sort((a, b) => b[1].created - a[1].created).map(([k, v]) => [k, { ...v, conversion: conversion(v) }])),
  by_day: [...byDay].map(([day, v]) => ({ day, ...v })),
  excluded: { stories: excluded.created, paid_stories: excluded.paid, revenue: excluded.revenue, patterns: PATTERNS },
};

if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

// ───────── table ─────────
const eur = (n) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
const fmtPct = (p) => (p === null ? "-" : `${p.toLocaleString("es-ES")} %`);
const HEAD = ["day", "created", "started", "preview", "ordered", "paid", "refund", "revenue"];
const line = (label, t) => [label, t.created, t.started, t.preview, t.ordered, t.paid, t.refunded, eur(t.revenue)].map(String);
const table = [HEAD, ...report.by_day.map((d) => line(d.day, d)), line("TOTAL", totals)];
const widths = HEAD.map((_, i) => Math.max(...table.map((r) => r[i].length)));
const render = (r) => r.map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join("  ");

console.log(`Meapica growth funnel · cohorts ${from} → ${to} (${TZ}, by story creation day)`);
console.log(`mode: ${report.mode}${timestampMode ? "" : " (stories.generation_started_at / preview_ready_at not in DB yet)"}\n`);
console.log(render(HEAD));
console.log(widths.map((w) => "─".repeat(w)).join("  "));
for (const r of table.slice(1, -1)) console.log(render(r));
console.log(widths.map((w) => "─".repeat(w)).join("  "));
console.log(render(table.at(-1)));

const c = report.totals.conversion;
console.log(
  `\nconversion: started/created ${fmtPct(c.started_of_created)} · preview/started ${fmtPct(c.preview_of_started)} · ` +
    `ordered/preview ${fmtPct(c.ordered_of_preview)} · paid/ordered ${fmtPct(c.paid_of_ordered)} · paid/preview ${fmtPct(c.paid_of_preview)} · ` +
    `paid/created ${fmtPct(c.paid_of_created)}`,
);
console.log(`revenue (IVA incluido): ${eur(totals.revenue)} from ${totals.paid_orders} paid orders\n`);
console.log("by locale:");
for (const [loc, t] of Object.entries(report.by_locale)) {
  console.log(
    `  ${loc.padEnd(3)} created ${String(t.created).padStart(4)} · preview ${String(t.preview).padStart(4)} · ordered ${String(t.ordered).padStart(3)} · ` +
      `paid ${String(t.paid).padStart(3)} (${fmtPct(t.conversion.paid_of_preview)} of previews) · ${eur(t.revenue)}`,
  );
}
console.log(`\nexcluded as test/e2e/admin: ${excluded.created} stories (${excluded.paid} paid, ${eur(excluded.revenue)})`);
