// Review request (es / ca / en / fr): ONE email per order, a few days after the book
// arrived (printed) or after the PDF was ready (cron /api/cron/review-requests, rules in
// src/lib/reviews/review-schedule.ts). It asks the buyer what they thought of the book
// they bought, with a signed one-time link to /[locale]/review (no login).
//
// Legal: it is about a purchase the recipient made (legitimate interest, RGPD 6.1.f;
// treated like LSSI 21.2 communications to existing customers to be safe): never sent to
// buyers who ticked the checkout opt-out or to suppressed addresses, names the seller,
// says why we write and carries an unsubscribe link plus a mailbox to object. The sender
// adds the List-Unsubscribe headers (RFC 8058). Privacy policy: legal.privacy.section4Text.
// Voice: warm, direct, short paragraphs, no em-dashes (owner's canonical email voice).

import { escapeHtml, renderEmailLayout } from "./layout";
import { buyerFirstName, type BuiltEmail } from "./order-emails";
import { deName, type NameGender } from "@/lib/name-grammar";
import { SELLER_IDENTITY } from "@/lib/pricing";
import { SUPPORT_EMAIL } from "@/lib/support";

type Locale = "es" | "ca" | "en" | "fr";
const LOCALES: readonly Locale[] = ["es", "ca", "en", "fr"];

export interface ReviewRequestContext {
  locale: string;
  buyerName?: string | null;
  /** Already reduced to letters (mailSafeName): it goes into a subject line. */
  childName: string;
  childGender?: NameGender;
  printed: boolean;
  /** Signed review page (src/lib/reviews/review-token.ts). */
  reviewUrl: string;
  /** Unsubscribe page for the recipient (required: no link, no email). */
  unsubscribeUrl: string;
}

interface Names {
  /** "de Lucía" / "d'Olívia" / "de la Noa" (bare name in English). */
  deName: string;
  name: string;
}

interface Strings {
  kicker: string;
  greeting: (firstName: string | null) => string;
  subject: (p: Names) => string;
  heading: (p: Names) => string;
  opener: (p: Names & { printed: boolean }) => string;
  ask: string;
  cta: string;
  signoff: string;
  footer: (p: Names & { seller: string; unsubscribe: string; mailbox: string }) => string;
  unsubscribe: string;
}

const CONTENT: Record<Locale, Strings> = {
  es: {
    kicker: "Tu opinión",
    greeting: (n) => (n ? `Hola ${n},` : "Hola,"),
    subject: (p) => `¿Qué os ha parecido el cuento ${p.deName}?`,
    heading: (p) => `¿Qué os ha parecido el cuento ${p.deName}?`,
    opener: (p) =>
      p.printed
        ? "Hace unos días os llegó el libro y nos encantaría saber cómo ha ido la primera lectura."
        : "Hace unos días te llegó el cuento en PDF y nos encantaría saber cómo ha ido la primera lectura.",
    ask: "Valorarlo te lleva menos de un minuto, y tu opinión ayuda mucho a otras familias que están pensando en regalar uno.",
    cta: "Valorar el cuento",
    signoff: "¡Gracias!\nEl equipo de Meapica",
    footer: (p) =>
      `Te escribimos una sola vez porque compraste el cuento ${p.deName} en ${p.seller}. Si no quieres recibir correos como este, ${p.unsubscribe} o escríbenos a ${p.mailbox}.`,
    unsubscribe: "date de baja aquí",
  },
  ca: {
    kicker: "La teva opinió",
    greeting: (n) => (n ? `Hola ${n},` : "Hola,"),
    subject: (p) => `Què us ha semblat el conte ${p.deName}?`,
    heading: (p) => `Què us ha semblat el conte ${p.deName}?`,
    opener: (p) =>
      p.printed
        ? "Fa uns dies us va arribar el llibre i ens encantaria saber com ha anat la primera lectura."
        : "Fa uns dies et va arribar el conte en PDF i ens encantaria saber com ha anat la primera lectura.",
    ask: "Valorar-lo és qüestió d'un minut, i la teva opinió ajuda molt altres famílies que estan pensant a regalar-ne un.",
    cta: "Valorar el conte",
    signoff: "Gràcies!\nL'equip de Meapica",
    footer: (p) =>
      `T'escrivim una sola vegada perquè vas comprar el conte ${p.deName} a ${p.seller}. Si no vols rebre correus com aquest, ${p.unsubscribe} o escriu-nos a ${p.mailbox}.`,
    unsubscribe: "dona't de baixa aquí",
  },
  en: {
    kicker: "Your opinion",
    greeting: (n) => (n ? `Hi ${n},` : "Hi there,"),
    subject: (p) => `How did you like ${p.name}'s story?`,
    heading: (p) => `How did you like ${p.name}'s story?`,
    opener: (p) =>
      p.printed
        ? "Your book arrived a few days ago and we'd love to know how the first reading went."
        : "Your PDF story arrived a few days ago and we'd love to know how the first reading went.",
    ask: "Rating it takes less than a minute, and it really helps other families who are thinking of giving one.",
    cta: "Rate the story",
    signoff: "Thank you!\nThe Meapica team",
    footer: (p) =>
      `We're writing just this once because you bought ${p.name}'s story from ${p.seller}. If you'd rather not get emails like this, ${p.unsubscribe} or write to ${p.mailbox}.`,
    unsubscribe: "unsubscribe here",
  },
  fr: {
    kicker: "Votre avis",
    greeting: (n) => (n ? `Bonjour ${n},` : "Bonjour,"),
    subject: (p) => `Qu'avez-vous pensé de l'histoire ${p.deName} ?`,
    heading: (p) => `Qu'avez-vous pensé de l'histoire ${p.deName} ?`,
    opener: (p) =>
      p.printed
        ? "Votre livre est arrivé il y a quelques jours et nous aimerions beaucoup savoir comment s'est passée la première lecture."
        : "Votre histoire en PDF est arrivée il y a quelques jours et nous aimerions beaucoup savoir comment s'est passée la première lecture.",
    ask: "La noter prend moins d'une minute, et votre avis aide beaucoup les familles qui pensent en offrir une.",
    cta: "Noter l'histoire",
    signoff: "Merci !\nL'équipe Meapica",
    footer: (p) =>
      `Nous vous écrivons une seule fois parce que vous avez acheté l'histoire ${p.deName} chez ${p.seller}. Si vous ne souhaitez plus recevoir ce type d'e-mails, ${p.unsubscribe} ou écrivez-nous à ${p.mailbox}.`,
    unsubscribe: "désabonnez-vous ici",
  },
};

function resolveLocale(locale: string): Locale {
  return (LOCALES as readonly string[]).includes(locale) ? (locale as Locale) : "es";
}

/** Build the review request (HTML + text). The caller adds the List-Unsubscribe headers. */
export function buildReviewRequestEmail(ctx: ReviewRequestContext): BuiltEmail {
  const loc = resolveLocale(ctx.locale);
  const s = CONTENT[loc];
  const name = ctx.childName.trim();
  const plain: Names = { name, deName: deName(name, loc, ctx.childGender) };
  const html: Names = { name: escapeHtml(plain.name), deName: escapeHtml(plain.deName) };
  const greeting = s.greeting(buyerFirstName(ctx.buyerName));
  const paragraphs = [s.opener({ ...plain, printed: ctx.printed }), s.ask];

  const footerHtml = s.footer({
    ...html,
    seller: escapeHtml(SELLER_IDENTITY),
    unsubscribe: `<a href="${escapeHtml(ctx.unsubscribeUrl)}" style="color:inherit;text-decoration:underline;">${escapeHtml(s.unsubscribe)}</a>`,
    mailbox: `<a href="mailto:${SUPPORT_EMAIL}" style="color:inherit;text-decoration:underline;">${SUPPORT_EMAIL}</a>`,
  });
  const footerText = s.footer({ ...plain, seller: SELLER_IDENTITY, unsubscribe: `${s.unsubscribe} (${ctx.unsubscribeUrl})`, mailbox: SUPPORT_EMAIL });

  return {
    subject: s.subject(plain),
    html: renderEmailLayout({
      kicker: escapeHtml(s.kicker),
      greeting: escapeHtml(greeting),
      heading: s.heading(html),
      paragraphs: paragraphs.map(escapeHtml),
      cta: { label: escapeHtml(s.cta), url: ctx.reviewUrl },
      signoff: s.signoff,
      lang: loc,
      footerNoteHtml: footerHtml,
    }),
    text: [greeting, s.heading(plain), ...paragraphs, `${s.cta}: ${ctx.reviewUrl}`, "---", s.signoff, footerText].join("\n\n"),
    commercial: true,
  };
}
