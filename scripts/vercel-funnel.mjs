#!/usr/bin/env node
// Cookieless funnel read-out from Vercel Web Analytics (custom events from
// src/lib/tracking/vercel-analytics.ts), production only.
//
//   node scripts/vercel-funnel.mjs                 # last 7 days, meta vs other
//   node scripts/vercel-funnel.mjs --days 28
//   node scripts/vercel-funnel.mjs --since 2026-11-01 --until 2026-11-07
//   node scripts/vercel-funnel.mjs --json
//
// Auth: the logged-in `vercel` CLI (`vercel api`), no token stored. Endpoint:
// GET /v1/query/web-analytics/events/aggregate (vercel.com/docs/rest-api/web-analytics).
// Dashboard: https://vercel.com/xevi10hs-projects/kids-book/analytics › Events.

import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TEAM = "team_16XuimRv2lLxTgPL6vqAWdLA";
const PROJECT = "kids-book";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const days = Number(opt("days") ?? 7);
const until = opt("until") ?? new Date().toISOString();
const since = opt("since") ?? new Date(Date.parse(until) - days * 86_400_000).toISOString();
const asJson = args.includes("--json");

/** Funnel order. create_step is split into its 6 steps. */
const STEPS = [
  ["landing_view", "Landing (first page of the visit)"],
  ["cta_click", "Clicked 'Crear su libro' (hero / sticky)"],
  ["create_step:1", "Step 1 · name"],
  ["create_step:2", "Step 2 · protagonist"],
  ["photo_uploaded", "  photo uploaded (optional)"],
  ["create_step:3", "Step 3 · adventure"],
  ["create_step:4", "Step 4 · dedication / painting"],
  ["preview_requested", "Preview requested (generation started)"],
  ["preview_shown", "Preview ready"],
  ["create_step:5", "Step 5 · book preview"],
  ["create_step:6", "Step 6 · order (formats in view)"],
  ["checkout_started", "Checkout started (Stripe)"],
];

function query(by, filter) {
  const qs = new URLSearchParams({ projectId: PROJECT, teamId: TEAM, since, until, limit: "100" });
  for (const b of by) qs.append("by", b);
  if (filter) qs.set("filter", filter);
  const out = execFileSync("vercel", ["api", `/v1/query/web-analytics/events/aggregate?${qs}`], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(out.slice(out.indexOf("{"))).data ?? [];
}

/** Numeric metrics of a row (Vercel returns them next to the group keys, e.g. total / devices). */
const metrics = (row) => Object.fromEntries(Object.entries(row).filter(([, v]) => typeof v === "number"));
/** A group key of a row; Vercel may name an eventData/<key> group either way. */
const dim = (row, key) => row[key] ?? row[key.split("/")[0]];

// One eventData dimension per query (unambiguous rows): split by source with a filter instead.
const table = {};
const raw = {};
for (const source of ["meta", "other"]) {
  const bySource = `eventData/source eq '${source}'`;
  const names = query(["eventName"], bySource);
  const steps = query(["eventData/step"], `eventName eq 'create_step' and ${bySource}`);
  raw[source] = { names, steps };
  const add = (key, row) => ((table[key] ??= {})[source] = metrics(row));
  for (const r of names) if (r.eventName !== "create_step") add(r.eventName, r);
  for (const r of steps) add(`create_step:${dim(r, "eventData/step")}`, r);
}
const empty = Object.values(raw).every((r) => r.names.length === 0 && r.steps.length === 0);

if (asJson) {
  console.log(JSON.stringify({ since, until, funnel: table, raw }, null, 2));
} else {
  console.log(`Vercel Web Analytics funnel, production, ${since.slice(0, 10)} → ${until.slice(0, 10)}`);
  const metricNames = [...new Set(Object.values(table).flatMap((s) => Object.values(s).flatMap((m) => Object.keys(m))))];
  if (!metricNames.length) console.log("(no events in this window)");
  for (const [key, label] of STEPS) {
    const row = table[key] ?? {};
    const cell = (src) => metricNames.map((m) => `${m} ${row[src]?.[m] ?? 0}`).join(" / ") || "0";
    console.log(`${label.padEnd(42)} meta: ${cell("meta").padEnd(22)} other: ${cell("other")}`);
  }
  if (empty) {
    console.log("\nRaw API rows are empty. If the site has traffic, check that the build with @vercel/analytics is live.");
  }
}
