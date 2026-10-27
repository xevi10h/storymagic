// Server copy of the Advent calendar PDFs and daily email (es + ca, written natively).
// The page's UI copy lives in the `advent` messages namespace (src/messages/{es,ca}.json).
// Voice: warm, direct, short, no em-dashes in email prose.

import type { AdventLocale } from "./render";

export interface AdventServerCopy {
  dateLocale: string;
  pdf: {
    /** Footer: "Calendario de Adviento de Noa · Puerta 5 de 24". */
    footer: (p: { deName: string; door: number; total: number }) => string;
    /** Footer without a name. */
    footerNoName: (p: { door: number; total: number }) => string;
    compilationTitle: string;
    /** "de Noa" under the compilation title. */
    compilationFor: (deName: string) => string;
    compilationSub: string;
    compilationColophon: string;
    docTitle: (p: { door: number; title: string }) => string;
  };
  file: {
    door: (slug: string, door: number) => string;
    compilation: (slug: string) => string;
  };
  email: {
    subject: (p: { door: number; title: string }) => string;
    kicker: (p: { door: number; total: number }) => string;
    hello: string;
    intro: (p: { door: number; teaser: string }) => string;
    pdfLine: string;
    compilationLine: string;
    open: string;
    offerLabel: string;
    bookHeading: (name: string) => string;
    bookText: (p: { pages: number }) => string;
    bookDeadline: (date: string) => string;
    bookPack: (price: string) => string;
    bookLate: (pdfPrice: string) => string;
    bookFrom: (price: string) => string;
    bookCta: (deName: string) => string;
    signoff: string;
    footer: (p: { seller: string; unsubscribe: string; mailbox: string }) => string;
    unsubscribe: string;
  };
}

export const ADVENT_COPY: Record<AdventLocale, AdventServerCopy> = {
  es: {
    dateLocale: "es-ES",
    pdf: {
      footer: ({ deName, door, total }) => `Calendario de Adviento ${deName} · Puerta ${door} de ${total}`,
      footerNoName: ({ door, total }) => `Calendario de Adviento · Puerta ${door} de ${total}`,
      compilationTitle: "El libro de Adviento",
      compilationFor: (deName) => deName,
      compilationSub: "24 cuentos para 24 noches, con Bartolo, el camello más pequeño de los Reyes Magos.",
      compilationColophon: "Calendario de Adviento de Meapica · Diciembre de 2026 · meapica.es",
      docTitle: ({ door, title }) => `Puerta ${door}: ${title}`,
    },
    file: {
      door: (slug, door) => `${slug}-puerta-${String(door).padStart(2, "0")}.pdf`,
      compilation: (slug) => `${slug}-libro-de-adviento.pdf`,
    },
    email: {
      subject: ({ door, title }) => `Puerta ${door}: ${title}`,
      kicker: ({ door, total }) => `Puerta ${door} de ${total}`,
      hello: "Hola,",
      intro: ({ door, teaser }) => `Hoy se abre la puerta ${door}. ${teaser}`,
      pdfLine: "Te dejamos el cuento en PDF por si lo queréis leer en papel esta noche.",
      compilationLine: "Y como hoy es Nochebuena, también te dejamos los 24 cuentos juntos en un solo PDF: vuestro libro de Adviento.",
      open: "Abrir la puerta",
      offerLabel: "Oferta",
      bookHeading: (name) => (name ? `¿Y el cuento entero con ${name}?` : "¿Y un cuento entero con su nombre?"),
      bookText: ({ pages }) => `${pages} páginas pintadas a acuarela con su retrato, impreso y en casa. Lo ves antes de pagar.`,
      bookDeadline: (date) => `Para Reyes, pide hasta el ${date}.`,
      bookPack: (price) => `Y con tu libro, el 2.º en tapa blanda te sale a ${price} IVA incluido.`,
      bookLate: (pdfPrice) => `El impreso ya no llega a Reyes, pero el PDF sí: ${pdfPrice} IVA incluido, al momento.`,
      bookFrom: (price) => `Desde ${price} IVA incluido. Envío gratis.`,
      bookCta: (deName) => `Crear el libro ${deName}`,
      signoff: "Un abrazo,\nEl equipo de Meapica",
      footer: ({ seller, unsubscribe, mailbox }) =>
        `Recibes este correo porque pediste las puertas del Calendario de Adviento (un email al día del 1 al 24 de diciembre). Incluye una oferta de ${seller}. Si no quieres recibir más, ${unsubscribe} o escríbenos a ${mailbox}.`,
      unsubscribe: "date de baja aquí",
    },
  },
  ca: {
    dateLocale: "ca-ES",
    pdf: {
      footer: ({ deName, door, total }) => `Calendari d'Advent ${deName} · Porta ${door} de ${total}`,
      footerNoName: ({ door, total }) => `Calendari d'Advent · Porta ${door} de ${total}`,
      compilationTitle: "El llibre d'Advent",
      compilationFor: (deName) => deName,
      compilationSub: "24 contes per a 24 nits, amb en Bartolo, el camell més petit dels Reis d'Orient.",
      compilationColophon: "Calendari d'Advent de Meapica · Desembre del 2026 · meapica.es",
      docTitle: ({ door, title }) => `Porta ${door}: ${title}`,
    },
    file: {
      door: (slug, door) => `${slug}-porta-${String(door).padStart(2, "0")}.pdf`,
      compilation: (slug) => `${slug}-llibre-d-advent.pdf`,
    },
    email: {
      subject: ({ door, title }) => `Porta ${door}: ${title}`,
      kicker: ({ door, total }) => `Porta ${door} de ${total}`,
      hello: "Hola,",
      intro: ({ door, teaser }) => `Avui s'obre la porta ${door}. ${teaser}`,
      pdfLine: "Et deixem el conte en PDF per si el voleu llegir en paper aquesta nit.",
      compilationLine: "I com que avui és la Nit de Nadal, també et deixem els 24 contes junts en un sol PDF: el vostre llibre d'Advent.",
      open: "Obrir la porta",
      offerLabel: "Oferta",
      bookHeading: (name) => (name ? `I el conte sencer amb ${name}?` : "I un conte sencer amb el seu nom?"),
      bookText: ({ pages }) => `${pages} pàgines pintades a l'aquarel·la amb el seu retrat, imprès i a casa. El veus abans de pagar.`,
      bookDeadline: (date) => `Per Reis, demana'l fins al ${date}.`,
      bookPack: (price) => `I amb el teu llibre, el 2n en tapa tova et surt a ${price} IVA inclòs.`,
      bookLate: (pdfPrice) => `L'imprès ja no arriba per Reis, però el PDF sí: ${pdfPrice} IVA inclòs, a l'instant.`,
      bookFrom: (price) => `Des de ${price} IVA inclòs. Enviament gratuït.`,
      bookCta: (deName) => `Crear el llibre ${deName}`,
      signoff: "Una abraçada,\nL'equip de Meapica",
      footer: ({ seller, unsubscribe, mailbox }) =>
        `Reps aquest correu perquè vas demanar les portes del Calendari d'Advent (un correu al dia de l'1 al 24 de desembre). Inclou una oferta de ${seller}. Si no en vols rebre més, ${unsubscribe} o escriu-nos a ${mailbox}.`,
      unsubscribe: "dona't de baixa aquí",
    },
  },
};
