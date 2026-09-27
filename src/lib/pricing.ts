// Pricing in cents (EUR)
// Shared between client and server — no server-only imports here

// Display labels are in i18n files (src/messages/{locale}.json → "pricing" section).
// Labels here are only used as Stripe line-item names (language-neutral English).

// Stripe Price IDs by environment
// Live IDs: created via Stripe MCP (2026-03-08)
// Test IDs: run `stripe products create` in test mode to generate
export const STRIPE_PRICE_IDS = {
  live: {
    digital_pdf: "price_1T8dioKnVQxTGgOxhesJVMzi",
    softcover: "price_1T8diFKnVQxTGgOxtSdTKFqI",
    hardcover: "price_1T8diGKnVQxTGgOxHwVEkHQo",
  },
  test: {
    digital_pdf: "price_1T8dqYKnVQxTGgOxkpTrZwuS",
    softcover: "price_1T8dsGKnVQxTGgOxeH5mA5i8",
    hardcover: "price_1T8dsHKnVQxTGgOx7DVtAZyY",
  },
} as const;

export function getStripePriceId(format: keyof typeof STRIPE_PRICE_IDS.live): string {
  const env = (process.env.STRIPE_ENVIRONMENT?.trim() ?? "test") as "test" | "live";
  const priceId = STRIPE_PRICE_IDS[env][format];
  if (!priceId || priceId.endsWith("_...")) {
    throw new Error(`Stripe price ID for "${format}" not configured in ${env} mode`);
  }
  return priceId;
}

export const PRICING = {
  digital_pdf: {
    price: 990,
    label: "Digital PDF",
    icon: "download",
    includesDigital: true,
    requiresShipping: false,
  },
  softcover: {
    price: 3490,
    label: "Softcover",
    icon: "menu_book",
    includesDigital: true,
    requiresShipping: true,
  },
  hardcover: {
    price: 4990,
    label: "Hardcover",
    icon: "book",
    includesDigital: true,
    requiresShipping: true,
  },
} as const;

export const ADDONS = {
  adventure_pack: {
    price: 1290,
    label: "Adventure Pack",
    icon: "redeem",
    badge: true,
    physicalOnly: true,
    detailCount: 3,
    detailIcons: ["mail", "stars", "bookmark"],
  },
  extra_copy: {
    price: 1500,
    label: "Extra Copy (Softcover)",
    icon: "content_copy",
    badge: false,
    physicalOnly: true,
    detailCount: 3,
    detailIcons: ["verified", "local_shipping", "favorite"],
  },
} as const;

export type BookFormat = keyof typeof PRICING;
export type AddonId = keyof typeof ADDONS;

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
export const PREVIEW_ILLUSTRATION_COUNT = 3;

// Total scenes in a story
export const TOTAL_SCENE_COUNT = 12;
