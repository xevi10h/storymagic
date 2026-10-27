// "Pack Reyes" second-book codes (server-only). Rules in src/lib/second-book.ts.
//
//   printed book paid ──► ensureSecondBookCode (payments.ts, before the confirmation email)
//       └─► second_book_codes row + single-use Stripe promotion code (15 € off softcover, until 6 Jan)
//   book paid with that code ──► the row is marked redeemed, and that order earns no code
//
// Idempotent (unique order_id, DB row first, ensurePromotionCode looks the text up first).
// KNOWN GAP (same as referral rewards): refunding the earning order does not revoke its code.

import type Stripe from "stripe";
import type { FulfilmentClient, SecondBookCodeRow } from "@/lib/fulfilment/db";
import { normalizeEmail, sessionPromotionCodeIds } from "@/lib/promo-codes";
import { SECOND_BOOK_COUPON_ID, earnsSecondBookCode, secondBookExpiresAt } from "@/lib/second-book";
import { earliestPrintedCutoff, spainToday } from "@/lib/shipping";
import { ensurePromotionCode, getPromotionSetup, newCode } from "./stripe-promotions";

const LOCALES = new Set(["es", "ca", "en", "fr"]);
const UNIQUE_VIOLATION = "23505";

/**
 * After a book order is paid: mark a second-book code it used as redeemed, then give the order
 * its own code when it earns one. Returns the order's row (null = none). Throws on DB/Stripe errors.
 */
export async function ensureSecondBookCode(
  supabase: FulfilmentClient,
  order: { id: string; user_id: string | null; format: string },
  session: Pick<Stripe.Checkout.Session, "discounts" | "amount_total">,
  opts: { email?: string | null; locale?: string | null } = {},
): Promise<SecondBookCodeRow | null> {
  const promoIds = sessionPromotionCodeIds(session.discounts);
  let usedSecondBookCode = false;
  if (promoIds.length > 0) {
    const { data: used, error } = await supabase.from("second_book_codes").select("id, redeemed_order_id").in("stripe_promotion_code_id", promoIds);
    if (error) throw new Error(`second_book_codes lookup (order ${order.id}): ${error.message}`);
    usedSecondBookCode = (used ?? []).length > 0;
    if (usedSecondBookCode) {
      const { error: rErr } = await supabase
        .from("second_book_codes")
        .update({ redeemed_order_id: order.id, redeemed_at: new Date().toISOString() })
        .in("stripe_promotion_code_id", promoIds)
        .is("redeemed_order_id", null);
      if (rErr) throw new Error(`second_book_codes redemption (order ${order.id}): ${rErr.message}`);
    }
  }

  const read = async () => {
    const { data, error } = await supabase.from("second_book_codes").select("*").eq("order_id", order.id).maybeSingle();
    if (error) throw new Error(`second_book_codes read (order ${order.id}): ${error.message}`);
    return data;
  };
  let row = await read();
  if (row?.stripe_promotion_code_id) return row;

  if (!row) {
    const today = spainToday();
    const reyesCutoff = earliestPrintedCutoff(today, "reyes");
    const earns = earnsSecondBookCode({ format: order.format, amountTotalCents: session.amount_total ?? 0, usedSecondBookCode, today, reyesCutoff });
    if (!earns || !(await getPromotionSetup()).secondBook) return null;
    const locale = opts.locale && LOCALES.has(opts.locale) ? opts.locale : "es";
    for (let attempt = 0; attempt < 4 && !row; attempt++) {
      const { error } = await supabase.from("second_book_codes").insert({
        order_id: order.id,
        user_id: order.user_id,
        email: normalizeEmail(opts.email),
        code: newCode("reward"),
        locale,
        expires_at: secondBookExpiresAt(reyesCutoff).toISOString(),
      });
      // Unique violation = a concurrent caller won (order_id) or a code collision: re-read.
      if (error && error.code !== UNIQUE_VIOLATION) throw new Error(`second_book_codes insert (order ${order.id}): ${error.message}`);
      row = await read();
    }
    if (!row) throw new Error(`Could not create a second-book code for order ${order.id}`);
  }

  const promoId = await ensurePromotionCode({
    code: row.code,
    coupon: SECOND_BOOK_COUPON_ID,
    maxRedemptions: 1,
    expiresAt: new Date(row.expires_at),
    metadata: { kind: "second_book", order_id: order.id },
  });
  const { error: updErr } = await supabase.from("second_book_codes").update({ stripe_promotion_code_id: promoId }).eq("id", row.id);
  if (updErr) throw new Error(`second_book_codes update (order ${order.id}): ${updErr.message}`);
  return { ...row, stripe_promotion_code_id: promoId };
}

export interface SecondBookCode {
  code: string;
  expiresAt: string;
}

/** Usable codes (live in Stripe, not redeemed, not expired) earned by these orders, by order id. Throws on DB error. */
export async function secondBookCodesForOrders(supabase: FulfilmentClient, orderIds: readonly string[]): Promise<Map<string, SecondBookCode>> {
  const out = new Map<string, SecondBookCode>();
  if (orderIds.length === 0) return out;
  const { data, error } = await supabase
    .from("second_book_codes")
    .select("order_id, code, expires_at")
    .in("order_id", [...orderIds])
    .not("stripe_promotion_code_id", "is", null)
    .is("redeemed_order_id", null)
    .gt("expires_at", new Date().toISOString());
  if (error) throw new Error(`second_book_codes read: ${error.message}`);
  for (const r of data ?? []) out.set(r.order_id, { code: r.code, expiresAt: r.expires_at });
  return out;
}

/**
 * The buyer's own usable code (promo_…) to pre-apply on a softcover checkout, or null.
 * Matched by account or email. Fail soft: null on any error (never blocks a checkout).
 */
export async function secondBookPromotionForBuyer(
  supabase: FulfilmentClient,
  buyer: { userId: string; email: string | null | undefined },
): Promise<string | null> {
  const email = normalizeEmail(buyer.email);
  const usable = (column: "user_id" | "email", value: string) =>
    supabase
      .from("second_book_codes")
      .select("stripe_promotion_code_id")
      .eq(column, value)
      .not("stripe_promotion_code_id", "is", null)
      .is("redeemed_order_id", null)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: true })
      .limit(1);
  const results = await Promise.all([usable("user_id", buyer.userId), ...(email ? [usable("email", email)] : [])]);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    console.warn("[second-book] Buyer lookup failed:", failed.error.message);
    return null;
  }
  return results.flatMap((r) => r.data ?? [])[0]?.stripe_promotion_code_id ?? null;
}
