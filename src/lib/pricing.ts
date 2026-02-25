// Pricing in cents (EUR)
// Shared between client and server — no server-only imports here

export const PRICING = {
  softcover: { price: 3490, label: "Tapa blanda", description: "Impresión premium en papel Munken 170g" },
  hardcover: { price: 4990, label: "Tapa dura", description: "Encuadernación premium con cubierta rígida" },
} as const;

export const ADDONS = {
  adventure_pack: {
    price: 1290,
    label: "Pack Aventura Artesanal",
    description: "Convierte el regalo en toda una experiencia",
    icon: "redeem",
    badge: "Más popular",
    details: [
      { icon: "mail", text: "Carta manuscrita del personaje dirigida al niño" },
      { icon: "stars", text: "6 pegatinas mate ilustradas del cuento" },
      { icon: "bookmark", text: "Marcapáginas de madera grabado con su nombre" },
    ],
  },
  digital_pdf: {
    price: 500,
    label: "PDF Digital (instantáneo)",
    description: "Recíbelo al momento, léelo en cualquier pantalla",
    icon: "download",
    badge: null,
    details: [
      { icon: "bolt", text: "Descarga inmediata tras la compra" },
      { icon: "high_quality", text: "Formato PDF en alta calidad (300 DPI)" },
      { icon: "devices", text: "Perfecto para leer en tablet, ordenador o móvil" },
    ],
  },
  extra_copy: {
    price: 1500,
    label: "Copia extra (tapa blanda)",
    description: "Una copia adicional para regalar o tener en casa de los abuelos",
    icon: "content_copy",
    badge: null,
    details: [
      { icon: "verified", text: "Mismo libro, misma calidad de impresión" },
      { icon: "local_shipping", text: "Envío conjunto (sin gastos de envío adicionales)" },
      { icon: "favorite", text: "Ideal para abuelos, padrinos o separados" },
    ],
  },
} as const;

export type BookFormat = keyof typeof PRICING;
export type AddonId = keyof typeof ADDONS;
