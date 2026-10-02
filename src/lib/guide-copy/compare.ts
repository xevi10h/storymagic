// /compare — es + ca only. Honest, dated comparison with the personalised-book
// brands sold in Spain. Competitor facts come ONLY from their official sites, read
// on COMPARE_CHECKED_ON (each cell cites a source of COMPARE_SOURCES). A fact we
// could not verify is "no indicado". Never add a fact without a source URL, never
// use their logos, never disparage. Re-check every fact (and bump the date here and
// GUIDES_CONTENT_UPDATED in lib/guides.ts) before changing any of it.
//
// Micuento was left out: micuento.com did not resolve on 2026-10-02 (stated on the page).
// Meapica's column is derived from product-facts.ts (prices VAT-inclusive, B2C).

import { STORY_TEMPLATES } from "@/lib/create-store";
import type { GuideBaseCopy, GuideFacts } from "./types";

const WORLDS = STORY_TEMPLATES.length;

export const COMPARE_CHECKED_ON = "2026-10-02";

type L = { es: string; ca: string };

export const COMPARE_ROWS = ["price", "formats", "catalan", "languages", "shipping", "preview", "personalisation"] as const;
export type CompareRow = (typeof COMPARE_ROWS)[number];

export interface CompareSource {
  url: string;
  brand: string;
  what: L;
}

/** Numbered in this order on the page (1-based). */
export const COMPARE_SOURCES: CompareSource[] = [
  { brand: "Mumablue", url: "https://www.mumablue.com/esp/inicio", what: { es: "Inicio: precios de los cuentos, licencias y opiniones", ca: "Inici: preus dels contes, llicències i opinions" } },
  { brand: "Mumablue", url: "https://www.mumablue.com/esp/preguntas-frecuentes", what: { es: "Preguntas frecuentes: formato, idiomas y coste de envío", ca: "Preguntes freqüents: format, idiomes i cost d'enviament" } },
  { brand: "Mumablue", url: "https://www.mumablue.com/esp/como-funciona", what: { es: "Cómo funciona: personalización y previsualización", ca: "Com funciona: personalització i previsualització" } },
  { brand: "Mumablue", url: "https://www.mumablue.com/esp/nuestros-cuentos-personalizados/burbujas", what: { es: "Ficha de un cuento: plazo mínimo de entrega", ca: "Fitxa d'un conte: termini mínim de lliurament" } },
  { brand: "Wonderbly", url: "https://www.wonderbly.com/es/personalized-products/lost-my-name-book", what: { es: "Superventas: precio, formatos, tamaño e idiomas", ca: "El més venut: preu, formats, mida i idiomes" } },
  { brand: "Wonderbly", url: "https://www.wonderbly.com/es/help?a=Vuestros-libros-estan-disponibles-en-varios-idiomas---id--hQFUsLC0QSeZdEmIv0TUBw", what: { es: "Ayuda: idiomas disponibles", ca: "Ajuda: idiomes disponibles" } },
  { brand: "Wonderbly", url: "https://www.wonderbly.com/es/pages/delivery-info", what: { es: "Envíos: plazos y coste", ca: "Enviaments: terminis i cost" } },
  { brand: "Wonderbly", url: "https://www.wonderbly.com/es/help?a=Como-puedo-crear-mi-libro---id--vBaWPMS0SrC_caVKrpqGDA", what: { es: "Ayuda: vista previa completa", ca: "Ajuda: vista prèvia completa" } },
  { brand: "Wonderbly", url: "https://www.wonderbly.com/es/help?a=Los-personajes-disponibles-no-se-me-parecen-podeis-anadir-mas-opciones---id--Z7T1X5KoT7eA7PkvoxIGhA", what: { es: "Ayuda: combinaciones del personaje", ca: "Ajuda: combinacions del personatge" } },
  { brand: "Wonderbly", url: "https://www.wonderbly.com/es/pages/our-story", what: { es: "Nuestra historia: catálogo, idiomas y grupo editorial", ca: "La nostra història: catàleg, idiomes i grup editorial" } },
  { brand: "Hurra Héroes", url: "https://hurraheroes.es/collections/libros-para-un-nino", what: { es: "Libros para un niño: precios", ca: "Llibres per a un nen: preus" } },
  { brand: "Hurra Héroes", url: "https://hurraheroes.es/pages/terms-and-conditions", what: { es: "Condiciones: precios con IVA", ca: "Condicions: preus amb IVA" } },
  { brand: "Hurra Héroes", url: "https://hurraheroes.es/pages/faq-merchandise", what: { es: "Preguntas frecuentes: formatos e idiomas", ca: "Preguntes freqüents: formats i idiomes" } },
  { brand: "Hurra Héroes", url: "https://hurraheroes.es/pages/shipping-payment-and-return", what: { es: "Envío y pago: tarifas y destinos", ca: "Enviament i pagament: tarifes i destinacions" } },
  { brand: "Hurra Héroes", url: "https://hurraheroes.es/pages/faq-book-order", what: { es: "Preguntas frecuentes del pedido: vista previa y personalización", ca: "Preguntes freqüents de la comanda: vista prèvia i personalització" } },
];

const src = (url: string) => COMPARE_SOURCES.findIndex((s) => s.url === url) + 1;

export interface CompareCellCopy {
  text: L;
  source?: number;
}

export interface CompareBrand {
  id: string;
  name: string;
  url: string;
  cells: Record<CompareRow, CompareCellCopy>;
  /** Where they are clearly better than us (from their own site). */
  strengths: { text: L; source: number }[];
}

export const COMPARE_BRANDS: CompareBrand[] = [
  {
    id: "mumablue",
    name: "Mumablue",
    url: "https://www.mumablue.com/esp/inicio",
    cells: {
      price: { text: { es: "Desde 24,99 € (precio mostrado en su web; envío aparte)", ca: "Des de 24,99 € (preu que mostra la seva web; enviament a part)" }, source: src("https://www.mumablue.com/esp/inicio") },
      formats: { text: { es: "Tapa dura, 22 × 22 cm, 44 páginas", ca: "Tapa dura, 22 × 22 cm, 44 pàgines" }, source: src("https://www.mumablue.com/esp/preguntas-frecuentes") },
      catalan: { text: { es: "Sí", ca: "Sí" }, source: src("https://www.mumablue.com/esp/preguntas-frecuentes") },
      languages: {
        text: { es: "11 idiomas, entre ellos castellano, catalán, gallego y euskera", ca: "11 idiomes, entre els quals castellà, català, gallec i basc" },
        source: src("https://www.mumablue.com/esp/preguntas-frecuentes"),
      },
      shipping: {
        text: { es: "Sí. Coste visible en el carrito; entrega mínima de 6 días laborables", ca: "Sí. Cost visible a la cistella; lliurament mínim de 6 dies laborables" },
        source: src("https://www.mumablue.com/esp/nuestros-cuentos-personalizados/burbujas"),
      },
      preview: {
        text: { es: "Sí, previsualización antes del carrito (no indica si es el libro entero)", ca: "Sí, previsualització abans de la cistella (no indica si és el llibre sencer)" },
        source: src("https://www.mumablue.com/esp/como-funciona"),
      },
      personalisation: {
        text: {
          es: "Nombre y personaje por opciones (pelo, peinado, ojos, complexión, ropa); foto opcional del niño y dedicatoria",
          ca: "Nom i personatge per opcions (cabell, pentinat, ulls, complexió, roba); foto opcional del nen i dedicatòria",
        },
        source: src("https://www.mumablue.com/esp/como-funciona"),
      },
    },
    strengths: [
      { text: { es: "Cuentos con licencias: Frozen, Toy Story, FC Barcelona o Miraculous.", ca: "Contes amb llicències: Frozen, Toy Story, FC Barcelona o Miraculous." }, source: src("https://www.mumablue.com/esp/inicio") },
      { text: { es: "Además del catalán, ediciones en gallego y euskera.", ca: "A més del català, edicions en gallec i basc." }, source: src("https://www.mumablue.com/esp/preguntas-frecuentes") },
      { text: { es: "Libros de familia con varios adultos y niños, y miles de opiniones publicadas.", ca: "Llibres de família amb diversos adults i nens, i milers d'opinions publicades." }, source: src("https://www.mumablue.com/esp/inicio") },
    ],
  },
  {
    id: "wonderbly",
    name: "Wonderbly",
    url: "https://www.wonderbly.com/es",
    cells: {
      price: { text: { es: "Desde 29,99 € tapa blanda (precio mostrado en su web; envío aparte)", ca: "Des de 29,99 € tapa tova (preu que mostra la seva web; enviament a part)" }, source: src("https://www.wonderbly.com/es/personalized-products/lost-my-name-book") },
      formats: { text: { es: "Tapa blanda, tapa dura y tapa dura plana prémium; A4 en su superventas", ca: "Tapa tova, tapa dura i tapa dura plana prèmium; A4 en el més venut" }, source: src("https://www.wonderbly.com/es/personalized-products/lost-my-name-book") },
      catalan: { text: { es: "No (no aparece en sus idiomas)", ca: "No (no apareix entre els seus idiomes)" }, source: src("https://www.wonderbly.com/es/help?a=Vuestros-libros-estan-disponibles-en-varios-idiomas---id--hQFUsLC0QSeZdEmIv0TUBw") },
      languages: { text: { es: "Varía por libro: castellano, inglés, francés, alemán, italiano y otros", ca: "Depèn del llibre: castellà, anglès, francès, alemany, italià i altres" }, source: src("https://www.wonderbly.com/es/help?a=Vuestros-libros-estan-disponibles-en-varios-idiomas---id--hQFUsLC0QSeZdEmIv0TUBw") },
      shipping: {
        text: { es: "Sí, desde Europa. Impreso en 2-4 días laborables más el envío (urgente, 3-5 días); envío siempre de pago", ca: "Sí, des d'Europa. Imprès en 2-4 dies laborables més l'enviament (urgent, 3-5 dies); enviament sempre de pagament" },
        source: src("https://www.wonderbly.com/es/pages/delivery-info"),
      },
      preview: { text: { es: "Sí, vista previa completa", ca: "Sí, vista prèvia completa" }, source: src("https://www.wonderbly.com/es/help?a=Como-puedo-crear-mi-libro---id--vBaWPMS0SrC_caVKrpqGDA") },
      personalisation: {
        text: { es: "Historia construida con su nombre y personaje por opciones; dedicatoria", ca: "Història construïda amb el seu nom i personatge per opcions; dedicatòria" },
        source: src("https://www.wonderbly.com/es/help?a=Los-personajes-disponibles-no-se-me-parecen-podeis-anadir-mas-opciones---id--Z7T1X5KoT7eA7PkvoxIGhA"),
      },
    },
    strengths: [
      { text: { es: "Un catálogo muy amplio: más de 200 libros en 12 idiomas; forma parte de Penguin Random House.", ca: "Un catàleg molt ampli: més de 200 llibres en 12 idiomes; forma part de Penguin Random House." }, source: src("https://www.wonderbly.com/es/pages/our-story") },
      { text: { es: "Producción rápida: impreso en 2-4 días laborables, con envío urgente.", ca: "Producció ràpida: imprès en 2-4 dies laborables, amb enviament urgent." }, source: src("https://www.wonderbly.com/es/pages/delivery-info") },
      { text: { es: "Puedes leer la vista previa completa antes de comprar.", ca: "Pots llegir la vista prèvia completa abans de comprar." }, source: src("https://www.wonderbly.com/es/help?a=Como-puedo-crear-mi-libro---id--vBaWPMS0SrC_caVKrpqGDA") },
    ],
  },
  {
    id: "hurra-heroes",
    name: "Hurra Héroes",
    url: "https://hurraheroes.es/",
    cells: {
      price: {
        text: { es: "Desde 29,99 € tapa blanda, IVA incluido según sus condiciones; envío aparte", ca: "Des de 29,99 € tapa tova, IVA inclòs segons les seves condicions; enviament a part" },
        source: src("https://hurraheroes.es/collections/libros-para-un-nino"),
      },
      formats: { text: { es: "Tapa blanda o dura (A4 apaisado en los clásicos)", ca: "Tapa tova o dura (A4 apaïsat en els clàssics)" }, source: src("https://hurraheroes.es/pages/faq-merchandise") },
      catalan: { text: { es: "No (no aparece en sus idiomas)", ca: "No (no apareix entre els seus idiomes)" }, source: src("https://hurraheroes.es/pages/faq-merchandise") },
      languages: { text: { es: "Castellano; también inglés, alemán, francés, portugués, italiano y otros", ca: "Castellà; també anglès, alemany, francès, portuguès, italià i altres" }, source: src("https://hurraheroes.es/pages/faq-merchandise") },
      shipping: {
        text: { es: "Sí, sin Canarias, Ceuta ni Melilla. Estándar 6,99 €; urgente en hasta 6 días laborables", ca: "Sí, sense Canàries, Ceuta ni Melilla. Estàndard 6,99 €; urgent en fins a 6 dies laborables" },
        source: src("https://hurraheroes.es/pages/shipping-payment-and-return"),
      },
      preview: { text: { es: "Sí, el libro entero", ca: "Sí, el llibre sencer" }, source: src("https://hurraheroes.es/pages/faq-book-order") },
      personalisation: {
        text: {
          es: "Nombre y personaje por opciones (piel, ojos, pelo, pecas, gafas); eliges 10 o 15 historias; dedicatoria",
          ca: "Nom i personatge per opcions (pell, ulls, cabell, pigues, ulleres); tries 10 o 15 històries; dedicatòria",
        },
        source: src("https://hurraheroes.es/pages/faq-book-order"),
      },
    },
    strengths: [
      { text: { es: "Eliges qué historias entran en el libro y puede haber hasta cinco personajes.", ca: "Tries quines històries entren al llibre i hi pot haver fins a cinc personatges." }, source: src("https://hurraheroes.es/pages/faq-book-order") },
      { text: { es: "Puedes leer el libro entero antes de pedirlo.", ca: "Pots llegir el llibre sencer abans de demanar-lo." }, source: src("https://hurraheroes.es/pages/faq-book-order") },
      { text: { es: "Tarifa de envío publicada y baja para la península (6,99 €).", ca: "Tarifa d'enviament publicada i baixa per a la Península (6,99 €)." }, source: src("https://hurraheroes.es/pages/shipping-payment-and-return") },
    ],
  },
];

export interface CompareGuideCopy extends GuideBaseCopy {
  checkedLabel: string;
  tableHeading: string;
  tableCaption: string;
  rowLabels: Record<CompareRow, string>;
  meapica: Record<CompareRow, string>;
  tableNotes: string[];
  sourceLabel: (n: number) => string;
  scrollHint: string;
  strengthsHeading: string;
  strengthsIntro: string;
  ownHeading: string;
  ownGood: string[];
  ownWeak: string[];
  ownGoodLabel: string;
  ownWeakLabel: string;
  sourcesHeading: string;
  sourcesIntro: string;
  langKey: "es" | "ca";
}

const es = (f: GuideFacts, n: number): CompareGuideCopy => ({
  langKey: "es",
  metaTitle: "Mejores cuentos personalizados: comparativa 2026 | Meapica",
  metaDescription:
    "Meapica, Mumablue, Wonderbly y Hurra Héroes con datos de sus webs: precio, formatos, catalán, envío y vista previa. Con fuentes y fecha de revisión.",
  breadcrumb: "Comparativa",
  eyebrow: "Comparativa con fuentes",
  h1: "Mejores cuentos personalizados en España: comparativa honesta",
  lead:
    "Comparamos los cuentos personalizados que se venden en España con lo que cada marca publica en su propia web: precio, formatos, idiomas, envío, vista previa y cómo se personaliza. Somos Meapica, así que también te contamos dónde los demás son mejores.",
  cta: "Crear su libro",
  trust: ["Cada dato enlaza a su fuente", "Datos revisados el 2 oct 2026"],
  checkedLabel: "Datos revisados el 2 oct 2026",
  tableHeading: "La tabla, dato a dato",
  tableCaption: "Comparativa de cuentos personalizados vendidos en España, con datos revisados el 2 de octubre de 2026",
  rowLabels: {
    price: "Precio desde (libro impreso)",
    formats: "Formatos",
    catalan: "En catalán",
    languages: "Idiomas",
    shipping: "Envío en España",
    preview: "Vista previa antes de pagar",
    personalisation: "Cómo se personaliza",
  },
  meapica: {
    price: `Desde ${f.softcover} tapa blanda, IVA incluido, envío incluido (tapa dura ${f.hardcover} IVA incluido)`,
    formats: `Tapa blanda o dura, ${f.size} × ${f.size} cm, ${f.pages} páginas, con PDF; o solo PDF (${f.pdf} IVA incluido)`,
    catalan: "Sí, escrito directamente en catalán",
    languages: "Castellano, catalán, inglés y francés",
    shipping: `Gratis a la península y Baleares (no Canarias, Ceuta ni Melilla); ${f.minDays}-${f.maxDays} días laborables`,
    preview: `Sí: portada, retrato y las ${n} primeras escenas (no el libro entero)`,
    personalisation: "Nombre, retrato en acuarela por rasgos (piel, pelo, peinado, ojos, gafas, pecas), mundo y 3 capítulos que eliges; dedicatoria",
  },
  tableNotes: [
    "Precios tal como se mostraban en cada web el día de la revisión; cambian con las promociones. En las otras marcas el envío se cobra aparte.",
    "El día de la revisión, la web de Hurra Héroes mostraba un aviso de renovación y algunos libros marcados como «Próximamente».",
    "Micuento no aparece: su web (micuento.com) no respondía el 2 de octubre de 2026, así que no pudimos comprobar sus datos.",
  ],
  sourceLabel: (i) => `Fuente ${i}`,
  scrollHint: "Desliza para ver todas las marcas",
  strengthsHeading: "Dónde es mejor cada uno",
  strengthsIntro: "Según lo que cada marca publica en su web. Si alguno de estos puntos es lo que más te importa, esa marca puede ser mejor opción para ti.",
  ownHeading: "Y Meapica",
  ownGoodLabel: "Lo que hacemos bien",
  ownWeakLabel: "Dónde nos quedamos cortos",
  ownGood: [
    `Un retrato en acuarela hecho con sus rasgos, que se repite en las ${f.scenes} escenas.`,
    "Tú eliges el mundo y los tres capítulos, y el texto se escribe para su edad.",
    "En catalán, escrito directamente en catalán.",
    `Precio con el IVA y el envío incluidos: ${f.softcover} en tapa blanda, ${f.hardcover} en tapa dura.`,
  ],
  ownWeak: [
    `Somos nuevos: ${WORLDS} mundos, frente a catálogos de decenas de libros.`,
    `Antes de pagar ves la portada, el retrato y ${n} escenas, no el libro entero.`,
    `Tarda ${f.minDays}-${f.maxDays} días laborables y no hay opción de envío urgente.`,
    "No enviamos a Canarias, Ceuta ni Melilla, ni hacemos libros con personajes con licencia.",
  ],
  sourcesHeading: "Fuentes",
  sourcesIntro: "Páginas oficiales de cada marca, consultadas el 2 de octubre de 2026. Si ves un dato que ha cambiado, escríbenos y lo corregimos.",
  sections: [
    {
      heading: "Si lo quieres en catalán",
      paragraphs: [
        "Mumablue y Meapica lo tienen; Wonderbly y Hurra Héroes no lo ofrecen en su web. En Meapica el cuento se escribe directamente en catalán, con el artículo delante del nombre (en Pol, la Martina).",
      ],
    },
    {
      heading: "Si quieres que se le parezca",
      paragraphs: [
        "Todas usan un personaje que montas con opciones. Cambian los detalles: Hurra Héroes incluye pecas y gafas, Mumablue añade ropa y complexión, y en Meapica el personaje es un retrato en acuarela que se repite en cada escena. Míralo en la vista previa antes de decidir.",
      ],
    },
    {
      heading: "Si vas justo de tiempo",
      paragraphs: [
        `Wonderbly imprime en 2-4 días laborables y tiene envío urgente; Hurra Héroes ofrece urgente en hasta 6 días laborables. Meapica tarda ${f.minDays}-${f.maxDays} días laborables, sin urgente, pero el PDF llega por correo tras el pago, normalmente en menos de una hora.`,
      ],
    },
    {
      heading: "Si el presupuesto manda",
      paragraphs: [
        `Compara el precio final con el envío: en las demás marcas se suma en el carrito. En Meapica, ${f.softcover} en tapa blanda y ${f.hardcover} en tapa dura ya llevan el IVA y el envío.`,
      ],
    },
  ],
  faq: [
    {
      question: "¿Cuál es el mejor cuento personalizado?",
      answer:
        "Depende de lo que más te importe. Por catálogo y rapidez destaca Wonderbly; por licencias como Frozen o el Barça, Mumablue; para elegir varias historias, Hurra Héroes; y si quieres un retrato en acuarela con sus rasgos, una aventura que eliges tú y el precio con envío incluido, Meapica.",
    },
    {
      question: "¿Qué cuentos personalizados hay en catalán?",
      answer:
        "Según sus webs, el 2 de octubre de 2026 ofrecían catalán Mumablue y Meapica; Wonderbly y Hurra Héroes no lo tenían entre sus idiomas.",
    },
    {
      question: "¿En cuáles ves el libro antes de pagar?",
      answer: `En todas hay vista previa. Wonderbly y Hurra Héroes enseñan el libro completo; Mumablue no indica si es entero; Meapica enseña la portada, el retrato y las ${n} primeras escenas, porque cada libro se pinta para cada niño.`,
    },
    {
      question: "¿Por qué fiarme de una comparativa hecha por Meapica?",
      answer:
        "Porque cada dato enlaza a la página oficial de la que sale, con la fecha en que lo miramos, y porque también te decimos dónde los demás son mejores. Si un dato ha cambiado, escríbenos y lo corregimos.",
    },
  ],
  relatedHeading: "También te puede interesar",
});

const ca = (f: GuideFacts, n: number): CompareGuideCopy => ({
  langKey: "ca",
  metaTitle: "Millors contes personalitzats: comparativa 2026 | Meapica",
  metaDescription:
    "Meapica, Mumablue, Wonderbly i Hurra Héroes amb dades de les seves webs: preu, formats, català, enviament i vista prèvia. Amb fonts i data de revisió.",
  breadcrumb: "Comparativa",
  eyebrow: "Comparativa amb fonts",
  h1: "Millors contes personalitzats a Espanya: comparativa honesta",
  lead:
    "Comparem els contes personalitzats que es venen a Espanya amb el que cada marca publica a la seva pròpia web: preu, formats, idiomes, enviament, vista prèvia i com es personalitza. Som Meapica, així que també t'expliquem on els altres són millors.",
  cta: "Crear el seu llibre",
  trust: ["Cada dada enllaça a la seva font", "Dades revisades el 2 d'oct. del 2026"],
  checkedLabel: "Dades revisades el 2 d'oct. del 2026",
  tableHeading: "La taula, dada a dada",
  tableCaption: "Comparativa de contes personalitzats que es venen a Espanya, amb dades revisades el 2 d'octubre del 2026",
  rowLabels: {
    price: "Preu des de (llibre imprès)",
    formats: "Formats",
    catalan: "En català",
    languages: "Idiomes",
    shipping: "Enviament a Espanya",
    preview: "Vista prèvia abans de pagar",
    personalisation: "Com es personalitza",
  },
  meapica: {
    price: `Des de ${f.softcover} tapa tova, IVA inclòs, enviament inclòs (tapa dura ${f.hardcover} IVA inclòs)`,
    formats: `Tapa tova o dura, ${f.size} × ${f.size} cm, ${f.pages} pàgines, amb PDF; o només PDF (${f.pdf} IVA inclòs)`,
    catalan: "Sí, escrit directament en català",
    languages: "Castellà, català, anglès i francès",
    shipping: `Gratuït a la Península i les Balears (no Canàries, Ceuta ni Melilla); ${f.minDays}-${f.maxDays} dies laborables`,
    preview: `Sí: portada, retrat i les ${n} primeres escenes (no el llibre sencer)`,
    personalisation: "Nom, retrat a l'aquarel·la per trets (pell, cabell, pentinat, ulls, ulleres, pigues), món i 3 capítols que tries; dedicatòria",
  },
  tableNotes: [
    "Preus tal com es mostraven a cada web el dia de la revisió; canvien amb les promocions. A les altres marques l'enviament es cobra a part.",
    "El dia de la revisió, la web d'Hurra Héroes mostrava un avís de renovació i alguns llibres marcats com a «Próximamente».",
    "Micuento no hi surt: la seva web (micuento.com) no responia el 2 d'octubre del 2026, i no en vam poder comprovar les dades.",
  ],
  sourceLabel: (i) => `Font ${i}`,
  scrollHint: "Llisca per veure totes les marques",
  strengthsHeading: "On és millor cadascú",
  strengthsIntro: "Segons el que cada marca publica a la seva web. Si algun d'aquests punts és el que més t'importa, aquella marca pot ser millor opció per a tu.",
  ownHeading: "I Meapica",
  ownGoodLabel: "El que fem bé",
  ownWeakLabel: "On ens quedem curts",
  ownGood: [
    `Un retrat a l'aquarel·la fet amb els seus trets, que es repeteix a les ${f.scenes} escenes.`,
    "Tu tries el món i els tres capítols, i el text s'escriu per a la seva edat.",
    "En català, escrit directament en català.",
    `Preu amb l'IVA i l'enviament inclosos: ${f.softcover} en tapa tova, ${f.hardcover} en tapa dura.`,
  ],
  ownWeak: [
    `Som nous: ${WORLDS} mons, davant de catàlegs de desenes de llibres.`,
    `Abans de pagar veus la portada, el retrat i ${n} escenes, no el llibre sencer.`,
    `Triga ${f.minDays}-${f.maxDays} dies laborables i no hi ha opció d'enviament urgent.`,
    "No enviem a Canàries, Ceuta ni Melilla, ni fem llibres amb personatges amb llicència.",
  ],
  sourcesHeading: "Fonts",
  sourcesIntro: "Pàgines oficials de cada marca, consultades el 2 d'octubre del 2026. Si veus una dada que ha canviat, escriu-nos i la corregim.",
  sections: [
    {
      heading: "Si el vols en català",
      paragraphs: [
        "Mumablue i Meapica el tenen; Wonderbly i Hurra Héroes no l'ofereixen a la seva web. A Meapica el conte s'escriu directament en català, amb l'article davant del nom (en Pol, la Martina).",
      ],
    },
    {
      heading: "Si vols que s'hi assembli",
      paragraphs: [
        "Totes fan servir un personatge que muntes amb opcions. Canvien els detalls: Hurra Héroes inclou pigues i ulleres, Mumablue hi afegeix roba i complexió, i a Meapica el personatge és un retrat a l'aquarel·la que es repeteix a cada escena. Mira-ho a la vista prèvia abans de decidir.",
      ],
    },
    {
      heading: "Si vas just de temps",
      paragraphs: [
        `Wonderbly imprimeix en 2-4 dies laborables i té enviament urgent; Hurra Héroes ofereix urgent en fins a 6 dies laborables. Meapica triga ${f.minDays}-${f.maxDays} dies laborables, sense urgent, però el PDF arriba per correu després del pagament, normalment en menys d'una hora.`,
      ],
    },
    {
      heading: "Si mana el pressupost",
      paragraphs: [
        `Compara el preu final amb l'enviament: a les altres marques s'afegeix a la cistella. A Meapica, ${f.softcover} en tapa tova i ${f.hardcover} en tapa dura ja porten l'IVA i l'enviament.`,
      ],
    },
  ],
  faq: [
    {
      question: "Quin és el millor conte personalitzat?",
      answer:
        "Depèn del que més t'importi. Per catàleg i rapidesa destaca Wonderbly; per llicències com Frozen o el Barça, Mumablue; per triar diverses històries, Hurra Héroes; i si vols un retrat a l'aquarel·la amb els seus trets, una aventura que tries tu i el preu amb l'enviament inclòs, Meapica.",
    },
    {
      question: "Quins contes personalitzats hi ha en català?",
      answer:
        "Segons les seves webs, el 2 d'octubre del 2026 oferien català Mumablue i Meapica; Wonderbly i Hurra Héroes no el tenien entre els seus idiomes.",
    },
    {
      question: "En quins veus el llibre abans de pagar?",
      answer: `En totes hi ha vista prèvia. Wonderbly i Hurra Héroes ensenyen el llibre complet; Mumablue no indica si és sencer; Meapica ensenya la portada, el retrat i les ${n} primeres escenes, perquè cada llibre es pinta per a cada nen.`,
    },
    {
      question: "Per què m'he de fiar d'una comparativa feta per Meapica?",
      answer:
        "Perquè cada dada enllaça a la pàgina oficial d'on surt, amb la data en què la vam mirar, i perquè també et diem on els altres són millors. Si una dada ha canviat, escriu-nos i la corregim.",
    },
  ],
  relatedHeading: "També et pot interessar",
});

export const COMPARE_GUIDE_COPY: Record<string, (f: GuideFacts, previewScenes: number) => CompareGuideCopy> = { es, ca };
