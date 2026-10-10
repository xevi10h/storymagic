// Stripe side of the referral programme and gift vouchers (server-only).
//
// The coupons and voucher Prices are created by scripts/stripe-setup-catalog.mts, never by
// the app. Until that script has run on the active account the features are HIDDEN (fail
// soft): no referral code is minted (no QR, nothing in emails), the voucher page shows
// "coming soon" and its checkout refuses.

import { randomInt } from "node:crypto";
import type Stripe from "stripe";
import { getStripe, getStripeCatalog } from "@/lib/stripe";
import {
  REFERRAL_COUPON_ID,
  REFERRAL_DISCOUNT_CENTS,
  VOUCHER_CATALOG_ITEMS,
  VOUCHER_COUPON_IDS,
  VOUCHER_FORMATS,
  generateCode,
  type CODE_LENGTH,
  type VoucherFormat,
} from "@/lib/promo-codes";

export interface PromotionSetup {
  /** The 10 € referral coupon exists and is valid. */
  referral: boolean;
  /** Per format: the Price that sells the voucher (null = voucher not sellable). */
  voucherPrices: Record<VoucherFormat, string | null>;
}

const TTL_MS = 10 * 60_000;
let cached: { at: number; value: PromotionSetup } | null = null;

async function couponOk(stripe: Stripe, id: string, check: (c: Stripe.Coupon) => boolean): Promise<boolean> {
  try {
    const coupon = await stripe.coupons.retrieve(id);
    if (!coupon.valid || !check(coupon)) {
      console.warn(`[promotions] Coupon ${id} is not usable (valid=${coupon.valid}); feature hidden`);
      return false;
    }
    return true;
  } catch (err) {
    const missing = (err as { code?: string }).code === "resource_missing";
    console.warn(`[promotions] Coupon ${id} ${missing ? "missing — run scripts/stripe-setup-catalog.mts" : "unreadable"}; feature hidden`);
    return false;
  }
}

/** What is set up on the active Stripe account. Never throws; cached 10 min. */
export async function getPromotionSetup(): Promise<PromotionSetup> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const none: PromotionSetup = { referral: false, voucherPrices: { hardcover: null, softcover: null, digital_pdf: null } };
  try {
    const stripe = getStripe();
    const [catalog, referral, ...vouchers] = await Promise.all([
      getStripeCatalog(),
      couponOk(stripe, REFERRAL_COUPON_ID, (c) => c.amount_off === REFERRAL_DISCOUNT_CENTS && c.currency === "eur"),
      ...VOUCHER_FORMATS.map((f) => couponOk(stripe, VOUCHER_COUPON_IDS[f], (c) => c.percent_off === 100)),
    ]);
    const voucherPrices = { ...none.voucherPrices };
    VOUCHER_FORMATS.forEach((f, i) => {
      voucherPrices[f] = vouchers[i] ? (catalog.optionalPrices[VOUCHER_CATALOG_ITEMS[f]] ?? null) : null;
    });
    const value = { referral, voucherPrices };
    cached = { at: Date.now(), value };
    return value;
  } catch (err) {
    console.warn("[promotions] Stripe setup unreadable, referral + vouchers hidden:", err instanceof Error ? err.message : err);
    return none;
  }
}

/** Any voucher format sellable? (the page shows only the sellable ones) */
export function vouchersAvailable(setup: PromotionSetup): boolean {
  return VOUCHER_FORMATS.some((f) => !!setup.voucherPrices[f]);
}

/** A fresh random code (crypto). */
export function newCode(kind: keyof typeof CODE_LENGTH): string {
  return generateCode(kind, (n) => randomInt(n));
}

/**
 * Promotion code `code` on `coupon`, created once. Idempotent across retries: an existing
 * code with that text on the same coupon is returned instead of creating a duplicate
 * (the DB row is written first, so a retry always asks for the same text).
 */
export async function ensurePromotionCode(params: {
  code: string;
  coupon: string;
  maxRedemptions?: number;
  expiresAt?: Date | null;
  metadata: Record<string, string>;
}): Promise<string> {
  const stripe = getStripe();
  const existing = await stripe.promotionCodes.list({ code: params.code, limit: 10 });
  const couponOf = (p: Stripe.PromotionCode) => (typeof p.promotion.coupon === "string" ? p.promotion.coupon : p.promotion.coupon?.id);
  const hit = existing.data.find((p) => p.code.toUpperCase() === params.code && couponOf(p) === params.coupon);
  if (hit) return hit.id;
  if (existing.data.some((p) => p.code.toUpperCase() === params.code && p.active)) {
    throw new Error(`Promotion code ${params.code} already exists on another coupon`);
  }
  const created = await stripe.promotionCodes.create({
    promotion: { type: "coupon", coupon: params.coupon },
    code: params.code,
    ...(params.maxRedemptions ? { max_redemptions: params.maxRedemptions } : {}),
    ...(params.expiresAt ? { expires_at: Math.floor(params.expiresAt.getTime() / 1000) } : {}),
    metadata: params.metadata,
  });
  return created.id;
}
