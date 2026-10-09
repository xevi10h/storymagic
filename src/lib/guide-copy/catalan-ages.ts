// /personalized-books/in-catalan/by-age — Catalan only (lib/guides.ts): the reading
// stages are named as Catalan schools name them (I3-I5, primària), so the page has no
// other edition. It complements /personalized-books/{band} (what to pick at each age)
// with the language angle: reading in Catalan at each stage.
//
// Facts this page relies on (verify before editing): the text is written for the child's
// exact age, with a refrain and short sentences in the 2-4 mode (lib/ai/book-plan.ts);
// body type is largest for the youngest band and shrinks with age (lib/book/print-spec.ts);
// the story is written in standard Catalan as published in Catalunya, with the personal
// article (lib/ai/book-plan.ts). The worlds of each band and their age ranges are NOT
// typed here: the page reads them from STORY_TEMPLATES.

import type { AgeBandSlug } from "@/lib/product-facts";
import { GUIDES } from "@/lib/guides";
import type { GuideBaseCopy, GuideFacts } from "./types";

export interface CatalanAgeBandCopy {
  /** School stage, as a kicker above the heading. */
  stage: string;
  heading: string;
  paragraphs: string[];
}

export type CatalanAgesGuideCopy = GuideBaseCopy & {
  hubCrumb: string;
  parentCrumb: string;
  bands: Record<AgeBandSlug, CatalanAgeBandCopy>;
  worldsLabel: string;
  exampleLabel: string;
};

const ca = (f: GuideFacts, previewScenes: number): CatalanAgesGuideCopy => ({
  metaTitle: `Contes en català per edats, de ${f.ageMin} a ${f.ageMax} anys | Meapica`,
  metaDescription:
    "Contes en català per a nens de 2 a 4, de 5 a 7 i de 8 a 12 anys: què canvia a cada etapa lectora i un exemple per llegir sencer. Amb el seu nom a la portada.",
  breadcrumb: "Per edats",
  hubCrumb: "Contes personalitzats",
  parentCrumb: "En català",
  eyebrow: "Contes en català per edats",
  h1: `Contes en català per a cada edat, de ${f.ageMin} a ${f.ageMax} anys`,
  lead:
    "Un conte per a un infant d'I3 no s'escriu igual que un per a una nena de quart. Aquí tens què canvia a cada etapa, quins mons hi encaixen i un llibre d'exemple en català de cada franja, perquè el puguis llegir sencer abans de fer el seu.",
  cta: "Crear el seu conte",
  trust: ["Text escrit per a la seva edat", "En català, no traduït", "Veus les primeres pàgines abans de pagar"],
  worldsLabel: "Mons per a aquesta edat",
  exampleLabel: "Un exemple per llegir sencer",
  bands: {
    "2-4": {
      stage: "Llar d'infants, I3 i I4",
      heading: "De 2 a 4 anys: contes per escoltar i assenyalar",
      paragraphs: [
        "A aquesta edat el conte l'expliques tu, i ell o ella el llegeix amb el dit: assenyala, repeteix i demana «un altre cop». Per això el text d'aquesta franja és curt, amb frases senzilles i una tornada que torna a cada escena i que aviat dirà de memòria.",
        "El seu nom és la primera paraula que reconeixen escrita, molt abans de saber llegir: el veuen cada dia al penjador de l'escola. Trobar-lo a la portada d'un llibre, i sentir-lo amb el seu article a cada pàgina (en Nil, la Bruna), és el que fa que aquest conte sigui «el meu».",
        "La lletra és la més grossa de totes les franges i les il·lustracions omplen la pàgina, pensades per mirar-les plegats a la falda.",
      ],
    },
    "5-7": {
      stage: "I5, primer i segon de primària",
      heading: "De 5 a 7 anys: contes per començar a llegir en català",
      paragraphs: [
        "És l'etapa en què les lletres comencen a tenir sentit. A l'escola aprenen a llegir en català, i a casa un conte on surt el seu nom és la millor excusa per practicar: el nom el desxifren de seguida, i això els dona empenta per a la paraula següent.",
        "Una manera que funciona és llegir-lo a mitges: tu llegeixes la pàgina i ell o ella s'encarrega de les paraules que ja coneix, començant pel seu nom. Les històries d'aquesta franja ja tenen diàlegs, humor i una mica d'intriga, i es llegeixen d'una tirada abans d'anar a dormir.",
        "Com que el text s'escriu directament en català, hi troben les paraules tal com les senten a classe i al pati, no un castellà disfressat.",
      ],
    },
    "8-12": {
      stage: "De tercer a sisè de primària",
      heading: "De 8 a 12 anys: contes per llegir sols",
      paragraphs: [
        "Ja llegeixen sols i no volen que se'ls tracti com a petits. El text d'aquesta franja és el més llarg i el més ric: més vocabulari, més trama, el que pensa el protagonista i un repte que no es resol a la primera.",
        "Ser el protagonista continua funcionant, però d'una altra manera: ja no és la sorpresa de reconèixer-se, sinó la gràcia de ser dins d'una història de debò. És un bon llibre per a l'estona de lectura de l'escola i un bon regal de Sant Jordi quan ja trien ells què llegeixen.",
        "També és l'edat en què es comencen a guardar coses. La dedicatòria de la primera pàgina, escrita per vosaltres, és la que rellegirà de gran.",
      ],
    },
  },
  sections: [
    {
      heading: "Com sabem quin text li toca",
      paragraphs: [
        "Quan crees el conte indiques la seva edat, i la història s'escriu per a aquesta edat, no per a una franja genèrica. Cada món té, a més, el seu propi rang d'edat, que veuràs a cada targeta: els rangs se solapen, de manera que gairebé sempre hi ha més d'una opció.",
        "Si està entre dues franges, tria pel que li agrada ara i no per l'edat exacta. Un conte que li ve una mica gran el podeu llegir junts; un que li ve petit, el deixarà aviat.",
      ],
    },
    {
      heading: "El que tenen en comú tots els contes",
      paragraphs: [
        `Tots són un llibre quadrat de ${f.size} × ${f.size} cm, amb ${f.pages} pàgines i ${f.scenes} escenes pintades a l'aquarel·la sobre paper estucat setinat de ${f.paper} g. Tapa dura, ${f.hardcover} IVA inclòs; tapa tova, ${f.softcover} IVA inclòs; totes dues amb l'enviament gratuït a la Península i les Balears i el PDF del conte. Només el PDF, ${f.pdf} IVA inclòs.`,
        `El llibre imprès arriba en ${f.minDays}-${f.maxDays} dies laborables. Abans de pagar veus la portada amb el seu nom, el seu retrat i les ${previewScenes} primeres escenes il·lustrades.`,
      ],
    },
    {
      heading: "I si a casa parleu castellà?",
      paragraphs: [
        "Molts infants parlen castellà a casa i aprenen a llegir en català a l'escola. Un conte en català amb el seu nom els dona un motiu per llegir a casa en la llengua de la classe sense que sembli fer deures.",
        "La dedicatòria la pots escriure en la llengua que vulguis: s'imprimeix tal com l'escrius.",
      ],
      link: { href: GUIDES.catalan.path, label: "Com escrivim els contes en català" },
    },
  ],
  faq: [
    {
      question: "A partir de quina edat hi ha contes en català?",
      answer: `Dels ${f.ageMin} als ${f.ageMax} anys. Per a nadons encara no en tenim: el conte més primerenc és per a infants de ${f.ageMin} anys.`,
    },
    {
      question: "El text està en lletra de pal o en lletra lligada?",
      answer:
        "En lletra d'impremta, la dels llibres: ni tot en majúscules ni lligada. Per als més petits la lletra és més grossa, i es va fent més petita a mesura que creix l'edat del lector.",
    },
    {
      question: "Quin català fa servir el conte?",
      answer:
        "El català estàndard, tal com s'escriu i es publica a Catalunya, amb l'article davant dels noms de persona (en Pau, la Laia). De moment no hi ha una versió específica en valencià ni en català de les Illes.",
    },
    {
      question: "Llegeix molt per l'edat que té. Puc triar un conte de més grans?",
      answer:
        "El text s'escriu per a l'edat que indiques en crear-lo. Cada món mostra el seu rang d'edat: si llegeix molt, tria'n un que arribi a edats més altes.",
    },
    {
      question: "Quant costa un conte en català?",
      answer: `El mateix a totes les edats: tapa tova, ${f.softcover}; tapa dura, ${f.hardcover}; només el PDF, ${f.pdf}. Tots els preus amb l'IVA inclòs, i el llibre imprès porta l'enviament i el PDF.`,
    },
  ],
  relatedHeading: "També et pot interessar",
});

export const CATALAN_AGES_GUIDE_COPY: Record<string, (f: GuideFacts, previewScenes: number) => CatalanAgesGuideCopy> = { ca };
