// Runnable check for the creator programme rules (no deps, no test runner):
//   node --experimental-strip-types src/lib/creators.check.mjs
// The SQL double-spend guard (creator_withdraw) is checked against a real Postgres by
// supabase/tests/creator_withdraw.check.sh.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CREATOR_CREDIT_MAX_CENTS,
  CREATOR_CREDIT_MAX_DISCOUNT_CENTS,
  CREATOR_PAYOUT_MIN_CENTS,
  cleanHolderName,
  commissionCents,
  commissionState,
  creatorBalance,
  creditAmountError,
  creditDiscountCents,
  isValidIban,
  isValidTaxId,
  maskIban,
  normalizeHandle,
  normalizeIban,
  parseEuroCents,
} from "./creators.ts";

// ── Commission: 10 % of what was paid without VAT ─────────────────────────
// Hardcover 49,90 with -10 % = 44,91 (4 % IVA inside: 1,73) → net 43,18 → 4,32 €
assert.deepEqual(commissionCents({ amountTotal: 4491, amountTax: 173, amountRefunded: 0 }), { net: 4318, commission: 432 });
// Softcover 34,90 -10 % = 31,41 (IVA 1,21) → net 30,20 → 3,02 €
assert.deepEqual(commissionCents({ amountTotal: 3141, amountTax: 121, amountRefunded: 0 }), { net: 3020, commission: 302 });
// full refund → 0; half refund → half (VAT share of the refund off too)
assert.equal(commissionCents({ amountTotal: 4491, amountTax: 173, amountRefunded: 4491 }).commission, 0);
assert.deepEqual(commissionCents({ amountTotal: 4000, amountTax: 154, amountRefunded: 2000 }), { net: 1923, commission: 192 });
// free / missing / over-refunded never go negative
assert.equal(commissionCents({ amountTotal: 0, amountTax: 0, amountRefunded: 0 }).commission, 0);
assert.equal(commissionCents({ amountTotal: null, amountTax: undefined, amountRefunded: null }).commission, 0);
assert.equal(commissionCents({ amountTotal: 1000, amountTax: 38, amountRefunded: 5000 }).commission, 0);

// ── State: pending until delivered, void when refunded/cancelled ──────────
for (const s of ["paid", "producing", "shipped"]) assert.equal(commissionState(s, 432), "pending");
assert.equal(commissionState("delivered", 432), "available");
assert.equal(commissionState("delivered", 0), "void", "refunded after delivery");
assert.equal(commissionState("refunded", 432), "void");
assert.equal(commissionState("cancelled", 432), "void");

// ── Balance (mirrors the SQL in creator_withdraw) ─────────────────────────
const sales = [
  { commission_cents: 500, order_status: "delivered" },
  { commission_cents: 2000, order_status: "delivered" },
  { commission_cents: 300, order_status: "shipped" },
  { commission_cents: 400, order_status: "refunded" },
];
assert.deepEqual(creatorBalance(sales, []), { pendingCents: 300, availableCents: 2500, requestedCents: 0, paidOutCents: 0, spentCents: 0 });
const w = [
  { kind: "payout", status: "paid", amount_cents: 2000 },
  { kind: "payout", status: "cancelled", amount_cents: 2500 }, // released
  { kind: "credit", status: "issued", amount_cents: 200 },
];
assert.deepEqual(creatorBalance(sales, w), { pendingCents: 300, availableCents: 300, requestedCents: 0, paidOutCents: 2000, spentCents: 200 });
// a requested payout is reserved
assert.equal(creatorBalance(sales, [{ kind: "payout", status: "requested", amount_cents: 2500 }]).availableCents, 0);
assert.equal(creatorBalance(sales, [{ kind: "payout", status: "requested", amount_cents: 2500 }]).requestedCents, 2500);

// ── 2x credit ─────────────────────────────────────────────────────────────
assert.equal(creditDiscountCents(1000), 2000);
assert.equal(creditDiscountCents(1234), 2468);
assert.equal(creditAmountError(1000, 2500), null);
assert.equal(creditAmountError(2500, 2500), "too_large", "2x would exceed the hardcover price");
assert.equal(creditAmountError(CREATOR_CREDIT_MAX_CENTS, 9999), null);
assert.equal(creditDiscountCents(CREATOR_CREDIT_MAX_CENTS) <= CREATOR_CREDIT_MAX_DISCOUNT_CENTS, true);
assert.equal(creditAmountError(1001, 1000), "insufficient_balance");
assert.equal(creditAmountError(99, 1000), "too_small");
assert.equal(creditAmountError(10.5, 1000), "too_small", "whole cents only");
assert.equal(CREATOR_PAYOUT_MIN_CENTS, 2000);
// the max discount is the hardcover book (single-use code, book products only)
const pricing = readFileSync(new URL("./pricing.ts", import.meta.url), "utf8");
const hardcover = pricing.split("\n").find((l) => l.trimStart().startsWith("hardcover: { lookupKey")) ?? "";
assert.equal(Number(hardcover.match(/amount: (\d+)/)?.[1]), CREATOR_CREDIT_MAX_DISCOUNT_CENTS);
// the 20 € minimum is the same in the SQL check constraint
const sql = readFileSync(new URL("../../supabase/migrations/20261023120000_creator_programme.sql", import.meta.url), "utf8");
assert.match(sql, new RegExp(`amount_cents >= ${CREATOR_PAYOUT_MIN_CENTS}`));
assert.match(sql, /then amount_cents \* 2 end/);

// ── Amount input (tolerant, es/ca) ────────────────────────────────────────
assert.equal(parseEuroCents("10"), 1000);
assert.equal(parseEuroCents("10,5"), 1050);
assert.equal(parseEuroCents("10.50"), 1050);
assert.equal(parseEuroCents(" 12,34 € "), 1234);
assert.equal(parseEuroCents("1.234,56"), 123456);
assert.equal(parseEuroCents("1.234"), 123400);
assert.equal(parseEuroCents("abc"), null);
assert.equal(parseEuroCents("-5"), null);
assert.equal(parseEuroCents(5), null);

// ── Payout details ────────────────────────────────────────────────────────
assert.equal(isValidIban("ES91 2100 0418 4502 0005 1332"), true);
assert.equal(isValidIban("es9121000418450200051332"), true);
assert.equal(isValidIban("ES91 2100 0418 4502 0005 1333"), false, "bad check digits");
assert.equal(isValidIban("ES91 2100 0418 4502 0005 133"), false, "Spanish IBAN is 24 chars");
assert.equal(isValidIban("DE89 3704 0044 0532 0130 00"), true);
assert.equal(isValidIban(""), false);
assert.equal(normalizeIban(" es91-2100 "), "ES912100");
assert.equal(maskIban("ES9121000418450200051332"), "ES91 •••• 1332");
assert.equal(isValidTaxId("12345678Z"), true);
assert.equal(isValidTaxId("12345678-z"), true);
assert.equal(isValidTaxId("12345678A"), false);
assert.equal(isValidTaxId("X1234567L"), true);
assert.equal(isValidTaxId("B12345678"), true);
assert.equal(isValidTaxId("1234"), false);
assert.equal(cleanHolderName("  Lara   Fernández "), "Lara Fernández");
assert.equal(cleanHolderName("A"), null);
assert.equal(normalizeHandle("@Lara_Mamaestra "), "lara_mamaestra");
assert.equal(normalizeHandle("myfamilytime.es"), "myfamilytime.es");
assert.equal(normalizeHandle("bad handle"), null);

console.log("creators.check: all assertions passed");
