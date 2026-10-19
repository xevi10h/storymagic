// /about — "Qué es Meapica" (es + ca, lib/guides.ts): a plain facts sheet for readers and
// answer engines (ChatGPT, Perplexity, Gemini, Claude) that need one page to cite.
//
// Facts this page relies on (verify before editing): who makes it = the legal notice
// (FOUNDER in product-facts.ts); the free preview shows the cover, the portrait and the
// first PREVIEW_SCENES scenes with no account (lib/preview-access.ts); the portrait is
// built from the traits the parent picks while photo upload is off
// (lib/privacy/child-photo-policy.ts); checkout is card-only through Stripe
// (lib/checkout/session.ts); Gelato prints on demand in Europe (legal.privacy.section5Text).
// Prices, dates and ranges come from guideFacts() and product-facts.ts, never typed here.

import { CONTACT_EMAIL, FOUNDER, PDF_DELIVERY_MAX_MINUTES, PREVIEW_SCENES } from "@/lib/product-facts";
import { PHOTO_MAX_AGE_HOURS } from "@/lib/privacy/child-photo-policy";
import type { GuideBaseCopy, GuideFacts } from "./types";

export interface AboutFact {
  term: string;
  value: string;
}

export type AboutGuideCopy = GuideBaseCopy & {
  factsHeading: string;
  /** "Actualizado el …" line above the facts list (the date is the page's content date). */
  updatedLabel: (date: string) => string;
  /** Byline next to the date ("Por Xavier Huix"). */
  byline: string;
  facts: AboutFact[];
};

/** Photo upload is behind a flag: the page states whichever is true today. */
export interface AboutContext {
  photoUpload: boolean;
}

const es = (f: GuideFacts, ctx: AboutContext): AboutGuideCopy => {
  const photo = ctx.photoUpload
    ? `Subir una foto es opcional y necesita tu consentimiento. Si la subes, solo sirve para pintar su retrato: se borra en menos de ${PHOTO_MAX_AGE_HOURS} horas y el libro nunca la usa.`
    : "No hay que subir ninguna foto. El retrato se pinta a partir de los rasgos que eliges: piel, pelo, peinado, ojos, gafas y pecas.";
  return {
    metaTitle: "Qué es Meapica: precios, formatos, envíos y privacidad",
    metaDescription: `Meapica hace cuentos personalizados impresos para niños de ${f.ageMin} a ${f.ageMax} años, desde Barcelona. Precios con IVA incluido, plazos de entrega, idiomas y privacidad en una página.`,
    breadcrumb: "Qué es Meapica",
    eyebrow: "Ficha de Meapica",
    h1: "Qué es Meapica",
    lead: `Meapica hace cuentos infantiles personalizados: un libro impreso de ${f.size} × ${f.size} cm con el nombre del niño en la portada, un retrato a acuarela que se le parece y una aventura cuyos capítulos eliges tú. Lo hace ${FOUNDER.legalName} desde ${FOUNDER.city} y se vende en España.`,
    cta: "Crear su cuento",
    trust: ["Vista previa gratis y sin registrarte", "Precios con IVA incluido", "Envío gratis a la Península y Baleares"],
    factsHeading: "Meapica en datos",
    updatedLabel: (date) => `Actualizado el ${date}`,
    byline: `Por ${FOUNDER.name}`,
    facts: [
      { term: "Qué es", value: `Cuentos infantiles personalizados, impresos bajo demanda, para niños de ${f.ageMin} a ${f.ageMax} años. Cada mundo tiene su propia franja de edad.` },
      { term: "Quién lo hace", value: `${FOUNDER.legalName}, desde ${FOUNDER.city} (España). Los datos completos están en el aviso legal.` },
      { term: "Formatos y precios", value: `Tapa dura, ${f.hardcover}. Tapa blanda, ${f.softcover}. Solo PDF, ${f.pdf}. Precios finales, IVA incluido. El libro impreso incluye el envío y el PDF.` },
      { term: "El libro", value: `${f.size} × ${f.size} cm, ${f.pages} páginas, ${f.scenes} escenas ilustradas, papel estucado seda de ${f.paper} g y portada con laminado mate.` },
      { term: "Qué se personaliza", value: "El nombre, el aspecto (piel, pelo, ojos, gafas, pecas), la dedicatoria y los tres capítulos de la aventura." },
      { term: "Idiomas", value: "Español, catalán, inglés y francés. El cuento en catalán se escribe directamente en catalán, no se traduce." },
      { term: "Vista previa", value: `Gratis y sin cuenta: ves la portada con su nombre, su retrato y las ${PREVIEW_SCENES} primeras escenas ilustradas antes de pagar.` },
      { term: "Fotos del niño", value: photo },
      { term: "Plazo de entrega", value: `Libro impreso: ${f.minDays}-${f.maxDays} días laborables, con seguimiento por correo. PDF: por correo, normalmente en menos de ${PDF_DELIVERY_MAX_MINUTES} minutos después de pagar.` },
      { term: "Envíos", value: "España peninsular y Baleares, envío gratis. No enviamos a Canarias, Ceuta, Melilla ni fuera de España; el PDF llega a cualquier lugar." },
      { term: "Devoluciones", value: `Al ser un producto personalizado no admite devoluciones (art. 103 c LGDCU). Si llega con un defecto de impresión o dañado, te enviamos otro gratis si nos avisas en los ${f.defectDays} días siguientes.` },
      { term: "Pago", value: "Con tarjeta, en la pasarela segura de Stripe." },
      { term: "Contacto", value: CONTACT_EMAIL },
    ],
    sections: [
      {
        heading: "Cómo se hace un cuento de Meapica",
        paragraphs: [
          "Escribes su nombre y su edad y eliges cómo es. Después eliges un mundo (el espacio, un bosque mágico, los piratas, los dinosaurios…) y los tres capítulos de su aventura, y escribes la dedicatoria.",
          `En un minuto ves su portada y las primeras escenas pintadas. Si te gusta, eliges el formato y pagas. El libro se imprime bajo demanda en Europa y llega a casa en ${f.minDays}-${f.maxDays} días laborables; con el libro impreso también recibes el PDF.`,
        ],
        link: { href: "/examples", label: "Ver cuentos de ejemplo, página a página" },
      },
      {
        heading: "Cómo funciona la vista previa",
        paragraphs: [
          `La vista previa es gratis y no necesitas registrarte. Ves la portada con su nombre, su retrato a acuarela y las ${PREVIEW_SCENES} primeras escenas ilustradas de su cuento, tal como se imprimirán.`,
          "Si su retrato no te convence, cambias su aspecto y volvemos a pintarlo. Solo pagas si te gusta, y antes de pedirlo puedes cambiar el título de la portada.",
        ],
      },
      {
        heading: "Privacidad de los datos del niño",
        paragraphs: [
          photo,
          `El nombre, la edad y los rasgos solo se usan para crear su libro. Puedes borrar tu cuenta y tus libros desde tu perfil o escribiéndonos a ${CONTACT_EMAIL}.`,
        ],
        link: { href: "/legal#privacy", label: "Política de privacidad" },
      },
      {
        heading: "Quién está detrás",
        paragraphs: [
          `Meapica es un proyecto de ${FOUNDER.name}, desde ${FOUNDER.city}. Escribe las guías de esta web y atiende el correo de ${CONTACT_EMAIL}. Los libros los imprime Gelato bajo demanda en Europa y los envía a casa.`,
        ],
        link: { href: "/legal#terms", label: "Aviso legal" },
      },
    ],
    faq: [
      {
        question: "¿Cuánto cuesta un cuento de Meapica?",
        answer: `Tapa blanda, ${f.softcover}; tapa dura, ${f.hardcover}; solo el PDF, ${f.pdf}. Todos los precios son finales, con el IVA incluido, y el libro impreso incluye el envío y el PDF.`,
      },
      {
        question: "¿Cuánto tarda en llegar?",
        answer: `El libro impreso llega en ${f.minDays}-${f.maxDays} días laborables a la Península y Baleares. El PDF llega por correo, normalmente en menos de ${PDF_DELIVERY_MAX_MINUTES} minutos. Para Reyes, pide el libro impreso antes del ${f.reyesDate}.`,
      },
      {
        question: "¿Hay que subir una foto del niño?",
        answer: ctx.photoUpload
          ? `No es obligatorio. Si la subes, solo se usa para pintar su retrato y se borra en menos de ${PHOTO_MAX_AGE_HOURS} horas; el libro no la usa.`
          : "No. El retrato se pinta con los rasgos que eliges (piel, pelo, peinado, ojos, gafas y pecas): se le parece sin ninguna foto.",
      },
      {
        question: "¿Puedo ver el libro antes de pagar?",
        answer: `Sí. Creas su cuento gratis y sin registrarte y ves la portada, su retrato y las ${PREVIEW_SCENES} primeras escenas ilustradas. Solo pagas si te gusta.`,
      },
      {
        question: "¿En qué idiomas está?",
        answer: "En español, catalán, inglés y francés. El cuento en catalán se escribe directamente en catalán, no es una traducción.",
      },
      {
        question: "¿Envían a Canarias o fuera de España?",
        answer: "De momento no. El libro impreso se envía a la Península y Baleares. Para Canarias, Ceuta, Melilla u otros países está el PDF, que llega por correo a cualquier lugar.",
      },
    ],
    relatedHeading: "Más sobre Meapica",
  };
};

const ca = (f: GuideFacts, ctx: AboutContext): AboutGuideCopy => {
  const photo = ctx.photoUpload
    ? `Pujar una foto és opcional i necessita el teu consentiment. Si la puges, només serveix per pintar el seu retrat: s'esborra en menys de ${PHOTO_MAX_AGE_HOURS} hores i el llibre no la fa servir mai.`
    : "No cal pujar cap foto. El retrat es pinta a partir dels trets que tries: pell, cabell, pentinat, ulls, ulleres i pigues.";
  return {
    metaTitle: "Què és Meapica: preus, formats, enviaments i privacitat",
    metaDescription: `Meapica fa contes personalitzats impresos per a infants de ${f.ageMin} a ${f.ageMax} anys, des de Barcelona. Preus amb IVA inclòs, terminis d'entrega, idiomes i privacitat en una pàgina.`,
    breadcrumb: "Què és Meapica",
    eyebrow: "Fitxa de Meapica",
    h1: "Què és Meapica",
    lead: `Meapica fa contes infantils personalitzats: un llibre imprès de ${f.size} × ${f.size} cm amb el nom de l'infant a la portada, un retrat a l'aquarel·la que s'hi assembla i una aventura amb els capítols que tries tu. El fa ${FOUNDER.legalName} des de ${FOUNDER.city} i es ven a Espanya.`,
    cta: "Crear el seu conte",
    trust: ["Vista prèvia gratuïta i sense registrar-te", "Preus amb IVA inclòs", "Enviament gratuït a la Península i les Balears"],
    factsHeading: "Meapica en dades",
    updatedLabel: (date) => `Actualitzat el ${date}`,
    byline: `Per ${FOUNDER.name}`,
    facts: [
      { term: "Què és", value: `Contes infantils personalitzats, impresos sota demanda, per a infants de ${f.ageMin} a ${f.ageMax} anys. Cada món té la seva franja d'edat.` },
      { term: "Qui el fa", value: `${FOUNDER.legalName}, des de ${FOUNDER.city} (Espanya). Les dades completes són a l'avís legal.` },
      { term: "Formats i preus", value: `Tapa dura, ${f.hardcover}. Tapa tova, ${f.softcover}. Només PDF, ${f.pdf}. Preus finals, IVA inclòs. El llibre imprès inclou l'enviament i el PDF.` },
      { term: "El llibre", value: `${f.size} × ${f.size} cm, ${f.pages} pàgines, ${f.scenes} escenes il·lustrades, paper estucat setinat de ${f.paper} g i portada amb laminat mat.` },
      { term: "Què es personalitza", value: "El nom, l'aspecte (pell, cabell, ulls, ulleres, pigues), la dedicatòria i els tres capítols de l'aventura." },
      { term: "Idiomes", value: "Català, castellà, anglès i francès. El conte en català s'escriu directament en català, no es tradueix." },
      { term: "Vista prèvia", value: `Gratuïta i sense compte: veus la portada amb el seu nom, el seu retrat i les ${PREVIEW_SCENES} primeres escenes il·lustrades abans de pagar.` },
      { term: "Fotos de l'infant", value: photo },
      { term: "Termini d'entrega", value: `Llibre imprès: ${f.minDays}-${f.maxDays} dies laborables, amb seguiment per correu. PDF: per correu, normalment en menys de ${PDF_DELIVERY_MAX_MINUTES} minuts després de pagar.` },
      { term: "Enviaments", value: "Espanya peninsular i Balears, enviament gratuït. No enviem a Canàries, Ceuta, Melilla ni fora d'Espanya; el PDF arriba a qualsevol lloc." },
      { term: "Devolucions", value: `Com que és un producte personalitzat, no admet devolucions (art. 103 c LGDCU). Si arriba amb un defecte d'impressió o malmès, te n'enviem un altre de franc si ens avises en els ${f.defectDays} dies següents.` },
      { term: "Pagament", value: "Amb targeta, a la passarel·la segura de Stripe." },
      { term: "Contacte", value: CONTACT_EMAIL },
    ],
    sections: [
      {
        heading: "Com es fa un conte de Meapica",
        paragraphs: [
          "Escrius el seu nom i la seva edat i tries com és. Després tries un món (l'espai, un bosc màgic, els pirates, els dinosaures…) i els tres capítols de la seva aventura, i escrius la dedicatòria.",
          `En un minut veus la seva portada i les primeres escenes pintades. Si t'agrada, tries el format i pagues. El llibre s'imprimeix sota demanda a Europa i arriba a casa en ${f.minDays}-${f.maxDays} dies laborables; amb el llibre imprès també reps el PDF.`,
        ],
        link: { href: "/examples", label: "Veure contes d'exemple, pàgina a pàgina" },
      },
      {
        heading: "Com funciona la vista prèvia",
        paragraphs: [
          `La vista prèvia és gratuïta i no cal registrar-se. Veus la portada amb el seu nom, el seu retrat a l'aquarel·la i les ${PREVIEW_SCENES} primeres escenes il·lustrades del seu conte, tal com s'imprimiran.`,
          "Si el retrat no et convenç, canvies el seu aspecte i el tornem a pintar. Només pagues si t'agrada, i abans de demanar-lo pots canviar el títol de la portada.",
        ],
      },
      {
        heading: "Privacitat de les dades de l'infant",
        paragraphs: [
          photo,
          `El nom, l'edat i els trets només s'usen per crear el seu llibre. Pots esborrar el teu compte i els teus llibres des del teu perfil o escrivint-nos a ${CONTACT_EMAIL}.`,
        ],
        link: { href: "/legal#privacy", label: "Política de privacitat" },
      },
      {
        heading: "Qui hi ha al darrere",
        paragraphs: [
          `Meapica és un projecte de ${FOUNDER.name}, des de ${FOUNDER.city}. Escriu les guies d'aquest web i respon el correu de ${CONTACT_EMAIL}. Els llibres els imprimeix Gelato sota demanda a Europa i els envia a casa.`,
        ],
        link: { href: "/legal#terms", label: "Avís legal" },
      },
    ],
    faq: [
      {
        question: "Quant costa un conte de Meapica?",
        answer: `Tapa tova, ${f.softcover}; tapa dura, ${f.hardcover}; només el PDF, ${f.pdf}. Tots els preus són finals, amb l'IVA inclòs, i el llibre imprès inclou l'enviament i el PDF.`,
      },
      {
        question: "Quant triga a arribar?",
        answer: `El llibre imprès arriba en ${f.minDays}-${f.maxDays} dies laborables a la Península i les Balears. El PDF arriba per correu, normalment en menys de ${PDF_DELIVERY_MAX_MINUTES} minuts. Per Reis, demana el llibre imprès abans del ${f.reyesDate}.`,
      },
      {
        question: "Cal pujar una foto de l'infant?",
        answer: ctx.photoUpload
          ? `No és obligatori. Si la puges, només s'usa per pintar el seu retrat i s'esborra en menys de ${PHOTO_MAX_AGE_HOURS} hores; el llibre no la fa servir.`
          : "No. El retrat es pinta amb els trets que tries (pell, cabell, pentinat, ulls, ulleres i pigues): s'hi assembla sense cap foto.",
      },
      {
        question: "Puc veure el llibre abans de pagar?",
        answer: `Sí. Crees el seu conte de franc i sense registrar-te i veus la portada, el seu retrat i les ${PREVIEW_SCENES} primeres escenes il·lustrades. Només pagues si t'agrada.`,
      },
      {
        question: "En quins idiomes està?",
        answer: "En català, castellà, anglès i francès. El conte en català s'escriu directament en català, no és una traducció.",
      },
      {
        question: "Envieu a Canàries o fora d'Espanya?",
        answer: "De moment no. El llibre imprès s'envia a la Península i les Balears. Per a Canàries, Ceuta, Melilla o altres països hi ha el PDF, que arriba per correu a qualsevol lloc.",
      },
    ],
    relatedHeading: "Més sobre Meapica",
  };
};

export const ABOUT_GUIDE_COPY: Record<string, (f: GuideFacts, ctx: AboutContext) => AboutGuideCopy> = { es, ca };
