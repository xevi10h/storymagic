// Emails of the referral programme and the gift vouchers (es / ca / en / fr), plus the
// referral block shown in the order emails. Same shell and voice as order-emails.ts:
// warm, direct, short paragraphs, no em-dashes.

import { EMAIL_COLORS, escapeHtml, renderEmailLayout } from "./layout";
import { getSiteUrl } from "./send";
import { buyerFirstName } from "./order-emails";
import { SUPPORT_EMAIL } from "@/lib/support";
import { REFERRAL_DISCOUNT_CENTS, VOUCHER_WITHDRAWAL_DAYS, type VoucherFormat } from "@/lib/promo-codes";
import type { GiftVoucherRow } from "@/lib/fulfilment/db";

type Locale = "es" | "ca" | "en" | "fr";
const LOCALES: Locale[] = ["es", "ca", "en", "fr"];
const INTL: Record<Locale, string> = { es: "es-ES", ca: "ca-ES", en: "en-GB", fr: "fr-FR" };

function loc(locale: string | null | undefined): Locale {
  return LOCALES.includes(locale as Locale) ? (locale as Locale) : "es";
}

/** Whole euros without decimals: "10 €" / "€10". */
export function wholeEuros(cents: number, locale: string): string {
  return new Intl.NumberFormat(INTL[loc(locale)].replace("en-GB", "en-IE"), {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function longDate(iso: string, l: Locale): string {
  return new Intl.DateTimeFormat(INTL[l], { dateStyle: "long", timeZone: "Europe/Madrid" }).format(new Date(iso));
}

const stripTags = (s: string) =>
  s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** The code in a dashed box: easy to read, copy and print. */
function codeBox(code: string, label: string): string {
  const C = EMAIL_COLORS;
  return `<div style="margin:0 0 24px;padding:18px 20px;border:2px dashed ${C.primary};border-radius:12px;text-align:center;">
    <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${C.primaryText};">${escapeHtml(label)}</p>
    <p style="margin:0;font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:26px;font-weight:700;letter-spacing:0.12em;color:${C.heading};">${escapeHtml(code)}</p>
  </div>`;
}

// ── Gift voucher (to the buyer) ─────────────────────────────────────────────

const FORMAT_NAME: Record<Locale, Record<VoucherFormat, string>> = {
  es: { hardcover: "tapa dura", softcover: "tapa blanda", digital_pdf: "PDF" },
  ca: { hardcover: "tapa dura", softcover: "tapa tova", digital_pdf: "PDF" },
  en: { hardcover: "hardcover", softcover: "softcover", digital_pdf: "PDF" },
  fr: { hardcover: "couverture rigide", softcover: "couverture souple", digital_pdf: "PDF" },
};

interface VoucherCopy {
  subject: (f: string) => string;
  heading: string;
  greeting: (n: string | null) => string;
  intro: (f: string, recipient: string | null) => string;
  redeem: (printed: boolean) => string;
  noExpiry: string;
  codeLabel: string;
  cta: string;
  withdrawal: string;
  invoice: string;
  signoff: string;
}

const VOUCHER: Record<Locale, VoucherCopy> = {
  es: {
    subject: (f) => `Tu tarjeta regalo Meapica (${f})`,
    heading: "Tu tarjeta regalo está lista",
    greeting: (n) => (n ? `Hola ${n},` : "Hola,"),
    intro: (f, r) => `Gracias por regalar un cuento. Aquí tienes la tarjeta regalo de un cuento personalizado en ${f}${r ? ` para <strong>${r}</strong>` : ""}.`,
    redeem: (p) =>
      p
        ? "Puedes imprimirla o reenviarla. Quien la reciba crea su cuento en meapica.shop y escribe el código al pagar: el libro le sale gratis, con el envío incluido."
        : "Puedes imprimirla o reenviarla. Quien la reciba crea su cuento en meapica.shop y escribe el código al pagar: el PDF le sale gratis.",
    noExpiry: "No caduca: la podéis canjear cuando queráis.",
    codeLabel: "Código de la tarjeta regalo",
    cta: "Ver e imprimir la tarjeta",
    withdrawal: `Si cambias de idea, puedes desistir en ${VOUCHER_WITHDRAWAL_DAYS} días desde la compra mientras no se haya canjeado: escríbenos a ${SUPPORT_EMAIL} y te devolvemos el importe.`,
    invoice: "Descargar la factura",
    signoff: "Un abrazo,\nEl equipo de Meapica",
  },
  ca: {
    subject: (f) => `La teva targeta regal Meapica (${f})`,
    heading: "La teva targeta regal ja és a punt",
    greeting: (n) => (n ? `Hola ${n},` : "Hola,"),
    intro: (f, r) => `Gràcies per regalar un conte. Aquí tens la targeta regal d'un conte personalitzat en ${f}${r ? ` per a <strong>${r}</strong>` : ""}.`,
    redeem: (p) =>
      p
        ? "La pots imprimir o reenviar. Qui la rebi crea el seu conte a meapica.shop i escriu el codi en pagar: el llibre li surt gratis, amb l'enviament inclòs."
        : "La pots imprimir o reenviar. Qui la rebi crea el seu conte a meapica.shop i escriu el codi en pagar: el PDF li surt gratis.",
    noExpiry: "No caduca: la podeu bescanviar quan vulgueu.",
    codeLabel: "Codi de la targeta regal",
    cta: "Veure i imprimir la targeta",
    withdrawal: `Si canvies d'idea, pots desistir en ${VOUCHER_WITHDRAWAL_DAYS} dies des de la compra mentre no s'hagi bescanviat: escriu-nos a ${SUPPORT_EMAIL} i et retornem l'import.`,
    invoice: "Descarregar la factura",
    signoff: "Una abraçada,\nL'equip de Meapica",
  },
  en: {
    subject: (f) => `Your Meapica gift voucher (${f})`,
    heading: "Your gift voucher is ready",
    greeting: (n) => (n ? `Hi ${n},` : "Hi,"),
    intro: (f, r) => `Thank you for giving a story. Here is your gift voucher for one personalised ${f} book${r ? ` for <strong>${r}</strong>` : ""}.`,
    redeem: (p) =>
      p
        ? "Print it or forward it. The recipient creates their story on meapica.shop and types the code at checkout: the book is free, shipping included."
        : "Print it or forward it. The recipient creates their story on meapica.shop and types the code at checkout: the PDF is free.",
    noExpiry: "It never expires: it can be redeemed whenever you like.",
    codeLabel: "Gift voucher code",
    cta: "View and print the voucher",
    withdrawal: `Changed your mind? You can cancel within ${VOUCHER_WITHDRAWAL_DAYS} days of purchase as long as it has not been redeemed: write to ${SUPPORT_EMAIL} and we refund you.`,
    invoice: "Download the invoice",
    signoff: "Warm wishes,\nThe Meapica team",
  },
  fr: {
    subject: (f) => `Votre carte cadeau Meapica (${f})`,
    heading: "Votre carte cadeau est prête",
    greeting: (n) => (n ? `Bonjour ${n},` : "Bonjour,"),
    intro: (f, r) => `Merci d'offrir une histoire. Voici votre carte cadeau pour un livre personnalisé en ${f}${r ? ` pour <strong>${r}</strong>` : ""}.`,
    redeem: (p) =>
      p
        ? "Imprimez-la ou transférez-la. La personne qui la reçoit crée son histoire sur meapica.shop et saisit le code au paiement : le livre est offert, livraison comprise."
        : "Imprimez-la ou transférez-la. La personne qui la reçoit crée son histoire sur meapica.shop et saisit le code au paiement : le PDF est offert.",
    noExpiry: "Elle n'expire pas : vous pouvez l'utiliser quand vous voulez.",
    codeLabel: "Code de la carte cadeau",
    cta: "Voir et imprimer la carte",
    withdrawal: `Vous avez changé d'avis ? Vous pouvez vous rétracter dans les ${VOUCHER_WITHDRAWAL_DAYS} jours suivant l'achat tant qu'elle n'a pas été utilisée : écrivez-nous à ${SUPPORT_EMAIL} et nous vous remboursons.`,
    invoice: "Télécharger la facture",
    signoff: "Bien à vous,\nL'équipe Meapica",
  },
};

export interface BuiltGrowthEmail {
  subject: string;
  html: string;
  text: string;
}

export function buildGiftVoucherEmail(params: {
  voucher: Pick<GiftVoucherRow, "code" | "format" | "locale" | "buyer_name" | "recipient_name">;
  cardUrl: string;
  invoiceUrl?: string | null;
}): BuiltGrowthEmail {
  const l = loc(params.voucher.locale);
  const s = VOUCHER[l];
  const v = params.voucher;
  const format = FORMAT_NAME[l][v.format];
  const greeting = s.greeting(buyerFirstName(v.buyer_name));
  const paragraphs = [
    s.intro(format, v.recipient_name ? escapeHtml(v.recipient_name) : null),
    s.redeem(v.format !== "digital_pdf"),
    s.noExpiry,
  ];
  const html = renderEmailLayout({
    heading: s.heading,
    greeting: escapeHtml(greeting),
    paragraphs,
    cta: { label: s.cta, url: params.cardUrl },
    detailsHtml:
      codeBox(v.code, s.codeLabel) +
      (params.invoiceUrl
        ? `<p style="margin:0 0 24px;font-size:14px;"><a href="${escapeHtml(params.invoiceUrl)}" style="color:${EMAIL_COLORS.primaryText};font-weight:600;text-decoration:underline;">${escapeHtml(s.invoice)}</a></p>`
        : ""),
    infoHtml: escapeHtml(s.withdrawal),
    signoff: s.signoff,
    lang: l,
  });
  const text = [greeting, ...paragraphs.map(stripTags), `${s.codeLabel}: ${v.code}`, `${s.cta}: ${params.cardUrl}`, ...(params.invoiceUrl ? [`${s.invoice}: ${params.invoiceUrl}`] : []), s.withdrawal, "---", s.signoff].join("\n\n");
  return { subject: s.subject(format), html, text };
}

// ── Referral reward (to the referrer) ───────────────────────────────────────

const REWARD: Record<Locale, { subject: (a: string) => string; heading: string; p1: (a: string) => string; p2: (d: string) => string; codeLabel: string; cta: string; signoff: string; greeting: string }> = {
  es: {
    subject: (a) => `Tienes ${a} para tu próximo cuento`,
    heading: "¡Gracias por recomendarnos!",
    greeting: "Hola,",
    p1: (a) => `Una familia ha pedido su cuento con tu código. Como te prometimos, aquí tienes ${a} de descuento en tu próximo libro impreso (tapa blanda o tapa dura).`,
    p2: (d) => `Escribe el código al pagar. Es de un solo uso y vale hasta el ${d}.`,
    codeLabel: "Tu código de descuento",
    cta: "Crear otro cuento",
    signoff: "Un abrazo,\nEl equipo de Meapica",
  },
  ca: {
    subject: (a) => `Tens ${a} per al teu proper conte`,
    heading: "Gràcies per recomanar-nos!",
    greeting: "Hola,",
    p1: (a) => `Una família ha demanat el seu conte amb el teu codi. Com et vam prometre, aquí tens ${a} de descompte en el teu proper llibre imprès (tapa tova o tapa dura).`,
    p2: (d) => `Escriu el codi en pagar. És d'un sol ús i val fins al ${d}.`,
    codeLabel: "El teu codi de descompte",
    cta: "Crear un altre conte",
    signoff: "Una abraçada,\nL'equip de Meapica",
  },
  en: {
    subject: (a) => `You have ${a} off your next story`,
    heading: "Thank you for recommending us!",
    greeting: "Hi,",
    p1: (a) => `A family ordered their story with your code. As promised, here is ${a} off your next printed book (softcover or hardcover).`,
    p2: (d) => `Type the code at checkout. It can be used once and is valid until ${d}.`,
    codeLabel: "Your discount code",
    cta: "Create another story",
    signoff: "Warm wishes,\nThe Meapica team",
  },
  fr: {
    subject: (a) => `${a} offerts pour votre prochaine histoire`,
    heading: "Merci de nous avoir recommandés !",
    greeting: "Bonjour,",
    p1: (a) => `Une famille a commandé son histoire avec votre code. Comme promis, voici ${a} de réduction sur votre prochain livre imprimé (couverture souple ou rigide).`,
    p2: (d) => `Saisissez le code au paiement. Il est valable une fois, jusqu'au ${d}.`,
    codeLabel: "Votre code de réduction",
    cta: "Créer une autre histoire",
    signoff: "Bien à vous,\nL'équipe Meapica",
  },
};

export function buildReferralRewardEmail(params: { locale: string; code: string; expiresAt: string }): BuiltGrowthEmail {
  const l = loc(params.locale);
  const s = REWARD[l];
  const amount = wholeEuros(REFERRAL_DISCOUNT_CENTS, l);
  const paragraphs = [escapeHtml(s.p1(amount)), escapeHtml(s.p2(longDate(params.expiresAt, l)))];
  const url = `${getSiteUrl()}/${l}/create`;
  const html = renderEmailLayout({
    heading: s.heading,
    greeting: s.greeting,
    paragraphs,
    cta: { label: s.cta, url },
    detailsHtml: codeBox(params.code, s.codeLabel),
    signoff: s.signoff,
    lang: l,
  });
  const text = [s.greeting, ...paragraphs.map(stripTags), `${s.codeLabel}: ${params.code}`, `${s.cta}: ${url}`, "---", s.signoff].join("\n\n");
  return { subject: s.subject(amount), html, text };
}

// ── Referral block inside the order emails (commercial: only with an unsubscribe link) ──

const REFERRAL_BLOCK: Record<Locale, { title: (a: string) => string; body: (a: string, code: string) => string; link: string }> = {
  es: {
    title: (a) => `${a} para ti y ${a} para otra familia`,
    body: (a, c) => `Comparte tu código ${c}: quien lo use tiene ${a} de descuento en su libro impreso y, cuando lo pida, te regalamos otros ${a} para el tuyo.`,
    link: "Tu enlace para compartir",
  },
  ca: {
    title: (a) => `${a} per a tu i ${a} per a una altra família`,
    body: (a, c) => `Comparteix el teu codi ${c}: qui el faci servir té ${a} de descompte en el seu llibre imprès i, quan el demani, et regalem uns altres ${a} per al teu.`,
    link: "El teu enllaç per compartir",
  },
  en: {
    title: (a) => `${a} for you, ${a} for another family`,
    body: (a, c) => `Share your code ${c}: whoever uses it gets ${a} off their printed book, and when they order we give you another ${a} off yours.`,
    link: "Your link to share",
  },
  fr: {
    title: (a) => `${a} pour vous, ${a} pour une autre famille`,
    body: (a, c) => `Partagez votre code ${c} : la personne qui l'utilise a ${a} de réduction sur son livre imprimé et, quand elle commande, nous vous offrons ${a} sur le vôtre.`,
    link: "Votre lien à partager",
  },
};

/** The referral block (html + text) for an order email. */
export function renderReferralBlock(
  referral: { code: string; url: string },
  locale: string,
  optOut: { lead: string; link: string; url: string },
): { html: string; text: string } {
  const l = loc(locale);
  const s = REFERRAL_BLOCK[l];
  const a = wholeEuros(REFERRAL_DISCOUNT_CENTS, l);
  const C = EMAIL_COLORS;
  const codeHtml = `<strong style="font-family:'SFMono-Regular',Menlo,Consolas,monospace;letter-spacing:0.08em;color:${C.heading};">${escapeHtml(referral.code)}</strong>`;
  const html = `<div style="margin:0 0 24px;padding:18px 20px;border:1px solid ${C.border};border-radius:12px;background-color:${C.bg};">
    <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:${C.heading};">${escapeHtml(s.title(a))}</p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:${C.body};">${escapeHtml(s.body(a, "\u0000")).replace("\u0000", codeHtml)}</p>
    <p style="margin:0;font-size:14px;line-height:1.5;color:${C.body};">${escapeHtml(s.link)}: <a href="${escapeHtml(referral.url)}" style="color:${C.primaryText};font-weight:700;text-decoration:underline;word-break:break-all;">${escapeHtml(referral.url.replace(/^https?:\/\//, ""))}</a></p>
    <p style="margin:14px 0 0;font-size:12px;line-height:1.5;color:${C.muted};">${escapeHtml(optOut.lead)} <a href="${escapeHtml(optOut.url)}" style="color:${C.muted};text-decoration:underline;">${escapeHtml(optOut.link)}</a></p>
  </div>`;
  const text = `${s.title(a)}\n${s.body(a, referral.code)}\n${s.link}: ${referral.url}\n${optOut.lead} ${optOut.link}: ${optOut.url}`;
  return { html, text };
}
