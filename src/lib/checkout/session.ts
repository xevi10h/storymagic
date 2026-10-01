// Stripe Checkout Session parameters for a book purchase (server-only). Pure apart
// from its inputs: /api/checkout resolves the user, story, orders and catalog, this
// module turns them into line items + session params (also used by the TEST-mode
// verification script, which must not write orders).

import type Stripe from "stripe";
import { catalogPriceId, type StripeCatalog } from "@/lib/stripe";
import {
  addonCatalogItem,
  addonPrice,
  isAddonEnabled,
  offerPrice,
  PRICING,
  REORDER_CONSENT_VERSION,
  SELLER_IDENTITY,
  WITHDRAWAL_CONSENT_VERSION,
  type AddonId,
  type BookFormat,
  type PhysicalFormat,
} from "@/lib/pricing";
import { offerCatalogItem, upsellForStory, type StoryUpsell, type UpsellOrderRow } from "@/lib/upsell";
import type { Locale } from "@/i18n/routing";
import { SUPPORT_EMAIL } from "@/lib/support";

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

// Another printed copy of a finished book: the PDF is already delivered.
const REORDER_NOTICE: Record<Locale, string> = {
  es: "Libro personalizado impreso por encargo: sin derecho de desistimiento (art. 103 c LGDCU). IVA incluido.",
  ca: "Llibre personalitzat imprès per encàrrec: sense dret de desistiment (art. 103 c LGDCU). IVA inclòs.",
  en: "Personalised book printed to order: no right of withdrawal (art. 103 c, Spanish consumer law). VAT included.",
  fr: "Livre personnalisé imprimé sur commande : pas de droit de rétractation (art. 103 c, droit espagnol). TVA incluse.",
};

const SHIPPING_AREA_NOTICE: Record<Locale, string> = {
  es: "Envío estándar incluido a la península y Baleares (7-10 días laborables). De momento no enviamos a Canarias, Ceuta ni Melilla.",
  ca: "Enviament estàndard inclòs a la península i les Balears (7-10 dies laborables). De moment no enviem a Canàries, Ceuta ni Melilla.",
  en: "Standard shipping included to mainland Spain and the Balearic Islands (7-10 business days). We don't ship to the Canary Islands, Ceuta or Melilla yet.",
  fr: "Livraison standard incluse en Espagne péninsulaire et aux Baléares (7 à 10 jours ouvrés). Pas encore de livraison aux Canaries, à Ceuta ni à Melilla.",
};

// Brand on the hosted Checkout page (docs/brand.md). Images by public prod URL: Stripe
// fetches them, so never `origin` (localhost in dev). Invoices keep Dashboard branding.
// Button = --brand-text, not --brand: Stripe's 16 px white label needs ≥ 4.5:1.
const CHECKOUT_BRANDING: Stripe.Checkout.SessionCreateParams.BrandingSettings = {
  display_name: "Meapica",
  logo: { type: "url", url: "https://meapica.shop/images/meapica-logo.png" },
  icon: { type: "url", url: "https://meapica.shop/images/icon-512.png" },
  background_color: "#FFF8F0",
  button_color: "#b94f1f",
  border_style: "rounded",
  font_family: "nunito",
};

const INVOICE_FOOTER =`${SELLER_IDENTITY} · IVA incluido (4 %, libros) · ${SUPPORT_EMAIL}`;

/**
 * The post-purchase offer that applies to this checkout, decided from the buyer's
 * own orders of the story (never from the client). Only for another printed copy
 * of a finished book; the upgrade needs its Stripe Prices on this account.
 */
export function checkoutOffer(input: {
  orders: readonly UpsellOrderRow[];
  userId: string;
  storyId: string;
  format: BookFormat;
  isReorder: boolean;
  catalog: StripeCatalog;
  now: number;
}): StoryUpsell | null {
  if (!input.isReorder || !PRICING[input.format].requiresShipping) return null;
  const upgradeAvailable =
    !!catalogPriceId(input.catalog, "upgrade_hardcover") && !!catalogPriceId(input.catalog, "upgrade_softcover");
  return upsellForStory(input.orders, {
    userId: input.userId,
    storyId: input.storyId,
    now: input.now,
    upgradeAvailable,
  });
}

export interface CheckoutSessionInput {
  catalog: StripeCatalog;
  storyId: string;
  userId: string;
  email: string | null | undefined;
  format: BookFormat;
  /** Requested add-on ids (unvalidated). */
  addonIds: readonly unknown[];
  locale: Locale;
  isReorder: boolean;
  offer: StoryUpsell | null;
  origin: string;
}

export interface CheckoutSessionPlan {
  params: Stripe.Checkout.SessionCreateParams;
  validAddons: AddonId[];
  totalCents: number;
  consentVersion: string;
  /** The offer actually charged (null if none, or its Price is missing). */
  offer: StoryUpsell | null;
}

export function buildCheckoutSession(input: CheckoutSessionInput): CheckoutSessionPlan {
  const { catalog, storyId, userId, format, locale, isReorder, offer, origin } = input;
  const requiresShipping = PRICING[format].requiresShipping;
  const physical = format as PhysicalFormat;

  // Base line: the offer Price when one applies (only physical formats get offers).
  const offerItem = offer && requiresShipping ? offerCatalogItem(offer.offer, physical) : null;
  const offerPriceId = offerItem ? catalogPriceId(catalog, offerItem) : null;
  const appliedOffer = offerItem && offerPriceId ? offer : null;
  const basePriceId = appliedOffer ? offerPriceId! : catalog.prices[format];
  const baseCents = appliedOffer ? offerPrice(appliedOffer.offer, physical) : PRICING[format].price;
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [{ price: basePriceId, quantity: 1 }];

  // Only sellable add-ons, only on physical formats, deduplicated.
  const validAddons: AddonId[] = [];
  if (requiresShipping) {
    for (const id of new Set(input.addonIds)) {
      if (typeof id !== "string" || !isAddonEnabled(id)) continue;
      const item = addonCatalogItem(id, physical);
      if (!item) continue;
      validAddons.push(id);
      lineItems.push({ price: catalog.prices[item], quantity: 1 });
    }
  }
  const totalCents = baseCents + validAddons.reduce((sum, id) => sum + addonPrice(id, format), 0);
  const consentVersion = isReorder ? REORDER_CONSENT_VERSION : WITHDRAWAL_CONSENT_VERSION;

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    payment_method_types: ["card"],
    // Promotion codes are managed in the Stripe Dashboard (schools/AMPA, gifts).
    allow_promotion_codes: true,
    line_items: lineItems,
    customer_email: input.email || undefined,
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
    custom_text: { submit: { message: (isReorder ? REORDER_NOTICE : WITHDRAWAL_NOTICE)[locale] } },
    branding_settings: CHECKOUT_BRANDING,
    metadata: {
      story_id: storyId,
      user_id: userId,
      format,
      addons: JSON.stringify(validAddons),
      locale,
      withdrawal_consent_version: consentVersion,
      reorder: isReorder ? "true" : "false",
      ...(appliedOffer ? { offer: appliedOffer.offer, offer_source_order_id: appliedOffer.sourceOrderId } : {}),
    },
    payment_intent_data: { metadata: { story_id: storyId, format, ...(appliedOffer ? { offer: appliedOffer.offer } : {}) } },
    success_url: `${origin}/${locale}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    // Another copy is bought from the library: back there if they change their mind.
    cancel_url: isReorder ? `${origin}/${locale}/dashboard?tab=orders` : `${origin}/${locale}/create/${storyId}/preview`,
  };
  if (requiresShipping) {
    // Decision 2026-09-28: Spain only (Gelato ships from an EU plant; no customs).
    params.shipping_address_collection = { allowed_countries: ["ES"] };
    // The carrier calls if a delivery fails.
    params.phone_number_collection = { enabled: true };
    // Canarias, Ceuta and Melilla are excluded (outside the EU VAT area); Stripe
    // can't restrict postcodes, so say it here and enforce it before printing.
    params.custom_text = { ...params.custom_text, shipping_address: { message: SHIPPING_AREA_NOTICE[locale] } };
  }

  return { params, validAddons, totalCents, consentVersion, offer: appliedOffer };
}
