#!/usr/bin/env node
// Seeds public.creators (creator panel, migration 20261023120000_creator_programme.sql) from the
// audience promotion codes already in Stripe (metadata {creator, kind: "audience"}, created by
// scripts/social/create-creator-codes.sh). Stripe has no emails: the login email of each creator
// comes from a CSV you write, one line per creator: `<instagram handle>,<email>`.
//
// Dry run by default (prints what it would insert, writes nothing). Each row is validated
// against the creators table constraints first and inserted on its own: a bad or duplicate row
// is reported and skipped, never aborts the rest. Creators without an email in the CSV are
// listed and skipped; register them later from /admin/creators.
//
// Usage (repo root, keys read from .env.local):
//   node scripts/social/seed-creators.mjs creators.csv              # LIVE Stripe, dry run
//   node scripts/social/seed-creators.mjs creators.csv --apply      # insert (existing emails/codes kept)
//   node scripts/social/seed-creators.mjs creators.csv --test       # TEST Stripe account instead
// --apply writes to the Supabase project in NEXT_PUBLIC_SUPABASE_URL (production in .env.local).
import { readFileSync } from "node:fs";
import Stripe from "stripe";

const env = Object.fromEntries(
  readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const get = (name) => process.env[name] || env[name] || (() => { throw new Error(`${name} missing (env or .env.local)`); })();

const csvPath = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!csvPath) throw new Error("Usage: node scripts/social/seed-creators.mjs <handle,email csv> [--apply] [--test]");
const apply = process.argv.includes("--apply");
const test = process.argv.includes("--test");

const handleOf = (s) => String(s ?? "").trim().replace(/^@/, "").toLowerCase();
const emails = new Map();
for (const line of readFileSync(csvPath, "utf8").split("\n")) {
  const [handle, email] = line.split(",").map((s) => s?.trim());
  if (!handle || !email || handle.startsWith("#") || handle === "handle") continue;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`Bad email for ${handle}: ${email}`);
  emails.set(handleOf(handle), email.toLowerCase());
}

const stripe = new Stripe(get(test ? "STRIPE_SECRET_KEY_TEST" : "STRIPE_SECRET_KEY_LIVE"));
// Same rules as the creators table check constraints (migration 20261023120000).
const invalid = (r) =>
  !/^[a-z0-9._]{1,30}$/.test(r.handle) ? "handle" : !/^[A-Z0-9]{4,24}$/.test(r.promo_code) ? "code" : !/^[^\s@]+@[^\s@]+$/.test(r.email) ? "email" : null;

const rows = [];
const missing = [];
const bad = [];
for await (const p of stripe.promotionCodes.list({ active: true, limit: 100 })) {
  if (p.metadata?.kind !== "audience") continue;
  const handle = handleOf(p.metadata.creator);
  const email = emails.get(handle);
  const row = { email, handle, promo_code: p.code.toUpperCase(), stripe_promotion_code_id: p.id };
  if (!email) missing.push(`@${handle} (${p.code})`);
  else if (invalid(row)) bad.push(`@${handle} (${p.code}): invalid ${invalid(row)}`);
  else rows.push(row);
}

console.log(`${test ? "TEST" : "LIVE"} Stripe: ${rows.length} creator(s) to seed, ${missing.length} without email in ${csvPath}, ${bad.length} invalid`);
for (const r of rows) console.log(`  @${r.handle.padEnd(22)} ${r.promo_code.padEnd(16)} ${r.email}`);
if (missing.length) console.log(`  skipped (no email): ${missing.join(", ")}`);
for (const b of bad) console.log(`  skipped (${b})`);
if (!apply) {
  console.log("Dry run: nothing written. Add --apply to insert.");
  process.exit(0);
}

let inserted = 0;
for (const r of rows) {
  const res = await fetch(`${get("NEXT_PUBLIC_SUPABASE_URL")}/rest/v1/creators`, {
    method: "POST",
    headers: {
      apikey: get("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${get("SUPABASE_SERVICE_ROLE_KEY")}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(r),
  });
  if (res.ok) {
    inserted++;
    console.log(`  inserted @${r.handle}`);
  } else {
    const text = await res.text();
    // 409 = unique email / code / promotion code already registered: left as it is.
    console.log(`  ${res.status === 409 ? "already registered" : `FAILED ${res.status}`} @${r.handle}: ${text.slice(0, 200)}`);
  }
}
console.log(`Inserted ${inserted} of ${rows.length}.`);
