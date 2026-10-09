// /gifts/tio-de-nadal — Catalan only (lib/guides.ts): the tió is a Catalan tradition,
// so the page is written natively in Catalan and has no other edition.
//
// Facts this page relies on (verify before editing): the story is NOT about the tió or
// Christmas (it is the adventure of the chosen world); the dedication is the buyer's own
// text with the signature they want, printed on page 1 (lib/pdf/layout.ts); the cover
// title can be edited in the preview (components/create/BookEditSheets.tsx); one book is
// made for one child; we ship to the peninsula + Balearics only (lib/shipping.ts), so not
// to Andorra or France. Dates and prices come from guideFacts(), never typed here.

import { CHRISTMAS_DELIVERY_PATH } from "@/lib/shipping";
import { toolPath } from "@/lib/tools/registry";
import { GUIDES } from "@/lib/guides";
import type { GuideBaseCopy, GuideFacts } from "./types";

export type TioGuideCopy = GuideBaseCopy & {
  /** Caption after the linked title of the example book in the hero. */
  exampleCaption: string;
  examplesHeading: string;
  examplesIntro: string;
};

const ca = (f: GuideFacts, previewScenes: number): TioGuideCopy => ({
  metaTitle: "Regal per al tió de Nadal: un conte amb el seu nom | Meapica",
  metaDescription:
    "Un regal per fer cagar el tió que no es menja: un conte en català amb el seu nom a la portada i el seu retrat a l'aquarel·la. Vista prèvia gratuïta.",
  breadcrumb: "Tió de Nadal",
  eyebrow: "Regals per al tió de Nadal",
  h1: "Regal per fer cagar el tió: un conte amb el seu nom",
  lead:
    "Sota la manta, entre els torrons i les neules, hi apareix un llibre amb el seu nom a la portada. L'ha cagat el tió, però l'has fet tu: una aventura escrita en català on el protagonista té la seva cara, pintada a l'aquarel·la.",
  cta: "Crear el seu conte",
  exampleCaption: "és un dels nostres contes d'exemple en català.",
  trust: ["Veus les primeres pàgines abans de pagar", `Hi cap sota la manta: ${f.size} × ${f.size} cm`, "Escrit en català, no traduït"],
  sections: [
    {
      heading: "Què caga el tió, i per què un conte hi encaixa",
      paragraphs: [
        "El tió no porta els regals grossos: d'això ja se n'encarreguen els Reis. El tió caga coses petites, de les que es reparteixen allà mateix, a peu de manta: torrons, neules, xocolata, uns mitjons, un joc de cartes i, a moltes cases, un conte.",
        "Un llibre és, doncs, un regal de tió de tota la vida. La diferència és que aquest no surt de cap prestatgeria: a la portada hi ha el seu nom, a dins hi surt dibuixat a cada escena i la història l'has triada tu. Quan aixequi la manta i es reconegui a la coberta, la cançó s'haurà acabat, però la festa no.",
      ],
    },
    {
      heading: "Hi cap sota la manta",
      paragraphs: [
        `És un llibre quadrat de ${f.size} × ${f.size} cm i ${f.pages} pàgines: prou prim per amagar-lo sota la manta sense que faci bony, i prou gran perquè les il·lustracions es vegin bé quan el llegiu al sofà havent dinat.`,
        `La tapa tova és la més lleugera; la tapa dura és la que aguanta més anys de lectures. A dins hi ha ${f.scenes} escenes pintades a l'aquarel·la sobre paper estucat setinat de ${f.paper} g.`,
        "El paquet arriba a casa per missatgeria. Si hi ha ulls curiosos, pensa on el desaràs fins que toqui fer cagar el tió.",
      ],
    },
    {
      heading: "No és un conte sobre el tió: és la seva aventura",
      paragraphs: [
        `Val més dir-ho clar: el tió no surt a la història. El conte és una aventura en el món que tries, com l'espai, un bosc màgic, els pirates, els dinosaures o un castell. Cada món té la seva franja d'edat, entre els ${f.ageMin} i els ${f.ageMax} anys, i el text s'escriu per a l'edat que indiques.`,
        "El toc de tió l'hi poses tu. La dedicatòria és la primera pàgina del llibre i s'imprimeix tal com l'escrius: la pots signar «El tió», «El tió de casa els avis» o amb els vostres noms. I abans de demanar-lo pots canviar el títol de la portada.",
      ],
    },
    {
      heading: "Quan demanar-lo perquè arribi abans de la Nit de Nadal",
      paragraphs: [
        `L'imprimim per encàrrec i arriba en ${f.minDays}-${f.maxDays} dies laborables, amb l'enviament inclòs, a la Península i les Balears. Perquè sigui a casa el 24 de desembre, demana'l com a tard el ${f.christmasDate}. És una data estimada, calculada amb marge pels festius i pel volum de paquets del desembre; no és una garantia.`,
        "Si el feu cagar el dia de Nadal a casa dels avis, compta-hi igualment la Nit de Nadal: val més que el llibre s'esperi uns dies dins d'un armari que no pas que faci tard.",
        `Se t'ha passat la data? El conte en PDF (${f.pdf} IVA inclòs) t'arriba per correu després de pagar, normalment en menys d'una hora, i el pots imprimir a casa i embolicar-lo.`,
      ],
      link: { href: CHRISTMAS_DELIVERY_PATH, label: "Totes les dates límit de Nadal i Reis" },
    },
    {
      heading: "Tió o Reis? Com repartir-ho",
      paragraphs: [
        "A moltes cases el tió caga el detall i els Reis porten allò que s'ha demanat a la carta. El conte funciona a tots dos llocs: sota la manta, com la sorpresa que no s'esperava, o el matí del 6 de gener, al costat de les sabates.",
        `Si el deixes per a Reis tens més marge: el llibre imprès es pot demanar fins al ${f.reyesDate}. I mentrestant pots imprimir gratis la carta als Reis d'Orient amb el seu nom i el seu retrat.`,
      ],
      link: { href: toolPath("letter"), label: "Carta als Reis per imprimir, gratuïta" },
    },
    {
      heading: "Escrit en català, amb el nom com el dieu a casa",
      paragraphs: [
        "El conte no es tradueix del castellà: s'escriu directament en català. El nom hi porta l'article, igual que quan el crideu perquè vingui a picar el tió: en Jan, la Queralt, l'Aniol. Abans d'il·lustrar-lo, el text passa un control que comprova pàgina a pàgina que l'article hi és i que tot concorda.",
      ],
      link: { href: GUIDES.catalan.path, label: "Com escrivim els contes en català" },
    },
    {
      heading: "Formats i preus",
      paragraphs: [
        `Tapa dura, ${f.hardcover} IVA inclòs. Tapa tova, ${f.softcover} IVA inclòs. Totes dues porten l'enviament gratuït i el PDF del conte. Només el PDF, ${f.pdf} IVA inclòs.`,
        `Crear-lo és gratuït i no cal registrar-se: abans de pagar veus la portada amb el seu nom, el seu retrat i les ${previewScenes} primeres escenes il·lustrades.`,
      ],
    },
  ],
  examplesHeading: "Contes d'exemple en català",
  examplesIntro: "Llibres reals, fets amb el mateix procés que el teu. Obre'ls i llegeix-los sencers abans de crear el seu.",
  faq: [
    {
      question: "Fins quin dia el puc demanar perquè el tió el cagui?",
      answer: `Perquè el llibre imprès sigui a casa el 24 de desembre, demana'l com a tard el ${f.christmasDate}. Arriba en ${f.minDays}-${f.maxDays} dies laborables a la Península i les Balears. La data porta marge pels festius del desembre, però és una estimació.`,
    },
    {
      question: "Puc signar la dedicatòria com si fos el tió?",
      answer:
        "Sí. La dedicatòria l'escrius tu i s'imprimeix a la primera pàgina amb la signatura que vulguis: «El tió», els avis o els pares.",
    },
    {
      question: "El conte parla del tió o de Nadal?",
      answer:
        "No. És una aventura en el món que tries (l'espai, el bosc màgic, els pirates, els dinosaures…) amb l'infant com a protagonista. El tió hi és a la dedicatòria i en la manera de regalar-lo.",
    },
    {
      question: "Som dos germans: el tió pot cagar un conte per a cadascun?",
      answer:
        "Sí, però són dos llibres. Cada conte es crea per a un sol infant, amb el seu nom, el seu retrat i la seva aventura; fes-ne un per a cadascun i demana'ls amb temps.",
    },
    {
      question: "Envieu a Andorra o a la Catalunya del Nord?",
      answer:
        "De moment no. Enviem el llibre imprès a la Península i a les Balears; no a Canàries, Ceuta ni Melilla, ni fora d'Espanya. Per a aquests casos hi ha el conte en PDF, que arriba per correu a tot arreu.",
    },
    {
      question: "Quant costa?",
      answer: `Tapa tova, ${f.softcover}; tapa dura, ${f.hardcover}; només el PDF, ${f.pdf}. Tots els preus amb l'IVA inclòs, i el llibre imprès porta l'enviament i el PDF.`,
    },
  ],
  relatedHeading: "Més per a aquestes festes",
});

export const TIO_GUIDE_COPY: Record<string, (f: GuideFacts, previewScenes: number) => TioGuideCopy> = { ca };
