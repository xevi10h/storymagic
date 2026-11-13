import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { getStripe, getStripeCatalog, PRICING, type BookFormat } from "@/lib/stripe";
import { routing, type Locale } from "@/i18n/routing";
import { purchaseEligibility } from "@/lib/fulfilment/logic";
import { buildCheckoutSession, checkoutOffer } from "@/lib/checkout/session";
import { CONSENT_COOKIE, GA_SESSION_COOKIE, UTM_COOKIE, consentAllows, parseConsent } from "@/lib/tracking/consent";
import { gaClientId, gaSessionId } from "@/lib/tracking/ga4-mp";
import { buyerHasOwnCode, referralForCheckout } from "@/lib/growth/referrals";
import { secondBookPromotionForBuyer } from "@/lib/growth/second-book";
import { getPromotionSetup } from "@/lib/growth/stripe-promotions";
import { canPreApplyReferral, REFERRAL_COOKIE, REFERRAL_DISCOUNT_CENTS } from "@/lib/promo-codes";
import { SECOND_BOOK_DISCOUNT_CENTS } from "@/lib/second-book";
import { blackFridayDiscountCents, isBlackFridayAt, orderPromoCandidates } from "@/lib/black-friday";
import { CREATOR_AUDIENCE_PERCENT_OFF, CREATOR_CODE_METADATA_KEY } from "@/lib/creators";
import { alertOperator } from "@/lib/fulfilment/alerts";
import { isTemplateAvailable } from "@/lib/create-store";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ad attribution for the Stripe webhook (Meta CAPI, TikTok, GA4) and for knowing where an
 * order came from (UTMs). Only with advertising consent; Stripe metadata values
 * are capped at 500 chars.
 */
function attributionMetadata(request: Request): Record<string, string> {
  const cookies = new Map(
    (request.headers.get("cookie") ?? "").split(/;\s*/).map((c) => {
      const i = c.indexOf("=");
      const raw = c.slice(i + 1);
      try {
        return [c.slice(0, i), decodeURIComponent(raw)] as const;
      } catch {
        return [c.slice(0, i), raw] as const;
      }
    }),
  );
  // Per purpose (banner "Configurar"): ads → Meta/TikTok server events + UTMs; analytics → GA4.
  const consent = parseConsent(cookies.get(CONSENT_COOKIE));
  const ads = consentAllows(consent, "ads");
  const analytics = consentAllows(consent, "analytics");
  if (!ads && !analytics) return {};
  const meta: Record<string, string> = {};
  if (analytics) {
    Object.assign(meta, {
      analytics_consent: "1",
      ga_cid: gaClientId(cookies.get("_ga")),
      ga_sid: GA_SESSION_COOKIE ? gaSessionId(cookies.get(GA_SESSION_COOKIE)) : "",
    });
  }
  if (ads) {
    Object.assign(meta, {
      ads_consent: "1",
      fbp: cookies.get("_fbp") ?? "",
      fbc: cookies.get("_fbc") ?? "",
      ttp: cookies.get("_ttp") ?? "",
      client_ip: (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim(),
      client_ua: request.headers.get("user-agent") ?? "",
      source_url: request.headers.get("referer") ?? "",
    });
    try {
      Object.assign(meta, JSON.parse(cookies.get(UTM_COOKIE) ?? "{}"));
    } catch {
      // malformed cookie: no UTMs
    }
  }
  return Object.fromEntries(
    Object.entries(meta)
      .filter(([, v]) => typeof v === "string" && v !== "")
      .map(([k, v]) => [k, v.slice(0, 500)]),
  );
}

/** ponytail: 2-min idempotency window — a double click reuses the session; a
 * deliberate second purchase after 2 min gets a new one. Per-click client keys
 * if that window ever proves too short. */
const IDEMPOTENCY_WINDOW_MS = 120_000;
function idempotencyKey(parts: string[], bucket: number): string {
  return `checkout-${createHash("sha256").update([...parts, bucket].join("|")).digest("hex").slice(0, 40)}`;
}

/**
 * Checkout Sessions expire 1 h after the click (Stripe's default is 24 h): the order is
 * cancelled and the abandoned-checkout email (src/lib/marketing/checkout-recovery.ts) can go
 * out the same day. Derived from the idempotency bucket, never from Date.now(): a replay with
 * the same key must send byte-identical params or Stripe rejects it. Stripe's minimum is 30 min.
 */
const CHECKOUT_TTL_S = 60 * 60;
function sessionExpiresAt(bucket: number): number {
  return Math.floor(((bucket + 1) * IDEMPOTENCY_WINDOW_MS) / 1000) + CHECKOUT_TTL_S;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      storyId?: string;
      format?: BookFormat;
      addons?: unknown[];
      locale?: string;
      withdrawalConsent?: boolean;
      /** "No quiero recibir ofertas…" ticked (LSSI 21.2 opt-out at collection). */
      marketingOptOut?: boolean;
      /** "¿Tienes otro código?": don't pre-apply the /r link code (Stripe then shows its code field). */
      ownCode?: boolean;
    };
    const { storyId, format } = body;
    const addonIds = Array.isArray(body.addons) ? body.addons : [];

    if (!storyId || !UUID_RE.test(storyId)) {
      return NextResponse.json({ error: "Invalid story ID" }, { status: 400 });
    }
    if (!format || !Object.hasOwn(PRICING, format)) {
      return NextResponse.json({ error: "Invalid format" }, { status: 400 });
    }
    // Express consent (art. 103 m LGDCU) must precede the purchase: never default it.
    if (body.withdrawalConsent !== true) {
      return NextResponse.json({ error: "withdrawal_consent_required" }, { status: 400 });
    }

    // Service role + explicit owner filter (clients cannot read stories.generated_text).
    const { data: story, error: storyError } = await createFulfilmentClient()
      .from("stories")
      .select("id, status, locale, generated_text, template_id")
      .eq("id", storyId)
      .eq("user_id", user.id)
      .single();
    if (storyError || !story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }
    // The preview, or a finished book (another printed copy at the normal price).
    const eligibility = purchaseEligibility(story.status, format);
    if (eligibility === "not_ready") {
      return NextResponse.json({ error: "Story is not ready for purchase" }, { status: 400 });
    }
    if (eligibility === "already_owned") {
      return NextResponse.json({ error: "already_owned" }, { status: 409 });
    }
    const isReorder = story.status !== "preview";
    // The final book is rendered from the preview's frozen image plan; previews made
    // by the removed engines have none and could never be fulfilled.
    const generated = story.generated_text as { imagePlan?: unknown } | null;
    if (!generated?.imagePlan) {
      return NextResponse.json({ error: "preview_outdated" }, { status: 409 });
    }
    // Seasonal worlds (Reyes) are sold only inside their window (Europe/Madrid). A reorder of a
    // book already paid for (another printed copy) is a reprint, not a new sale: never blocked.
    if (!isReorder && story.template_id && !isTemplateAvailable(story.template_id)) {
      return NextResponse.json({ error: "template_unavailable" }, { status: 410 });
    }

    // MOCK_MODE: refuse checkout. Local dev shares the production Supabase, and the
    // fulfil-orders cron picks up every `status="paid"` order and sends it to Gelato,
    // so a mock "paid" row would become a real print order. To unlock a story in
    // local dev use the preview's "DEV — Mock Mode" button (POST /complete, which
    // has its own mock path and creates no order).
    if (process.env.MOCK_MODE === "true") {
      return NextResponse.json({ error: "mock_mode_checkout_disabled" }, { status: 403 });
    }

    const locale: Locale = (routing.locales as readonly string[]).includes(body.locale ?? "")
      ? (body.locale as Locale)
      : (routing.locales as readonly string[]).includes(story.locale ?? "")
        ? (story.locale as Locale)
        : routing.defaultLocale;

    const catalog = await getStripeCatalog();

    // Post-purchase offers (PDF -> printed upgrade, extra copy within 60 days):
    // decided here from the buyer's own paid orders of this story, never the client.
    let offerOrders: Parameters<typeof checkoutOffer>[0]["orders"] = [];
    if (isReorder && PRICING[format].requiresShipping) {
      const { data: rows, error: ordersError } = await createFulfilmentClient()
        .from("orders")
        .select("id, user_id, story_id, format, status, refunded_at, created_at, offer")
        .eq("user_id", user.id)
        .eq("story_id", storyId);
      // Fail soft: without the lookup the buyer simply pays the normal price.
      if (ordersError) console.error("[checkout] Offer lookup failed:", ordersError.message);
      else offerOrders = rows ?? [];
    }
    const offer = checkoutOffer({ orders: offerOrders, userId: user.id, storyId, format, isReorder, catalog, now: Date.now() });

    // Which code to pre-apply (Stripe takes ONE per session, so codes never stack). Candidates:
    //  - /r/<code> cookie: a friend's referral code (10 €, printed book) or a creator's audience
    //    code (10 %, any format), never the buyer's own code; unknown / not live codes are ignored.
    //  - Pack Reyes: the buyer's own 19,90 € softcover code (15 € off).
    //  - Black Friday (src/lib/black-friday.ts): 20 % on the book line of a FIRST book, inside the
    //    window (checked here by instant) and only if the coupon exists on this Stripe account.
    // The biggest saving goes first, the others are fallbacks if Stripe refuses it (used up,
    // expired…). Nothing is pre-applied when the buyer asked to type their own code ("¿Tienes otro
    // código?"): a pre-applied code hides Stripe's code field.
    const refCookie = request.headers
      .get("cookie")
      ?.split(/;\s*/)
      .find((c) => c.startsWith(`${REFERRAL_COOKIE}=`))
      ?.slice(REFERRAL_COOKIE.length + 1);
    const ownCode = body.ownCode === true;
    const fulfilment = createFulfilmentClient();
    // Link codes and Pack Reyes are skipped when the buyer holds a code of their own (unredeemed
    // gift voucher they bought, creator credit): a pre-applied code would hide Stripe's field.
    const holdsOwnCode = ownCode ? false : await buyerHasOwnCode(fulfilment, user.email);
    const referral = ownCode ? null : await referralForCheckout(fulfilment, refCookie);
    const linkEligible =
      !!referral && canPreApplyReferral(referral, { userId: user.id, email: user.email, format, ownCode, holdsOwnCode });
    const listCents = PRICING[format].price;
    const secondBookPromo =
      format === "softcover" && !ownCode && !holdsOwnCode
        ? await secondBookPromotionForBuyer(fulfilment, { userId: user.id, email: user.email })
        : null;
    // Black Friday is the price the order screen shows, so it is pre-applied for voucher / credit
    // holders too: they reach Stripe's code field through "¿Tienes una tarjeta regalo u otro
    // código?", which every buyer sees during the window (PurchasePanel).
    const blackFridayEligible = !ownCode && !isReorder && !offer && isBlackFridayAt(Date.now());
    const blackFridayPromo = blackFridayEligible ? (await getPromotionSetup()).blackFriday : null;
    if (blackFridayEligible && !blackFridayPromo) {
      // The order screen shows the Black Friday price: without the Stripe objects buyers would pay the list price.
      await alertOperator(fulfilment, {
        key: "checkout-black-friday-missing",
        subject: "Black Friday code missing on this Stripe account",
        lines: ["Checkout ran without the 20 % (coupon or BLACKFRIDAY code missing/unreadable).", "Run scripts/stripe-setup-black-friday.mts with this account's key."],
        dedupeSeconds: 6 * 3600,
      }).catch(() => false);
    }
    const candidates = orderPromoCandidates([
      secondBookPromo ? { kind: "second_book", promotionCodeId: secondBookPromo, savingCents: SECOND_BOOK_DISCOUNT_CENTS } : null,
      linkEligible && referral
        ? {
            kind: referral.kind,
            promotionCodeId: referral.stripe_promotion_code_id,
            savingCents:
              referral.kind === "creator" ? Math.round((listCents * CREATOR_AUDIENCE_PERCENT_OFF) / 100) : REFERRAL_DISCOUNT_CENTS,
          }
        : null,
      blackFridayPromo
        ? { kind: "black_friday", promotionCodeId: blackFridayPromo, savingCents: blackFridayDiscountCents(listCents) }
        : null,
    ]);
    // A creator's follower keeps counting for the creator when a bigger code (Black Friday) wins:
    // the webhook attributes the order from this metadata (recordOrderPromotion). Only when the
    // creator code itself was eligible (so never the creator's own purchase).
    const creatorMetadata: Record<string, string> =
      linkEligible && referral?.kind === "creator" ? { [CREATOR_CODE_METADATA_KEY]: referral.code } : {};

    const attribution = attributionMetadata(request);
    const bucket = Math.floor(Date.now() / IDEMPOTENCY_WINDOW_MS);
    const planFor = (referralPromotionCodeId: string | null) => buildCheckoutSession({
      catalog,
      storyId,
      userId: user.id,
      email: user.email,
      format,
      addonIds,
      locale,
      isReorder,
      offer,
      origin: new URL(request.url).origin,
      referralPromotionCodeId,
    });
    const createSession = (promo: string | null) => {
      const p = planFor(promo);
      // Ad attribution for the webhook (Meta CAPI) and UTMs: only with advertising consent.
      p.params.metadata = { ...p.params.metadata, ...attribution, ...creatorMetadata };
      p.params.expires_at = sessionExpiresAt(bucket);
      return {
        plan: p,
        request: () =>
          getStripe().checkout.sessions.create(p.params, {
            idempotencyKey: idempotencyKey([
              user.id,
              storyId,
              format,
              [...p.validAddons].sort().join(","),
              locale,
              p.offer ? `${p.offer.offer}:${p.offer.sourceOrderId}` : "",
              // Attribution and the pre-applied code are part of the key: same key + different params is a Stripe error.
              JSON.stringify(attribution),
              JSON.stringify(creatorMetadata),
              promo ?? "",
            ], bucket),
          }),
      };
    };
    let attempt = createSession(candidates[0]?.promotionCodeId ?? null);
    let session;
    for (let i = 0; ; i++) {
      try {
        session = await attempt.request();
        break;
      } catch (err) {
        // The code can't be applied (used up, expired, deactivated…): next candidate, then none.
        const failed = candidates[i];
        if (!failed) throw err;
        const reason = err instanceof Error ? err.message : String(err);
        console.warn(`[checkout] Pre-applied ${failed.kind} code ${failed.promotionCodeId} not applied:`, reason);
        if (failed.kind === "black_friday") {
          // The order screen shows the Black Friday price: a refusal charges buyers more than shown.
          await alertOperator(fulfilment, {
            key: "checkout-black-friday-refused",
            subject: "Black Friday code refused at checkout",
            lines: [
              `Stripe refused ${failed.promotionCodeId} on a ${format} checkout: ${reason}`,
              "Check the coupon and the BLACKFRIDAY promotion code (scripts/stripe-setup-black-friday.mts).",
            ],
            dedupeSeconds: 6 * 3600,
          }).catch(() => false);
        }
        attempt = createSession(candidates[i + 1]?.promotionCodeId ?? null);
      }
    }
    const plan = attempt.plan;
    const { validAddons, totalCents } = plan;

    // An idempotent replay of a session that has since completed/expired has no URL.
    if (!session.url) {
      return NextResponse.json({ error: "checkout_session_closed" }, { status: 409 });
    }

    // Service role: users can't write orders (RLS). A replayed idempotent create
    // returns the same session → the row already exists → no duplicate.
    const admin = createFulfilmentClient();
    const { error: orderError } = await admin.from("orders").upsert(
      {
        user_id: user.id,
        story_id: storyId,
        stripe_checkout_session_id: session.id,
        format,
        addons: validAddons,
        subtotal: totalCents / 100,
        total: totalCents / 100,
        status: "pending",
        withdrawal_consent_at: new Date().toISOString(),
        withdrawal_consent_version: plan.consentVersion,
        // Only an explicit tick opts out; the box was shown on every checkout (false = offered, not ticked).
        marketing_opt_out: body.marketingOptOut === true,
        offer: plan.offer?.offer ?? null,
        offer_source_order_id: plan.offer?.sourceOrderId ?? null,
      },
      { onConflict: "stripe_checkout_session_id", ignoreDuplicates: true },
    );
    if (orderError) {
      try {
        await getStripe().checkout.sessions.expire(session.id);
      } catch {
        console.error("Failed to expire Stripe session after order insert failure:", session.id);
      }
      console.error("Failed to create order:", orderError);
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }

    const response = NextResponse.json({ url: session.url });
    // The buyer chose their own code: forget the link code for good.
    if (ownCode) response.cookies.delete(REFERRAL_COOKIE);
    return response;
  } catch (err) {
    console.error("Checkout error:", err instanceof Error ? { message: err.message, stack: err.stack } : err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
