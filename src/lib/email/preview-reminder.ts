// Abandoned-preview reminders (es / ca / en / fr): up to three emails about a book the
// parent previewed but did not buy, sent 1 h, 24 h and 72 h after they asked for them.
//
// Legal (LSSI art. 20-22 + RGPD art. 6.1.a): only sent with the express consent recorded
// in preview_reminders (unticked checkbox beside the "send me the preview" field); each
// email is identifiable as a commercial message from the seller (kicker + footer), says
// why the recipient gets it and carries an unsubscribe link plus a valid address to
// object. The List-Unsubscribe headers (RFC 8058) are added by the sender.
// Voice: warm, direct, short paragraphs, no em-dashes (owner's canonical email voice).
// Schedule and stop rules: src/lib/marketing/preview-reminder-schedule.ts.

import { escapeHtml, renderEmailLayout } from "./layout";
import type { BuiltEmail } from "./order-emails";
import { deName, type NameGender } from "@/lib/name-grammar";
import { formatPrice, PRICING, SELLER_IDENTITY } from "@/lib/pricing";
import { SUPPORT_EMAIL } from "@/lib/support";
import type { ReminderStage } from "@/lib/marketing/preview-reminder-schedule";
import type { NextCutoff, SeasonOccasion } from "@/lib/shipping";

type Locale = "es" | "ca" | "en" | "fr";
const LOCALES: readonly Locale[] = ["es", "ca", "en", "fr"];

/** A printed-book cut-off is only quoted this close to it (no "order before 10 December" in March). */
export const DEADLINE_HORIZON_DAYS = 75;

/** What the email says about arriving on time (from src/lib/shipping.ts). */
export type ReminderDeadline =
  | { kind: "printed"; occasion: SeasonOccasion; lastOrderDate: string; daysLeft: number }
  /** Printed cut-offs are over but the gift day is not: the PDF still arrives in time. */
  | { kind: "pdf_only"; occasion: SeasonOccasion }
  | null;

/** The deadline to quote today: the nearest open printed cut-off, or the PDF once they are all closed. */
export function reminderDeadline(next: NextCutoff | null, inGiftSeason: boolean, occasionIfClosed: SeasonOccasion): ReminderDeadline {
  if (next) return next.daysLeft <= DEADLINE_HORIZON_DAYS ? { kind: "printed", ...next } : null;
  return inGiftSeason ? { kind: "pdf_only", occasion: occasionIfClosed } : null;
}

export interface PreviewReminderContext {
  locale: string;
  stage: ReminderStage;
  /** Already reduced to letters (mailSafeName): it goes to an address the user typed. */
  childName: string;
  childGender?: NameGender;
  /** Read-only share link of the preview (the owner is redirected to the full preview). */
  previewUrl: string;
  /** Cover image for the email (null = no picture). */
  coverUrl: string | null;
  deadline: ReminderDeadline;
  /** Unsubscribe page for the recipient (required: no link, no email). */
  unsubscribeUrl: string;
}

interface StageCopy {
  subject: (p: Names) => string;
  heading: (p: Names) => string;
  paragraphs: (p: Names & Prices) => string[];
}

interface Names {
  name: string;
  /** "de Lucía" / "d'Olívia" / "de la Noa" (bare name in English). */
  deName: string;
}

interface Prices {
  pdf: string;
  softcover: string;
  hardcover: string;
}

interface ReminderStrings {
  kicker: string;
  stages: Record<ReminderStage, StageCopy>;
  occasion: Record<SeasonOccasion, string>;
  deadlinePrinted: (p: { occasion: string; date: string }) => string;
  deadlinePdf: (p: { occasion: string }) => string;
  cta: string;
  coverAlt: (p: Names) => string;
  signoff: string;
  footer: (p: Names & { seller: string; unsubscribe: string; mailbox: string }) => string;
  unsubscribe: string;
  dateLocale: string;
}

const CONTENT: Record<Locale, ReminderStrings> = {
  es: {
    kicker: "Recordatorio",
    stages: {
      1: {
        subject: (p) => `El cuento ${p.deName} sigue aquí`,
        heading: (p) => `El cuento ${p.deName} te espera`,
        paragraphs: () => [
          "Lo hemos guardado tal como lo dejaste, con su portada y sus primeras páginas. Puedes volver a verlo cuando quieras y enseñárselo a quien quieras.",
        ],
      },
      2: {
        subject: (p) => `¿Cómo acaba el cuento ${p.deName}?`,
        heading: (p) => `¿Cómo acaba el cuento ${p.deName}?`,
        paragraphs: (p) => [
          "En la vista previa has visto el principio. El cuento completo sigue la aventura hasta el final, con todas sus ilustraciones.",
          `Lo tienes en PDF por ${p.pdf} IVA incluido, y también impreso: tapa blanda por ${p.softcover} o tapa dura por ${p.hardcover}, IVA y envío incluidos.`,
        ],
      },
      3: {
        subject: (p) => `Último aviso sobre el cuento ${p.deName}`,
        heading: (p) => `El cuento ${p.deName}, por última vez`,
        paragraphs: () => [
          "Este es el último correo que te mandamos sobre este cuento. La vista previa sigue disponible unos días más, por si quieres terminarlo.",
        ],
      },
    },
    occasion: { christmas: "Nochebuena", reyes: "Reyes" },
    deadlinePrinted: (p) =>
      `Si es un regalo para ${p.occasion}, pide el libro impreso antes del <strong>${p.date}</strong> para que llegue a tiempo (península y Baleares). El PDF llega por correo tras el pago.`,
    deadlinePdf: (p) => `El libro impreso ya no llega a tiempo para ${p.occasion}, pero el PDF sí: te llega por correo tras el pago.`,
    cta: "Ver su cuento",
    coverAlt: (p) => `Portada del cuento ${p.deName}`,
    signoff: "Un abrazo,\nEl equipo de Meapica",
    footer: (p) =>
      `Te escribimos porque, al pedirnos la vista previa del cuento ${p.deName}, marcaste que te lo recordáramos por email. Es una comunicación comercial de ${p.seller}. Si no quieres recibir más correos así, ${p.unsubscribe} o escríbenos a ${p.mailbox}.`,
    unsubscribe: "date de baja aquí",
    dateLocale: "es-ES",
  },
  ca: {
    kicker: "Recordatori",
    stages: {
      1: {
        subject: (p) => `El conte ${p.deName} continua aquí`,
        heading: (p) => `El conte ${p.deName} t'espera`,
        paragraphs: () => [
          "L'hem desat tal com el vas deixar, amb la portada i les primeres pàgines. El pots tornar a mirar quan vulguis i ensenyar-lo a qui vulguis.",
        ],
      },
      2: {
        subject: (p) => `Com acaba el conte ${p.deName}?`,
        heading: (p) => `Com acaba el conte ${p.deName}?`,
        paragraphs: (p) => [
          "A la vista prèvia n'has vist el començament. El conte complet segueix l'aventura fins al final, amb totes les il·lustracions.",
          `El tens en PDF per ${p.pdf} IVA inclòs, i també imprès: tapa tova per ${p.softcover} o tapa dura per ${p.hardcover}, IVA i enviament inclosos.`,
        ],
      },
      3: {
        subject: (p) => `Últim avís sobre el conte ${p.deName}`,
        heading: (p) => `El conte ${p.deName}, per última vegada`,
        paragraphs: () => [
          "Aquest és l'últim correu que t'enviem sobre aquest conte. La vista prèvia continua disponible uns dies més, per si el vols acabar.",
        ],
      },
    },
    occasion: { christmas: "la nit de Nadal", reyes: "Reis" },
    deadlinePrinted: (p) =>
      `Si és un regal per a ${p.occasion}, demana el llibre imprès abans del <strong>${p.date}</strong> perquè arribi a temps (península i Balears). El PDF arriba per correu després del pagament.`,
    deadlinePdf: (p) => `El llibre imprès ja no arriba a temps per a ${p.occasion}, però el PDF sí: t'arriba per correu després del pagament.`,
    cta: "Veure el seu conte",
    coverAlt: (p) => `Portada del conte ${p.deName}`,
    signoff: "Una abraçada,\nL'equip de Meapica",
    footer: (p) =>
      `T'escrivim perquè, quan ens vas demanar la vista prèvia del conte ${p.deName}, vas marcar que te'l recordéssim per correu. És una comunicació comercial de ${p.seller}. Si no vols rebre més correus com aquest, ${p.unsubscribe} o escriu-nos a ${p.mailbox}.`,
    unsubscribe: "dona't de baixa aquí",
    dateLocale: "ca-ES",
  },
  en: {
    kicker: "Reminder",
    stages: {
      1: {
        subject: (p) => `${p.name}'s story is still here`,
        heading: (p) => `${p.name}'s story is waiting for you`,
        paragraphs: () => [
          "We've kept it just as you left it, with its cover and first pages. You can come back to it whenever you like and show it to anyone you like.",
        ],
      },
      2: {
        subject: (p) => `How does ${p.name}'s story end?`,
        heading: (p) => `How does ${p.name}'s story end?`,
        paragraphs: (p) => [
          "The preview shows the beginning. The full story follows the adventure to the end, with all its illustrations.",
          `You can have it as a PDF for ${p.pdf} VAT included, or printed: softcover for ${p.softcover} or hardcover for ${p.hardcover}, VAT and delivery included.`,
        ],
      },
      3: {
        subject: (p) => `Last reminder about ${p.name}'s story`,
        heading: (p) => `${p.name}'s story, one last time`,
        paragraphs: () => [
          "This is the last email we'll send you about this story. The preview stays available for a few more days in case you want to finish it.",
        ],
      },
    },
    occasion: { christmas: "Christmas Eve", reyes: "Three Kings' Day" },
    deadlinePrinted: (p) =>
      `If it's a gift for ${p.occasion}, order the printed book by <strong>${p.date}</strong> so it arrives in time (mainland Spain and the Balearic Islands). The PDF reaches your inbox after payment.`,
    deadlinePdf: (p) => `The printed book won't arrive in time for ${p.occasion} any more, but the PDF will: it reaches your inbox after payment.`,
    cta: "See the story",
    coverAlt: (p) => `Cover of ${p.name}'s story`,
    signoff: "Warmly,\nThe Meapica team",
    footer: (p) =>
      `We're writing because, when you asked for the preview of ${p.name}'s story, you ticked the box to be reminded by email. This is a commercial message from ${p.seller}. If you'd rather not get emails like this, ${p.unsubscribe} or write to ${p.mailbox}.`,
    unsubscribe: "unsubscribe here",
    dateLocale: "en-GB",
  },
  fr: {
    kicker: "Rappel",
    stages: {
      1: {
        subject: (p) => `L'histoire ${p.deName} est toujours là`,
        heading: (p) => `L'histoire ${p.deName} vous attend`,
        paragraphs: () => [
          "Nous l'avons gardée telle que vous l'avez laissée, avec sa couverture et ses premières pages. Vous pouvez y revenir quand vous voulez et la montrer à qui vous voulez.",
        ],
      },
      2: {
        subject: (p) => `Comment finit l'histoire ${p.deName} ?`,
        heading: (p) => `Comment finit l'histoire ${p.deName} ?`,
        paragraphs: (p) => [
          "L'aperçu montre le début. L'histoire complète suit l'aventure jusqu'à la fin, avec toutes ses illustrations.",
          `Elle est disponible en PDF pour ${p.pdf} TVA incluse, et aussi imprimée : couverture souple à ${p.softcover} ou couverture rigide à ${p.hardcover}, TVA et livraison incluses.`,
        ],
      },
      3: {
        subject: (p) => `Dernier rappel pour l'histoire ${p.deName}`,
        heading: (p) => `L'histoire ${p.deName}, une dernière fois`,
        paragraphs: () => [
          "C'est le dernier e-mail que nous vous envoyons au sujet de cette histoire. L'aperçu reste disponible encore quelques jours, si vous souhaitez la terminer.",
        ],
      },
    },
    occasion: { christmas: "le réveillon de Noël", reyes: "les Rois mages" },
    deadlinePrinted: (p) =>
      `Si c'est un cadeau pour ${p.occasion}, commandez le livre imprimé avant le <strong>${p.date}</strong> pour qu'il arrive à temps (Espagne péninsulaire et Baléares). Le PDF arrive par e-mail après le paiement.`,
    deadlinePdf: (p) => `Le livre imprimé n'arrivera plus à temps pour ${p.occasion}, mais le PDF si : il arrive par e-mail après le paiement.`,
    cta: "Voir l'histoire",
    coverAlt: (p) => `Couverture de l'histoire ${p.deName}`,
    signoff: "Bien à vous,\nL'équipe Meapica",
    footer: (p) =>
      `Nous vous écrivons parce qu'en demandant l'aperçu de l'histoire ${p.deName}, vous avez coché la case pour recevoir un rappel par e-mail. Ceci est une communication commerciale de ${p.seller}. Si vous ne souhaitez plus recevoir ce type d'e-mails, ${p.unsubscribe} ou écrivez-nous à ${p.mailbox}.`,
    unsubscribe: "désabonnez-vous ici",
    dateLocale: "fr-FR",
  },
};

function resolveLocale(locale: string): Locale {
  return (LOCALES as readonly string[]).includes(locale) ? (locale as Locale) : "es";
}

/** "2026-12-10" → "10 de diciembre" / "10 December". */
function formatDay(date: string, dateLocale: string): string {
  return new Intl.DateTimeFormat(dateLocale, { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

const stripStrong = (s: string) => s.replace(/<\/?strong>/g, "");

/** Build one reminder (HTML + text). The caller adds the List-Unsubscribe headers. */
export function buildPreviewReminderEmail(ctx: PreviewReminderContext): BuiltEmail {
  const loc = resolveLocale(ctx.locale);
  const s = CONTENT[loc];
  const stage = s.stages[ctx.stage];
  const name = ctx.childName.trim();
  const plain: Names = { name, deName: deName(name, loc, ctx.childGender) };
  const html: Names = { name: escapeHtml(plain.name), deName: escapeHtml(plain.deName) };
  const prices: Prices = {
    pdf: formatPrice(PRICING.digital_pdf.price, loc),
    softcover: formatPrice(PRICING.softcover.price, loc),
    hardcover: formatPrice(PRICING.hardcover.price, loc),
  };

  const deadlineLine =
    ctx.deadline?.kind === "printed"
      ? s.deadlinePrinted({ occasion: s.occasion[ctx.deadline.occasion], date: formatDay(ctx.deadline.lastOrderDate, s.dateLocale) })
      : ctx.deadline?.kind === "pdf_only"
        ? s.deadlinePdf({ occasion: s.occasion[ctx.deadline.occasion] })
        : null;

  const paragraphsHtml = [...stage.paragraphs({ ...html, ...prices }), ...(deadlineLine ? [deadlineLine] : [])];
  const paragraphsText = [...stage.paragraphs({ ...plain, ...prices }), ...(deadlineLine ? [stripStrong(deadlineLine)] : [])];

  const footerHtml = s.footer({
    ...html,
    seller: escapeHtml(SELLER_IDENTITY),
    unsubscribe: `<a href="${escapeHtml(ctx.unsubscribeUrl)}" style="color:inherit;text-decoration:underline;">${escapeHtml(s.unsubscribe)}</a>`,
    mailbox: `<a href="mailto:${SUPPORT_EMAIL}" style="color:inherit;text-decoration:underline;">${SUPPORT_EMAIL}</a>`,
  });
  const footerText = s.footer({ ...plain, seller: SELLER_IDENTITY, unsubscribe: `${s.unsubscribe} (${ctx.unsubscribeUrl})`, mailbox: SUPPORT_EMAIL });

  return {
    subject: stage.subject(plain),
    html: renderEmailLayout({
      kicker: escapeHtml(s.kicker),
      heading: stage.heading(html),
      image: ctx.coverUrl ? { url: ctx.coverUrl, alt: s.coverAlt(html), href: ctx.previewUrl } : undefined,
      paragraphs: paragraphsHtml,
      cta: { label: escapeHtml(s.cta), url: ctx.previewUrl },
      signoff: s.signoff,
      lang: loc,
      footerNoteHtml: footerHtml,
    }),
    text: [s.kicker.toUpperCase(), stage.heading(plain), ...paragraphsText, `${s.cta}: ${ctx.previewUrl}`, "---", s.signoff, footerText].join("\n\n"),
    commercial: true,
  };
}
