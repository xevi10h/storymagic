// "PDF → papel" reminder: the one commercial email Meapica sends on its own (es / ca / en / fr).
//
// Sent once per PDF order, 7 days after book_ready (cron /api/cron/upsell-reminders,
// eligibility in src/lib/upsell.ts). LSSI: it is only sent to buyers who were offered the
// opt-out at checkout and did not tick it (art. 21.2), it is identifiable as an offer and
// names who sends it (art. 20.1: "Oferta" kicker + seller identity in the footer), and it
// carries an unsubscribe link plus a valid address to object (art. 21.2 / 22.1). The
// List-Unsubscribe headers (RFC 8058) are added by the sender.
// Voice: warm, direct, short paragraphs, no em-dashes (owner's canonical email voice).

import { escapeHtml, renderEmailLayout } from "./layout";
import { getSiteUrl } from "./send";
import { buyerFirstName, type BuiltEmail } from "./order-emails";
import { orderAccessUrl } from "@/lib/auth/next-path";
import { formatPrice, offerPrice, SELLER_IDENTITY, STRIPE_CATALOG } from "@/lib/pricing";
import { SUPPORT_EMAIL } from "@/lib/support";

type Locale = "es" | "ca" | "en" | "fr";
const LOCALES: readonly Locale[] = ["es", "ca", "en", "fr"];

export interface UpgradeReminderContext {
  locale: string;
  buyerName?: string | null;
  childName: string;
  bookTitle: string;
  /** Recipient (prefilled on the login behind the CTA). */
  recipientEmail: string;
  /** Unsubscribe page for the recipient (required: no link, no email). */
  unsubscribeUrl: string;
}

interface Prices {
  hardcover: string;
  softcover: string;
  pdf: string;
}

interface ReminderStrings {
  kicker: string;
  greeting: (firstName: string | null) => string;
  subject: (name: string) => string;
  heading: (name: string) => string;
  paragraphs: (p: Prices & { title: string; name: string }) => string[];
  cta: string;
  signoff: string;
  /** Why we write + who we are + how to stop (footer small print). */
  footer: (p: { seller: string; unsubscribe: string; mailbox: string }) => string;
  unsubscribe: string;
}

const CONTENT: Record<Locale, ReminderStrings> = {
  es: {
    kicker: "Oferta",
    greeting: (n) => (n ? `Hola ${n},` : "Hola,"),
    subject: (name) => (name ? `¿Y si ${name} tuviera su cuento en papel?` : "¿Y si tuvierais el cuento en papel?"),
    heading: (name) => (name ? `El cuento de ${name}, en papel` : "Vuestro cuento, en papel"),
    paragraphs: (p) => [
      p.name
        ? `Hace unos días te mandamos ${p.title}, el cuento de ${p.name}. Ojalá ya lo hayáis leído más de una vez.`
        : `Hace unos días te mandamos ${p.title}. Ojalá ya lo hayáis leído más de una vez.`,
      `Si te apetece tenerlo en papel, lo imprimimos en tapa dura por <strong>${p.hardcover} IVA incluido</strong>: te descontamos los ${p.pdf} del PDF. En tapa blanda sale por ${p.softcover} IVA incluido. El envío es gratis.`,
      "Es el mismo cuento con las mismas ilustraciones. Lo pides desde tus pedidos cuando quieras, la oferta no caduca.",
    ],
    cta: "Pedirlo impreso",
    signoff: "Un abrazo,\nEl equipo de Meapica",
    footer: (p) =>
      `Te escribimos porque compraste este cuento en PDF. Es una oferta comercial de ${p.seller}. Si no quieres recibir más ofertas, ${p.unsubscribe} o escríbenos a ${p.mailbox}.`,
    unsubscribe: "date de baja aquí",
  },
  ca: {
    kicker: "Oferta",
    greeting: (n) => (n ? `Hola ${n},` : "Hola,"),
    subject: (name) => (name ? `I si ${name} tingués el seu conte en paper?` : "I si tinguéssiu el conte en paper?"),
    heading: (name) => (name ? `El conte de ${name}, en paper` : "El vostre conte, en paper"),
    paragraphs: (p) => [
      p.name
        ? `Fa uns dies et vam enviar ${p.title}, el conte de ${p.name}. Tant de bo ja l'hàgiu llegit més d'una vegada.`
        : `Fa uns dies et vam enviar ${p.title}. Tant de bo ja l'hàgiu llegit més d'una vegada.`,
      `Si et ve de gust tenir-lo en paper, l'imprimim en tapa dura per <strong>${p.hardcover} IVA inclòs</strong>: et descomptem els ${p.pdf} del PDF. En tapa tova surt per ${p.softcover} IVA inclòs. L'enviament és gratuït.`,
      "És el mateix conte amb les mateixes il·lustracions. El demanes des de les teves comandes quan vulguis, l'oferta no caduca.",
    ],
    cta: "Demanar-lo imprès",
    signoff: "Una abraçada,\nL'equip de Meapica",
    footer: (p) =>
      `T'escrivim perquè vas comprar aquest conte en PDF. És una oferta comercial de ${p.seller}. Si no vols rebre més ofertes, ${p.unsubscribe} o escriu-nos a ${p.mailbox}.`,
    unsubscribe: "dona't de baixa aquí",
  },
  en: {
    kicker: "Offer",
    greeting: (n) => (n ? `Hi ${n},` : "Hi there,"),
    subject: (name) => (name ? `What if ${name} had their story in print?` : "What if you had the story in print?"),
    heading: (name) => (name ? `${name}'s story, in print` : "Your story, in print"),
    paragraphs: (p) => [
      p.name
        ? `A few days ago we sent you ${p.title}, ${p.name}'s story. We hope you've read it together more than once.`
        : `A few days ago we sent you ${p.title}. We hope you've read it together more than once.`,
      `If you'd like it on paper, we print it in hardcover for <strong>${p.hardcover} VAT included</strong>, with the ${p.pdf} you paid for the PDF taken off. Softcover is ${p.softcover} VAT included. Shipping is free.`,
      "Same story, same illustrations. Order it from your orders whenever you like, the offer doesn't expire.",
    ],
    cta: "Order it printed",
    signoff: "Warmly,\nThe Meapica team",
    footer: (p) =>
      `We're writing because you bought this story as a PDF. This is a commercial offer from ${p.seller}. If you'd rather not get offers, ${p.unsubscribe} or write to ${p.mailbox}.`,
    unsubscribe: "unsubscribe here",
  },
  fr: {
    kicker: "Offre",
    greeting: (n) => (n ? `Bonjour ${n},` : "Bonjour,"),
    subject: (name) => (name ? `Et si ${name} avait son histoire sur papier ?` : "Et si vous aviez l'histoire sur papier ?"),
    heading: (name) => (name ? `L'histoire de ${name}, sur papier` : "Votre histoire, sur papier"),
    paragraphs: (p) => [
      p.name
        ? `Il y a quelques jours, nous vous avons envoyé ${p.title}, l'histoire de ${p.name}. Nous espérons que vous l'avez déjà lue plus d'une fois.`
        : `Il y a quelques jours, nous vous avons envoyé ${p.title}. Nous espérons que vous l'avez déjà lue plus d'une fois.`,
      `Si vous souhaitez l'avoir sur papier, nous l'imprimons en couverture rigide à <strong>${p.hardcover} TVA incluse</strong> : nous déduisons les ${p.pdf} du PDF. En couverture souple, il est à ${p.softcover} TVA incluse. La livraison est offerte.`,
      "C'est la même histoire avec les mêmes illustrations. Commandez-le depuis vos commandes quand vous le souhaitez, l'offre n'expire pas.",
    ],
    cta: "Le commander imprimé",
    signoff: "Bien à vous,\nL'équipe Meapica",
    footer: (p) =>
      `Nous vous écrivons parce que vous avez acheté cette histoire en PDF. Ceci est une offre commerciale de ${p.seller}. Si vous ne souhaitez plus recevoir d'offres, ${p.unsubscribe} ou écrivez-nous à ${p.mailbox}.`,
    unsubscribe: "désabonnez-vous ici",
  },
};

function resolveLocale(locale: string): Locale {
  return (LOCALES as readonly string[]).includes(locale) ? (locale as Locale) : "es";
}

/** Build the reminder (HTML + text). The caller adds the List-Unsubscribe headers. */
export function buildUpgradeReminderEmail(ctx: UpgradeReminderContext): BuiltEmail {
  const loc = resolveLocale(ctx.locale);
  const s = CONTENT[loc];
  const name = ctx.childName.trim();
  const prices: Prices = {
    hardcover: formatPrice(offerPrice("pdf_upgrade", "hardcover"), loc),
    softcover: formatPrice(offerPrice("pdf_upgrade", "softcover"), loc),
    pdf: formatPrice(STRIPE_CATALOG.digital_pdf.amount, loc),
  };
  const greeting = s.greeting(buyerFirstName(ctx.buyerName));
  const ctaUrl = orderAccessUrl(getSiteUrl(), loc, ctx.recipientEmail);

  const paragraphsHtml = s.paragraphs({
    ...prices,
    title: `<strong>${escapeHtml(ctx.bookTitle)}</strong>`,
    name: escapeHtml(name),
  });
  const paragraphsText = s.paragraphs({ ...prices, title: ctx.bookTitle, name }).map((p) => p.replace(/<\/?strong>/g, ""));

  const footerHtml = s.footer({
    seller: escapeHtml(SELLER_IDENTITY),
    unsubscribe: `<a href="${escapeHtml(ctx.unsubscribeUrl)}" style="color:inherit;text-decoration:underline;">${escapeHtml(s.unsubscribe)}</a>`,
    mailbox: `<a href="mailto:${SUPPORT_EMAIL}" style="color:inherit;text-decoration:underline;">${SUPPORT_EMAIL}</a>`,
  });
  const footerText = s.footer({ seller: SELLER_IDENTITY, unsubscribe: `${s.unsubscribe} (${ctx.unsubscribeUrl})`, mailbox: SUPPORT_EMAIL });

  const html = renderEmailLayout({
    kicker: escapeHtml(s.kicker),
    heading: escapeHtml(s.heading(name)),
    greeting: escapeHtml(greeting),
    paragraphs: paragraphsHtml,
    cta: { label: escapeHtml(s.cta), url: ctaUrl },
    signoff: s.signoff,
    lang: loc,
    footerNoteHtml: footerHtml,
  });

  const text = [
    `${s.kicker.toUpperCase()}`,
    greeting,
    ...paragraphsText,
    `${s.cta}: ${ctaUrl}`,
    "---",
    s.signoff,
    footerText,
  ].join("\n\n");

  return { subject: s.subject(name), html, text, commercial: true };
}
