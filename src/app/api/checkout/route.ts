import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { getStripe, getStripeCatalog, PRICING, type BookFormat, type AddonId } from "@/lib/stripe";
import {
  addonCatalogItem,
  addonPrice,
  isAddonEnabled,
  SELLER_IDENTITY,
  WITHDRAWAL_CONSENT_VERSION,
  type PhysicalFormat,
} from "@/lib/pricing";
import { routing, type Locale } from "@/i18n/routing";
import { purchaseEligibility } from "@/lib/fulfilment/logic";
import { SUPPORT_EMAIL } from "@/lib/support";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Stripe Checkout has no Catalan: Catalan buyers get the Spanish page.
const CHECKOUT_LOCALE: Record<Locale, Stripe.Checkout.SessionCreateParams.Locale> = {
  es: "es",
  ca: "es",
  en: "en",
  fr: "fr",
};

// Shown above the Pay button (Stripe renders it as-is; our paywall already
// collected the express consent, this repeats it on the payment page).
const WITHDRAWAL_NOTICE: Record<Locale, string> = {
  es: "Libro personalizado: sin derecho de desistimiento (art. 103 c y m LGDCU). Has aceptado recibir el PDF en cuanto esté listo. IVA incluido.",
  ca: "Llibre personalitzat: sense dret de desistiment (art. 103 c i m LGDCU). Has acceptat rebre el PDF quan estigui llest. IVA inclòs.",
  en: "Personalised book: no right of withdrawal (art. 103 c and m, Spanish consumer law). You agreed to receive the PDF as soon as it is ready. VAT included.",
  fr: "Livre personnalisé : pas de droit de rétractation (art. 103 c et m, droit espagnol). Vous avez accepté de recevoir le PDF dès qu'il est prêt. TVA incluse.",
};

const SHIPPING_AREA_NOTICE: Record<Locale, string> = {
  es: "Envío estándar incluido a la península y Baleares (7-10 días laborables). De momento no enviamos a Canarias, Ceuta ni Melilla.",
  ca: "Enviament estàndard inclòs a la península i les Balears (7-10 dies laborables). De moment no enviem a Canàries, Ceuta ni Melilla.",
  en: "Standard shipping included to mainland Spain and the Balearic Islands (7-10 business days). We don't ship to the Canary Islands, Ceuta or Melilla yet.",
  fr: "Livraison standard incluse en Espagne péninsulaire et aux Baléares (7 à 10 jours ouvrés). Pas encore de livraison aux Canaries, à Ceuta ni à Melilla.",
};

const INVOICE_FOOTER = `${SELLER_IDENTITY} · IVA incluido (4 %, libros) · ${SUPPORT_EMAIL}`;

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
      addons?: AddonId[];
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

    const { data: story, error: storyError } = await supabase
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
    const requiresShipping = PRICING[format].requiresShipping;
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [{ price: catalog.prices[format], quantity: 1 }];

    // Only sellable add-ons, only on physical formats, deduplicated.
    const validAddons: AddonId[] = [];
    if (requiresShipping) {
      for (const id of new Set(addonIds)) {
        if (!isAddonEnabled(id)) continue;
        const item = addonCatalogItem(id, format as PhysicalFormat);
        if (!item) continue;
        validAddons.push(id);
        lineItems.push({ price: catalog.prices[item], quantity: 1 });
      }
    }
    const totalCents = PRICING[format].price + validAddons.reduce((sum, id) => sum + addonPrice(id, format), 0);

    const origin = new URL(request.url).origin;
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      payment_method_types: ["card"],
      // Promotion codes are managed in the Stripe Dashboard (schools/AMPA, gifts).
      allow_promotion_codes: true,
      line_items: lineItems,
      customer_email: user.email || undefined,
      locale: CHECKOUT_LOCALE[locale],
      // Prices are VAT-inclusive (B2C); Stripe Tax extracts the 4 % book rate.
      automatic_tax: { enabled: true },
      // Optional business tax ID (NIF/CIF) for a "factura completa": Checkout shows
      // the field (with the legal name) for supported locations; no customer object
      // needed, it lands on customer_details.tax_ids and on the invoice.
      tax_id_collection: { enabled: true },
      // Invoice (factura) for every order, with the seller NIF.
      invoice_creation: {
        enabled: true,
        invoice_data: {
          account_tax_ids: catalog.sellerTaxId ? [catalog.sellerTaxId] : undefined,
          footer: INVOICE_FOOTER,
          metadata: { story_id: storyId },
        },
      },
      custom_text: { submit: { message: WITHDRAWAL_NOTICE[locale] } },
      metadata: {
        story_id: storyId,
        user_id: user.id,
        format,
        addons: JSON.stringify(validAddons),
        locale,
        withdrawal_consent_version: WITHDRAWAL_CONSENT_VERSION,
        reorder: isReorder ? "true" : "false",
      },
      payment_intent_data: { metadata: { story_id: storyId, format } },
      success_url: `${origin}/${locale}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      // Another copy is bought from the library: back there if they change their mind.
      cancel_url: isReorder ? `${origin}/${locale}/dashboard` : `${origin}/${locale}/crear/${storyId}/preview`,
    };
    if (requiresShipping) {
      // Decision 2026-09-28: Spain only (Gelato ships from an EU plant; no customs).
      sessionParams.shipping_address_collection = { allowed_countries: ["ES"] };
      // The carrier calls if a delivery fails.
      sessionParams.phone_number_collection = { enabled: true };
      // Canarias, Ceuta and Melilla are excluded (outside the EU VAT area); Stripe
      // can't restrict postcodes, so say it here and enforce it before printing.
      sessionParams.custom_text = { ...sessionParams.custom_text, shipping_address: { message: SHIPPING_AREA_NOTICE[locale] } };
    }

    const session = await getStripe().checkout.sessions.create(sessionParams, {
      idempotencyKey: idempotencyKey([user.id, storyId, format, [...validAddons].sort().join(","), locale]),
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
        withdrawal_consent_version: WITHDRAWAL_CONSENT_VERSION,
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
