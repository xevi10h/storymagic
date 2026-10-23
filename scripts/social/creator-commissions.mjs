#!/usr/bin/env node
// Monthly creator commissions, straight from Stripe (LIVE, read-only).
//
// Deal (decided 2026-10-22): followers get 10% off with the creator's audience code (<NAME>10,
// Stripe coupon pUqYq48o, promo code metadata {creator, kind: "audience"}, created by
// scripts/social/create-creator-codes.sh). The creator earns 10% of what the buyer paid WITHOUT
// VAT (amount_total - amount_tax), paid by bank transfer once a month when the balance is >= 20 €.
// Refunded amounts are subtracted. Gift codes (kind "gift", 0 €) never count.
//
// Since 2026-10-23 the app keeps the ledger (creator panel + /admin/creators, tables creators /
// creator_commissions / creator_withdrawals): this script stays as an independent cross-check
// straight from Stripe. Formula shared with the app: src/lib/creators.ts (commissionCents).
//
// Usage:
//   node scripts/social/creator-commissions.mjs                          # previous calendar month
//   node scripts/social/creator-commissions.mjs --from 2026-10-01 --to 2026-11-30   # inclusive days
//   node scripts/social/creator-commissions.mjs --orders                 # also list every order
import { readFileSync } from "node:fs";
import Stripe from "stripe";
// Node >= 22.18 strips the types of a .ts import (pure module, no imports of its own).
import { commissionCents, CREATOR_PAYOUT_MIN_CENTS as PAYOUT_MIN_CENTS } from "../../src/lib/creators.ts";

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

function liveKey() {
  if (process.env.STRIPE_SECRET_KEY_LIVE) return process.env.STRIPE_SECRET_KEY_LIVE;
  const line = readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
    .split("\n").find((l) => l.startsWith("STRIPE_SECRET_KEY_LIVE="));
  if (!line) throw new Error("STRIPE_SECRET_KEY_LIVE missing (env or .env.local)");
  return line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
}

/** Madrid calendar days → unix seconds [gte, lt). */
function range() {
  const from = arg("--from");
  const to = arg("--to");
  if (from && to) {
    const day = (s) => Date.parse(`${s}T00:00:00+01:00`) / 1000;
    return { label: `${from} → ${to}`, gte: day(from), lt: day(to) + 86400 };
  }
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const ymd = (d) => d.toISOString().slice(0, 10);
  return { label: ymd(start).slice(0, 7), gte: Date.parse(`${ymd(start)}T00:00:00+01:00`) / 1000, lt: Date.parse(`${ymd(end)}T00:00:00+01:00`) / 1000 };
}

const eur = (cents) => (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });

async function main() {
  const stripe = new Stripe(liveKey());
  const { label, gte, lt } = range();
  const byCreator = new Map();

  for await (const s of stripe.checkout.sessions.list({
    created: { gte, lt },
    status: "complete",
    limit: 100,
    expand: ["data.discounts.promotion_code", "data.payment_intent.latest_charge"],
  })) {
    if (s.payment_status !== "paid") continue;
    const promo = (s.discounts ?? []).map((d) => d.promotion_code).find((p) => p && typeof p === "object" && p.metadata?.kind === "audience");
    if (!promo) continue;
    const creator = promo.metadata.creator || promo.code;
    const charge = s.payment_intent?.latest_charge;
    const { net, commission } = commissionCents({
      amountTotal: s.amount_total,
      amountTax: s.total_details?.amount_tax,
      amountRefunded: typeof charge === "object" && charge ? charge.amount_refunded : 0,
    });
    const row = byCreator.get(creator) ?? { code: promo.code, orders: [], net: 0, commission: 0 };
    row.orders.push({ date: new Date(s.created * 1000).toISOString().slice(0, 10), session: s.id, paid: s.amount_total, net, commission, story: s.metadata?.story_id });
    row.net += net;
    row.commission += commission;
    byCreator.set(creator, row);
  }

  console.log(`Creator commissions ${label} (10% of paid ex-VAT, payout >= ${eur(PAYOUT_MIN_CENTS)})\n`);
  if (!byCreator.size) return console.log("No paid orders with a creator audience code.");
  for (const [creator, r] of [...byCreator].sort((a, b) => b[1].commission - a[1].commission)) {
    const pay = r.commission >= PAYOUT_MIN_CENTS ? "PAY" : "carry over";
    console.log(`@${creator.padEnd(22)} ${r.code.padEnd(16)} orders ${String(r.orders.length).padStart(3)}  net ${eur(r.net).padStart(10)}  commission ${eur(r.commission).padStart(9)}  ${pay}`);
    if (process.argv.includes("--orders")) for (const o of r.orders) console.log(`    ${o.date} ${o.session} paid ${eur(o.paid)} net ${eur(o.net)} → ${eur(o.commission)}`);
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
