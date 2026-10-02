// Product facts: the single source of truth for what Meapica sells, used by the
// marketing copy (as ICU params), the JSON-LD (components/seo/JsonLd.tsx) and
// /llms.txt. Shared by client and server — no server-only imports here.
//
// Everything is derived from the code that actually runs the product: prices from
// STRIPE_CATALOG (pricing.ts), delivery promise and coverage from shipping.ts, ages
// from the story templates (create-store.ts). Change the fact there, never here.

import { STORY_TEMPLATES } from "./create-store";
import { PRICING, TOTAL_SCENE_COUNT } from "./pricing";
import { DELIVERY_PARAMS, SHIPPING_REGIONS } from "./shipping";
import { SUPPORT_EMAIL } from "./support";

export const SITE_URL = "https://meapica.shop";
export const BRAND_NAME = "Meapica";

/**
 * Public contact address shown in structured data and /llms.txt.
 */
export const CONTACT_EMAIL = SUPPORT_EMAIL;

/**
 * Official social profiles (schema.org sameAs). Only profiles that really exist:
 * none yet (docs/roadmap.md, IG/TikTok accounts pending on the owner).
 */
export const SOCIAL_PROFILES: string[] = [
  "https://www.instagram.com/meapica_books/",
  "https://www.tiktok.com/@meapica_books",
  "https://www.facebook.com/1372668209255492",
];

// ── The book ────────────────────────────────────────────────────────────────

/** Square trim size: 20 × 20 cm. */
export const BOOK_SIZE_CM = 20;
/** Inner pages Gelato prints (front + back cover not counted). */
export const BOOK_INNER_PAGES = 30;
/** Illustrated scenes per story. */
export const BOOK_SCENES = TOTAL_SCENE_COUNT;
/** Coated silk paper weight (g/m²). */
export const BOOK_PAPER_GSM = 170;
/** Languages a book can be written in (= site locales). */
export const BOOK_LANGUAGES = ["es", "ca", "en", "fr"] as const;
/** PDF delivery after payment: "normally in under an hour". */
export const PDF_DELIVERY_MAX_MINUTES = 60;

/** Sellable formats with their VAT-inclusive price in cents (B2C). */
export const BOOK_FORMATS = {
  hardcover: { priceCents: PRICING.hardcover.price, printed: true },
  softcover: { priceCents: PRICING.softcover.price, printed: true },
  digital_pdf: { priceCents: PRICING.digital_pdf.price, printed: false },
} as const;

/** Lowest printed price (the "desde" price). */
export const PRINTED_FROM_CENTS = Math.min(PRICING.softcover.price, PRICING.hardcover.price);

// ── Ages ────────────────────────────────────────────────────────────────────

/** Youngest / oldest reader any story template is written for. */
export const AGE_MIN = Math.min(...STORY_TEMPLATES.map((t) => t.ageMin));
export const AGE_MAX = Math.max(...STORY_TEMPLATES.map((t) => t.ageMax));

/**
 * Age bands used by the catalog filter and the /personalized-books pages. Each
 * template keeps its own range (ageMin–ageMax); a template belongs to every band
 * its range touches (components/landing/BookCollectionData.ts).
 */
export const AGE_BANDS = [
  { slug: "2-4", min: 2, max: 4 },
  { slug: "5-7", min: 5, max: 7 },
  { slug: "8-12", min: 8, max: 12 },
] as const;
export type AgeBandSlug = (typeof AGE_BANDS)[number]["slug"];

// ── Delivery ────────────────────────────────────────────────────────────────

/** Customer promise for printed books, door to door, in business days (all formats). */
export const DELIVERY_BUSINESS_DAYS = { min: DELIVERY_PARAMS.minDays, max: DELIVERY_PARAMS.maxDays };

/** ICU params for messages quoting the delivery promise (defined in shipping.ts). */
export { DELIVERY_PARAMS };

/** Shipping is included in the printed price. */
export const SHIPPING_COST_CENTS = 0;
export const SHIPS_TO_REGIONS = SHIPPING_REGIONS;
/** Spanish territories we do not ship to (decision 2026-09-28). */
export const EXCLUDED_REGIONS = ["canarias", "ceuta", "melilla"] as const;
/**
 * Spanish postcode ranges we ship to (schema.org DefinedRegion): every province
 * except Las Palmas 35, Santa Cruz de Tenerife 38, Ceuta 51 and Melilla 52.
 */
export const SHIPPING_POSTCODE_RANGES = [
  { begin: "01000", end: "34999" },
  { begin: "36000", end: "37999" },
  { begin: "39000", end: "50999" },
] as const;

// ── Returns (legal.terms.section5 / landingFaq.returnsA) ────────────────────

/** Personalised goods: no right of withdrawal (art. 103 c LGDCU). */
export const RETURNS_ACCEPTED = false;
/** Days after delivery to report a print defect or transit damage (free reprint). */
export const DEFECT_CLAIM_DAYS = 30;

/**
 * ICU params for messages that quote product facts ("{minDays}-{maxDays} días laborables",
 * "{pages} páginas", "de {ageMin} a {ageMax} años"). next-intl ignores unused params, so
 * every fact-bearing message can receive the whole object.
 */
export const COPY_PARAMS = {
  ...DELIVERY_PARAMS,
  ageMin: AGE_MIN,
  ageMax: AGE_MAX,
  pages: BOOK_INNER_PAGES,
  scenes: BOOK_SCENES,
  size: BOOK_SIZE_CM,
  paper: BOOK_PAPER_GSM,
  defectDays: DEFECT_CLAIM_DAYS,
};

/** COPY_PARAMS plus the formatted VAT-inclusive prices ({hardcover}, {softcover}, {pdf}, {priceFrom}). */
export function factParams(formatPrice: (cents: number) => string) {
  return {
    ...COPY_PARAMS,
    hardcover: formatPrice(BOOK_FORMATS.hardcover.priceCents),
    softcover: formatPrice(BOOK_FORMATS.softcover.priceCents),
    pdf: formatPrice(BOOK_FORMATS.digital_pdf.priceCents),
    priceFrom: formatPrice(PRINTED_FROM_CENTS),
  };
}
