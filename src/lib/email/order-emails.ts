// Localized transactional emails for the physical-book order lifecycle.
//
// Lifecycle (physical order):
//   paid       → order_confirmed   ("we got your order, the book is being prepared")
//   producing  → in_production     ("it's at the print studio")
//   shipped    → shipped           ("it's on its way" + tracking)
//   delivered  → delivered         ("it arrived — enjoy")
//
// Digital order: order_confirmed_digital on payment.
// Every order: book_ready once the final illustrations are done (download link).

import { renderEmailLayout, escapeHtml } from "./layout";
import { getSiteUrl } from "./send";

export type OrderEmailEvent =
  | "order_confirmed"
  | "order_confirmed_digital"
  | "book_ready"
  | "in_production"
  | "shipped"
  | "delivered";

type Locale = "es" | "ca" | "en" | "fr";

const LOCALES: Locale[] = ["es", "ca", "en", "fr"];

export interface OrderEmailContext {
  /** Recipient locale — falls back to "es" if unsupported */
  locale: string;
  /** Child / protagonist name, used to personalize copy */
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
  /** Stripe hosted invoice (order_confirmed*) */
  invoiceUrl?: string | null;
}

interface Strings {
  greeting: (name: string) => string;
  signoff: string;
  dashboardCta: string;
  trackingCta: string;
  trackingLabel: string;
  downloadCta: string;
  /** Durable-medium confirmation of the express consent (art. 98.7 + 103 m LGDCU). */
  withdrawalConfirmation: string;
  invoiceLink: string;
  events: Record<
    OrderEmailEvent,
    { subject: (book: string) => string; heading: string; paragraphs: (ctx: OrderEmailContext) => string[] }
  >;
}

const CONTENT: Record<Locale, Strings> = {
  es: {
    greeting: (n) => `Hola ${n},`,
    signoff: "Con cariño,\nEl equipo de Meapica",
    dashboardCta: "Ver mi pedido",
    trackingCta: "Seguir el envío",
    trackingLabel: "Número de seguimiento",
    downloadCta: "Ver y descargar mi libro",
    withdrawalConfirmation:
      "Como aceptaste antes de pagar, este libro se crea a medida y el PDF se entrega en cuanto está listo, por lo que no tiene derecho de desistimiento (art. 103 c y m de la LGDCU). Si algo llega mal, escríbenos a hola@meapica.com y lo solucionamos.",
    invoiceLink: "Descargar la factura",
    events: {
      order_confirmed_digital: {
        subject: (b) => `Hemos recibido tu pedido — ${b}`,
        heading: "¡Gracias por tu pedido!",
        paragraphs: (c) => [
          `Hemos recibido tu pedido de <strong>${escapeHtml(c.bookTitle)}</strong>, el cuento personalizado de ${escapeHtml(c.childName)}.`,
          "Ahora estamos pintando las ilustraciones finales de cada página. En cuanto el libro esté listo te enviaremos un correo con el enlace para descargarlo.",
        ],
      },
      book_ready: {
        subject: (b) => `Tu libro ya está listo — ${b}`,
        heading: "¡Tu libro está listo!",
        paragraphs: (c) => [
          `Ya hemos terminado de ilustrar <strong>${escapeHtml(c.bookTitle)}</strong>, el cuento de ${escapeHtml(c.childName)}.`,
          c.isPhysical
            ? "Puedes verlo y descargarlo en PDF con el botón de abajo. La versión impresa pasa ahora a imprenta y te avisaremos cuando salga."
            : "Puedes verlo y descargarlo en PDF con el botón de abajo, siempre que quieras.",
        ],
      },
      order_confirmed: {
        subject: (b) => `Hemos recibido tu pedido — ${b}`,
        heading: "¡Gracias por tu pedido!",
        paragraphs: (c) => [
          `Hemos recibido tu pedido de <strong>${escapeHtml(c.bookTitle)}</strong>, el cuento personalizado de ${escapeHtml(c.childName)}.`,
          "Ahora preparamos cada página con todo el detalle antes de enviarlo a imprenta. Te avisaremos en cada paso del camino.",
        ],
      },
      in_production: {
        subject: (b) => `Tu libro ya se está imprimiendo — ${b}`,
        heading: "Tu libro está en la imprenta",
        paragraphs: (c) => [
          `Buenas noticias: <strong>${escapeHtml(c.bookTitle)}</strong> ya está en producción.`,
          "Nuestro estudio de impresión lo está creando con papel de alta calidad y encuadernación profesional. En cuanto salga de imprenta y se envíe, te mandaremos el número de seguimiento.",
        ],
      },
      shipped: {
        subject: (b) => `¡Tu libro va en camino! — ${b}`,
        heading: "Tu libro está en camino",
        paragraphs: (c) => [
          `<strong>${escapeHtml(c.bookTitle)}</strong> ya ha salido de la imprenta y viaja hacia ti.`,
          `Pronto ${escapeHtml(c.childName)} tendrá su propio cuento entre las manos. Puedes seguir el envío en tiempo real con el botón de abajo.`,
        ],
      },
      delivered: {
        subject: (b) => `Tu libro ya ha llegado — ${b}`,
        heading: "¡Tu libro ha llegado!",
        paragraphs: (c) => [
          `<strong>${escapeHtml(c.bookTitle)}</strong> ya ha sido entregado. Esperamos que a ${escapeHtml(c.childName)} le encante leerlo una y otra vez.`,
          "Si te ha hecho ilusión, nos encantaría que compartieras una foto o crearas otro cuento para una nueva aventura.",
        ],
      },
    },
  },
  ca: {
    greeting: (n) => `Hola ${n},`,
    signoff: "Amb afecte,\nL'equip de Meapica",
    dashboardCta: "Veure la meva comanda",
    trackingCta: "Seguir l'enviament",
    trackingLabel: "Número de seguiment",
    downloadCta: "Veure i descarregar el meu llibre",
    withdrawalConfirmation:
      "Com vas acceptar abans de pagar, aquest llibre es crea a mida i el PDF s'entrega quan està llest, per això no té dret de desistiment (art. 103 c i m de la LGDCU). Si alguna cosa arriba malament, escriu-nos a hola@meapica.com i ho solucionem.",
    invoiceLink: "Descarregar la factura",
    events: {
      order_confirmed_digital: {
        subject: (b) => `Hem rebut la teva comanda — ${b}`,
        heading: "Gràcies per la teva comanda!",
        paragraphs: (c) => [
          `Hem rebut la teva comanda de <strong>${escapeHtml(c.bookTitle)}</strong>, el conte personalitzat de ${escapeHtml(c.childName)}.`,
          "Ara estem pintant les il·lustracions finals de cada pàgina. Quan el llibre estigui llest t'enviarem un correu amb l'enllaç per descarregar-lo.",
        ],
      },
      book_ready: {
        subject: (b) => `El teu llibre ja està llest — ${b}`,
        heading: "El teu llibre ja està llest!",
        paragraphs: (c) => [
          `Ja hem acabat d'il·lustrar <strong>${escapeHtml(c.bookTitle)}</strong>, el conte de ${escapeHtml(c.childName)}.`,
          c.isPhysical
            ? "Pots veure'l i descarregar-lo en PDF amb el botó de sota. La versió impresa passa ara a impremta i t'avisarem quan surti."
            : "Pots veure'l i descarregar-lo en PDF amb el botó de sota, sempre que vulguis.",
        ],
      },
      order_confirmed: {
        subject: (b) => `Hem rebut la teva comanda — ${b}`,
        heading: "Gràcies per la teva comanda!",
        paragraphs: (c) => [
          `Hem rebut la teva comanda de <strong>${escapeHtml(c.bookTitle)}</strong>, el conte personalitzat de ${escapeHtml(c.childName)}.`,
          "Ara preparem cada pàgina amb tot el detall abans d'enviar-lo a impremta. T'avisarem a cada pas del camí.",
        ],
      },
      in_production: {
        subject: (b) => `El teu llibre ja s'està imprimint — ${b}`,
        heading: "El teu llibre és a la impremta",
        paragraphs: (c) => [
          `Bones notícies: <strong>${escapeHtml(c.bookTitle)}</strong> ja està en producció.`,
          "El nostre estudi d'impressió l'està creant amb paper d'alta qualitat i enquadernació professional. Quan surti d'impremta i s'enviï, t'enviarem el número de seguiment.",
        ],
      },
      shipped: {
        subject: (b) => `El teu llibre va de camí! — ${b}`,
        heading: "El teu llibre està en camí",
        paragraphs: (c) => [
          `<strong>${escapeHtml(c.bookTitle)}</strong> ja ha sortit de la impremta i viatja cap a tu.`,
          `Aviat ${escapeHtml(c.childName)} tindrà el seu propi conte a les mans. Pots seguir l'enviament en temps real amb el botó de sota.`,
        ],
      },
      delivered: {
        subject: (b) => `El teu llibre ja ha arribat — ${b}`,
        heading: "El teu llibre ha arribat!",
        paragraphs: (c) => [
          `<strong>${escapeHtml(c.bookTitle)}</strong> ja s'ha entregat. Esperem que a ${escapeHtml(c.childName)} li encanti llegir-lo una vegada i una altra.`,
          "Si t'ha fet il·lusió, ens encantaria que compartissis una foto o que creessis un altre conte per a una nova aventura.",
        ],
      },
    },
  },
  en: {
    greeting: (n) => `Hi ${n},`,
    signoff: "With love,\nThe Meapica team",
    dashboardCta: "View my order",
    trackingCta: "Track shipment",
    trackingLabel: "Tracking number",
    downloadCta: "View & download my book",
    withdrawalConfirmation:
      "As you accepted before paying, this book is made to order and the PDF is delivered as soon as it is ready, so it carries no right of withdrawal (art. 103 c and m, Spanish consumer law). If anything arrives wrong, write to hola@meapica.com and we will fix it.",
    invoiceLink: "Download the invoice",
    events: {
      order_confirmed_digital: {
        subject: (b) => `We've received your order — ${b}`,
        heading: "Thank you for your order!",
        paragraphs: (c) => [
          `We've received your order for <strong>${escapeHtml(c.bookTitle)}</strong>, ${escapeHtml(c.childName)}'s personalized storybook.`,
          "We're now painting the final illustrations for every page. As soon as the book is ready we'll email you a link to download it.",
        ],
      },
      book_ready: {
        subject: (b) => `Your book is ready — ${b}`,
        heading: "Your book is ready!",
        paragraphs: (c) => [
          `We've finished illustrating <strong>${escapeHtml(c.bookTitle)}</strong>, ${escapeHtml(c.childName)}'s story.`,
          c.isPhysical
            ? "You can view and download the PDF with the button below. The printed edition now goes to print and we'll let you know when it ships."
            : "You can view and download the PDF with the button below, whenever you like.",
        ],
      },
      order_confirmed: {
        subject: (b) => `We've received your order — ${b}`,
        heading: "Thank you for your order!",
        paragraphs: (c) => [
          `We've received your order for <strong>${escapeHtml(c.bookTitle)}</strong>, ${escapeHtml(c.childName)}'s personalized storybook.`,
          "We're now preparing every page with care before sending it to print. We'll keep you posted at each step.",
        ],
      },
      in_production: {
        subject: (b) => `Your book is being printed — ${b}`,
        heading: "Your book is at the print studio",
        paragraphs: (c) => [
          `Good news: <strong>${escapeHtml(c.bookTitle)}</strong> is now in production.`,
          "Our print studio is crafting it with high-quality paper and professional binding. As soon as it ships, we'll send you the tracking number.",
        ],
      },
      shipped: {
        subject: (b) => `Your book is on its way! — ${b}`,
        heading: "Your book is on its way",
        paragraphs: (c) => [
          `<strong>${escapeHtml(c.bookTitle)}</strong> has left the print studio and is heading your way.`,
          `Soon ${escapeHtml(c.childName)} will be holding their very own storybook. You can follow the shipment in real time with the button below.`,
        ],
      },
      delivered: {
        subject: (b) => `Your book has arrived — ${b}`,
        heading: "Your book has arrived!",
        paragraphs: (c) => [
          `<strong>${escapeHtml(c.bookTitle)}</strong> has been delivered. We hope ${escapeHtml(c.childName)} loves reading it again and again.`,
          "If it made you smile, we'd love for you to share a photo or create another story for a brand-new adventure.",
        ],
      },
    },
  },
  fr: {
    greeting: (n) => `Bonjour ${n},`,
    signoff: "Avec amour,\nL'équipe Meapica",
    dashboardCta: "Voir ma commande",
    trackingCta: "Suivre l'envoi",
    trackingLabel: "Numéro de suivi",
    downloadCta: "Voir et télécharger mon livre",
    withdrawalConfirmation:
      "Comme vous l'avez accepté avant de payer, ce livre est fabriqué sur mesure et le PDF est livré dès qu'il est prêt : il n'ouvre donc pas de droit de rétractation (art. 103 c et m, droit espagnol de la consommation). Si quelque chose arrive abîmé, écrivez-nous à hola@meapica.com et nous le réglerons.",
    invoiceLink: "Télécharger la facture",
    events: {
      order_confirmed_digital: {
        subject: (b) => `Nous avons reçu votre commande — ${b}`,
        heading: "Merci pour votre commande !",
        paragraphs: (c) => [
          `Nous avons reçu votre commande de <strong>${escapeHtml(c.bookTitle)}</strong>, le livre personnalisé de ${escapeHtml(c.childName)}.`,
          "Nous peignons maintenant les illustrations finales de chaque page. Dès que le livre sera prêt, nous vous enverrons un e-mail avec le lien de téléchargement.",
        ],
      },
      book_ready: {
        subject: (b) => `Votre livre est prêt — ${b}`,
        heading: "Votre livre est prêt !",
        paragraphs: (c) => [
          `Nous avons terminé d'illustrer <strong>${escapeHtml(c.bookTitle)}</strong>, l'histoire de ${escapeHtml(c.childName)}.`,
          c.isPhysical
            ? "Vous pouvez le consulter et le télécharger en PDF avec le bouton ci-dessous. La version imprimée part maintenant à l'impression et nous vous préviendrons dès son expédition."
            : "Vous pouvez le consulter et le télécharger en PDF avec le bouton ci-dessous, quand vous le souhaitez.",
        ],
      },
      order_confirmed: {
        subject: (b) => `Nous avons reçu votre commande — ${b}`,
        heading: "Merci pour votre commande !",
        paragraphs: (c) => [
          `Nous avons reçu votre commande de <strong>${escapeHtml(c.bookTitle)}</strong>, le livre personnalisé de ${escapeHtml(c.childName)}.`,
          "Nous préparons maintenant chaque page avec soin avant de l'envoyer à l'impression. Nous vous tiendrons informé à chaque étape.",
        ],
      },
      in_production: {
        subject: (b) => `Votre livre est en cours d'impression — ${b}`,
        heading: "Votre livre est à l'atelier d'impression",
        paragraphs: (c) => [
          `Bonne nouvelle : <strong>${escapeHtml(c.bookTitle)}</strong> est désormais en production.`,
          "Notre atelier le crée avec un papier de haute qualité et une reliure professionnelle. Dès qu'il sera expédié, nous vous enverrons le numéro de suivi.",
        ],
      },
      shipped: {
        subject: (b) => `Votre livre est en route ! — ${b}`,
        heading: "Votre livre est en route",
        paragraphs: (c) => [
          `<strong>${escapeHtml(c.bookTitle)}</strong> a quitté l'atelier et arrive vers vous.`,
          `Bientôt, ${escapeHtml(c.childName)} tiendra son propre livre entre ses mains. Vous pouvez suivre l'envoi en temps réel avec le bouton ci-dessous.`,
        ],
      },
      delivered: {
        subject: (b) => `Votre livre est arrivé — ${b}`,
        heading: "Votre livre est arrivé !",
        paragraphs: (c) => [
          `<strong>${escapeHtml(c.bookTitle)}</strong> a été livré. Nous espérons que ${escapeHtml(c.childName)} adorera le lire encore et encore.`,
          "S'il vous a plu, nous serions ravis que vous partagiez une photo ou que vous créiez une autre histoire pour une nouvelle aventure.",
        ],
      },
    },
  },
};

function resolveLocale(locale: string): Locale {
  return (LOCALES.includes(locale as Locale) ? locale : "es") as Locale;
}

export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Build a localized order-lifecycle email.
 * For the "shipped" event a tracking CTA/info block is added when a tracking URL/number exists.
 */
export function buildOrderEmail(event: OrderEmailEvent, ctx: OrderEmailContext): BuiltEmail {
  const loc = resolveLocale(ctx.locale);
  const s = CONTENT[loc];
  const ev = s.events[event];

  const dashboardUrl = `${getSiteUrl()}/${loc}/dashboard`;
  const paragraphs = ev.paragraphs(ctx);

  // CTA: tracking link for shipped / download link for book_ready (if available), otherwise dashboard.
  const cta =
    event === "shipped" && ctx.trackingUrl
      ? { label: s.trackingCta, url: ctx.trackingUrl }
      : event === "book_ready" && ctx.downloadUrl
        ? { label: s.downloadCta, url: ctx.downloadUrl }
        : { label: s.dashboardCta, url: dashboardUrl };

  // Info block: tracking number (shipped) / consent confirmation + invoice (order confirmed).
  const isConfirmation = event === "order_confirmed" || event === "order_confirmed_digital";
  const infoHtml =
    event === "shipped" && ctx.trackingNumber
      ? `<strong>${s.trackingLabel}:</strong> ${escapeHtml(ctx.trackingNumber)}`
      : isConfirmation
        ? escapeHtml(s.withdrawalConfirmation) +
          (ctx.invoiceUrl ? `<br><br><a href="${escapeHtml(ctx.invoiceUrl)}">${s.invoiceLink}</a>` : "")
        : undefined;

  const html = renderEmailLayout({
    heading: ev.heading,
    greeting: s.greeting(escapeHtml(ctx.childName)),
    paragraphs,
    cta,
    infoHtml,
    signoff: s.signoff,
    lang: loc,
  });

  // Plain-text fallback — strip simple tags from paragraphs.
  const stripTags = (str: string) => str.replace(/<[^>]+>/g, "");
  const textLines = [
    s.greeting(ctx.childName),
    ...paragraphs.map(stripTags),
  ];
  if (isConfirmation) {
    textLines.push(s.withdrawalConfirmation);
    if (ctx.invoiceUrl) textLines.push(`${s.invoiceLink}: ${ctx.invoiceUrl}`);
  } else if (infoHtml) {
    textLines.push(stripTags(infoHtml));
  }
  textLines.push(`${cta.label}: ${cta.url}`, "---", s.signoff);

  return {
    subject: ev.subject(ctx.bookTitle),
    html,
    text: textLines.join("\n\n"),
  };
}
