// Printed copy of "Carta a los Reyes Magos" (the letter the child fills in by
// hand). Pure, written natively per locale (Catalan says "Reis d'Orient" and
// closes the salutation with a comma).

export interface LetterCopy {
  kicker: string;
  salutation: string;
  /** "Me llamo Lucía y tengo" … age … "años." */
  introName: string;
  introAge: string;
  years: string;
  behavedHeading: string;
  behavedOptions: [string, string, string];
  bestThing: string;
  wishesHeading: string;
  wishesDrawHint: string;
  kindnessHeading: string;
  drawingHeading: string;
  signOff: string;
  signatureLabel: string;
  footer: string;
}

const ES: LetterCopy = {
  kicker: "Para Sus Majestades los Reyes Magos de Oriente",
  salutation: "Queridos Reyes Magos:",
  introName: "Me llamo",
  introAge: "y tengo",
  years: "años.",
  behavedHeading: "Este año me he portado…",
  behavedOptions: ["¡Muy bien!", "Bien", "Lo he intentado"],
  bestThing: "Lo que mejor he hecho este año:",
  wishesHeading: "Me gustaría…",
  wishesDrawHint: "Dibuja lo que te gustaría",
  kindnessHeading: "Para otros niños y niñas pido…",
  drawingHeading: "Os he hecho un dibujo",
  signOff: "Con mucho cariño,",
  signatureLabel: "Mi firma",
  footer: "Carta gratuita para imprimir · meapica.shop",
};

const CA: LetterCopy = {
  kicker: "Per a Ses Majestats els Reis d'Orient",
  salutation: "Estimats Reis d'Orient,",
  introName: "Em dic",
  introAge: "i tinc",
  years: "anys.",
  behavedHeading: "Aquest any m'he portat…",
  behavedOptions: ["Molt bé!", "Bé", "Ho he intentat"],
  bestThing: "El que he fet millor aquest any:",
  wishesHeading: "M'agradaria…",
  wishesDrawHint: "Dibuixa el que t'agradaria",
  kindnessHeading: "Per als altres nens i nenes demano…",
  drawingHeading: "Us he fet un dibuix",
  signOff: "Amb molt d'amor,",
  signatureLabel: "La meva signatura",
  footer: "Carta gratuïta per imprimir · meapica.shop",
};

export const LETTER_COPY: Record<"es" | "ca", LetterCopy> = { es: ES, ca: CA };
