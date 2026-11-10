// Product feeds for shopping surfaces: Google Merchant Center (RSS 2.0 + g: namespace,
// fetched daily by a scheduled fetch) and the ChatGPT product feed (JSONL, same data).
// Served by src/app/feeds/*/route.ts; validated by scripts/check-merchant-feed.mts.
//
// Two families of items, all of them things a visitor can buy today:
// - the three sellable formats (hardcover, softcover, PDF): the same offers and skus the home
//   page's Product JSON-LD declares (components/seo/JsonLd.tsx), linking to the Spanish home
//   page, which shows every price;
// - one printed item per story world and printed format, for every world that has its own
//   landing page (/es/themes/<slug>, lib/seo-landing.ts) plus the seasonal Reyes edition
//   (/es/gifts/three-kings) while it can be ordered. Google requires the landing page to
//   show the item itself and its price: those pages name the world and quote the hardcover
//   and softcover prices with "IVA incluido". A world without a landing page gets no item
//   (add its /themes page first, then it appears here by itself).
// Hardcover and softcover are separate items, not variants of an item group: Google's
// variant attributes are colour, size, material, pattern, age group and gender.
// Every fact is derived from product-facts / pricing / shipping / create-store: change the
// fact there, never here. Shared by client and server.

import {
  AGE_MAX,
  AGE_MIN,
  BOOK_FORMATS,
  BOOK_INNER_PAGES,
  BOOK_PAPER_GSM,
  BOOK_SCENES,
  BOOK_SIZE_CM,
  BRAND_NAME,
  DEFECT_CLAIM_DAYS,
  DELIVERY_BUSINESS_DAYS,
  HANDLING_BUSINESS_DAYS,
  TRANSIT_BUSINESS_DAYS,
  PDF_DELIVERY_MAX_MINUTES,
  RETURNS_ACCEPTED,
  SHIPPING_COST_CENTS,
  SITE_URL,
} from "./product-facts";
import { getTemplateConfig, isTemplateAvailable, templateToday } from "./create-store";
import { THEME_TEMPLATE, seoPath } from "./seo-landing";

export type FeedFormat = keyof typeof BOOK_FORMATS;
export const FEED_FORMATS: FeedFormat[] = ["hardcover", "softcover", "digital_pdf"];

/** Public paths of the feed images (built by scripts/build-merchant-feed-images.mts). */
export const FEED_IMAGES = {
  hardcover: "/images/feed/meapica-hardcover.jpg",
  softcover: "/images/feed/meapica-softcover.jpg",
  digital_pdf: "/images/feed/meapica-digital-pdf.jpg",
  openSpread: "/images/feed/meapica-open-spread.jpg",
  coverArt: "/images/feed/meapica-cover-art.jpg",
} as const;

/** Spanish storefront: the indexable page that sells the book and shows every price. */
export const FEED_LANDING_URL = `${SITE_URL}/es`;
/** Terms (section 5: shipping and returns). */
export const FEED_RETURN_POLICY_URL = `${SITE_URL}/es/legal`;

/** Google product taxonomy (taxonomy-with-ids.en-US.txt). */
const GOOGLE_CATEGORY = { printed: "543543", digital: "543542" } as const; // Media > Books > Print Books / E-books
const OPENAI_CATEGORY = { printed: "Media > Books > Print Books", digital: "Media > Books > E-books" } as const;

/** Printed formats: the ones a story-world item is sold in. */
export const FEED_WORLD_FORMATS = ["hardcover", "softcover"] as const satisfies readonly FeedFormat[];

/**
 * How each world reads after "Cuento personalizado …" in an item title (Spanish feed).
 * Keys are STORY_TEMPLATES ids. A world listed in THEME_TEMPLATE without an entry here
 * fails scripts/check-merchant-feed.mts, so a new theme page cannot ship a nameless item.
 */
const WORLD_SUBJECT: Record<string, string> = {
  dinosaurs: "de dinosaurios",
  space: "del espacio",
  pirates: "de piratas",
  superhero: "de superhéroes",
  forest: "del bosque mágico",
  safari: "de safari",
  reyes: "de Reyes Magos",
};

export interface FeedWorld {
  /** Stable id fragment: the theme slug ("magic-forest"), or the template id for Reyes. */
  key: string;
  /** STORY_TEMPLATES id. */
  templateId: string;
  /** Landing page (no locale prefix) that shows this world and both printed prices. */
  path: string;
}

/** Seasonal Reyes edition ("Paje Real por una Noche"): shown on the Reyes gift page. */
export const REYES_FEED_WORLD: FeedWorld = { key: "reyes", templateId: "reyes", path: seoPath("gifts", "three-kings") };

/** Every world that can have feed items (images are built for all of them, in or out of season). */
export const FEED_WORLDS: FeedWorld[] = [
  ...Object.entries(THEME_TEMPLATE).map(([slug, templateId]) => ({ key: slug, templateId, path: seoPath("themes", slug) })),
  REYES_FEED_WORLD,
];

/** Public paths of a world's feed images (built by scripts/build-merchant-feed-images.mts). */
export function feedWorldImages(key: string) {
  return {
    hardcover: `/images/feed/meapica-${key}-hardcover.jpg`,
    softcover: `/images/feed/meapica-${key}-softcover.jpg`,
    art: `/images/feed/meapica-${key}-art.jpg`,
  } as const;
}

export interface FeedShipping {
  country: "ES";
  /** Postal code range "01000-34999" (Google syntax); absent = whole country. */
  postalCode?: string;
  service: string;
  priceCents: number;
  handling: { min: number; max: number };
  transit: { min: number; max: number };
}

export interface FeedItem {
  id: string;
  format: FeedFormat;
  /** Story world of the item (FeedWorld.key); null = the generic "any world" item. */
  world: string | null;
  printed: boolean;
  title: string;
  description: string;
  link: string;
  imageLink: string;
  additionalImageLinks: string[];
  priceCents: number;
  googleCategory: string;
  openaiCategory: string;
  productType: string;
  highlights: string[];
  details: Array<{ section: string; name: string; value: string }>;
  shipping: FeedShipping[];
}

/** "4990" → "49.90 EUR" (Merchant Center and OpenAI money format, VAT-inclusive). */
export function feedPrice(cents: number): string {
  return `${(cents / 100).toFixed(2)} EUR`;
}

const abs = (p: string) => `${SITE_URL}${p}`;

const FORMAT_COPY: Record<FeedFormat, { title: string; productType: string; lead: string }> = {
  hardcover: {
    title: `Cuento personalizado para niños con su nombre · Tapa dura ${BOOK_SIZE_CM} × ${BOOK_SIZE_CM} cm (incluye PDF)`,
    productType: "Libros > Cuentos infantiles personalizados > Tapa dura",
    lead: "Libro de tapa dura impreso y su versión en PDF.",
  },
  softcover: {
    title: `Cuento personalizado para niños con su nombre · Tapa blanda ${BOOK_SIZE_CM} × ${BOOK_SIZE_CM} cm (incluye PDF)`,
    productType: "Libros > Cuentos infantiles personalizados > Tapa blanda",
    lead: "Libro de tapa blanda impreso y su versión en PDF.",
  },
  digital_pdf: {
    title: "Cuento personalizado para niños con su nombre · PDF digital",
    productType: "Libros > Cuentos infantiles personalizados > PDF digital",
    lead: "Cuento en PDF para leer en pantalla o imprimir en casa.",
  },
};

/** "menos de una hora" for the PDF delivery promise. */
const PDF_DELIVERY = PDF_DELIVERY_MAX_MINUTES === 60 ? "menos de una hora" : `menos de ${PDF_DELIVERY_MAX_MINUTES} minutos`;

/** The story world of a world item: title, one-line synopsis and its own age range (STORY_TEMPLATES). */
type FeedStory = { title: string; description: string; ageMin: number; ageMax: number };

function description(format: FeedFormat, printed: boolean, story?: FeedStory): string {
  const lead = story ? `${FORMAT_COPY[format].lead} Historia: «${story.title}». ${story.description}` : FORMAT_COPY[format].lead;
  const book = `Cuento infantil personalizado de ${story?.ageMin ?? AGE_MIN} a ${story?.ageMax ?? AGE_MAX} años: el nombre del niño o la niña en la portada y en la historia, su retrato a acuarela y ${story ? "los tres capítulos que eliges tú" : "la aventura que eliges entre varios mundos"}. ${BOOK_INNER_PAGES} páginas con ${BOOK_SCENES} escenas ilustradas, formato cuadrado de ${BOOK_SIZE_CM} × ${BOOK_SIZE_CM} cm.`;
  const preview = "Antes de pagar ves la portada, el retrato y las primeras escenas de su cuento.";
  const delivery = printed
    ? `Papel de ${BOOK_PAPER_GSM} g. Impreso bajo demanda en Europa. Envío gratis a España peninsular y Baleares en ${DELIVERY_BUSINESS_DAYS.min}-${DELIVERY_BUSINESS_DAYS.max} días laborables; el PDF llega por correo normalmente en ${PDF_DELIVERY}.`
    : `Se entrega por correo normalmente en ${PDF_DELIVERY} tras el pago.`;
  const returns = printed
    ? `Al ser un libro hecho a medida no admite devoluciones; si llega con un defecto de impresión o dañado en el envío, avísanos en los ${DEFECT_CLAIM_DAYS} días siguientes y te enviamos otro sin coste.`
    : "Al ser un contenido digital personalizado no admite devoluciones.";
  return [lead, book, preview, delivery, returns].join(" ");
}

function highlights(printed: boolean, story?: FeedStory): string[] {
  return [
    ...(story ? [`Historia «${story.title}»`] : []),
    "El nombre y el retrato a acuarela del niño o la niña",
    `${BOOK_INNER_PAGES} páginas y ${BOOK_SCENES} escenas ilustradas`,
    `Para niños de ${story?.ageMin ?? AGE_MIN} a ${story?.ageMax ?? AGE_MAX} años`,
    printed
      ? `Envío gratis a España peninsular y Baleares en ${DELIVERY_BUSINESS_DAYS.min}-${DELIVERY_BUSINESS_DAYS.max} días laborables`
      : `PDF por correo, normalmente en ${PDF_DELIVERY}`,
  ];
}

function details(format: FeedFormat, printed: boolean, story?: FeedStory): FeedItem["details"] {
  const s = "Características";
  const binding: Record<FeedFormat, string> = { hardcover: "Tapa dura", softcover: "Tapa blanda", digital_pdf: "PDF digital" };
  return [
    { section: s, name: "Formato", value: binding[format] },
    { section: s, name: "Páginas", value: String(BOOK_INNER_PAGES) },
    { section: s, name: "Escenas ilustradas", value: String(BOOK_SCENES) },
    { section: s, name: "Tamaño", value: `${BOOK_SIZE_CM} × ${BOOK_SIZE_CM} cm` },
    ...(printed ? [{ section: s, name: "Papel", value: `${BOOK_PAPER_GSM} g/m²` }] : []),
    { section: s, name: "Edad", value: `${story?.ageMin ?? AGE_MIN}-${story?.ageMax ?? AGE_MAX} años` },
    ...(story ? [{ section: s, name: "Historia", value: story.title }] : []),
  ];
}

function shipping(printed: boolean): FeedShipping[] {
  if (!printed) {
    return [{ country: "ES", service: "Descarga digital", priceCents: 0, handling: { min: 0, max: 0 }, transit: { min: 0, max: 0 } }];
  }
  // ponytail: whole of ES. Google rejects item-level postal codes for Spain
  // (region_not_allowed: only US/AU/JP). Canarias/Ceuta/Melilla are blocked at
  // checkout; exclude them via account-level shipping regions if that ever matters.
  return [{
    country: "ES",
    service: "Envío estándar",
    priceCents: SHIPPING_COST_CENTS,
    handling: HANDLING_BUSINESS_DAYS,
    transit: TRANSIT_BUSINESS_DAYS,
  }];
}

/** Items of one story world: one per printed format, linking to the world's own landing page. */
function worldItems(world: FeedWorld): FeedItem[] {
  const template = getTemplateConfig(world.templateId);
  const subject = WORLD_SUBJECT[world.templateId];
  if (!template || !subject) throw new Error(`[merchant-feed] world "${world.key}" has no template or no title subject`);
  const images = feedWorldImages(world.key);
  return FEED_WORLD_FORMATS.map((format) => {
    const { priceCents } = BOOK_FORMATS[format];
    return {
      id: `meapica-${world.key}-${format}`,
      format,
      world: world.key,
      printed: true,
      title: FORMAT_COPY[format].title.replace("para niños", subject),
      description: description(format, true, template),
      link: `${FEED_LANDING_URL}${world.path}`,
      imageLink: abs(images[format]),
      additionalImageLinks: [abs(images.art)],
      priceCents,
      googleCategory: GOOGLE_CATEGORY.printed,
      openaiCategory: OPENAI_CATEGORY.printed,
      productType: `${FORMAT_COPY[format].productType} > ${template.title}`,
      highlights: highlights(true, template),
      details: details(format, true, template),
      shipping: shipping(true),
    };
  });
}

/**
 * Every item of the feeds. `today` (YYYY-MM-DD, Europe/Madrid) decides whether a seasonal
 * world is on sale: the Reyes edition leaves the feed the day after its last order day.
 */
export function buildFeedItems(today: string = templateToday()): FeedItem[] {
  return [...formatItems(), ...FEED_WORLDS.filter((w) => isTemplateAvailable(w.templateId, today)).flatMap(worldItems)];
}

/** The three formats of the generic book (any world), linking to the Spanish home page. */
function formatItems(): FeedItem[] {
  return FEED_FORMATS.map((format) => {
    const { priceCents, printed } = BOOK_FORMATS[format];
    return {
      // Same sku as the home page's Product JSON-LD offers.
      id: `meapica-${format.replace("_", "-")}`,
      format,
      world: null,
      printed,
      title: FORMAT_COPY[format].title,
      description: description(format, printed),
      link: FEED_LANDING_URL,
      imageLink: abs(FEED_IMAGES[format]),
      additionalImageLinks: (printed ? [FEED_IMAGES.openSpread, FEED_IMAGES.coverArt] : [FEED_IMAGES.coverArt]).map(abs),
      priceCents,
      googleCategory: printed ? GOOGLE_CATEGORY.printed : GOOGLE_CATEGORY.digital,
      openaiCategory: printed ? OPENAI_CATEGORY.printed : OPENAI_CATEGORY.digital,
      productType: FORMAT_COPY[format].productType,
      highlights: highlights(printed),
      details: details(format, printed),
      shipping: shipping(printed),
    };
  });
}

// ── Google Merchant Center (RSS 2.0, xmlns:g="http://base.google.com/ns/1.0") ──

function xml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

const tag = (name: string, value: string, indent = "      ") => `${indent}<g:${name}>${xml(value)}</g:${name}>`;

function googleItem(item: FeedItem): string {
  const lines = [
    tag("id", item.id),
    tag("title", item.title),
    tag("description", item.description),
    tag("link", item.link),
    tag("image_link", item.imageLink),
    ...item.additionalImageLinks.map((u) => tag("additional_image_link", u)),
    tag("availability", "in_stock"),
    tag("price", feedPrice(item.priceCents)),
    tag("brand", BRAND_NAME),
    // Made to order (name, portrait, story): no GTIN/MPN exists.
    tag("identifier_exists", "no"),
    tag("condition", "new"),
    tag("google_product_category", item.googleCategory),
    tag("product_type", item.productType),
    tag("age_group", "kids"),
    tag("adult", "no"),
    tag("is_bundle", "no"),
    ...(item.printed
      ? [tag("product_length", `${BOOK_SIZE_CM} cm`), tag("product_width", `${BOOK_SIZE_CM} cm`)]
      : []),
    ...item.highlights.map((h) => tag("product_highlight", h)),
    ...item.details.map(
      (d) =>
        `      <g:product_detail>\n${tag("section_name", d.section, "        ")}\n${tag("attribute_name", d.name, "        ")}\n${tag("attribute_value", d.value, "        ")}\n      </g:product_detail>`,
    ),
    ...item.shipping.map((s) =>
      [
        "      <g:shipping>",
        tag("country", s.country, "        "),
        ...(s.postalCode ? [tag("postal_code", s.postalCode, "        ")] : []),
        tag("service", s.service, "        "),
        tag("price", feedPrice(s.priceCents), "        "),
        tag("min_handling_time", String(s.handling.min), "        "),
        tag("max_handling_time", String(s.handling.max), "        "),
        tag("min_transit_time", String(s.transit.min), "        "),
        tag("max_transit_time", String(s.transit.max), "        "),
        "      </g:shipping>",
      ].join("\n"),
    ),
  ];
  return `    <item>\n${lines.join("\n")}\n    </item>`;
}

export function buildGoogleMerchantXml(items: FeedItem[] = buildFeedItems()): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${xml(BRAND_NAME)}</title>
    <link>${xml(FEED_LANDING_URL)}</link>
    <description>${xml("Cuentos infantiles personalizados de Meapica")}</description>
${items.map(googleItem).join("\n")}
  </channel>
</rss>
`;
}

// ── ChatGPT product feed (developers.openai.com/commerce/specs/feed, JSONL) ──

export function buildOpenAiRecords(items: FeedItem[] = buildFeedItems()): Record<string, unknown>[] {
  return items.map((item) => ({
    item_id: item.id,
    title: item.title,
    description: item.description,
    url: item.link,
    brand: BRAND_NAME,
    seller_name: BRAND_NAME,
    image_url: item.imageLink,
    additional_image_urls: item.additionalImageLinks,
    price: feedPrice(item.priceCents),
    availability: "in_stock",
    condition: "new",
    product_category: item.openaiCategory,
    age_group: "kids",
    is_digital: !item.printed,
    ...(item.printed
      ? { dimensions: { length: String(BOOK_SIZE_CM), width: String(BOOK_SIZE_CM), unit: "cm" } }
      : {}),
    shipping_price: feedPrice(item.printed ? SHIPPING_COST_CENTS : 0),
    accepts_returns: RETURNS_ACCEPTED,
    return_policy: FEED_RETURN_POLICY_URL,
    target_countries: ["ES"],
    store_country: "ES",
    is_eligible_search: true,
    is_eligible_checkout: false,
  }));
}

export function buildOpenAiJsonl(items: FeedItem[] = buildFeedItems()): string {
  return `${buildOpenAiRecords(items).map((r) => JSON.stringify(r)).join("\n")}\n`;
}
