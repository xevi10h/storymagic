import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { getStripe, getStripeCatalog, PRICING, type BookFormat } from "@/lib/stripe";
import { routing, type Locale } from "@/i18n/routing";
import { purchaseEligibility } from "@/lib/fulfilment/logic";
import { buildCheckoutSession, checkoutOffer } from "@/lib/checkout/session";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ponytail: 2-min idempotency window — a double click reuses the session; a
 * deliberate second purchase after 2 min gets a new one. Per-click client keys
 * if that window ever proves too short. */
function idempotencyKey(parts: string[]): string {
  const bucket = Math.floor(Date.now() / 120_000);
  return `checkout-${createHash("sha256").update([...parts, bucket].join("|")).digest("hex").slice(0, 40)}`;
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
      .select("id, status, locale, generated_text")
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

    const plan = buildCheckoutSession({
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
    });
    const { validAddons, totalCents } = plan;

    const session = await getStripe().checkout.sessions.create(plan.params, {
      idempotencyKey: idempotencyKey([
        user.id,
        storyId,
        format,
        [...validAddons].sort().join(","),
        locale,
        plan.offer ? `${plan.offer.offer}:${plan.offer.sourceOrderId}` : "",
      ]),
    });

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

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", err instanceof Error ? { message: err.message, stack: err.stack } : err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
