import { NextResponse } from "next/server";
import { getStripe, getStripeCatalog } from "@/lib/stripe";
import { routing, type Locale } from "@/i18n/routing";
import { checkRateLimit, rateLimitSubject } from "@/lib/rate-limit";
import { getPromotionSetup } from "@/lib/growth/stripe-promotions";
import { buildVoucherCheckoutParams } from "@/lib/growth/gift-vouchers";
import { VOUCHER_MESSAGE_MAX, VOUCHER_RECIPIENT_MAX, cleanVoucherText, isVoucherFormat } from "@/lib/promo-codes";

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

    const catalog = await getStripeCatalog();
    const params = buildVoucherCheckoutParams({
      priceId,
      format: body.format,
      locale,
      recipientName: cleanVoucherText(body.recipientName, VOUCHER_RECIPIENT_MAX),
      message: cleanVoucherText(body.message, VOUCHER_MESSAGE_MAX, true),
      sellerTaxId: catalog.sellerTaxId,
      origin: new URL(request.url).origin,
    });
    const session = await getStripe().checkout.sessions.create(params);
    if (!session.url) return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[gift-voucher] Checkout error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
