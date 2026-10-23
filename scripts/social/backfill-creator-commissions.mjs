#!/usr/bin/env node
// Backfills creator attribution for orders paid BEFORE the creator programme was deployed
// (migration 20261023120000_creator_programme.sql): for every paid Checkout Session since
// 2026-10-06 (audience codes were created that day) that used a creator's audience code, writes
// orders.promotion_code_id / promotion_code / discount_cents and the creator_commissions row,
// exactly like the webhook does now (recordOrderPromotion in src/lib/growth/creators.ts):
// 10 % of paid ex-VAT minus the VAT share of what is refunded TODAY, no commission when the
// buyer is the creator, only orders still paid/producing/shipped/delivered. Existing rows are
// left as they are (unique order_id), so it can run again safely.
//
// Run AFTER the migration and after seeding the creators (seed-creators.mjs): a code whose
// creator is not in the creators table is reported and skipped.
//
// Usage (repo root, keys from .env.local; Supabase = NEXT_PUBLIC_SUPABASE_URL = production):
//   node scripts/social/backfill-creator-commissions.mjs              # LIVE Stripe, dry run
//   node scripts/social/backfill-creator-commissions.mjs --apply      # write
//   node scripts/social/backfill-creator-commissions.mjs --since 2026-10-06 --test
import { readFileSync } from "node:fs";
import Stripe from "stripe";
// Node >= 22.18 strips the types of a .ts import (pure module, no imports of its own).
import { commissionCents } from "../../src/lib/creators.ts";

const env = Object.fromEntries(
  readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const get = (name) => process.env[name] || env[name] || (() => { throw new Error(`${name} missing (env or .env.local)`); })();
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const apply = process.argv.includes("--apply");
const test = process.argv.includes("--test");
const since = arg("--since") ?? "2026-10-06";
const LIVE = new Set(["paid", "producing", "shipped", "delivered"]);

const stripe = new Stripe(get(test ? "STRIPE_SECRET_KEY_TEST" : "STRIPE_SECRET_KEY_LIVE"));
const rest = async (path, init = {}) => {
  const res = await fetch(`${get("NEXT_PUBLIC_SUPABASE_URL")}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: get("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${get("SUPABASE_SERVICE_ROLE_KEY")}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(`Supabase ${init.method ?? "GET"} ${path.split("?")[0]}: ${res.status} ${await res.text()}`);
  return res.status === 204 || init.method === "PATCH" ? null : res.json();
};

const counts = { sessions: 0, written: 0, skipped: 0 };
console.log(`${test ? "TEST" : "LIVE"} Stripe, paid sessions since ${since}, ${apply ? "WRITING" : "dry run"}\n`);

for await (const s of stripe.checkout.sessions.list({
  created: { gte: Math.floor(Date.parse(`${since}T00:00:00+02:00`) / 1000) },
  status: "complete",
  limit: 100,
  expand: ["data.discounts.promotion_code", "data.payment_intent.latest_charge"],
})) {
  if (s.payment_status !== "paid" && s.payment_status !== "no_payment_required") continue;
  const promo = (s.discounts ?? []).map((d) => d.promotion_code).find((p) => p && typeof p === "object" && p.metadata?.kind === "audience");
  if (!promo) continue;
  counts.sessions++;
  const skip = (why) => {
    counts.skipped++;
    console.log(`  skip ${s.id} (${promo.code}): ${why}`);
  };

  const [order] = await rest(`orders?stripe_checkout_session_id=eq.${s.id}&select=id,status,customer_email`);
  if (!order) { skip("no order row"); continue; }
  const [creator] = await rest(`creators?stripe_promotion_code_id=eq.${promo.id}&select=id,email,handle`);
  if (!creator) { skip("creator not registered (seed-creators.mjs first)"); continue; }
  if (!LIVE.has(order.status)) { skip(`order ${order.id} is ${order.status}`); continue; }
  const buyer = (s.customer_details?.email ?? order.customer_email ?? "").trim().toLowerCase();
  if (buyer && buyer === creator.email) { skip("bought by the creator"); continue; }

  const charge = typeof s.payment_intent === "object" ? s.payment_intent?.latest_charge : null;
  const amountTotal = s.amount_total ?? 0;
  const amountTax = s.total_details?.amount_tax ?? 0;
  const amountRefunded = Math.min(typeof charge === "object" && charge ? charge.amount_refunded : 0, amountTotal);
  const { commission } = commissionCents({ amountTotal, amountTax, amountRefunded });
  console.log(`  @${creator.handle.padEnd(20)} order ${order.id} paid ${amountTotal} refunded ${amountRefunded} → commission ${commission} cents`);
  if (!apply) continue;

  await rest(`orders?id=eq.${order.id}`, {
    method: "PATCH",
    body: JSON.stringify({ promotion_code_id: promo.id, promotion_code: promo.code, discount_cents: s.total_details?.amount_discount ?? 0 }),
    headers: { Prefer: "return=minimal" },
  });
  await rest("creator_commissions?on_conflict=order_id", {
    method: "POST",
    body: JSON.stringify({
      creator_id: creator.id,
      order_id: order.id,
      amount_total_cents: amountTotal,
      amount_tax_cents: amountTax,
      amount_refunded_cents: amountRefunded,
      commission_cents: commission,
    }),
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
  });
  counts.written++;
}

console.log(`\n${counts.sessions} session(s) with an audience code · ${apply ? `${counts.written} written` : "dry run, nothing written"} · ${counts.skipped} skipped`);
