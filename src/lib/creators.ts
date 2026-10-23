// Creator programme: pure rules, no imports, so it can be checked with
// `node --experimental-strip-types src/lib/creators.check.mjs` and imported by
// scripts/social/creator-commissions.mjs.
//
// Owner decisions 2026-10-22 / 2026-10-23:
//  - Creators are invite-only (an operator registers email + handle + their audience code
//    <NAME>10 from /admin/creators). Signing in with that email shows "Panel de creador".
//  - Commission = 10 % of what the buyer paid WITHOUT VAT, per order paid with the creator's
//    audience code; refunds take their VAT share off. Pending until the order is delivered,
//    then available. Refunded / cancelled orders earn nothing.
//  - The available balance is either cashed out by bank transfer (min 20 €, the whole
//    available balance, marked paid by hand) or spent at 2x: X € of balance → a single-use
//    2X € code for a printed book on meapica.es.
//  - The guard against spending twice lives in the database (RPC creator_withdraw, migration
//    20261023120000_creator_programme.sql): creatorBalance() below mirrors it for display.

export const CREATOR_COMMISSION_RATE = 0.1;
/** Same value in the creator_withdrawals check constraint. */
export const CREATOR_PAYOUT_MIN_CENTS = 2000;
export const CREATOR_CREDIT_MULTIPLIER = 2;
export const CREATOR_CREDIT_MIN_CENTS = 100;
/**
 * Largest discount of one credit code = a hardcover book (STRIPE_CATALOG.hardcover, checked):
 * the code is single use and only covers the book, so anything above it would be lost.
 */
export const CREATOR_CREDIT_MAX_DISCOUNT_CENTS = 4990;
export const CREATOR_CREDIT_MAX_CENTS = Math.floor(CREATOR_CREDIT_MAX_DISCOUNT_CENTS / CREATOR_CREDIT_MULTIPLIER);
/** Stripe promotion code metadata.kind of an audience code (scripts/social/create-creator-codes.sh). */
export const AUDIENCE_CODE_KIND = "audience";

// ── Commission ──────────────────────────────────────────────────────────────

/** Commission in cents of one paid session: 10 % of (paid - VAT - VAT-share of refunds), never negative. */
export function commissionCents(input: {
  amountTotal: number | null | undefined;
  amountTax: number | null | undefined;
  amountRefunded: number | null | undefined;
}): { net: number; commission: number } {
  const paid = input.amountTotal || 0;
  if (paid <= 0) return { net: 0, commission: 0 };
  // Refunds include VAT: take the same VAT share off them.
  const netRatio = (paid - (input.amountTax || 0)) / paid;
  const net = Math.max(0, Math.round((paid - (input.amountRefunded || 0)) * netRatio));
  return { net, commission: Math.round(net * CREATOR_COMMISSION_RATE) };
}

export type CommissionState = "pending" | "available" | "void";

/** Same rule as the SQL in creator_withdraw: delivered = available, refunded/cancelled = void. */
export function commissionState(orderStatus: string, commission: number): CommissionState {
  if (orderStatus === "refunded" || orderStatus === "cancelled") return "void";
  if (orderStatus === "delivered") return commission > 0 ? "available" : "void";
  return "pending";
}

// ── Balance ─────────────────────────────────────────────────────────────────

export type WithdrawalKind = "payout" | "credit";
export type WithdrawalStatus = "requested" | "paid" | "cancelled" | "issued";

export interface CreatorBalance {
  pendingCents: number;
  /** Can be cashed out or spent now (negative only if a paid-out commission was refunded later). */
  availableCents: number;
  /** Transfer requested, not paid yet (reserved). */
  requestedCents: number;
  paidOutCents: number;
  /** Turned into discount codes (balance units, the codes are worth twice this). */
  spentCents: number;
}

export function creatorBalance(
  commissions: readonly { commission_cents: number; order_status: string }[],
  withdrawals: readonly { kind: WithdrawalKind; status: WithdrawalStatus; amount_cents: number }[],
): CreatorBalance {
  let pendingCents = 0;
  let earned = 0;
  for (const c of commissions) {
    const state = commissionState(c.order_status, c.commission_cents);
    if (state === "pending") pendingCents += c.commission_cents;
    else if (state === "available") earned += c.commission_cents;
  }
  let requestedCents = 0;
  let paidOutCents = 0;
  let spentCents = 0;
  for (const w of withdrawals) {
    if (w.status === "cancelled") continue;
    if (w.kind === "credit") spentCents += w.amount_cents;
    else if (w.status === "paid") paidOutCents += w.amount_cents;
    else requestedCents += w.amount_cents;
  }
  return { pendingCents, availableCents: earned - requestedCents - paidOutCents - spentCents, requestedCents, paidOutCents, spentCents };
}

/** Value of the discount code bought with `amountCents` of balance. */
export function creditDiscountCents(amountCents: number): number {
  return amountCents * CREATOR_CREDIT_MULTIPLIER;
}

export type CreditError = "too_small" | "too_large" | "insufficient_balance";

export function creditAmountError(amountCents: number, availableCents: number): CreditError | null {
  if (!Number.isInteger(amountCents) || amountCents < CREATOR_CREDIT_MIN_CENTS) return "too_small";
  if (amountCents > CREATOR_CREDIT_MAX_CENTS) return "too_large";
  if (amountCents > availableCents) return "insufficient_balance";
  return null;
}

/** "10" / "10,5" / "10.50" / "1.234,56" / "12 €" → cents; null when it isn't an amount. */
export function parseEuroCents(input: unknown): number | null {
  if (typeof input !== "string") return null;
  let s = input.replace(/[\s €]/g, "");
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const lastSep = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
  // The last separator is decimal when 1-2 digits follow it; otherwise every separator groups thousands.
  if (lastSep >= 0 && s.length - lastSep - 1 <= 2) {
    s = `${s.slice(0, lastSep).replace(/[.,]/g, "")}.${s.slice(lastSep + 1)}`;
  } else {
    s = s.replace(/[.,]/g, "");
  }
  const cents = Math.round(Number(s) * 100);
  return Number.isFinite(cents) ? cents : null;
}

// ── Payout details ──────────────────────────────────────────────────────────

export function normalizeIban(input: unknown): string {
  return typeof input === "string" ? input.toUpperCase().replace(/[\s-]+/g, "") : "";
}

/** ISO 13616 IBAN: shape + mod-97 check digits. Spanish IBANs must be 24 characters. */
export function isValidIban(input: unknown): boolean {
  const iban = normalizeIban(input);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith("ES") && iban.length !== 24) return false;
  const digits = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rest = 0;
  for (const d of digits) rest = (rest * 10 + Number(d)) % 97;
  return rest === 1;
}

/** "ES91 2100 0418 4502 0005 1332" → "ES91 •••• 1332" (shown back to the creator). */
export function maskIban(iban: string): string {
  return `${iban.slice(0, 4)} •••• ${iban.slice(-4)}`;
}

export function normalizeTaxId(input: unknown): string {
  return typeof input === "string" ? input.toUpperCase().replace(/[\s.-]+/g, "") : "";
}

const NIF_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

/** Spanish NIF (DNI) or NIE with its check letter, or a company CIF (shape only). */
export function isValidTaxId(input: unknown): boolean {
  const id = normalizeTaxId(input);
  const person = /^([XYZ]|\d)(\d{7})([A-Z])$/.exec(id);
  if (person) {
    const lead = { X: "0", Y: "1", Z: "2" }[person[1]] ?? person[1];
    return NIF_LETTERS[Number(lead + person[2]) % 23] === person[3];
  }
  return /^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(id);
}

/** Account holder's full name: spaces collapsed, 3-80 characters; null when unusable. */
export function cleanHolderName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const name = input.normalize("NFC").replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
  return name.length >= 3 && name.length <= 80 ? name : null;
}

/** "@Lara_Mamaestra " → "lara_mamaestra" (Instagram handle); null when it can't be one. */
export function normalizeHandle(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const handle = input.trim().replace(/^@/, "").toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(handle) ? handle : null;
}
