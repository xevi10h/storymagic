// Pricing in cents (EUR)
// Shared between client and server — no server-only imports here

import { FREE_PREVIEW_SCENES } from "./preview-access";
import { offerCatalogItem, type UpsellFormat, type UpsellOffer } from "./upsell";

// Display labels are in i18n files (src/messages/{locale}.json → "pricing" section).
// Labels here are only used as Stripe line-item names (language-neutral English).

// Stripe catalog. Prices are resolved by lookup_key (not hardcoded ids), so the
// same code works on any Stripe account/mode: scripts/stripe-setup-catalog.mts
// creates these Products/Prices (VAT-inclusive, B2C) on the account behind the
// key it is given. Changing an amount = re-run that script (it moves the lookup
// key to a new Price) + update the cents here in the same commit.
export const TAX_CODE_PRINTED_CHILDRENS_BOOK = "txcd_35010001"; // "Books for Children" (4 % IVA in ES)
export const TAX_CODE_DIGITAL_BOOK = "txcd_10302000"; // "Digital Books - downloaded - permanent rights" (4 % IVA in ES)

export type CatalogItemId =
  | "digital_pdf"
  | "softcover"
  | "hardcover"
  | "extra_copy_softcover"
  | "extra_copy_hardcover"
  | "upgrade_softcover"
  | "upgrade_hardcover"
  | "voucher_digital_pdf"
  | "voucher_softcover"
  | "voucher_hardcover";

/**
 * Items that may be missing on a Stripe account (added after the first live setup):
 * getStripeCatalog does not fail on them, it just leaves them out and the offer that
 * sells them is hidden (fail soft) until scripts/stripe-setup-catalog.mts is re-run.
 */
export const OPTIONAL_CATALOG_ITEMS = [
  "upgrade_softcover",
  "upgrade_hardcover",
  "voucher_digital_pdf",
  "voucher_softcover",
  "voucher_hardcover",
] as const satisfies readonly CatalogItemId[];
export type OptionalCatalogItemId = (typeof OPTIONAL_CATALOG_ITEMS)[number];
export type RequiredCatalogItemId = Exclude<CatalogItemId, OptionalCatalogItemId>;

/** Customer-facing names (Checkout + invoice) are Spanish: Stripe has no Catalan locale. */
export const STRIPE_CATALOG: Record<CatalogItemId, { lookupKey: string; amount: number; name: string; taxCode: string }> = {
  digital_pdf: { lookupKey: "meapica_digital_pdf", amount: 990, name: "Cuento personalizado Meapica · PDF digital", taxCode: TAX_CODE_DIGITAL_BOOK },
  softcover: { lookupKey: "meapica_softcover", amount: 3490, name: "Cuento personalizado Meapica · Tapa blanda (incluye PDF)", taxCode: TAX_CODE_PRINTED_CHILDRENS_BOOK },
  hardcover: { lookupKey: "meapica_hardcover", amount: 4990, name: "Cuento personalizado Meapica · Tapa dura (incluye PDF)", taxCode: TAX_CODE_PRINTED_CHILDRENS_BOOK },
  extra_copy_softcover: { lookupKey: "meapica_extra_copy_softcover", amount: 1990, name: "Ejemplar extra · Tapa blanda", taxCode: TAX_CODE_PRINTED_CHILDRENS_BOOK },
  extra_copy_hardcover: { lookupKey: "meapica_extra_copy_hardcover", amount: 2990, name: "Ejemplar extra · Tapa dura", taxCode: TAX_CODE_PRINTED_CHILDRENS_BOOK },
  // PDF → printed upgrade (owner 2026-09-30): the format price minus the 9,90 € PDF.
  upgrade_softcover: { lookupKey: "meapica_upgrade_softcover", amount: 2500, name: "Cuento personalizado Meapica · Tapa blanda (descontado el PDF ya comprado)", taxCode: TAX_CODE_PRINTED_CHILDRENS_BOOK },
  upgrade_hardcover: { lookupKey: "meapica_upgrade_hardcover", amount: 4000, name: "Cuento personalizado Meapica · Tapa dura (descontado el PDF ya comprado)", taxCode: TAX_CODE_PRINTED_CHILDRENS_BOOK },
  // Gift vouchers (owner 2026-10-09): single-purpose vouchers for one format, so VAT is
  // charged at sale exactly like the book (same amount, same tax code); redeeming one is
  // a 0 € order (100 % coupon, src/lib/promo-codes.ts).
  voucher_digital_pdf: { lookupKey: "meapica_voucher_digital_pdf", amount: 990, name: "Tarjeta regalo Meapica · Cuento personalizado en PDF", taxCode: TAX_CODE_DIGITAL_BOOK },
  voucher_softcover: { lookupKey: "meapica_voucher_softcover", amount: 3490, name: "Tarjeta regalo Meapica · Cuento personalizado tapa blanda", taxCode: TAX_CODE_PRINTED_CHILDRENS_BOOK },
  voucher_hardcover: { lookupKey: "meapica_voucher_hardcover", amount: 4990, name: "Tarjeta regalo Meapica · Cuento personalizado tapa dura", taxCode: TAX_CODE_PRINTED_CHILDRENS_BOOK },
};

/**
 * Price (cents, VAT-inclusive) of a printed copy under a post-purchase offer. The
 * extra-copy offer reuses the checkout extra-copy Prices as a standalone line.
 */
export function offerPrice(offer: UpsellOffer, format: UpsellFormat): number {
  return STRIPE_CATALOG[offerCatalogItem(offer, format)].amount;
}

/** Catalog item behind a Stripe Price lookup_key (receipts), or null if unknown. */
export function catalogItemByLookupKey(lookupKey: string | null | undefined): CatalogItemId | null {
  if (!lookupKey) return null;
  const hit = (Object.keys(STRIPE_CATALOG) as CatalogItemId[]).find((id) => STRIPE_CATALOG[id].lookupKey === lookupKey);
  return hit ?? null;
}

/** Help inbox shown to buyers. Single definition in lib/support.ts (re-exported for older imports). */
export { SUPPORT_EMAIL } from "./support";

/**
 * Paywall trust line "¿Llega dañado o con un defecto de impresión? Te lo reponemos sin
 * coste". On since 2026-09-30: owner confirmed the free-reprint promise for printing /
 * manufacturing defects and transit damage (terms section 5 + landing FAQ say the same).
 */
export const SHOW_REPRINT_GUARANTEE = true;

/** Seller identity printed on Stripe invoices and on the order-confirmation receipt. */
export const SELLER_IDENTITY = "Xavier Huix Trenco (Meapica) · NIF 41649433K · Carrer Aribau 140, 5º, 08036 Barcelona";

export const PRICING = {
  digital_pdf: {
    price: STRIPE_CATALOG.digital_pdf.amount,
    label: "Digital PDF",
    icon: "download",
    includesDigital: true,
    requiresShipping: false,
  },
  softcover: {
    price: STRIPE_CATALOG.softcover.amount,
    label: "Softcover",
    icon: "menu_book",
    includesDigital: true,
    requiresShipping: true,
  },
  hardcover: {
    price: STRIPE_CATALOG.hardcover.amount,
    label: "Hardcover",
    icon: "book",
    includesDigital: true,
    requiresShipping: true,
  },
} as const;

export const ADDONS = {
  adventure_pack: {
    price: { softcover: 1290, hardcover: 1290 },
    label: "Adventure Pack",
    icon: "redeem",
    badge: true,
    physicalOnly: true,
    detailCount: 3,
    detailIcons: ["mail", "stars", "bookmark"],
  },
  extra_copy: {
    // Same format as the book (Gelato prints quantity 2): price depends on the format.
    price: { softcover: STRIPE_CATALOG.extra_copy_softcover.amount, hardcover: STRIPE_CATALOG.extra_copy_hardcover.amount },
    label: "Extra Copy",
    icon: "content_copy",
    badge: false,
    physicalOnly: true,
    detailCount: 3,
    detailIcons: ["verified", "local_shipping", "favorite"],
  },
} as const;

export type BookFormat = keyof typeof PRICING;
export type PhysicalFormat = "softcover" | "hardcover";
export type AddonId = keyof typeof ADDONS;

/** Add-ons exist only for physical formats; 0 for a digital book (never sold). */
export function addonPrice(id: AddonId, format: BookFormat): number {
  return format === "digital_pdf" ? 0 : ADDONS[id].price[format];
}

/** Stripe catalog item for an add-on on a given format (only sellable add-ons). */
export function addonCatalogItem(id: AddonId, format: PhysicalFormat): RequiredCatalogItemId | null {
  return id === "extra_copy" ? `extra_copy_${format}` : null;
}

// Add-on feature flags. The Adventure Pack (letter + stickers + bookmark) has no
// fulfilment pipeline yet (Gelato only prints the book), so selling it would be
// a consumer-law problem. Flip to true only once it is actually shipped.
export const ADDON_ENABLED: Record<AddonId, boolean> = {
  adventure_pack: false,
  extra_copy: true,
};

/** Show the "Más popular" badge on add-ons. Off until backed by real sales data. */
export const SHOW_ADDON_POPULAR_BADGE = false;

export const ENABLED_ADDON_IDS = (Object.keys(ADDONS) as AddonId[]).filter(
  (id) => ADDON_ENABLED[id],
);

export function isAddonEnabled(id: string): id is AddonId {
  return id in ADDONS && ADDON_ENABLED[id as AddonId];
}

/** Default format pre-selected on the paywall (hero product). */
export const DEFAULT_BOOK_FORMAT: BookFormat = "hardcover";

/**
 * Format a price in cents as a localized currency string, e.g. 4990 → "49,90 €"
 * (es/ca/fr) or "€49.90" (en). Prices are VAT-inclusive (B2C).
 */
export function formatPrice(cents: number, locale: string): string {
  const intlLocale =
    locale === "ca" ? "ca-ES" : locale === "fr" ? "fr-FR" : locale === "en" ? "en-IE" : "es-ES";
  return new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

// Number of scenes to illustrate for the free preview.
// Kept at 3 (was 4) to shorten preview latency + cost while still showing enough
// character consistency to convert. The remaining scenes generate after payment.
// Same constant the preview UI and the APIs' paywall use (lib/preview-access.ts).
export const PREVIEW_ILLUSTRATION_COUNT = FREE_PREVIEW_SCENES;

// Total scenes in a story
export const TOTAL_SCENE_COUNT = 12;

/**
 * Version of the withdrawal-exemption notice the buyer accepts on the paywall
 * (art. 103 c + m LGDCU: personalised book + digital content supplied at once).
 * Bump it whenever that copy (pricing.withdrawal.* in the message files) changes.
 */
export const WITHDRAWAL_CONSENT_VERSION = "2026-09-30";

/**
 * Same, for another printed copy of a finished book (library "Comprar otra copia"
 * and the post-purchase offers): the PDF is already delivered, so the notice only
 * covers the made-to-order printed book (dashboard.reorder.consent).
 */
export const REORDER_CONSENT_VERSION = "2026-09-30-reorder";
