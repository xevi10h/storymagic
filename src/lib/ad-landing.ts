// Paid-ad landing pages: /{locale}/l/{slug}, one template (app/[locale]/l/[slug]/page.tsx) and one
// variant per Meta ad, so the visitor lands on the same scene and line they just watched.
// Spanish only (the ads run in Spanish); other locales and unknown slugs are 404.
// noindex + out of the sitemap: paid traffic only, the copy overlaps the home.
//
// Honesty rules (feedback: no fake content): the quote is the line said or shown IN the ad, the
// scene is the ad's own AI still (always tagged "Escena recreada con IA"), the cover is the real
// showcase book the ad shows. Prices, shipping and delivery come from pricing / shipping, never here.
// Shared by client and server — no server-only imports here.

export const AD_LANDING_LOCALES = ["es"] as const;
export type AdLandingLocale = (typeof AD_LANDING_LOCALES)[number];

export const AD_LANDING_SLUGS = ["soy-yo", "la-cueva", "noa"] as const;
export type AdLandingSlug = (typeof AD_LANDING_SLUGS)[number];

export interface AdLandingVariant {
  /** <title> (layout template appends "| Meapica"). */
  metaTitle: string;
  metaDescription: string;
  /** The ad's still in /public: its 1080 × 1920 start frame cropped to the design's 358 × 300 box (at 50 % 30 %), webp. */
  scene: { src: string; width: number; height: number; alt: string };
  /** The line said / shown in the ad, as it appears there. */
  quote: string;
  /** H1: first line ink, second line brand orange. */
  title: [string, string];
  /** The example book the ad shows: painted cover art (square) + its printed title. */
  book: { coverSrc: string; title: string; childName: string };
}

export const AD_LANDINGS: Record<AdLandingSlug, AdLandingVariant> = {
  // docs/social/ads/soy-yo: a boy sees his own face on the cover ("Martín y la luz guardada").
  "soy-yo": {
    metaTitle: "Un cuento con su nombre y su cara",
    metaDescription:
      "Su nombre en la portada y su cara pintada en acuarela en cada escena. Ves su portada y las primeras páginas antes de pagar.",
    scene: {
      src: "/images/ads/soy-yo/scene.webp",
      width: 1080,
      height: 905,
      alt: "Un niño mira sorprendido un cuento con su cara en la portada",
    },
    quote: "«Papá… ¡ese soy yo!»",
    title: ["Su nombre en la portada.", "Su cara en cada escena."],
    book: { coverSrc: "/images/ads/soy-yo/cover.webp", title: "Martín y la luz guardada", childName: "Martín" },
  },
  // docs/social/ads/la-cueva: 90s gamebook nostalgia; the parent now picks the adventure for their child.
  "la-cueva": {
    metaTitle: "Antes elegías tu aventura. Ahora es su cuento",
    metaDescription:
      "Elegís juntos su aventura y su peque es el protagonista, con su nombre y su cara. Ves su portada y las primeras páginas antes de pagar.",
    scene: {
      src: "/images/ads/la-cueva/scene.webp",
      width: 1080,
      height: 905,
      alt: "Un niño de los 90 lee un libro de aventuras con una linterna bajo la manta",
    },
    quote: "«Si decides entrar en la cueva, pasa a la página 47»",
    title: ["Antes elegías tu aventura.", "Ahora tu peque es el protagonista."],
    book: { coverSrc: "/images/ads/la-cueva/cover.webp", title: "Aitana y la Perla Cantarina", childName: "Aitana" },
  },
  // docs/social/posts/2026-11-01: the bedtime "Noa y la llave de flor" video (its opening question).
  noa: {
    metaTitle: "Su cuento para dormir, con su nombre",
    metaDescription:
      "Un cuento para leer juntos antes de dormir, con su nombre y su cara pintada en acuarela. Ves su portada y las primeras páginas antes de pagar.",
    scene: {
      src: "/images/ads/noa/scene.webp",
      width: 1080,
      height: 905,
      alt: "Leyendo en la cama «Noa y la llave de flor» antes de dormir",
    },
    quote: "«¿Qué abre una llave de flor?»",
    title: ["Su cuento para dormir.", "Con su nombre y su cara."],
    // Same art as the landing's example book (components/landing/HowItWorksExample.ts).
    book: { coverSrc: "/images/landing/noa/cover.webp", title: "Noa y la llave de flor", childName: "Noa" },
  },
};

/** Copy shared by every variant (Spanish; the price, shipping and preview lines reuse the hero's messages). */
export const AD_LANDING_COPY = {
  aiTag: "Escena recreada con IA",
  cta: "Crear su cuento",
  stepsTitle: "Así funciona",
  steps: [
    "Escribe su nombre y elige cómo es, o sube una foto",
    "Elegís juntos su aventura",
    "Ves su cuento y decides. Pagas solo si te gusta",
  ],
  bookKicker: "El cuento del vídeo",
  /** {pages}, {scenes}: BOOK_INNER_PAGES / BOOK_SCENES (product-facts.ts). */
  bookBody: (pages: number, scenes: number) =>
    `${pages} páginas y ${scenes} escenas pintadas en acuarela con su cara. Tapa blanda o dura.`,
  /** {price}: printed "desde" price. Zones = SHIPPING_REGIONS (peninsula + baleares) in shipping.ts. */
  priceLine: (price: string) => `Libro impreso desde ${price} IVA incluido · Envío gratis a la península y Baleares`,
} as const;

export function isAdLandingSlug(slug: string): slug is AdLandingSlug {
  return (AD_LANDING_SLUGS as readonly string[]).includes(slug);
}

/** The variant for a locale + slug, or null (→ 404). */
export function getAdLanding(locale: string, slug: string): AdLandingVariant | null {
  if (!(AD_LANDING_LOCALES as readonly string[]).includes(locale) || !isAdLandingSlug(slug)) return null;
  return AD_LANDINGS[slug];
}
