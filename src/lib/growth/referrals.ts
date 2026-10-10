// Referral programme "10 € y 10 €" (server-only). Rules in src/lib/promo-codes.ts.
//
//   paid book order ──► ensureReferralCode   (webhook; lazily again before the PDF render)
//   friend pays a printed book with the code ──► processPromotionRedemptions (webhook)
//       └─► referral_rewards row + single-use 10 € code + one email to the referrer
//
// Everything is idempotent (unique rows, exactly-once email claim), so a Stripe retry or
// the success-page verify running the same session twice never doubles anything.
// KNOWN GAP (owner OK, 2026-10-09): a referred order refunded AFTER the reward was issued
// does not revoke the reward code. Deactivate it by hand in Stripe if it matters.

import type Stripe from "stripe";
import type { FulfilmentClient, ReferralCodeRow } from "@/lib/fulfilment/db";
import { alertOperator } from "@/lib/fulfilment/alerts";
import { sendEmail, getSiteUrl } from "@/lib/email/send";
import { buildReferralRewardEmail } from "@/lib/email/growth-emails";
import {
  REFERRAL_COUPON_ID,
  REFERRAL_MAX_REDEMPTIONS,
  REFERRAL_REWARD_VALIDITY_MONTHS,
  addMonths,
  normalizeCode,
  normalizeEmail,
  referralRewardDecision,
  referralUrl,
  sessionPromotionCodeIds,
} from "@/lib/promo-codes";
import { ensurePromotionCode, getPromotionSetup, newCode } from "./stripe-promotions";

const BOOK_FORMATS = new Set(["digital_pdf", "softcover", "hardcover"]);
const LOCALES = new Set(["es", "ca", "en", "fr"]);
const UNIQUE_VIOLATION = "23505";

export interface ReferralOrder {
  id: string;
  user_id: string | null;
  format: string;
  customer_email?: string | null;
}

export interface ReferralLink {
  code: string;
  url: string;
}

export function referralLink(code: string, locale: string): ReferralLink {
  return { code, url: referralUrl(getSiteUrl(), LOCALES.has(locale) ? locale : "es", code) };
}

/**
 * The order's referral code, created on first call (DB row first, then the Stripe
 * promotion code). Returns null when the programme is not set up on this Stripe account
 * or the order is not a book. Throws on DB/Stripe errors.
 */
export async function ensureReferralCode(
  supabase: FulfilmentClient,
  order: ReferralOrder,
  opts: { email?: string | null; locale?: string | null; stripeCustomerId?: string | null } = {},
): Promise<ReferralCodeRow | null> {
  if (!BOOK_FORMATS.has(order.format)) return null;

  const read = async () => {
    const { data, error } = await supabase.from("referral_codes").select("*").eq("order_id", order.id).maybeSingle();
    if (error) throw new Error(`referral_codes read (order ${order.id}): ${error.message}`);
    return data;
  };
  let row = await read();
  if (row?.stripe_promotion_code_id) return row;
  if (!(await getPromotionSetup()).referral) return row ?? null;

  if (!row) {
    const locale = opts.locale && LOCALES.has(opts.locale) ? opts.locale : "es";
    for (let attempt = 0; attempt < 4 && !row; attempt++) {
      const { error } = await supabase.from("referral_codes").insert({
        order_id: order.id,
        user_id: order.user_id,
        email: normalizeEmail(opts.email ?? order.customer_email),
        stripe_customer_id: opts.stripeCustomerId ?? null,
        code: newCode("referral"),
        locale,
      });
      // Unique violation = a concurrent caller won (order_id) or a code collision: re-read.
      if (error && error.code !== UNIQUE_VIOLATION) throw new Error(`referral_codes insert (order ${order.id}): ${error.message}`);
      row = await read();
    }
    if (!row) throw new Error(`Could not create a referral code for order ${order.id}`);
  }

  const promoId = await ensurePromotionCode({
    code: row.code,
    coupon: REFERRAL_COUPON_ID,
    maxRedemptions: REFERRAL_MAX_REDEMPTIONS,
    metadata: { kind: "referral", order_id: order.id },
  });
  const { error: updErr } = await supabase.from("referral_codes").update({ stripe_promotion_code_id: promoId }).eq("id", row.id);
  if (updErr) throw new Error(`referral_codes update (order ${order.id}): ${updErr.message}`);
  return { ...row, stripe_promotion_code_id: promoId };
}

/** Active referral codes of these orders (no Stripe call), by order id. Throws on DB error. */
export async function referralCodesForOrders(supabase: FulfilmentClient, orderIds: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (orderIds.length === 0) return out;
  const { data, error } = await supabase
    .from("referral_codes")
    .select("order_id, code, stripe_promotion_code_id")
    .in("order_id", [...orderIds]);
  if (error) throw new Error(`referral_codes read: ${error.message}`);
  for (const r of data ?? []) if (r.stripe_promotion_code_id) out.set(r.order_id, r.code);
  return out;
}

/**
 * Referral code from the /r cookie, for pre-applying it at checkout. Null when unknown,
 * not live in Stripe yet, or unreadable (never blocks a checkout).
 */
export async function referralForCheckout(
  supabase: FulfilmentClient,
  rawCode: string | undefined,
): Promise<Pick<ReferralCodeRow, "code" | "user_id" | "email" | "stripe_promotion_code_id"> | null> {
  const code = normalizeCode(rawCode);
  if (!code) return null;
  const { data, error } = await supabase
    .from("referral_codes")
    .select("code, user_id, email, stripe_promotion_code_id")
    .eq("code", code)
    .maybeSingle();
  if (error) {
    console.warn(`[referral] Lookup of ${code} failed: ${error.message}`);
    return null;
  }
  return data?.stripe_promotion_code_id ? data : null;
}

/** Escape LIKE wildcards so an email is matched literally by ilike. */
function likeLiteral(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * After a book order is paid: mark a gift voucher redeemed and/or reward a referrer for
 * the promotion codes the session used. Idempotent; throws so the webhook retries.
 */
export async function processPromotionRedemptions(
  supabase: FulfilmentClient,
  params: {
    order: { id: string; user_id: string | null; status: string };
    session: Pick<Stripe.Checkout.Session, "discounts" | "customer" | "created">;
    buyerEmail: string | null;
  },
): Promise<void> {
  const promoIds = sessionPromotionCodeIds(params.session.discounts);
  if (promoIds.length === 0) return;
  const { order } = params;

  // 1. Gift voucher: first redemption wins (the Stripe code is single-use anyway).
  const { error: vErr } = await supabase
    .from("gift_vouchers")
    .update({ redeemed_order_id: order.id, redeemed_at: new Date().toISOString() })
    .in("stripe_promotion_code_id", promoIds)
    .is("redeemed_order_id", null);
  if (vErr) throw new Error(`gift_vouchers redemption (order ${order.id}): ${vErr.message}`);

  // 2. Referral.
  const { data: source, error: sErr } = await supabase
    .from("referral_codes")
    .select("*")
    .in("stripe_promotion_code_id", promoIds)
    .maybeSingle();
  if (sErr) throw new Error(`referral_codes lookup (order ${order.id}): ${sErr.message}`);
  if (!source) return;

  const { data: existing, error: eErr } = await supabase
    .from("referral_rewards")
    .select("*")
    .eq("referred_order_id", order.id)
    .maybeSingle();
  if (eErr) throw new Error(`referral_rewards read (order ${order.id}): ${eErr.message}`);

  let reward = existing;
  if (!reward) {
    const buyerEmail = normalizeEmail(params.buyerEmail);
    const prior = await priorOrders(supabase, order, buyerEmail);
    const stripeCustomerId = typeof params.session.customer === "string" ? params.session.customer : (params.session.customer?.id ?? null);
    const { data: referredRow } = await supabase.from("orders").select("created_at").eq("id", order.id).maybeSingle();
    const decision = referralRewardDecision(
      source,
      {
        id: order.id,
        user_id: order.user_id,
        email: buyerEmail,
        stripe_customer_id: stripeCustomerId,
        status: order.status,
        created_at: referredRow?.created_at ?? new Date(params.session.created * 1000).toISOString(),
      },
      prior,
    );
    if (!decision.reward) {
      console.log(`[referral] Order ${order.id} used ${source.code}: no reward (${decision.reason})`);
      return;
    }
    for (let attempt = 0; attempt < 4 && !reward; attempt++) {
      const { error } = await supabase.from("referral_rewards").insert({
        referral_code_id: source.id,
        referred_order_id: order.id,
        referrer_email: normalizeEmail(source.email)!,
        code: newCode("reward"),
        locale: source.locale,
        expires_at: addMonths(new Date(), REFERRAL_REWARD_VALIDITY_MONTHS).toISOString(),
      });
      if (error && error.code !== UNIQUE_VIOLATION) throw new Error(`referral_rewards insert (order ${order.id}): ${error.message}`);
      const { data } = await supabase.from("referral_rewards").select("*").eq("referred_order_id", order.id).maybeSingle();
      reward = data;
    }
    if (!reward) throw new Error(`Could not create the referral reward for order ${order.id}`);
  }

  if (!reward.stripe_promotion_code_id) {
    const promoId = await ensurePromotionCode({
      code: reward.code,
      coupon: REFERRAL_COUPON_ID,
      maxRedemptions: 1,
      expiresAt: new Date(reward.expires_at),
      metadata: { kind: "referral_reward", referred_order_id: order.id, referral_code: source.code },
    });
    const { error } = await supabase.from("referral_rewards").update({ stripe_promotion_code_id: promoId }).eq("id", reward.id);
    if (error) throw new Error(`referral_rewards update (order ${order.id}): ${error.message}`);
    reward = { ...reward, stripe_promotion_code_id: promoId };
  }

  if (!reward.email_sent_at) {
    const { data: claimed, error: cErr } = await supabase
      .from("referral_rewards")
      .update({ email_sent_at: new Date().toISOString() })
      .eq("id", reward.id)
      .is("email_sent_at", null)
      .select("id");
    if (cErr) throw new Error(`referral_rewards claim (order ${order.id}): ${cErr.message}`);
    if (claimed && claimed.length > 0) {
      const built = buildReferralRewardEmail({ locale: reward.locale, code: reward.code, expiresAt: reward.expires_at });
      const ok = await sendEmail({ to: reward.referrer_email, ...built });
      if (!ok) {
        await supabase.from("referral_rewards").update({ email_sent_at: null }).eq("id", reward.id);
        throw new Error(`Referral reward email for order ${order.id} not sent, retry`);
      }
      console.log(`[referral] Reward ${reward.code} sent for order ${order.id} (code ${source.code})`);
      await alertOperator(supabase, {
        key: `referral-reward:${order.id}`,
        subject: `Referral reward issued (${source.code})`,
        lines: [`Referred order ${order.id} paid with ${source.code}; 10 € reward code ${reward.code} emailed to the referrer.`],
        dedupeSeconds: 30 * 86_400,
      });
    }
  }
}

/** The buyer's other orders (same account or same email). */
async function priorOrders(
  supabase: FulfilmentClient,
  order: { id: string; user_id: string | null },
  email: string | null,
): Promise<{ id: string; status: string; refunded_at: string | null; created_at: string }[]> {
  const cols = "id, status, refunded_at, created_at";
  const [byUser, byEmail] = await Promise.all([
    order.user_id ? supabase.from("orders").select(cols).eq("user_id", order.user_id).neq("id", order.id) : Promise.resolve({ data: [], error: null }),
    email ? supabase.from("orders").select(cols).ilike("customer_email", likeLiteral(email)).neq("id", order.id) : Promise.resolve({ data: [], error: null }),
  ]);
  if (byUser.error) throw new Error(`orders read (user): ${byUser.error.message}`);
  if (byEmail.error) throw new Error(`orders read (email): ${byEmail.error.message}`);
  const all = new Map<string, { id: string; status: string; refunded_at: string | null; created_at: string }>();
  for (const o of [...(byUser.data ?? []), ...(byEmail.data ?? [])]) all.set(o.id, o);
  return [...all.values()];
}
