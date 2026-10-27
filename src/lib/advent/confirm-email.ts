// Advent calendar double opt-in: the ONE confirmation email a pending sign-up gets (es / ca).
// Transactional and plain on purpose: no offer, no PDF, no story, just what was asked for
// and a "Confirmar" button that opens /[locale]/advent/confirm (which needs a click, so mail
// scanners that open links cannot confirm). Without the click nothing else is ever sent.

import { escapeHtml, renderEmailLayout } from "@/lib/email/layout";
import type { BuiltEmail } from "@/lib/email/order-emails";
import type { AdventLocale } from "./render";

const COPY = {
  es: {
    subject: "Confirma tu correo para el Calendario de Adviento",
    heading: "Confirma tu correo",
    paragraphs: (name: string) => [
      `Has pedido las puertas del Calendario de Adviento de Meapica con los cuentos de ${name}: un email al día del 1 al 24 de diciembre con el cuento del día en PDF.`,
      "Para empezar a recibirlas, confirma que este correo es tuyo.",
    ],
    cta: "Confirmar",
    info: "Si no lo has pedido tú, ignora este mensaje: sin confirmar no te enviaremos nada más.",
    signoff: "Un abrazo,\nEl equipo de Meapica",
  },
  ca: {
    subject: "Confirma el teu correu per al Calendari d'Advent",
    heading: "Confirma el teu correu",
    paragraphs: (name: string) => [
      `Has demanat les portes del Calendari d'Advent de Meapica amb els contes per a ${name}: un correu al dia de l'1 al 24 de desembre amb el conte del dia en PDF.`,
      "Per començar a rebre-les, confirma que aquest correu és teu.",
    ],
    cta: "Confirmar",
    info: "Si no ho has demanat tu, ignora aquest missatge: sense confirmar no t'enviarem res més.",
    signoff: "Una abraçada,\nL'equip de Meapica",
  },
} as const;

export function buildAdventConfirmEmail(ctx: { locale: AdventLocale; childName: string; confirmUrl: string }): BuiltEmail {
  const c = COPY[ctx.locale];
  const paragraphs = c.paragraphs(ctx.childName);
  return {
    subject: c.subject,
    html: renderEmailLayout({
      heading: escapeHtml(c.heading),
      paragraphs: paragraphs.map(escapeHtml),
      cta: { label: escapeHtml(c.cta), url: ctx.confirmUrl },
      infoHtml: escapeHtml(c.info),
      signoff: c.signoff,
      lang: ctx.locale,
    }),
    text: [c.heading, ...paragraphs, `${c.cta}: ${ctx.confirmUrl}`, c.info, "---", c.signoff].join("\n\n"),
  };
}
