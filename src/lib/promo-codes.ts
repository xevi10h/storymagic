// Referral programme ("10 € y 10 €") + gift vouchers: pure rules, no imports, so it can
// be checked with `node --experimental-strip-types src/lib/promo-codes.check.mjs`.
//
// Owner decisions 2026-10-09:
//  - Referral: every paid book order gets ONE personal code (a Stripe promotion code on
//    the shared coupon REFERRAL_COUPON_ID: 10 € off, printed books only). A friend who
//    pays a printed book with it gets 10 € off; the referrer then gets a single-use 10 €
//    reward code (same coupon) by email, once per referred order. No reward for the
//    referrer's own orders (same email / account / Stripe customer) nor for a buyer who
//    had already ordered before (the programme brings NEW families).
//  - Gift voucher: a voucher for one specific format (hardcover / softcover / PDF), paid
//    in full at purchase (single-purpose voucher: VAT charged then, like the book), with
//    no expiry (owner decision 2026-10-10), redeemed by a single-use code on a 100 %-off coupon restricted to that
//    format's Stripe product (same mechanism as the creator gift codes).

// ── Stripe objects (created by scripts/stripe-setup-catalog.mts, never by the app) ──

/** 10 € off (EUR, amount_off 1000), applies_to = softcover + hardcover book products. */
export const REFERRAL_COUPON_ID = "meapica_referral_10";
export const REFERRAL_DISCOUNT_CENTS = 1000;
/** Uses of one personal code (caps the cost of a code posted on a coupon site). */
export const REFERRAL_MAX_REDEMPTIONS = 20;
export const REFERRAL_REWARD_VALIDITY_MONTHS = 12;

export const VOUCHER_FORMATS = ["hardcover", "softcover", "digital_pdf"] as const;
export type VoucherFormat = (typeof VOUCHER_FORMATS)[number];

/** 100 % off, applies_to = that format's book product only. */
export const VOUCHER_COUPON_IDS: Record<VoucherFormat, string> = {
  hardcover: "meapica_voucher_hardcover",
  softcover: "meapica_voucher_softcover",
  digital_pdf: "meapica_voucher_digital_pdf",
};
/** STRIPE_CATALOG item (pricing.ts) that SELLS the voucher of each format. */
export const VOUCHER_CATALOG_ITEMS = {
  hardcover: "voucher_hardcover",
  softcover: "voucher_softcover",
  digital_pdf: "voucher_digital_pdf",
} as const satisfies Record<VoucherFormat, string>;
export const VOUCHER_WITHDRAWAL_DAYS = 14;
export const VOUCHER_RECIPIENT_MAX = 40;
export const VOUCHER_MESSAGE_MAX = 240;
/** Route of the voucher page (linked from the footer and the Christmas delivery page). */
export const GIFT_VOUCHER_PATH = "/gift-voucher";
/** Checkout Session metadata.kind of a voucher purchase (book sessions carry story_id instead). */
export const VOUCHER_SESSION_KIND = "gift_voucher";

// ── Referral link ───────────────────────────────────────────────────────────

/** Short route printed in the book (QR) and shared: /<locale>/r/<code> → /create. */
export const REFERRAL_ROUTE = "/r";
/** Code kept between the /r link and the book checkout (httpOnly, first-party). */
export const REFERRAL_COOKIE = "meapica_ref";
export const REFERRAL_COOKIE_MAX_AGE_S = 30 * 24 * 3600;

export function referralUrl(siteUrl: string, locale: string, code: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/${locale}${REFERRAL_ROUTE}/${code}`;
}

// ── Codes ───────────────────────────────────────────────────────────────────

/** Unambiguous alphabet (no 0/O, 1/I/L). Stripe codes allow only [A-Za-z0-9]. */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
/** Referral codes are typed from a printed page: short. Rewards/vouchers are worth money: long. */
export const CODE_LENGTH = { referral: 6, reward: 10, voucher: 10 } as const;
export const CODE_PREFIX = "MEA";

/** A new code: prefix + `length` random alphabet chars. `randomInt(n)` returns 0..n-1 (crypto in prod). */
export function generateCode(kind: keyof typeof CODE_LENGTH, randomInt: (n: number) => number): string {
  let out = CODE_PREFIX;
  for (let i = 0; i < CODE_LENGTH[kind]; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

/** "mea 7k3-p9q" → "MEA7K3P9Q"; null when it can't be one of our codes. */
export function normalizeCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const code = input.toUpperCase().replace(/[\s-]+/g, "");
  return /^[A-Z0-9]{4,24}$/.test(code) ? code : null;
}

// ── Dates ───────────────────────────────────────────────────────────────────

/** Same day `months` later (UTC), clamped to the month's last day (31 Jan + 1 → 28/29 Feb). */
export function addMonths(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const d = new Date(date.getTime());
  d.setUTCFullYear(y, m, Math.min(date.getUTCDate(), lastDay));
  return d;
}

// ── Referral reward ─────────────────────────────────────────────────────────

const LIVE = new Set(["paid", "producing", "shipped", "delivered"]);

export function normalizeEmail(email: string | null | undefined): string | null {
  const e = email?.trim().toLowerCase();
  return e && e.includes("@") ? e : null;
}

/** Owner of a referral code (the order that earned it). */
export interface ReferralSource {
  order_id: string;
  user_id: string | null;
  email: string | null;
  stripe_customer_id: string | null;
}

/** The order paid with a referral code. */
export interface ReferredOrder {
  id: string;
  user_id: string | null;
  email: string | null;
  stripe_customer_id: string | null;
  status: string;
  created_at: string;
}

/** The buyer's other orders (same account or same email), any status. */
export interface PriorOrder {
  id: string;
  status: string;
  refunded_at: string | null;
  created_at: string;
}

export type RewardSkipReason = "not_paid" | "own_order" | "self_referral" | "returning_customer" | "no_referrer_email";
export type RewardDecision = { reward: true } | { reward: false; reason: RewardSkipReason };

function sameBuyer(a: { user_id: string | null; email: string | null; stripe_customer_id: string | null }, b: typeof a): boolean {
  if (a.user_id && b.user_id && a.user_id === b.user_id) return true;
  const ea = normalizeEmail(a.email);
  if (ea && ea === normalizeEmail(b.email)) return true;
  return !!a.stripe_customer_id && a.stripe_customer_id === b.stripe_customer_id;
}

/** Does this paid order earn its referrer a 10 € reward? */
export function referralRewardDecision(source: ReferralSource, referred: ReferredOrder, priorOrders: readonly PriorOrder[]): RewardDecision {
  if (!LIVE.has(referred.status)) return { reward: false, reason: "not_paid" };
  if (source.order_id === referred.id) return { reward: false, reason: "own_order" };
  if (sameBuyer(source, referred)) return { reward: false, reason: "self_referral" };
  const before = Date.parse(referred.created_at);
  const returning = priorOrders.some(
    (o) => o.id !== referred.id && LIVE.has(o.status) && !o.refunded_at && Date.parse(o.created_at) < before,
  );
  if (returning) return { reward: false, reason: "returning_customer" };
  if (!normalizeEmail(source.email)) return { reward: false, reason: "no_referrer_email" };
  return { reward: true };
}

/**
 * Pre-apply a referral code (from the /r cookie) to a book checkout? Only printed formats
 * (the coupon does not cover the PDF) and never the code owner's own checkout.
 */
export function canPreApplyReferral(
  source: Pick<ReferralSource, "user_id" | "email">,
  buyer: { userId: string; email: string | null | undefined; format: string },
): boolean {
  if (buyer.format !== "hardcover" && buyer.format !== "softcover") return false;
  if (source.user_id && source.user_id === buyer.userId) return false;
  const e = normalizeEmail(buyer.email);
  return !(e && e === normalizeEmail(source.email));
}

// ── Gift voucher ────────────────────────────────────────────────────────────

export function isVoucherFormat(value: unknown): value is VoucherFormat {
  return typeof value === "string" && (VOUCHER_FORMATS as readonly string[]).includes(value);
}

/**
 * Buyer-typed text printed on the voucher: control characters dropped, spaces collapsed,
 * at most one blank line, trimmed, cut at `max` characters (code points). Empty → null.
 */
export function cleanVoucherText(value: unknown, max: number, multiline = false): string | null {
  if (typeof value !== "string") return null;
  let text = value.normalize("NFC").replace(/\r\n?/g, "\n");
  text = text.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "");
  text = multiline ? text.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{2,}/g, "\n") : text.replace(/\s+/g, " ");
  const trimmed = Array.from(text.trim()).slice(0, max).join("").trim();
  return trimmed || null;
}

/** Promotion code ids applied to a Checkout Session (session.discounts). */
export function sessionPromotionCodeIds(
  discounts: readonly { promotion_code?: string | { id: string } | null }[] | null | undefined,
): string[] {
  return (discounts ?? [])
    .map((d) => (typeof d.promotion_code === "string" ? d.promotion_code : (d.promotion_code?.id ?? null)))
    .filter((id): id is string => !!id);
}
