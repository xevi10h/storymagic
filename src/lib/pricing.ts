// Pricing in cents (EUR)
// Shared between client and server — no server-only imports here

// Display labels are in i18n files (src/messages/{locale}.json → "pricing" section).
// Labels here are only used as Stripe line-item names (language-neutral English).
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

// Number of scenes to illustrate for the free preview
export const PREVIEW_ILLUSTRATION_COUNT = 4;

// Total scenes in a story
export const TOTAL_SCENE_COUNT = 12;
