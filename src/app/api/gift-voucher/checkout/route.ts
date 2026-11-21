import { NextResponse } from "next/server";
import { getStripe, getStripeCatalog } from "@/lib/stripe";
import { routing, type Locale } from "@/i18n/routing";
import { checkRateLimit, rateLimitSubject } from "@/lib/rate-limit";
import { getPromotionSetup } from "@/lib/growth/stripe-promotions";
import { buildVoucherCheckoutParams } from "@/lib/growth/gift-vouchers";
import { VOUCHER_MESSAGE_MAX, VOUCHER_RECIPIENT_MAX, cleanVoucherText, isVoucherFormat } from "@/lib/promo-codes";
import { isBlackFridayAt } from "@/lib/black-friday";
import { alertOperator } from "@/lib/fulfilment/alerts";
import { createFulfilmentClient } from "@/lib/fulfilment/db";

/**
 * Gift voucher purchase → Stripe Checkout URL. No account needed (Checkout collects the
 * buyer's email). Nothing is written here: the voucher row is created when the payment
 * lands (webhook / thanks page, src/lib/growth/gift-vouchers.ts).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      format?: unknown;
      locale?: unknown;
      recipientName?: unknown;
      message?: unknown;
    };
    if (!isVoucherFormat(body.format)) return NextResponse.json({ error: "invalid_format" }, { status: 400 });
    const locale: Locale = (routing.locales as readonly string[]).includes(String(body.locale))
      ? (body.locale as Locale)
      : routing.defaultLocale;

    const setup = await getPromotionSetup();
    const priceId = setup.voucherPrices[body.format];
    if (!priceId) return NextResponse.json({ error: "unavailable" }, { status: 503 });

    const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
    const limit = await checkRateLimit(rateLimitSubject(`voucher:${ip}`), "gift_voucher_checkout");
    if (!limit.allowed) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds ?? 3600) } });
    }

    // Black Friday: the page shows the −20 % price (src/lib/black-friday.ts), so it is applied here.
    const blackFriday = isBlackFridayAt(Date.now());
    if (blackFriday && !setup.blackFridayVoucherCoupon) {
      await alertOperator(createFulfilmentClient(), {
        key: "voucher-black-friday-missing",
        subject: "Black Friday voucher coupon missing on this Stripe account",
        lines: ["A gift voucher checkout ran at full price (voucher coupon missing/unreadable).", "Run scripts/stripe-setup-black-friday.mts with this account's key."],
        dedupeSeconds: 6 * 3600,
      }).catch(() => false);
    }

    const catalog = await getStripeCatalog();
    const params = buildVoucherCheckoutParams({
      priceId,
      format: body.format,
      locale,
      recipientName: cleanVoucherText(body.recipientName, VOUCHER_RECIPIENT_MAX),
      message: cleanVoucherText(body.message, VOUCHER_MESSAGE_MAX, true),
      sellerTaxId: catalog.sellerTaxId,
      origin: new URL(request.url).origin,
      discountCoupon: blackFriday ? setup.blackFridayVoucherCoupon : null,
    });
    let session;
    try {
      session = await getStripe().checkout.sessions.create(params);
    } catch (err) {
      if (!params.discounts) throw err;
      // Coupon refused (expired at the last second, deleted…): sell at full price, tell the operator.
      await alertOperator(createFulfilmentClient(), {
        key: "voucher-black-friday-refused",
        subject: "Black Friday voucher coupon refused at checkout",
        lines: [`Stripe: ${err instanceof Error ? err.message : "unknown"}`, "The voucher was offered at full price."],
        dedupeSeconds: 6 * 3600,
      }).catch(() => false);
      session = await getStripe().checkout.sessions.create({ ...params, discounts: undefined });
    }
    if (!session.url) return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[gift-voucher] Checkout error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
