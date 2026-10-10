// Gift vouchers for one book format (server-only). Rules in src/lib/promo-codes.ts.
//
//   /gift-voucher ──► POST /api/gift-voucher/checkout ──► Stripe Checkout (voucher Price,
//   VAT charged now) ──► webhook / thanks page: recordGiftVoucherPurchase
//       └─► gift_vouchers row + single-use 100 % code on that format + email to the buyer
//   recipient creates the book and types the code at checkout ──► 0 € order ──► the
//   normal fulfilment (printed formats ship, Checkout still collects the address);
//   processPromotionRedemptions marks the voucher redeemed.

import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import type { FulfilmentClient, GiftVoucherRow } from "@/lib/fulfilment/db";
import { alertOperator } from "@/lib/fulfilment/alerts";
import { sendEmail, getSiteUrl } from "@/lib/email/send";
import { buildGiftVoucherEmail } from "@/lib/email/growth-emails";
import { CHECKOUT_BRANDING, CHECKOUT_LOCALE, INVOICE_FOOTER } from "@/lib/checkout/session";
import type { Locale } from "@/i18n/routing";
import {
  VOUCHER_COUPON_IDS,
  VOUCHER_MESSAGE_MAX,
  VOUCHER_RECIPIENT_MAX,
  VOUCHER_SESSION_KIND,
  VOUCHER_WITHDRAWAL_DAYS,
  cleanVoucherText,
  isVoucherFormat,
  normalizeEmail,
  type VoucherFormat,
} from "@/lib/promo-codes";
import { ensurePromotionCode, newCode } from "./stripe-promotions";
import { createVoucherCardToken } from "./voucher-card-token";

const UNIQUE_VIOLATION = "23505";
const LOCALES = new Set(["es", "ca", "en", "fr"]);

/** Shown above the Pay button (the voucher itself is NOT personalised: it has the 14-day right). */
const VOUCHER_NOTICE: Record<Locale, string> = {
  es: `Tarjeta regalo sin caducidad. Puedes desistir en ${VOUCHER_WITHDRAWAL_DAYS} días si no se ha canjeado. IVA incluido.`,
  ca: `Targeta regal sense caducitat. Pots desistir en ${VOUCHER_WITHDRAWAL_DAYS} dies si no s'ha bescanviat. IVA inclòs.`,
  en: `Gift voucher with no expiry date. You can cancel within ${VOUCHER_WITHDRAWAL_DAYS} days if it has not been redeemed. VAT included.`,
  fr: `Carte cadeau sans date d'expiration. Rétractation possible sous ${VOUCHER_WITHDRAWAL_DAYS} jours si elle n'a pas été utilisée. TVA incluse.`,
};

export function voucherCardUrl(voucher: Pick<GiftVoucherRow, "id" | "locale">): string {
  const locale = LOCALES.has(voucher.locale) ? voucher.locale : "es";
  return `${getSiteUrl()}/${locale}/gift-voucher/card/${createVoucherCardToken(voucher.id)}`;
}

export function buildVoucherCheckoutParams(input: {
  priceId: string;
  format: VoucherFormat;
  locale: Locale;
  recipientName: string | null;
  message: string | null;
  sellerTaxId: string | null;
  origin: string;
}): Stripe.Checkout.SessionCreateParams {
  const { locale, origin } = input;
  return {
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{ price: input.priceId, quantity: 1 }],
    locale: CHECKOUT_LOCALE[locale],
    automatic_tax: { enabled: true },
    tax_id_collection: { enabled: true },
    invoice_creation: {
      enabled: true,
      invoice_data: {
        account_tax_ids: input.sellerTaxId ? [input.sellerTaxId] : undefined,
        footer: INVOICE_FOOTER,
        metadata: { kind: VOUCHER_SESSION_KIND, format: input.format },
      },
    },
    custom_text: { submit: { message: VOUCHER_NOTICE[locale] } },
    branding_settings: CHECKOUT_BRANDING,
    metadata: {
      kind: VOUCHER_SESSION_KIND,
      format: input.format,
      locale,
      recipient_name: input.recipientName ?? "",
      message: input.message ?? "",
    },
    payment_intent_data: { metadata: { kind: VOUCHER_SESSION_KIND, format: input.format } },
    success_url: `${origin}/${locale}/gift-voucher/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/${locale}/gift-voucher`,
  };
}

export type VoucherPurchaseResult =
  | { state: "not_ours" }
  | { state: "not_paid" }
  | { state: "ready"; voucher: GiftVoucherRow; emailError: string | null };

/**
 * Record a paid voucher session (idempotent): row (unique per session) → Stripe
 * promotion code → email to the buyer exactly once. Throws on DB/Stripe errors; a failed
 * email is returned as `emailError` (the webhook turns it into a retry).
 */
export async function recordGiftVoucherPurchase(supabase: FulfilmentClient, sessionId: string): Promise<VoucherPurchaseResult> {
  const session = await getStripe().checkout.sessions.retrieve(sessionId, { expand: ["invoice"] });
  if (session.metadata?.kind !== VOUCHER_SESSION_KIND) return { state: "not_ours" };
  if (session.payment_status !== "paid") return { state: "not_paid" };
  const format = session.metadata.format;
  if (!isVoucherFormat(format)) throw new Error(`Voucher session ${sessionId} has an unknown format "${format}"`);

  const read = async () => {
    const { data, error } = await supabase.from("gift_vouchers").select("*").eq("stripe_checkout_session_id", sessionId).maybeSingle();
    if (error) throw new Error(`gift_vouchers read (session ${sessionId}): ${error.message}`);
    return data;
  };

  const sessionInvoice = session.invoice && typeof session.invoice === "object" ? session.invoice : null;
  let voucher = await read();
  const fresh = !voucher;
  if (!voucher) {
    const email = normalizeEmail(session.customer_details?.email ?? session.customer_email);
    if (!email) throw new Error(`Voucher session ${sessionId} has no buyer email`);
    const invoice = session.invoice && typeof session.invoice === "object" ? session.invoice : null;
    const locale = LOCALES.has(session.metadata.locale ?? "") ? session.metadata.locale! : "es";
    for (let attempt = 0; attempt < 4 && !voucher; attempt++) {
      const { error } = await supabase.from("gift_vouchers").insert({
        code: newCode("voucher"),
        format,
        amount_cents: session.amount_total ?? 0,
        buyer_email: email,
        buyer_name: session.customer_details?.name?.trim().slice(0, 120) || null,
        stripe_checkout_session_id: sessionId,
        stripe_payment_id: typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null),
        stripe_invoice_id: invoice?.id ?? (typeof session.invoice === "string" ? session.invoice : null),
        locale,
        recipient_name: cleanVoucherText(session.metadata.recipient_name, VOUCHER_RECIPIENT_MAX),
        message: cleanVoucherText(session.metadata.message, VOUCHER_MESSAGE_MAX, true),
        expires_at: null, // owner decision 2026-10-10: vouchers never expire (consumer-law risk of a short expiry)
      });
      if (error && error.code !== UNIQUE_VIOLATION) throw new Error(`gift_vouchers insert (session ${sessionId}): ${error.message}`);
      voucher = await read();
    }
    if (!voucher) throw new Error(`Could not record the voucher of session ${sessionId}`);
  }

  if (!voucher.stripe_promotion_code_id) {
    const promoId = await ensurePromotionCode({
      code: voucher.code,
      coupon: VOUCHER_COUPON_IDS[voucher.format],
      maxRedemptions: 1,
      metadata: { kind: "gift_voucher", voucher_id: voucher.id, format: voucher.format },
    });
    const { error } = await supabase.from("gift_vouchers").update({ stripe_promotion_code_id: promoId }).eq("id", voucher.id);
    if (error) throw new Error(`gift_vouchers update (session ${sessionId}): ${error.message}`);
    voucher = { ...voucher, stripe_promotion_code_id: promoId };
  }

  if (fresh) {
    await alertOperator(supabase, {
      key: `new-voucher:${voucher.id}`,
      subject: `New gift voucher: ${voucher.format} · ${(voucher.amount_cents / 100).toFixed(2)} EUR`,
      lines: [`Buyer: ${voucher.buyer_name ?? "-"} (${voucher.buyer_email}) · code ${voucher.code}`],
      dedupeSeconds: 30 * 86_400,
    });
  }

  let emailError: string | null = null;
  if (!voucher.email_sent_at) {
    const { data: claimed, error } = await supabase
      .from("gift_vouchers")
      .update({ email_sent_at: new Date().toISOString() })
      .eq("id", voucher.id)
      .is("email_sent_at", null)
      .select("email_sent_at");
    if (error) throw new Error(`gift_vouchers claim (session ${sessionId}): ${error.message}`);
    if (claimed && claimed.length > 0) {
      const built = buildGiftVoucherEmail({ voucher, cardUrl: voucherCardUrl(voucher), invoiceUrl: sessionInvoice?.hosted_invoice_url ?? null });
      const ok = await sendEmail({ to: voucher.buyer_email, ...built });
      if (ok) voucher = { ...voucher, email_sent_at: claimed[0].email_sent_at };
      else {
        await supabase.from("gift_vouchers").update({ email_sent_at: null }).eq("id", voucher.id);
        emailError = `Voucher email for session ${sessionId} not sent`;
      }
    }
  }
  return { state: "ready", voucher, emailError };
}

/** Voucher behind a payment (charge.refunded / disputes), or null. Throws on DB error. */
export async function voucherByPayment(supabase: FulfilmentClient, paymentId: string): Promise<GiftVoucherRow | null> {
  const { data, error } = await supabase.from("gift_vouchers").select("*").eq("stripe_payment_id", paymentId).maybeSingle();
  if (error) throw new Error(`gift_vouchers read (payment ${paymentId}): ${error.message}`);
  return data;
}

/**
 * charge.refunded on a voucher sale (e.g. withdrawal within 14 days): a full refund
 * deactivates the code so it can no longer be redeemed. A voucher already redeemed, or a
 * partial refund, only alerts the operator. The credit note is issued by the caller.
 */
export async function recordGiftVoucherRefund(supabase: FulfilmentClient, voucher: GiftVoucherRow, charge: Stripe.Charge): Promise<void> {
  if (!charge.refunded) {
    await alertOperator(supabase, {
      key: `voucher-partial-refund:${voucher.id}:${charge.amount_refunded}`,
      subject: `Partial refund on gift voucher ${voucher.code}`,
      lines: [`${charge.amount_refunded / 100} € of ${charge.amount / 100} €. The code stays active: deactivate it in Stripe if needed.`],
      dedupeSeconds: 7 * 86_400,
    });
    return;
  }
  if (voucher.stripe_promotion_code_id) {
    await getStripe().promotionCodes.update(voucher.stripe_promotion_code_id, { active: false });
  }
  const { error } = await supabase
    .from("gift_vouchers")
    .update({ refunded_at: new Date().toISOString() })
    .eq("id", voucher.id)
    .is("refunded_at", null);
  if (error) throw new Error(`gift_vouchers refund (voucher ${voucher.id}): ${error.message}`);
  if (voucher.redeemed_order_id) {
    await alertOperator(supabase, {
      key: `voucher-refund-redeemed:${voucher.id}`,
      subject: `Gift voucher ${voucher.code} refunded AFTER it was redeemed`,
      lines: [`It paid order ${voucher.redeemed_order_id}. Decide whether that order goes ahead.`],
      dedupeSeconds: 7 * 86_400,
    });
  }
  console.log(`[voucher] ${voucher.code} refunded and deactivated`);
}
