#!/usr/bin/env node
// Monthly creator commissions, straight from Stripe (LIVE, read-only).
//
// Deal (decided 2026-10-22): followers get 10% off with the creator's audience code (<NAME>10,
// Stripe coupon pUqYq48o, promo code metadata {creator, kind: "audience"}, created by
// scripts/social/create-creator-codes.sh). The creator earns 10% of what the buyer paid WITHOUT
// VAT (amount_total - amount_tax), paid by bank transfer once a month when the balance is >= 20 €.
// Refunded amounts are subtracted. Gift codes (kind "gift", 0 €) never count.
//
// ponytail: no DB table for balances or payouts. A creator under 20 € carries over: rerun with a
// --from that covers the unpaid months. Move to an orders column + payouts table if the channel grows.
//
// Usage:
//   node scripts/social/creator-commissions.mjs                          # previous calendar month
//   node scripts/social/creator-commissions.mjs --from 2026-10-01 --to 2026-11-30   # inclusive days
//   node scripts/social/creator-commissions.mjs --orders                 # also list every order
import { readFileSync } from "node:fs";
import Stripe from "stripe";

export const COMMISSION_RATE = 0.1;
export const PAYOUT_MIN_CENTS = 2000;

/** Commission in cents for one paid session: 10% of (paid - VAT - refunded), never negative. */
export function commissionCents({ amountTotal, amountTax, amountRefunded }) {
  const paid = amountTotal || 0;
  if (paid <= 0) return { net: 0, commission: 0 };
  // Refunds include VAT: take the same VAT share off them.
  const netRatio = (paid - (amountTax || 0)) / paid;
  const net = Math.max(0, Math.round((paid - (amountRefunded || 0)) * netRatio));
  return { net, commission: Math.round(net * COMMISSION_RATE) };
}

function demo() {
  // Hardcover 49,90 with -10% = 44,91 (4% IVA inside: 1,73) → net 43,18 → 4,32 €
  const a = commissionCents({ amountTotal: 4491, amountTax: 173, amountRefunded: 0 });
  if (a.net !== 4318 || a.commission !== 432) throw new Error(`demo hardcover: ${JSON.stringify(a)}`);
  const b = commissionCents({ amountTotal: 4491, amountTax: 173, amountRefunded: 4491 });
  if (b.commission !== 0) throw new Error("demo full refund");
  const c = commissionCents({ amountTotal: 0, amountTax: 0, amountRefunded: 0 });
  if (c.commission !== 0) throw new Error("demo free order");
}

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
  demo();
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
