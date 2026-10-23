// Creator programme (server-only). Rules in src/lib/creators.ts, tables + the balance guard
// in supabase/migrations/20261023120000_creator_programme.sql.
//
//   follower pays with <NAME>10 (typed, or pre-applied from /r/<NAME>10) ──► recordOrderPromotion
//       (webhook): orders.promotion_code_* + creator_commissions row (10 % of paid ex-VAT)
//   charge.refunded / dispute lost ──► recordCreatorRefund: commission recomputed from the charge
//       re-read from Stripe (events can arrive out of order), VAT share of the refund off
//   order delivered (PDF: ready email sent) ──► the commission counts as available (read from
//       the order, no job)
//   creator: POST /api/creator ──► requestCreatorPayout (operator emailed, marks it paid in /admin/creators)
//                              └─► spendCreatorCredit (X € of balance → single-use 2X € code)

import type Stripe from "stripe";
import type { CreatorRow, CreatorWithdrawalRow, FulfilmentClient, FulfilmentDatabase } from "@/lib/fulfilment/db";
import { alertOperator } from "@/lib/fulfilment/alerts";
import { getSiteUrl } from "@/lib/email/send";
import { getStripe } from "@/lib/stripe";
import { normalizeCode, normalizeEmail, REFERRAL_COUPON_ID, sessionPromotionCodeIds } from "@/lib/promo-codes";
import {
  AUDIENCE_CODE_KIND,
  CREATOR_CREDIT_MAX_CENTS,
  CREATOR_CREDIT_MIN_CENTS,
  CREATOR_CREDIT_MULTIPLIER,
  CREATOR_PAYOUT_MIN_CENTS,
  cleanHolderName,
  commissionCents,
  commissionState,
  creatorBalance,
  creditAmountError,
  isValidIban,
  isValidTaxId,
  maskIban,
  maskTaxId,
  normalizeHandle,
  normalizeIban,
  normalizeTaxId,
  type CommissionState,
  type CreatorBalance,
} from "@/lib/creators";
import { ensurePromotionCode, newCode } from "./stripe-promotions";

const UNIQUE_VIOLATION = "23505";
const LIVE = new Set(["paid", "producing", "shipped", "delivered"]);

// ── Attribution + commission (Stripe webhook) ───────────────────────────────

/**
 * After a book order is paid: record the promotion code on the order and, when it is a
 * creator's audience code, the commission. Idempotent (unique order_id); throws so the
 * webhook retries.
 */
export async function recordOrderPromotion(
  supabase: FulfilmentClient,
  params: {
    order: { id: string; status: string };
    session: Pick<Stripe.Checkout.Session, "discounts" | "amount_total" | "total_details" | "payment_intent">;
    buyerEmail: string | null;
  },
): Promise<void> {
  const { order, session } = params;
  const promoIds = sessionPromotionCodeIds(session.discounts);
  if (promoIds.length === 0) return;
  const expanded = (session.discounts ?? [])
    .map((d) => d.promotion_code)
    .find((p): p is Stripe.PromotionCode => !!p && typeof p === "object" && p.id === promoIds[0]);

  const { error: oErr } = await supabase
    .from("orders")
    .update({
      promotion_code_id: promoIds[0],
      promotion_code: expanded?.code ?? null,
      discount_cents: session.total_details?.amount_discount ?? 0,
    })
    .eq("id", order.id);
  if (oErr) throw new Error(`orders promotion attribution (order ${order.id}): ${oErr.message}`);

  const { data: creator, error: cErr } = await supabase
    .from("creators")
    .select("id, email, promo_code")
    .in("stripe_promotion_code_id", promoIds)
    .maybeSingle();
  if (cErr) throw new Error(`creators lookup (order ${order.id}): ${cErr.message}`);
  if (!creator || !LIVE.has(order.status)) return;
  if (normalizeEmail(params.buyerEmail) === creator.email) {
    console.log(`[creators] Order ${order.id} paid with ${creator.promo_code} by the creator: no commission`);
    return;
  }

  const amountTotal = session.amount_total ?? 0;
  const amountTax = session.total_details?.amount_tax ?? 0;
  // A refund can land before this row exists (webhook retries): start from what is refunded now.
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
  const amountRefunded = paymentIntentId ? await refundedOnPayment(paymentIntentId) : 0;
  const { commission } = commissionCents({ amountTotal, amountTax, amountRefunded });
  const { error } = await supabase.from("creator_commissions").upsert(
    {
      creator_id: creator.id,
      order_id: order.id,
      amount_total_cents: amountTotal,
      amount_tax_cents: amountTax,
      amount_refunded_cents: Math.min(amountRefunded, amountTotal),
      commission_cents: commission,
    },
    { onConflict: "order_id", ignoreDuplicates: true },
  );
  if (error) throw new Error(`creator_commissions insert (order ${order.id}): ${error.message}`);
  console.log(`[creators] Order ${order.id} paid with ${creator.promo_code}: commission ${commission} cents`);
}

/** Amount refunded so far on a payment's latest charge (read from Stripe, never from an event). */
async function refundedOnPayment(paymentIntentId: string): Promise<number> {
  const pi = await getStripe().paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
  return typeof pi.latest_charge === "object" && pi.latest_charge ? pi.latest_charge.amount_refunded : 0;
}

/**
 * Recompute an order's commission after a refund: `chargeId` = the refunded charge, re-read
 * from Stripe so an older event delivered late never overwrites a newer amount; null = the
 * whole payment is lost (chargeback lost). Throws on DB/Stripe errors (the webhook retries).
 */
export async function recordCreatorRefund(supabase: FulfilmentClient, orderId: string, chargeId: string | null): Promise<void> {
  const { data: row, error } = await supabase
    .from("creator_commissions")
    .select("id, amount_total_cents, amount_tax_cents, commission_cents")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) throw new Error(`creator_commissions read (order ${orderId}): ${error.message}`);
  if (!row) return;
  const refunded = chargeId ? (await getStripe().charges.retrieve(chargeId)).amount_refunded : row.amount_total_cents;
  const amountRefundedCents = Math.min(refunded, row.amount_total_cents);
  const { commission } = commissionCents({
    amountTotal: row.amount_total_cents,
    amountTax: row.amount_tax_cents,
    amountRefunded: amountRefundedCents,
  });
  const { error: updErr } = await supabase
    .from("creator_commissions")
    .update({ amount_refunded_cents: amountRefundedCents, commission_cents: commission, updated_at: new Date().toISOString() })
    .eq("id", row.id);
  if (updErr) throw new Error(`creator_commissions refund (order ${orderId}): ${updErr.message}`);
  if (commission !== row.commission_cents) console.log(`[creators] Order ${orderId} refunded: commission ${row.commission_cents} → ${commission} cents`);
}

/** Creator whose audience code is `rawCode` (the /r cookie), or null. Never throws. */
export async function creatorForCheckout(
  supabase: FulfilmentClient,
  rawCode: string | undefined,
): Promise<Pick<CreatorRow, "promo_code" | "email" | "stripe_promotion_code_id"> | null> {
  const code = normalizeCode(rawCode);
  if (!code) return null;
  const { data, error } = await supabase
    .from("creators")
    .select("promo_code, email, stripe_promotion_code_id")
    .eq("promo_code", code)
    .maybeSingle();
  if (error) {
    console.warn(`[creators] Lookup of ${code} failed: ${error.message}`);
    return null;
  }
  return data;
}

// ── Creator panel (GET /api/creator) ─────────────────────────────────────────

/** The creator registered with this login email (verified, non-anonymous user), or null. Throws on DB error. */
export async function creatorByEmail(supabase: FulfilmentClient, email: string | null | undefined): Promise<CreatorRow | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const { data, error } = await supabase.from("creators").select("*").eq("email", normalized).maybeSingle();
  if (error) throw new Error(`creators read: ${error.message}`);
  return data;
}

export interface CreatorPanel {
  creator: { handle: string; code: string };
  balance: CreatorBalance;
  limits: {
    payoutMinCents: number;
    creditMinCents: number;
    creditMaxCents: number;
    creditMultiplier: number;
  };
  /** Books bought with the creator's code. No buyer data: date, format, amounts, state. */
  sales: {
    id: string;
    createdAt: string;
    format: string;
    /** pending / paid / producing / shipped / delivered / refunded / cancelled */
    orderStatus: string;
    paidCents: number;
    commissionCents: number;
    state: CommissionState;
  }[];
  payouts: { id: string; createdAt: string; amountCents: number; status: "requested" | "paid" | "cancelled"; paidAt: string | null; iban: string }[];
  credits: { id: string; createdAt: string; amountCents: number; discountCents: number; code: string; ready: boolean }[];
  /**
   * Details of the latest payout, to prefill the next request. IBAN and NIF masked: the full
   * values never go back to the browser; a payout sent without them reuses the saved ones.
   */
  payoutDefaults: { iban: string; holderName: string; taxId: string } | null;
}

type CommissionWithOrder = {
  id: string;
  created_at: string;
  amount_total_cents: number;
  commission_cents: number;
  orders: OrderJoin | OrderJoin[] | null;
};
type OrderJoin = { status: string; format: string; ready_email_sent_at: string | null };

/** The commission's order as creatorBalance / commissionState read it (a missing order = void). */
function commissionOrder(orders: OrderJoin | OrderJoin[] | null) {
  const o = Array.isArray(orders) ? orders[0] : orders;
  return { order_status: o?.status ?? "cancelled", format: o?.format ?? "", ready_email_sent_at: o?.ready_email_sent_at ?? null };
}

// ponytail: the panel and /admin/creators load every row of a creator (PostgREST caps a read at
// ~1 000 rows). Fine for tens of sales per creator; past that, aggregate the balance in SQL (a
// view or RPC like creator_withdraw's) and page the sales list.

export async function getCreatorPanel(supabase: FulfilmentClient, creator: CreatorRow): Promise<CreatorPanel> {
  const [commissionsRes, withdrawalsRes] = await Promise.all([
    supabase
      .from("creator_commissions")
      .select("id, created_at, amount_total_cents, commission_cents, orders(status, format, ready_email_sent_at)")
      .eq("creator_id", creator.id)
      .order("created_at", { ascending: false }),
    supabase.from("creator_withdrawals").select("*").eq("creator_id", creator.id).order("created_at", { ascending: false }),
  ]);
  if (commissionsRes.error) throw new Error(`creator_commissions read: ${commissionsRes.error.message}`);
  if (withdrawalsRes.error) throw new Error(`creator_withdrawals read: ${withdrawalsRes.error.message}`);

  const commissions = ((commissionsRes.data ?? []) as unknown as CommissionWithOrder[]).map((c) => ({ ...c, ...commissionOrder(c.orders) }));
  let withdrawals = withdrawalsRes.data ?? [];

  // Credit codes whose Stripe promotion code failed to be created: retry now (best-effort).
  for (const w of withdrawals) {
    if (w.kind !== "credit" || w.status !== "issued" || w.stripe_promotion_code_id) continue;
    try {
      const promoId = await ensureCreditPromotionCode(supabase, w);
      withdrawals = withdrawals.map((x) => (x.id === w.id ? { ...x, stripe_promotion_code_id: promoId } : x));
    } catch (err) {
      console.error(`[creators] Credit code ${w.code} still not in Stripe:`, err instanceof Error ? err.message : err);
    }
  }

  const lastPayout = withdrawals.find((w) => w.kind === "payout");
  return {
    creator: { handle: creator.handle, code: creator.promo_code },
    balance: creatorBalance(commissions, withdrawals),
    limits: {
      payoutMinCents: CREATOR_PAYOUT_MIN_CENTS,
      creditMinCents: CREATOR_CREDIT_MIN_CENTS,
      creditMaxCents: CREATOR_CREDIT_MAX_CENTS,
      creditMultiplier: CREATOR_CREDIT_MULTIPLIER,
    },
    sales: commissions.map((c) => ({
      id: c.id,
      createdAt: c.created_at,
      format: c.format,
      orderStatus: c.order_status,
      paidCents: c.amount_total_cents,
      commissionCents: c.commission_cents,
      state: commissionState(c, c.commission_cents),
    })),
    payouts: withdrawals
      .filter((w) => w.kind === "payout")
      .map((w) => ({
        id: w.id,
        createdAt: w.created_at,
        amountCents: w.amount_cents,
        status: w.status as "requested" | "paid" | "cancelled",
        paidAt: w.paid_at,
        iban: maskIban(w.iban ?? ""),
      })),
    credits: withdrawals
      .filter((w) => w.kind === "credit" && w.status === "issued")
      .map((w) => ({
        id: w.id,
        createdAt: w.created_at,
        amountCents: w.amount_cents,
        discountCents: w.discount_cents ?? w.amount_cents * CREATOR_CREDIT_MULTIPLIER,
        code: w.code ?? "",
        ready: !!w.stripe_promotion_code_id,
      })),
    payoutDefaults:
      lastPayout?.iban && lastPayout.holder_name && lastPayout.tax_id
        ? { iban: maskIban(lastPayout.iban), holderName: lastPayout.holder_name, taxId: maskTaxId(lastPayout.tax_id) }
        : null,
  };
}

// ── Withdrawals (POST /api/creator) ─────────────────────────────────────────

export type WithdrawError =
  | "invalid_iban"
  | "invalid_tax_id"
  | "invalid_name"
  | "below_minimum"
  | "too_small"
  | "too_large"
  | "insufficient_balance";

export type WithdrawResult = { ok: true; withdrawal: CreatorWithdrawalRow } | { ok: false; error: WithdrawError };

/** The RPC's "not enough balance" (raised inside the row lock) → a typed error; anything else throws. */
async function withdraw(
  supabase: FulfilmentClient,
  args: FulfilmentDatabase["public"]["Functions"]["creator_withdraw"]["Args"],
): Promise<WithdrawResult> {
  const { data, error } = await supabase.rpc("creator_withdraw", args);
  if (error) {
    if (error.message.includes("insufficient_balance")) return { ok: false, error: "insufficient_balance" };
    throw Object.assign(new Error(`creator_withdraw (${args.p_creator_id}): ${error.message}`), { code: error.code });
  }
  return { ok: true, withdrawal: data };
}

/** IBAN + NIF of the creator's latest payout (reused when the form keeps the saved, masked values). */
async function savedPayoutDetails(supabase: FulfilmentClient, creatorId: string): Promise<{ iban: string; taxId: string } | null> {
  const { data, error } = await supabase
    .from("creator_withdrawals")
    .select("iban, tax_id")
    .eq("creator_id", creatorId)
    .eq("kind", "payout")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`creator_withdrawals read (${creatorId}): ${error.message}`);
  return data?.iban && data.tax_id ? { iban: data.iban, taxId: data.tax_id } : null;
}

/**
 * Bank transfer of `amountCents` (the client sends the whole available balance it showed;
 * the RPC refuses more than what is really available). An empty IBAN / NIF = the saved one.
 * Emails the operator once.
 */
export async function requestCreatorPayout(
  supabase: FulfilmentClient,
  creator: CreatorRow,
  input: { requestKey: string; amountCents: number; iban?: string; holderName: string; taxId?: string },
): Promise<WithdrawResult> {
  const saved = !input.iban?.trim() || !input.taxId?.trim() ? await savedPayoutDetails(supabase, creator.id) : null;
  const iban = normalizeIban(input.iban?.trim() ? input.iban : saved?.iban);
  const taxId = normalizeTaxId(input.taxId?.trim() ? input.taxId : saved?.taxId);
  const holderName = cleanHolderName(input.holderName);
  if (!isValidIban(iban)) return { ok: false, error: "invalid_iban" };
  if (!isValidTaxId(taxId)) return { ok: false, error: "invalid_tax_id" };
  if (!holderName) return { ok: false, error: "invalid_name" };
  if (!Number.isInteger(input.amountCents) || input.amountCents < CREATOR_PAYOUT_MIN_CENTS) return { ok: false, error: "below_minimum" };

  const result = await withdraw(supabase, {
    p_creator_id: creator.id,
    p_kind: "payout",
    p_amount_cents: input.amountCents,
    p_request_key: input.requestKey,
    p_iban: iban,
    p_holder_name: holderName,
    p_tax_id: taxId,
  });
  if (result.ok && result.withdrawal.kind === "payout") {
    // Bank details stay out of the email: the operator reads them in /admin/creators.
    await alertOperator(supabase, {
      key: `creator-payout:${result.withdrawal.id}`,
      subject: `Creator payout requested: @${creator.handle} · ${(result.withdrawal.amount_cents / 100).toFixed(2)} €`,
      lines: [
        `@${creator.handle} (${creator.promo_code}) asked for a bank transfer of ${(result.withdrawal.amount_cents / 100).toFixed(2)} €.`,
        `Transfer it, then mark it paid: ${getSiteUrl()}/admin/creators`,
      ],
      dedupeSeconds: 30 * 86_400,
    });
  }
  return result;
}

/** X € of available balance → a single-use 2X € code for a printed book. Idempotent per request key. */
export async function spendCreatorCredit(
  supabase: FulfilmentClient,
  creator: CreatorRow,
  input: { requestKey: string; amountCents: number },
): Promise<WithdrawResult> {
  // The available-balance check is the RPC's (under the row lock); here only the amount's shape.
  const shape = creditAmountError(input.amountCents, Number.POSITIVE_INFINITY);
  if (shape) return { ok: false, error: shape };

  let result: WithdrawResult | null = null;
  for (let attempt = 0; attempt < 4 && !result; attempt++) {
    try {
      result = await withdraw(supabase, {
        p_creator_id: creator.id,
        p_kind: "credit",
        p_amount_cents: input.amountCents,
        p_request_key: input.requestKey,
        p_code: newCode("reward"),
      });
    } catch (err) {
      // Code collision (unique code): new code, same request key.
      if ((err as { code?: string }).code !== UNIQUE_VIOLATION) throw err;
    }
  }
  if (!result) throw new Error(`Could not create a credit code for creator ${creator.id}`);
  if (!result.ok || result.withdrawal.stripe_promotion_code_id) return result;

  try {
    const promoId = await ensureCreditPromotionCode(supabase, result.withdrawal);
    return { ok: true, withdrawal: { ...result.withdrawal, stripe_promotion_code_id: promoId } };
  } catch (err) {
    // The balance is already reserved for this code: the next panel load retries Stripe.
    console.error(`[creators] Credit ${result.withdrawal.id} not created in Stripe yet:`, err instanceof Error ? err.message : err);
    return result;
  }
}

/**
 * The credit's Stripe objects: its own coupon (amount_off = discount, once, max 1 redemption,
 * applies_to = the same book products as the referral coupon, i.e. printed books) and a
 * single-use promotion code with the row's code. Idempotent: deterministic coupon id +
 * idempotency key, ensurePromotionCode reuses an existing code. Throws on Stripe/DB errors.
 */
async function ensureCreditPromotionCode(supabase: FulfilmentClient, credit: CreatorWithdrawalRow): Promise<string> {
  if (credit.kind !== "credit" || !credit.code || !credit.discount_cents) throw new Error(`Withdrawal ${credit.id} is not a credit`);
  const stripe = getStripe();
  const couponId = `meapica_creator_credit_${credit.id}`;
  const metadata = { kind: "creator_credit", creator_id: credit.creator_id, withdrawal_id: credit.id };
  try {
    await stripe.coupons.retrieve(couponId);
  } catch (err) {
    if ((err as { code?: string }).code !== "resource_missing") throw err;
    // Customer restriction is not possible: Checkout gets customer_email, not a customer.
    const reference = await stripe.coupons.retrieve(REFERRAL_COUPON_ID, { expand: ["applies_to"] });
    const products = reference.applies_to?.products ?? [];
    if (products.length === 0) throw new Error(`Coupon ${REFERRAL_COUPON_ID} has no applies_to products`);
    await stripe.coupons.create(
      {
        id: couponId,
        name: "Saldo de creador",
        amount_off: credit.discount_cents,
        currency: "eur",
        duration: "once",
        max_redemptions: 1,
        applies_to: { products },
        metadata,
      },
      { idempotencyKey: `creator-credit-coupon-${credit.id}` },
    );
  }
  let code = credit.code;
  for (let attempt = 0; ; attempt++) {
    try {
      const promoId = await ensurePromotionCode({ code, coupon: couponId, maxRedemptions: 1, metadata });
      const { error } = await supabase
        .from("creator_withdrawals")
        .update({ stripe_promotion_code_id: promoId, updated_at: new Date().toISOString() })
        .eq("id", credit.id);
      if (error) throw new Error(`creator_withdrawals update (${credit.id}): ${error.message}`);
      return promoId;
    } catch (err) {
      // The text is taken in Stripe by another code: give this credit a new one (only while it has no Stripe code).
      if (attempt >= 3 || !(err instanceof Error) || !err.message.includes("already exists on another coupon")) throw err;
      const next = newCode("reward");
      const { data, error } = await supabase
        .from("creator_withdrawals")
        .update({ code: next, updated_at: new Date().toISOString() })
        .eq("id", credit.id)
        .is("stripe_promotion_code_id", null)
        .select("id");
      if (error && error.code !== UNIQUE_VIOLATION) throw new Error(`creator_withdrawals new code (${credit.id}): ${error.message}`);
      if (!error && (data ?? []).length === 0) throw new Error(`Credit ${credit.id} changed meanwhile, retry`);
      if (!error) code = next;
    }
  }
}

// ── Operator (/admin/creators) ───────────────────────────────────────────────

export type RegisterCreatorResult = { ok: true; creator: CreatorRow } | { ok: false; message: string };

/**
 * Invite a creator: their login email + audience promotion code, which must exist on the
 * active Stripe account with metadata.kind = "audience". Handle defaults to metadata.creator.
 */
export async function registerCreator(
  supabase: FulfilmentClient,
  input: { email: string; code: string; handle?: string | null },
): Promise<RegisterCreatorResult> {
  const email = normalizeEmail(input.email);
  const code = normalizeCode(input.code);
  if (!email) return { ok: false, message: "Email no válido." };
  if (!code) return { ok: false, message: "Código no válido." };
  const found = await getStripe().promotionCodes.list({ code, limit: 10 });
  const promo = found.data.find((p) => p.code.toUpperCase() === code && p.metadata?.kind === AUDIENCE_CODE_KIND);
  if (!promo) return { ok: false, message: `No existe en Stripe un código de audiencia ${code} (metadata kind=audience).` };
  const handle = normalizeHandle(input.handle || promo.metadata?.creator);
  if (!handle) return { ok: false, message: "Usuario de Instagram no válido." };

  const { data, error } = await supabase
    .from("creators")
    .insert({ email, handle, promo_code: code, stripe_promotion_code_id: promo.id })
    .select("*")
    .single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { ok: false, message: "Ese email o ese código ya están registrados." };
    throw new Error(`creators insert: ${error.message}`);
  }
  return { ok: true, creator: data };
}

/**
 * Operator: mark a requested payout as transferred, cancel it (balance released), or cancel a
 * credit stuck before its Stripe code exists (balance released; a credit with a live code can't).
 */
export async function settleCreatorWithdrawal(
  supabase: FulfilmentClient,
  withdrawalId: string,
  action: "mark_paid" | "cancel_payout" | "cancel_credit",
): Promise<boolean> {
  const now = new Date().toISOString();
  let query = supabase
    .from("creator_withdrawals")
    .update({ status: action === "mark_paid" ? "paid" : "cancelled", paid_at: action === "mark_paid" ? now : null, updated_at: now })
    .eq("id", withdrawalId);
  query =
    action === "cancel_credit"
      ? query.eq("kind", "credit").eq("status", "issued").is("stripe_promotion_code_id", null)
      : query.eq("kind", "payout").eq("status", "requested");
  const { data, error } = await query.select("id");
  if (error) throw new Error(`creator_withdrawals settle (${withdrawalId}): ${error.message}`);
  return (data ?? []).length > 0;
}

export interface AdminCreator extends CreatorRow {
  balance: CreatorBalance;
  sales: number;
}

type AdminWithdrawal = CreatorWithdrawalRow & { handle: string };

/** Every creator with their balance, every payout still to transfer (with bank details) and every stuck credit. */
export async function listCreatorsForAdmin(
  supabase: FulfilmentClient,
): Promise<{ creators: AdminCreator[]; openPayouts: AdminWithdrawal[]; stuckCredits: AdminWithdrawal[] }> {
  const [cRes, kRes, wRes] = await Promise.all([
    supabase.from("creators").select("*").order("created_at", { ascending: true }),
    supabase.from("creator_commissions").select("creator_id, commission_cents, orders(status, format, ready_email_sent_at)"),
    supabase.from("creator_withdrawals").select("*").order("created_at", { ascending: true }),
  ]);
  for (const r of [cRes, kRes, wRes]) if (r.error) throw new Error(`creators admin read: ${r.error.message}`);
  const commissions = ((kRes.data ?? []) as unknown as { creator_id: string; commission_cents: number; orders: OrderJoin | OrderJoin[] | null }[]).map(
    (c) => ({ ...c, ...commissionOrder(c.orders) }),
  );
  const withdrawals = wRes.data ?? [];
  const creators = (cRes.data ?? []).map((c) => {
    const own = commissions.filter((k) => k.creator_id === c.id);
    return { ...c, sales: own.length, balance: creatorBalance(own, withdrawals.filter((w) => w.creator_id === c.id)) };
  });
  const handleOf = new Map(creators.map((c) => [c.id, c.handle]));
  const withHandle = (w: CreatorWithdrawalRow) => ({ ...w, handle: handleOf.get(w.creator_id) ?? "?" });
  const openPayouts = withdrawals.filter((w) => w.kind === "payout" && w.status === "requested").map(withHandle);
  const stuckCredits = withdrawals.filter((w) => w.kind === "credit" && w.status === "issued" && !w.stripe_promotion_code_id).map(withHandle);
  return { creators, openPayouts, stuckCredits };
}
