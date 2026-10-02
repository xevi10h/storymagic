// /personalized-books/in-catalan — es + ca only. The ca text is written natively
// in Catalan (not translated from the es one); the es page targets Spanish-speaking
// buyers of a Catalan book (grandparents, families with school in Catalan) and its
// CTA opens the Catalan site, because the book is written in the site's language.
//
// Facts this page relies on (verify before editing): the story is written directly
// in the locale's language (lib/ai/book-plan.ts, native-Catalan rules + the personal
// article check, findCatalanArticleIssues); order e-mails exist in ca
// (lib/email/order-emails.ts); Stripe Checkout has no Catalan locale (lib/pricing.ts).

import type { GuideBaseCopy, GuideFacts } from "./types";

export type CatalanGuideCopy = GuideBaseCopy & { hubCrumb: string; exampleCaption: string };

const ca = (f: GuideFacts): CatalanGuideCopy => ({
  metaTitle: "Conte personalitzat en català amb el seu nom | Meapica",
  metaDescription:
    "Llibre personalitzat per a nens escrit directament en català: el seu nom a la portada i el seu retrat a l'aquarel·la. Vista prèvia gratuïta.",
  breadcrumb: "En català",
  hubCrumb: "Contes personalitzats",
  exampleCaption: "és un dels nostres llibres d'exemple en català.",
  eyebrow: "Contes personalitzats en català",
  h1: "Conte personalitzat en català, escrit en català de debò",
  lead:
    "No és un conte en castellà passat pel traductor. La història s'escriu en català des de la primera frase, amb el seu nom i el seu article (en Pol, la Martina, l'Arnau), el seu retrat pintat a l'aquarel·la i l'aventura que tries tu.",
  cta: "Crear el seu conte",
  trust: ["Veus les primeres pàgines abans de pagar", "Tapa dura o tova, amb PDF inclòs", "Fet a Barcelona"],
  sections: [
    {
      heading: "Escrit en català, no traduït",
      paragraphs: [
        "Cada conte s'escriu en l'idioma de la web on el crees. A la versió en català tot el procés és en català, i la història s'escriu directament en català, amb el vocabulari i les construccions de casa: sense castellanismes ni frases calcades.",
        "El nom sempre porta el seu article, com quan el dius en veu alta: en Pol, la Martina, l'Arnau, d'en Biel. Abans d'il·lustrar el llibre, el text passa un control que comprova pàgina a pàgina que l'article hi és i que tot concorda amb nen, nena o neutre.",
      ],
    },
    {
      heading: "Per a les dates que aquí celebrem",
      paragraphs: [
        `Per Sant Jordi, un llibre amb el seu nom al costat de la rosa. L'imprimim per encàrrec i arriba en ${f.minDays}-${f.maxDays} dies laborables, així que demana'l almenys dues setmanes abans del 23 d'abril.`,
        `Per Reis, si el vols a casa abans de la nit del 5 de gener, demana'l fins al ${f.reyesDate}. Mentrestant, pots imprimir gratis la carta als Reis d'Orient amb el seu nom i el seu retrat, també en català.`,
        "I serveix igual per a l'aniversari, el sant o el final de curs: la dedicatòria l'escrius tu i obre el llibre.",
      ],
    },
    {
      heading: "A l'escola en català, el seu conte també",
      paragraphs: [
        "Molts nens aprenen a llegir en català a l'escola. Un conte on el protagonista és ell, amb el seu nom a cada pàgina, li dona un motiu per llegir a casa en la mateixa llengua de la classe.",
        `El text s'escriu per a la seva edat, de ${f.ageMin} a ${f.ageMax} anys: frases curtes i una tornada que es repeteix per als més petits, més història i reptes de debò a partir dels 8.`,
        "Si a casa parleu castellà, també el pots fer en castellà; i si és per a uns cosins de fora, en anglès o en francès.",
      ],
    },
    {
      heading: "Un regal dels avis, amb les seves paraules",
      paragraphs: [
        "La dedicatòria és la primera pàgina del llibre i l'imprimim tal com l'escrius, amb el vostre nom al peu. És la pàgina que rellegirà de gran.",
        "Si els avis no viuen a prop, el poden crear des del mòbil i fer-lo arribar directament a casa del nét: enviem a qualsevol adreça de la Península i les Balears, amb l'enviament inclòs.",
      ],
    },
    {
      heading: "Què hi ha dins del llibre",
      paragraphs: [
        `Un llibre quadrat de ${f.size} × ${f.size} cm, amb ${f.pages} pàgines, ${f.scenes} escenes pintades a l'aquarel·la i paper estucat setinat de ${f.paper} g. Fet a Barcelona, imprès a Europa.`,
        `Tapa dura, ${f.hardcover} IVA inclòs; tapa tova, ${f.softcover} IVA inclòs; totes dues amb l'enviament gratuït i el PDF del conte. Només el PDF: ${f.pdf} IVA inclòs.`,
        "Una cosa que val la pena saber: la pantalla de pagament és de Stripe, que no té versió en català, i la veuràs en castellà. Els correus de la comanda i el llibre, en català.",
      ],
    },
  ],
  faq: [
    {
      question: "El conte està escrit en català o traduït del castellà?",
      answer:
        "Escrit en català. Quan el crees a la versió en català de la web, la història s'escriu directament en català, amb l'article davant del nom (en Pol, la Martina), i un control comprova cada pàgina abans d'il·lustrar-la.",
    },
    {
      question: "Quant costa un conte personalitzat en català?",
      answer: `El mateix que en qualsevol idioma: tapa tova, ${f.softcover}; tapa dura, ${f.hardcover}; només el PDF, ${f.pdf}. Tots els preus amb l'IVA inclòs, i el llibre imprès porta l'enviament i el PDF.`,
    },
    {
      question: "Arriba a temps per Reis o per Sant Jordi?",
      answer: `Arriba en ${f.minDays}-${f.maxDays} dies laborables a la Península i les Balears (de moment no a Canàries, Ceuta ni Melilla). Per tenir-lo abans de Reis, demana'l fins al ${f.reyesDate}; per Sant Jordi, almenys dues setmanes abans del 23 d'abril. Si vas tard, el PDF t'arriba per correu, normalment en menys d'una hora.`,
    },
    {
      question: "El puc veure abans de pagar?",
      answer:
        "Sí. El crees gratis i sense registrar-te, i veus la portada amb el seu nom, el seu retrat i les primeres escenes il·lustrades del seu conte. Només pagues si t'agrada.",
    },
  ],
  relatedHeading: "També et pot interessar",
  closing: {
    eyebrow: "En català, de la primera a l'última pàgina",
    heading: "El seu conte, en la llengua en què aprèn a llegir",
    text: "Escriu el seu nom, tria com és i quina aventura viurà, i mira'n les primeres pàgines abans de pagar.",
  },
});

const es = (f: GuideFacts): CatalanGuideCopy => ({
  metaTitle: "Cuento personalizado en catalán con su nombre | Meapica",
  metaDescription:
    "Un cuento escrito directamente en catalán, no traducido: su nombre en la portada y su retrato en acuarela. Vista previa gratis. Envío gratis.",
  breadcrumb: "En catalán",
  hubCrumb: "Cuentos personalizados",
  exampleCaption: "es uno de nuestros libros de ejemplo en catalán.",
  eyebrow: "Cuentos personalizados en catalán",
  h1: "Cuento personalizado en catalán, escrito en catalán de verdad",
  lead:
    "No es un cuento en castellano pasado por un traductor. La historia se escribe en catalán desde la primera frase, con su nombre y su artículo, como se dice allí (en Pol, la Martina), su retrato pintado en acuarela y la aventura que eliges tú.",
  cta: "Crear su cuento en catalán",
  ctaNote: "Se abre la web en catalán: el cuento se escribe en el idioma en el que lo creas.",
  trust: ["Ves las primeras páginas antes de pagar", "Tapa dura o blanda, con PDF incluido", "Hecho en Barcelona"],
  sections: [
    {
      heading: "En catalán desde la primera frase, no traducido",
      paragraphs: [
        "Cada cuento se escribe en el idioma de la web en la que lo creas. En la versión en catalán, la historia se escribe directamente en catalán, con su vocabulario y sus construcciones: sin castellanismos ni frases calcadas.",
        "En catalán, los nombres llevan artículo: en Pol, la Martina, l'Arnau. Es un detalle que se pierde fácilmente en una traducción y que un niño que lee en catalán nota enseguida. Antes de ilustrar el libro, el texto pasa un control que comprueba página a página que el artículo está y que todo concuerda con niño, niña o neutro.",
      ],
    },
    {
      heading: "Para quién es",
      paragraphs: [
        "Para familias que hablan catalán en casa, para niños que aprenden a leer en catalán en el colegio aunque en casa se hable castellano, y para abuelos, tíos o padrinos que quieren regalar en la lengua del niño aunque ellos no la escriban.",
        "Si no hablas catalán, no pasa nada: las preguntas son sencillas (cómo se llama, cómo es, qué aventura vivirá) y la dedicatoria la escribes en el idioma que quieras. La imprimimos tal cual, en la primera página.",
      ],
    },
    {
      heading: "Sant Jordi, Reyes y el resto del año",
      paragraphs: [
        `Para Sant Jordi, un libro con su nombre junto a la rosa. Lo imprimimos bajo demanda y llega en ${f.minDays}-${f.maxDays} días laborables, así que pídelo al menos dos semanas antes del 23 de abril.`,
        `Para Reyes, si lo quieres en casa antes de la noche del 5 de enero, pídelo hasta el ${f.reyesDate}. Mientras llega, puedes imprimir gratis la carta a los Reyes Magos con su nombre y su retrato, en castellano o en catalán.`,
        "Y sirve igual para un cumpleaños, el santo o el fin de curso.",
      ],
    },
    {
      heading: "Qué incluye y cuánto cuesta",
      paragraphs: [
        `Un libro cuadrado de ${f.size} × ${f.size} cm, con ${f.pages} páginas, ${f.scenes} escenas pintadas en acuarela y papel estucado seda de ${f.paper} g. Hecho en Barcelona, impreso en Europa.`,
        `Tapa dura, ${f.hardcover} IVA incluido; tapa blanda, ${f.softcover} IVA incluido; las dos con envío gratis y el PDF del cuento. Solo el PDF: ${f.pdf} IVA incluido. Enviamos a España peninsular y Baleares.`,
        "Un detalle honesto: la pantalla de pago es de Stripe, que no tiene versión en catalán, y se muestra en castellano. Los correos del pedido y el libro van en catalán.",
      ],
    },
  ],
  faq: [
    {
      question: "¿El cuento está escrito en catalán o traducido?",
      answer:
        "Escrito en catalán. Si lo creas en la versión en catalán de la web, la historia se escribe directamente en catalán, con el artículo delante del nombre (en Pol, la Martina), y un control revisa cada página antes de ilustrarla.",
    },
    {
      question: "¿Puedo crearlo en catalán si yo no hablo catalán?",
      answer:
        "Sí. Las preguntas son pocas y sencillas (nombre, aspecto, mundo y capítulos) y la dedicatoria puedes escribirla en castellano o en catalán: la imprimimos tal como la escribes.",
    },
    {
      question: "¿Cuánto cuesta un cuento personalizado en catalán?",
      answer: `Lo mismo que en cualquier idioma: tapa blanda, ${f.softcover}; tapa dura, ${f.hardcover}; solo el PDF, ${f.pdf}. Todos los precios llevan el IVA incluido, y el libro impreso incluye el envío y el PDF.`,
    },
    {
      question: "¿Llega para Reyes o para Sant Jordi?",
      answer: `Llega en ${f.minDays}-${f.maxDays} días laborables a España peninsular y Baleares. Para Reyes, pídelo hasta el ${f.reyesDate}; para Sant Jordi, al menos dos semanas antes del 23 de abril. Si vas tarde, el PDF te llega por correo, normalmente en menos de una hora.`,
    },
  ],
  relatedHeading: "También te puede interesar",
  closing: {
    eyebrow: "En catalán, de la primera a la última página",
    heading: "Su cuento, en la lengua en la que aprende a leer",
    text: "Escribe su nombre, elige cómo es y qué aventura vivirá, y mira sus primeras páginas antes de pagar.",
  },
});

export const CATALAN_GUIDE_COPY: Record<string, (f: GuideFacts) => CatalanGuideCopy> = { ca, es };
