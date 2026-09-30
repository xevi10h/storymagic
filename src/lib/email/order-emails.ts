// Localized transactional emails for the order lifecycle (es / ca / en / fr).
//
// Lifecycle (physical order):
//   paid       → order_confirmed   ("we got your order" + receipt)
//   producing  → in_production     ("it's at the print studio")
//   shipped    → shipped           ("it's on its way" + tracking)
//   delivered  → delivered         ("it arrived, enjoy")
//
// Digital order: order_confirmed_digital on payment (+ receipt).
// Every order: book_ready once the final illustrations are done (download link).
//
// The recipient is the adult who paid, never the child: the greeting uses the
// buyer's first name when we know it (see notify-order.ts), else a neutral "Hola,".
// The child's name only appears in the body ("el cuento de Teo").
// Voice: warm, direct, short paragraphs, no em-dashes (owner's canonical email voice).

import { EMAIL_COLORS, renderEmailLayout, escapeHtml } from "./layout";
import { getSiteUrl } from "./send";
import { orderAccessUrl } from "@/lib/auth/next-path";
import { formatPrice, SELLER_IDENTITY, type CatalogItemId } from "@/lib/pricing";

export type OrderEmailEvent =
  | "order_confirmed"
  | "order_confirmed_digital"
  | "book_ready"
  | "in_production"
  | "shipped"
  | "delivered";

type Locale = "es" | "ca" | "en" | "fr";

const LOCALES: Locale[] = ["es", "ca", "en", "fr"];

/** Receipt data for the order-confirmation email, taken from the paid Checkout Session. */
export interface OrderReceipt {
  /** Short human reference of our order (see orderReference) */
  reference: string;
  /** Payment time, ISO 8601 */
  paidAt: string;
  items: { catalogId: CatalogItemId | null; description: string; amountCents: number }[];
  discountCents: number;
  totalCents: number;
  /** VAT contained in the (VAT-inclusive) total */
  taxCents: number;
  /** Physical order: shows the included shipping row */
  physical: boolean;
  shipping: { name: string; line1: string; line2?: string; postalCode: string; city: string } | null;
  invoiceUrl?: string | null;
  invoiceNumber?: string | null;
}

export interface OrderEmailContext {
  /** Recipient locale, falls back to "es" if unsupported */
  locale: string;
  /** The adult who paid (full or first name). Null/empty → neutral greeting. */
  buyerName?: string | null;
  /** Child / protagonist name, used in the body copy */
  childName: string;
  /** Book title */
  bookTitle: string;
  /** Carrier tracking number (shipped event) */
  trackingNumber?: string | null;
  /** Carrier tracking URL (shipped event) */
  trackingUrl?: string | null;
  /** Book view/download link (book_ready event) */
  downloadUrl?: string | null;
  /** Physical order (book_ready copy mentions the printed edition) */
  isPhysical?: boolean;
  /** order_confirmed*: receipt block */
  receipt?: OrderReceipt | null;
  /** Recipient address: prefilled on the login screen behind "Ver mi pedido". */
  recipientEmail?: string | null;
}

/** Short, stable order reference shown to the customer: first 8 hex of the order id. */
export function orderReference(orderId: string): string {
  return orderId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

/**
 * First name for the greeting. "MARTA PRUEBA GARCÍA" → "Marta", "maría josé" → "María".
 * Returns null for anything that does not look like a name (emails, digits).
 */
export function buyerFirstName(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0] ?? "";
  if (!first || first.length < 2 || /[@\d]/.test(first)) return null;
  const shouting = first === first.toUpperCase() || first === first.toLowerCase();
  if (!shouting) return first;
  return first
    .toLowerCase()
    .replace(/(^|[-'’])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

interface ReceiptStrings {
  title: string;
  reference: string;
  date: string;
  items: Record<CatalogItemId, string>;
  shipping: string;
  shippingIncluded: string;
  discount: string;
  total: string;
  vat: (rate: string | null) => string;
  shipTo: string;
  invoice: (num: string | null) => string;
  soldBy: string;
}

interface Strings {
  greeting: (firstName: string | null) => string;
  signoff: string;
  dashboardCta: string;
  trackingCta: string;
  trackingLabel: string;
  downloadCta: string;
  /** Durable-medium confirmation of the express consent (art. 98.7 + 103 m LGDCU). */
  withdrawalConfirmation: string;
  receipt: ReceiptStrings;
  events: Record<
    OrderEmailEvent,
    { subject: (ctx: OrderEmailContext) => string; heading: string; paragraphs: (ctx: OrderEmailContext) => string[] }
  >;
}

const b = (c: OrderEmailContext) => `<strong>${escapeHtml(c.bookTitle)}</strong>`;
const child = (c: OrderEmailContext) => escapeHtml(c.childName.trim());

const CONTENT: Record<Locale, Strings> = {
  es: {
    greeting: (n) => (n ? `Hola ${n},` : "Hola,"),
    signoff: "Un abrazo,\nEl equipo de Meapica",
    dashboardCta: "Ver mi pedido",
    trackingCta: "Seguir el envío",
    trackingLabel: "Número de seguimiento",
    downloadCta: "Ver y descargar el libro",
    withdrawalConfirmation:
      "Como aceptaste antes de pagar, este libro se crea a medida y el PDF se entrega en cuanto está listo, por lo que no tiene derecho de desistimiento (art. 103 c y m de la LGDCU). Si algo llega mal, escríbenos a hola@meapica.com y lo solucionamos.",
    receipt: {
      title: "Resumen del pedido",
      reference: "Pedido",
      date: "Fecha",
      items: {
        digital_pdf: "Cuento personalizado en PDF",
        softcover: "Cuento personalizado, tapa blanda (incluye el PDF)",
        hardcover: "Cuento personalizado, tapa dura (incluye el PDF)",
        extra_copy_softcover: "Ejemplar extra, tapa blanda",
        extra_copy_hardcover: "Ejemplar extra, tapa dura",
      },
      shipping: "Envío estándar",
      shippingIncluded: "Incluido",
      discount: "Descuento",
      total: "Total pagado",
      vat: (r) => (r ? `IVA incluido (${r})` : "IVA incluido"),
      shipTo: "Dirección de envío",
      invoice: (n) => (n ? `Descargar la factura ${n}` : "Descargar la factura"),
      soldBy: "Vendido por",
    },
    events: {
      order_confirmed: {
        subject: (c) => `Pedido confirmado: ${c.bookTitle}`,
        heading: "¡Gracias por tu pedido!",
        paragraphs: (c) => [
          c.childName.trim()
            ? `Ya tenemos tu pedido de ${b(c)}, el cuento de ${child(c)}.`
            : `Ya tenemos tu pedido de ${b(c)}.`,
          "Ahora pintamos las ilustraciones finales y te mandamos el PDF. Después el libro pasa a imprenta y te avisamos en cada paso hasta que llegue a casa.",
          "Aquí abajo tienes el resumen. Guarda este correo, es tu comprobante.",
        ],
      },
      order_confirmed_digital: {
        subject: (c) => `Pedido confirmado: ${c.bookTitle}`,
        heading: "¡Gracias por tu pedido!",
        paragraphs: (c) => [
          c.childName.trim()
            ? `Ya tenemos tu pedido de ${b(c)}, el cuento de ${child(c)}.`
            : `Ya tenemos tu pedido de ${b(c)}.`,
          "Ahora pintamos las ilustraciones finales de cada página. En cuanto esté listo te mandamos el enlace para descargarlo.",
          "Aquí abajo tienes el resumen. Guarda este correo, es tu comprobante.",
        ],
      },
      book_ready: {
        subject: (c) => (c.childName.trim() ? `El libro de ${c.childName.trim()} ya está listo` : "Tu libro ya está listo"),
        heading: "¡Tu libro está listo!",
        paragraphs: (c) => [
          c.childName.trim()
            ? `Ya hemos terminado de ilustrar ${b(c)}, el cuento de ${child(c)}.`
            : `Ya hemos terminado de ilustrar ${b(c)}.`,
          c.isPhysical
            ? "Puedes verlo y descargar el PDF con el botón de abajo. El libro impreso pasa ahora a imprenta y te avisaremos cuando salga."
            : "Puedes verlo y descargar el PDF con el botón de abajo, siempre que quieras.",
        ],
      },
      in_production: {
        subject: (c) => `Ya estamos imprimiendo ${c.bookTitle}`,
        heading: "Tu libro está en la imprenta",
        paragraphs: (c) => [
          `Buenas noticias: ${b(c)} ya se está imprimiendo.`,
          "Lo hacemos con papel de calidad y encuadernación profesional. Cuando salga hacia casa te mandamos el seguimiento.",
        ],
      },
      shipped: {
        subject: (c) => `¡${c.bookTitle} va de camino!`,
        heading: "Tu libro va de camino",
        paragraphs: (c) => [
          `${b(c)} ya ha salido de la imprenta y va hacia ti.`,
          (c.childName.trim() ? `Muy pronto ${child(c)} tendrá su cuento entre las manos. ` : "") +
            (c.trackingUrl ? "Puedes seguir el envío con el botón de abajo." : "Llega en pocos días laborables."),
        ],
      },
      delivered: {
        subject: (c) => `${c.bookTitle} ya ha llegado`,
        heading: "¡Tu libro ha llegado!",
        paragraphs: (c) => [
          c.childName.trim()
            ? `${b(c)} ya está en casa. Ojalá ${child(c)} lo lea una y otra vez.`
            : `${b(c)} ya está en casa. Ojalá lo disfrutéis una y otra vez.`,
          "Y cuando os apetezca otra aventura, aquí estamos para crear el siguiente cuento.",
        ],
      },
    },
  },
  ca: {
    greeting: (n) => (n ? `Hola ${n},` : "Hola,"),
    signoff: "Una abraçada,\nL'equip de Meapica",
    dashboardCta: "Veure la meva comanda",
    trackingCta: "Seguir l'enviament",
    trackingLabel: "Número de seguiment",
    downloadCta: "Veure i descarregar el llibre",
    withdrawalConfirmation:
      "Com vas acceptar abans de pagar, aquest llibre es crea a mida i el PDF s'entrega quan està llest, per això no té dret de desistiment (art. 103 c i m de la LGDCU). Si alguna cosa arriba malament, escriu-nos a hola@meapica.com i ho solucionem.",
    receipt: {
      title: "Resum de la comanda",
      reference: "Comanda",
      date: "Data",
      items: {
        digital_pdf: "Conte personalitzat en PDF",
        softcover: "Conte personalitzat, tapa tova (inclou el PDF)",
        hardcover: "Conte personalitzat, tapa dura (inclou el PDF)",
        extra_copy_softcover: "Exemplar extra, tapa tova",
        extra_copy_hardcover: "Exemplar extra, tapa dura",
      },
      shipping: "Enviament estàndard",
      shippingIncluded: "Inclòs",
      discount: "Descompte",
      total: "Total pagat",
      vat: (r) => (r ? `IVA inclòs (${r})` : "IVA inclòs"),
      shipTo: "Adreça d'enviament",
      invoice: (n) => (n ? `Descarregar la factura ${n}` : "Descarregar la factura"),
      soldBy: "Venut per",
    },
    events: {
      order_confirmed: {
        subject: (c) => `Comanda confirmada: ${c.bookTitle}`,
        heading: "Gràcies per la teva comanda!",
        paragraphs: (c) => [
          c.childName.trim()
            ? `Ja tenim la teva comanda de ${b(c)}, el conte de ${child(c)}.`
            : `Ja tenim la teva comanda de ${b(c)}.`,
          "Ara pintem les il·lustracions finals i t'enviem el PDF. Després el llibre passa a impremta i t'avisem a cada pas fins que arribi a casa.",
          "Aquí sota tens el resum. Guarda aquest correu, és el teu comprovant.",
        ],
      },
      order_confirmed_digital: {
        subject: (c) => `Comanda confirmada: ${c.bookTitle}`,
        heading: "Gràcies per la teva comanda!",
        paragraphs: (c) => [
          c.childName.trim()
            ? `Ja tenim la teva comanda de ${b(c)}, el conte de ${child(c)}.`
            : `Ja tenim la teva comanda de ${b(c)}.`,
          "Ara pintem les il·lustracions finals de cada pàgina. Quan estigui llest t'enviem l'enllaç per descarregar-lo.",
          "Aquí sota tens el resum. Guarda aquest correu, és el teu comprovant.",
        ],
      },
      book_ready: {
        subject: (c) => (c.childName.trim() ? `El llibre de ${c.childName.trim()} ja està llest` : "El teu llibre ja està llest"),
        heading: "El teu llibre ja està llest!",
        paragraphs: (c) => [
          c.childName.trim()
            ? `Ja hem acabat d'il·lustrar ${b(c)}, el conte de ${child(c)}.`
            : `Ja hem acabat d'il·lustrar ${b(c)}.`,
          c.isPhysical
            ? "Pots veure'l i descarregar el PDF amb el botó de sota. El llibre imprès passa ara a impremta i t'avisarem quan surti."
            : "Pots veure'l i descarregar el PDF amb el botó de sota, sempre que vulguis.",
        ],
      },
      in_production: {
        subject: (c) => `Ja estem imprimint ${c.bookTitle}`,
        heading: "El teu llibre és a la impremta",
        paragraphs: (c) => [
          `Bones notícies: ${b(c)} ja s'està imprimint.`,
          "El fem amb paper de qualitat i enquadernació professional. Quan surti cap a casa t'enviem el seguiment.",
        ],
      },
      shipped: {
        subject: (c) => `${c.bookTitle} ja és de camí!`,
        heading: "El teu llibre és de camí",
        paragraphs: (c) => [
          `${b(c)} ja ha sortit de la impremta i va cap a tu.`,
          (c.childName.trim() ? `Molt aviat ${child(c)} tindrà el seu conte a les mans. ` : "") +
            (c.trackingUrl ? "Pots seguir l'enviament amb el botó de sota." : "Arriba en pocs dies laborables."),
        ],
      },
      delivered: {
        subject: (c) => `${c.bookTitle} ja ha arribat`,
        heading: "El teu llibre ha arribat!",
        paragraphs: (c) => [
          c.childName.trim()
            ? `${b(c)} ja és a casa. Tant de bo ${child(c)} el llegeixi una vegada i una altra.`
            : `${b(c)} ja és a casa. Tant de bo el gaudiu una vegada i una altra.`,
          "I quan us vingui de gust una altra aventura, aquí som per crear el següent conte.",
        ],
      },
    },
  },
  en: {
    greeting: (n) => (n ? `Hi ${n},` : "Hi there,"),
    signoff: "Warmly,\nThe Meapica team",
    dashboardCta: "View my order",
    trackingCta: "Track the parcel",
    trackingLabel: "Tracking number",
    downloadCta: "View and download the book",
    withdrawalConfirmation:
      "As you accepted before paying, this book is made to order and the PDF is delivered as soon as it is ready, so it carries no right of withdrawal (art. 103 c and m, Spanish consumer law). If anything arrives wrong, write to hola@meapica.com and we will fix it.",
    receipt: {
      title: "Order summary",
      reference: "Order",
      date: "Date",
      items: {
        digital_pdf: "Personalised storybook, PDF",
        softcover: "Personalised storybook, softcover (PDF included)",
        hardcover: "Personalised storybook, hardcover (PDF included)",
        extra_copy_softcover: "Extra copy, softcover",
        extra_copy_hardcover: "Extra copy, hardcover",
      },
      shipping: "Standard shipping",
      shippingIncluded: "Included",
      discount: "Discount",
      total: "Total paid",
      vat: (r) => (r ? `VAT included (${r})` : "VAT included"),
      shipTo: "Shipping address",
      invoice: (n) => (n ? `Download invoice ${n}` : "Download the invoice"),
      soldBy: "Sold by",
    },
    events: {
      order_confirmed: {
        subject: (c) => `Order confirmed: ${c.bookTitle}`,
        heading: "Thank you for your order!",
        paragraphs: (c) => [
          c.childName.trim()
            ? `We've got your order for ${b(c)}, ${child(c)}'s storybook.`
            : `We've got your order for ${b(c)}.`,
          "We're now painting the final illustrations and will send you the PDF. Then the book goes to print and we'll update you at every step until it reaches your door.",
          "Your summary is below. Keep this email, it's your receipt.",
        ],
      },
      order_confirmed_digital: {
        subject: (c) => `Order confirmed: ${c.bookTitle}`,
        heading: "Thank you for your order!",
        paragraphs: (c) => [
          c.childName.trim()
            ? `We've got your order for ${b(c)}, ${child(c)}'s storybook.`
            : `We've got your order for ${b(c)}.`,
          "We're now painting the final illustrations for every page. As soon as it's ready we'll email you the download link.",
          "Your summary is below. Keep this email, it's your receipt.",
        ],
      },
      book_ready: {
        subject: (c) => (c.childName.trim() ? `${c.childName.trim()}'s book is ready` : "Your book is ready"),
        heading: "Your book is ready!",
        paragraphs: (c) => [
          c.childName.trim()
            ? `We've finished illustrating ${b(c)}, ${child(c)}'s story.`
            : `We've finished illustrating ${b(c)}.`,
          c.isPhysical
            ? "You can view it and download the PDF with the button below. The printed book now goes to print and we'll let you know when it ships."
            : "You can view it and download the PDF with the button below, whenever you like.",
        ],
      },
      in_production: {
        subject: (c) => `We're printing ${c.bookTitle}`,
        heading: "Your book is at the print studio",
        paragraphs: (c) => [
          `Good news: ${b(c)} is being printed right now.`,
          "We use quality paper and professional binding. As soon as it ships we'll send you the tracking.",
        ],
      },
      shipped: {
        subject: (c) => `${c.bookTitle} is on its way!`,
        heading: "Your book is on its way",
        paragraphs: (c) => [
          `${b(c)} has left the print studio and is heading your way.`,
          (c.childName.trim() ? `Very soon ${child(c)} will be holding their own storybook. ` : "") +
            (c.trackingUrl ? "You can follow the parcel with the button below." : "It arrives within a few business days."),
        ],
      },
      delivered: {
        subject: (c) => `${c.bookTitle} has arrived`,
        heading: "Your book has arrived!",
        paragraphs: (c) => [
          c.childName.trim()
            ? `${b(c)} is home. We hope ${child(c)} reads it again and again.`
            : `${b(c)} is home. We hope you enjoy it again and again.`,
          "And whenever you fancy another adventure, we're here to make the next story.",
        ],
      },
    },
  },
  fr: {
    greeting: (n) => (n ? `Bonjour ${n},` : "Bonjour,"),
    signoff: "Bien à vous,\nL'équipe Meapica",
    dashboardCta: "Voir ma commande",
    trackingCta: "Suivre le colis",
    trackingLabel: "Numéro de suivi",
    downloadCta: "Voir et télécharger le livre",
    withdrawalConfirmation:
      "Comme vous l'avez accepté avant de payer, ce livre est fabriqué sur mesure et le PDF est livré dès qu'il est prêt : il n'ouvre donc pas de droit de rétractation (art. 103 c et m, droit espagnol de la consommation). Si quelque chose arrive abîmé, écrivez-nous à hola@meapica.com et nous le réglerons.",
    receipt: {
      title: "Récapitulatif de commande",
      reference: "Commande",
      date: "Date",
      items: {
        digital_pdf: "Livre personnalisé en PDF",
        softcover: "Livre personnalisé, couverture souple (PDF inclus)",
        hardcover: "Livre personnalisé, couverture rigide (PDF inclus)",
        extra_copy_softcover: "Exemplaire supplémentaire, couverture souple",
        extra_copy_hardcover: "Exemplaire supplémentaire, couverture rigide",
      },
      shipping: "Livraison standard",
      shippingIncluded: "Incluse",
      discount: "Remise",
      total: "Total payé",
      vat: (r) => (r ? `TVA incluse (${r})` : "TVA incluse"),
      shipTo: "Adresse de livraison",
      invoice: (n) => (n ? `Télécharger la facture ${n}` : "Télécharger la facture"),
      soldBy: "Vendu par",
    },
    events: {
      order_confirmed: {
        subject: (c) => `Commande confirmée : ${c.bookTitle}`,
        heading: "Merci pour votre commande !",
        paragraphs: (c) => [
          c.childName.trim()
            ? `Nous avons bien reçu votre commande de ${b(c)}, le livre de ${child(c)}.`
            : `Nous avons bien reçu votre commande de ${b(c)}.`,
          "Nous peignons maintenant les illustrations finales et vous envoyons le PDF. Ensuite le livre part à l'impression et nous vous tenons informé à chaque étape jusqu'à la livraison.",
          "Le récapitulatif est ci-dessous. Gardez cet e-mail, c'est votre justificatif.",
        ],
      },
      order_confirmed_digital: {
        subject: (c) => `Commande confirmée : ${c.bookTitle}`,
        heading: "Merci pour votre commande !",
        paragraphs: (c) => [
          c.childName.trim()
            ? `Nous avons bien reçu votre commande de ${b(c)}, le livre de ${child(c)}.`
            : `Nous avons bien reçu votre commande de ${b(c)}.`,
          "Nous peignons maintenant les illustrations finales de chaque page. Dès qu'il est prêt, nous vous envoyons le lien de téléchargement.",
          "Le récapitulatif est ci-dessous. Gardez cet e-mail, c'est votre justificatif.",
        ],
      },
      book_ready: {
        subject: (c) => (c.childName.trim() ? `Le livre de ${c.childName.trim()} est prêt` : "Votre livre est prêt"),
        heading: "Votre livre est prêt !",
        paragraphs: (c) => [
          c.childName.trim()
            ? `Nous avons terminé d'illustrer ${b(c)}, l'histoire de ${child(c)}.`
            : `Nous avons terminé d'illustrer ${b(c)}.`,
          c.isPhysical
            ? "Vous pouvez le consulter et télécharger le PDF avec le bouton ci-dessous. Le livre imprimé part maintenant à l'impression et nous vous préviendrons dès son expédition."
            : "Vous pouvez le consulter et télécharger le PDF avec le bouton ci-dessous, quand vous le souhaitez.",
        ],
      },
      in_production: {
        subject: (c) => `Nous imprimons ${c.bookTitle}`,
        heading: "Votre livre est à l'impression",
        paragraphs: (c) => [
          `Bonne nouvelle : ${b(c)} est en cours d'impression.`,
          "Nous utilisons un papier de qualité et une reliure professionnelle. Dès son expédition, nous vous envoyons le suivi.",
        ],
      },
      shipped: {
        subject: (c) => `${c.bookTitle} est en route !`,
        heading: "Votre livre est en route",
        paragraphs: (c) => [
          `${b(c)} a quitté l'atelier et arrive chez vous.`,
          (c.childName.trim() ? `Très bientôt, ${child(c)} tiendra son propre livre entre ses mains. ` : "") +
            (c.trackingUrl ? "Vous pouvez suivre le colis avec le bouton ci-dessous." : "Il arrive en quelques jours ouvrés."),
        ],
      },
      delivered: {
        subject: (c) => `${c.bookTitle} est arrivé`,
        heading: "Votre livre est arrivé !",
        paragraphs: (c) => [
          c.childName.trim()
            ? `${b(c)} est à la maison. Nous espérons que ${child(c)} le lira encore et encore.`
            : `${b(c)} est à la maison. Nous espérons que vous le lirez encore et encore.`,
          "Et quand vous aurez envie d'une nouvelle aventure, nous serons là pour créer la prochaine histoire.",
        ],
      },
    },
  },
};

function resolveLocale(locale: string): Locale {
  return (LOCALES.includes(locale as Locale) ? locale : "es") as Locale;
}

const INTL_LOCALE: Record<Locale, string> = { es: "es-ES", ca: "ca-ES", en: "en-GB", fr: "fr-FR" };

/** VAT rate implied by a VAT-inclusive total, e.g. 192 of 4990 → "4 %". Null when there is no tax. */
function vatRateLabel(taxCents: number, totalCents: number, loc: Locale): string | null {
  const net = totalCents - taxCents;
  if (taxCents <= 0 || net <= 0) return null;
  const rate = Math.round((taxCents / net) * 1000) / 10; // one decimal: 4, 10, 21, 5.5
  const num = new Intl.NumberFormat(INTL_LOCALE[loc], { maximumFractionDigits: 1 }).format(rate);
  return loc === "en" ? `${num}%` : `${num} %`;
}

function formatDate(iso: string, loc: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[loc], { dateStyle: "long", timeZone: "Europe/Madrid" }).format(new Date(iso));
}

interface ReceiptRow {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}

function receiptRows(r: OrderReceipt, s: ReceiptStrings, loc: Locale): ReceiptRow[] {
  const money = (cents: number) => formatPrice(cents, loc);
  const rows: ReceiptRow[] = r.items.map((it) => ({
    label: it.catalogId ? s.items[it.catalogId] : it.description,
    value: money(it.amountCents),
  }));
  if (r.physical) rows.push({ label: s.shipping, value: s.shippingIncluded });
  if (r.discountCents > 0) rows.push({ label: s.discount, value: `-${money(r.discountCents)}` });
  rows.push({ label: s.total, value: money(r.totalCents), strong: true });
  rows.push({ label: s.vat(vatRateLabel(r.taxCents, r.totalCents, loc)), value: r.taxCents > 0 ? money(r.taxCents) : "", muted: true });
  return rows;
}

function addressLines(r: OrderReceipt): string[] {
  const a = r.shipping;
  if (!a) return [];
  return [a.name, a.line1, a.line2 ?? "", `${a.postalCode} ${a.city}`.trim()].filter((l) => l.trim());
}

/** The receipt block (inline styles, table layout for email clients). */
function renderReceiptHtml(r: OrderReceipt, s: ReceiptStrings, loc: Locale): string {
  const C = EMAIL_COLORS;
  const cell = "padding:6px 0;font-size:14px;line-height:1.5;vertical-align:top;";
  const rows = receiptRows(r, s, loc)
    .map((row) => {
      const color = row.muted ? C.muted : row.strong ? C.heading : C.body;
      const weight = row.strong ? "font-weight:700;" : "";
      const border = row.strong ? `border-top:1px solid ${C.border};padding-top:10px;` : "";
      return `<tr>
        <td style="${cell}${border}color:${color};${weight}padding-right:16px;">${escapeHtml(row.label)}</td>
        <td style="${cell}${border}color:${color};${weight}text-align:right;white-space:nowrap;">${escapeHtml(row.value)}</td>
      </tr>`;
    })
    .join("");

  const meta = `<p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:${C.muted};">
      ${escapeHtml(s.reference)} <strong style="color:${C.body};">${escapeHtml(r.reference)}</strong>
      &nbsp;·&nbsp; ${escapeHtml(s.date)} ${escapeHtml(formatDate(r.paidAt, loc))}
    </p>`;

  const address = addressLines(r);
  const addressHtml = address.length
    ? `<p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:${C.body};">
        <span style="color:${C.muted};">${escapeHtml(s.shipTo)}</span><br>${address.map(escapeHtml).join("<br>")}
      </p>`
    : "";

  const invoiceHtml = r.invoiceUrl
    ? `<p style="margin:16px 0 0;font-size:14px;"><a href="${escapeHtml(r.invoiceUrl)}" style="color:${C.primary};font-weight:600;text-decoration:underline;">${escapeHtml(s.invoice(r.invoiceNumber ?? null))}</a></p>`
    : "";

  return `<div style="margin:0 0 24px;padding:18px 20px;border:1px solid ${C.border};border-radius:12px;">
    <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:${C.heading};">${escapeHtml(s.title)}</p>
    ${meta}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>
    ${addressHtml}
    ${invoiceHtml}
    <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:${C.muted};">${escapeHtml(s.soldBy)} ${escapeHtml(SELLER_IDENTITY)}</p>
  </div>`;
}

function renderReceiptText(r: OrderReceipt, s: ReceiptStrings, loc: Locale): string {
  const lines = [
    s.title,
    `${s.reference} ${r.reference} · ${s.date} ${formatDate(r.paidAt, loc)}`,
    ...receiptRows(r, s, loc).map((row) => (row.value ? `${row.label}: ${row.value}` : row.label)),
  ];
  const address = addressLines(r);
  if (address.length) lines.push("", `${s.shipTo}:`, ...address);
  if (r.invoiceUrl) lines.push("", `${s.invoice(r.invoiceNumber ?? null)}: ${r.invoiceUrl}`);
  lines.push("", `${s.soldBy} ${SELLER_IDENTITY}`);
  return lines.join("\n");
}

export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

/** Build a localized order-lifecycle email (HTML + text alternative). */
export function buildOrderEmail(event: OrderEmailEvent, ctx: OrderEmailContext): BuiltEmail {
  const loc = resolveLocale(ctx.locale);
  const s = CONTENT[loc];
  const ev = s.events[event];
  const firstName = buyerFirstName(ctx.buyerName);

  // "Ver mi pedido": login with the buyer's email prefilled → code → orders tab.
  const dashboardUrl = orderAccessUrl(getSiteUrl(), loc, ctx.recipientEmail);
  const paragraphs = ev.paragraphs(ctx);

  // CTA: tracking link for shipped / download link for book_ready (if available), otherwise dashboard.
  const cta =
    event === "shipped" && ctx.trackingUrl
      ? { label: s.trackingCta, url: ctx.trackingUrl }
      : event === "book_ready" && ctx.downloadUrl
        ? { label: s.downloadCta, url: ctx.downloadUrl }
        : { label: s.dashboardCta, url: dashboardUrl };

  const isConfirmation = event === "order_confirmed" || event === "order_confirmed_digital";
  const colon = loc === "fr" ? "\u00a0:" : ":";
  const receipt = isConfirmation ? ctx.receipt ?? null : null;
  const infoText =
    event === "shipped" && ctx.trackingNumber
      ? `${s.trackingLabel}${colon} ${ctx.trackingNumber}`
      : isConfirmation
        ? s.withdrawalConfirmation
        : null;
  const infoHtml =
    event === "shipped" && ctx.trackingNumber
      ? `<strong>${s.trackingLabel}${colon}</strong> ${escapeHtml(ctx.trackingNumber)}`
      : infoText
        ? escapeHtml(infoText)
        : undefined;

  const greeting = s.greeting(firstName);
  const html = renderEmailLayout({
    heading: ev.heading,
    greeting: escapeHtml(greeting),
    paragraphs,
    cta,
    detailsHtml: receipt ? renderReceiptHtml(receipt, s.receipt, loc) : undefined,
    infoHtml,
    signoff: s.signoff,
    lang: loc,
  });

  // Text alternative (multipart/alternative): strip the simple tags used in paragraphs.
  const stripTags = (str: string) =>
    str.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const textLines = [greeting, ...paragraphs.map(stripTags), `${cta.label}: ${cta.url}`];
  if (receipt) textLines.push(renderReceiptText(receipt, s.receipt, loc));
  if (infoText) textLines.push(infoText);
  textLines.push("---", s.signoff);

  return {
    subject: ev.subject(ctx),
    html,
    text: textLines.join("\n\n"),
  };
}
