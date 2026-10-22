// Reyes deadline reminder (es / ca): the ONE email promised by the "Avísame antes de la
// fecha límite de Reyes" opt-in of the free printables (/tools/*, es/ca only), sent a few
// days before the last day to order a printed book that arrives for Reyes (cron
// /api/cron/reyes-reminders, window in src/lib/shipping.ts › reyesReminderWindow).
//
// Legal: explicit consent for this reminder only (RGPD 6.1.a, LSSI 21.1). It is a commercial
// communication: labelled (kicker + footer), names the seller, says why we write and carries
// an unsubscribe link plus a mailbox; the sender adds the List-Unsubscribe headers (RFC 8058).
// Prices are VAT- and shipping-inclusive (B2C). Voice: warm, direct, short, no em-dashes.

import { escapeHtml, renderEmailLayout } from "./layout";
import type { BuiltEmail } from "./order-emails";
import { formatPrice, PRICING, SELLER_IDENTITY } from "@/lib/pricing";
import { SUPPORT_EMAIL } from "@/lib/support";

type Locale = "es" | "ca";

export interface ReyesReminderContext {
  locale: string;
  /** Last day to order a printed book for Reyes (YYYY-MM-DD). */
  cutoff: string;
  /** Book creation page for the recipient's locale. */
  createUrl: string;
  /** Unsubscribe page for the recipient (required: no link, no email). */
  unsubscribeUrl: string;
}

interface Strings {
  kicker: string;
  subject: (date: string) => string;
  heading: string;
  paragraphs: (p: { date: string; from: string }) => string[];
  cta: string;
  signoff: string;
  footer: (p: { seller: string; unsubscribe: string; mailbox: string }) => string;
  unsubscribe: string;
  dateLocale: string;
}

const CONTENT: Record<Locale, Strings> = {
  es: {
    kicker: "Recordatorio de Reyes",
    subject: (date) => `Hasta el ${date} para que su cuento llegue a Reyes`,
    heading: "Su cuento todavía llega a Reyes",
    paragraphs: (p) => [
      "Nos pediste que te avisáramos antes de la fecha límite de Reyes, y aquí estamos.",
      `Si pides el cuento impreso como muy tarde el <strong>${p.date}</strong>, llega a casa a tiempo para Reyes (península y Baleares).`,
      `Lo creas en unos minutos con su nombre y ves las primeras páginas gratis antes de pagar. Impreso desde ${p.from}, IVA y envío incluidos.`,
    ],
    cta: "Crear su cuento",
    signoff: "Un abrazo,\nEl equipo de Meapica",
    footer: (p) =>
      `Te escribimos una sola vez porque, al descargar una plantilla gratuita de Reyes, marcaste que te avisáramos antes de la fecha límite. Es una comunicación comercial de ${p.seller}. Si no quieres recibir correos así, ${p.unsubscribe} o escríbenos a ${p.mailbox}.`,
    unsubscribe: "date de baja aquí",
    dateLocale: "es-ES",
  },
  ca: {
    kicker: "Recordatori de Reis",
    subject: (date) => `Fins al ${date} perquè el seu conte arribi per Reis`,
    heading: "El seu conte encara arriba per Reis",
    paragraphs: (p) => [
      "Ens vas demanar que t'avisàssim abans de la data límit de Reis, i aquí ens tens.",
      `Si demanes el conte imprès com a molt tard el <strong>${p.date}</strong>, arriba a casa a temps per Reis (península i Balears).`,
      `El crees en pocs minuts amb el seu nom i en veus les primeres pàgines gratis abans de pagar. Imprès des de ${p.from}, IVA i enviament inclosos.`,
    ],
    cta: "Crear el seu conte",
    signoff: "Una abraçada,\nL'equip de Meapica",
    footer: (p) =>
      `T'escrivim una sola vegada perquè, en descarregar una plantilla gratuïta de Reis, vas marcar que t'avisàssim abans de la data límit. És una comunicació comercial de ${p.seller}. Si no vols rebre correus com aquest, ${p.unsubscribe} o escriu-nos a ${p.mailbox}.`,
    unsubscribe: "dona't de baixa aquí",
    dateLocale: "ca-ES",
  },
};

const stripStrong = (s: string) => s.replace(/<\/?strong>/g, "");

/** Build the reminder (HTML + text). The caller adds the List-Unsubscribe headers. */
export function buildReyesReminderEmail(ctx: ReyesReminderContext): BuiltEmail {
  const loc: Locale = ctx.locale === "ca" ? "ca" : "es";
  const s = CONTENT[loc];
  const date = new Intl.DateTimeFormat(s.dateLocale, { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${ctx.cutoff}T00:00:00Z`));
  const from = formatPrice(PRICING.softcover.price, loc);
  const paragraphs = s.paragraphs({ date, from });

  const footerHtml = s.footer({
    seller: escapeHtml(SELLER_IDENTITY),
    unsubscribe: `<a href="${escapeHtml(ctx.unsubscribeUrl)}" style="color:inherit;text-decoration:underline;">${escapeHtml(s.unsubscribe)}</a>`,
    mailbox: `<a href="mailto:${SUPPORT_EMAIL}" style="color:inherit;text-decoration:underline;">${SUPPORT_EMAIL}</a>`,
  });
  const footerText = s.footer({ seller: SELLER_IDENTITY, unsubscribe: `${s.unsubscribe} (${ctx.unsubscribeUrl})`, mailbox: SUPPORT_EMAIL });

  return {
    subject: s.subject(date),
    html: renderEmailLayout({
      kicker: escapeHtml(s.kicker),
      heading: escapeHtml(s.heading),
      // Only our own copy (date, price) goes in: the <strong> is ours, nothing user-provided.
      paragraphs,
      cta: { label: escapeHtml(s.cta), url: ctx.createUrl },
      signoff: s.signoff,
      lang: loc,
      footerNoteHtml: footerHtml,
    }),
    text: [s.heading, ...paragraphs.map(stripStrong), `${s.cta}: ${ctx.createUrl}`, "---", s.signoff, footerText].join("\n\n"),
    commercial: true,
  };
}
