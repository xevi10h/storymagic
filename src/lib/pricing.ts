// Pricing in cents (EUR)
// Shared between client and server — no server-only imports here

export const PRICING = {
  digital_pdf: {
    price: 990,
    label: "PDF Digital",
    description: "Descarga instantánea en alta calidad",
    icon: "download",
    includesDigital: true,
    requiresShipping: false,
  },
  softcover: {
    price: 3490,
    label: "Tapa blanda",
    description: "Impresión premium en papel Munken 170g. Incluye PDF digital",
    icon: "menu_book",
    includesDigital: true,
    requiresShipping: true,
  },
  hardcover: {
    price: 4990,
    label: "Tapa dura",
    description: "Encuadernación premium con cubierta rígida. Incluye PDF digital",
    icon: "book",
    includesDigital: true,
    requiresShipping: true,
  },
} as const;

export const ADDONS = {
  adventure_pack: {
    price: 1290,
    label: "Pack Aventura Artesanal",
    description: "Convierte el regalo en toda una experiencia",
    icon: "redeem",
    badge: "Más popular",
    physicalOnly: true,
    details: [
      { icon: "mail", text: "Carta manuscrita del personaje dirigida al niño" },
      { icon: "stars", text: "6 pegatinas mate ilustradas del cuento" },
      { icon: "bookmark", text: "Marcapáginas de madera grabado con su nombre" },
    ],
  },
  extra_copy: {
    price: 1500,
    label: "Copia extra (tapa blanda)",
    description: "Una copia adicional para regalar o tener en casa de los abuelos",
    icon: "content_copy",
    badge: null,
    physicalOnly: true,
    details: [
      { icon: "verified", text: "Mismo libro, misma calidad de impresión" },
      { icon: "local_shipping", text: "Envío conjunto (sin gastos de envío adicionales)" },
      { icon: "favorite", text: "Ideal para abuelos, padrinos o separados" },
    ],
  },
} as const;

export type BookFormat = keyof typeof PRICING;
export type AddonId = keyof typeof ADDONS;

// Number of scenes to illustrate for the free preview
export const PREVIEW_ILLUSTRATION_COUNT = 4;

// Total scenes in a story
export const TOTAL_SCENE_COUNT = 12;
