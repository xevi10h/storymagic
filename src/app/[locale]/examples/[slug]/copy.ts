// Copy of the example-book page that is not in the `showcase` messages: SEO title /
// description and the server-rendered text block. An example is always labelled as one.

type Loc = "es" | "ca" | "en" | "fr";

/** A child's name as Catalan writes it: with its personal article (same rule as the printed book). */
function caArticle(name: string, gender: string): { bare: string; de: string } {
  // ponytail: vowel/h+vowel → l'; ignores the unstressed i/u exceptions ("la Irene").
  if (/^h?[aeiouàèéíòóúï]/i.test(name.trim())) return { bare: `l'${name}`, de: `de l'${name}` };
  return gender === "boy" ? { bare: `en ${name}`, de: `d'en ${name}` } : { bare: `la ${name}`, de: `de la ${name}` };
}
export const asLoc = (locale: string): Loc => (locale === "ca" || locale === "en" || locale === "fr" ? locale : "es");

interface ExampleCopy {
  /** <title>: the book's title + what the page is. */
  seoTitle: (title: string) => string;
  description: (title: string, name: string, age: number, gender: string) => string;
  textHeading: string;
  /** One line above the text: whose book it is and that it is an example. */
  textIntro: (name: string, age: number, gender: string) => string;
  textToggle: string;
  /** JSON-LD: what kind of work this is. */
  genre: string;
  /** Server-rendered gallery of the book's real illustrations. */
  galleryHeading: string;
  galleryIntro: (scenes: number) => string;
  /** alt of one illustration; `sceneTitle` is the chapter title printed in the book (may be empty). */
  sceneAlt: (title: string, n: number, sceneTitle: string) => string;
  coverCaption: string;
  sceneCaption: (n: number) => string;
  moreHeading: string;
  relatedHeading: string;
  allExamples: string;
}

export const EXAMPLE_COPY: Record<Loc, ExampleCopy> = {
  es: {
    seoTitle: (title) => `${title}: ejemplo de cuento personalizado`,
    description: (title, name, age) =>
      `Ejemplo real de cuento personalizado: «${title}», el libro de ${name} (${age} años). Léelo entero, página a página, y crea el de tu hijo.`,
    textHeading: "El texto de este cuento de ejemplo",
    textIntro: (name, age) =>
      `Este es un libro de ejemplo, creado para ${name} (${age} años). En el tuyo, el nombre, el retrato y la aventura son los de tu hijo.`,
    textToggle: "Leer el cuento completo",
    genre: "Cuento infantil personalizado (ejemplo)",
    galleryHeading: "Las ilustraciones de este cuento",
    galleryIntro: (n) => `La portada y las ${n} escenas pintadas en acuarela para este libro, en el orden en que se leen.`,
    sceneAlt: (title, n, sceneTitle) => `Ilustración en acuarela del cuento personalizado «${title}», escena ${n}${sceneTitle ? `: ${sceneTitle}` : ""}`,
    coverCaption: "Portada",
    sceneCaption: (n) => `Escena ${n}`,
    moreHeading: "Otros cuentos de ejemplo",
    relatedHeading: "Sigue mirando",
    allExamples: "Todos los cuentos de ejemplo",
  },
  ca: {
    seoTitle: (title) => `${title}: exemple de conte personalitzat`,
    description: (title, name, age, gender) =>
      `Exemple real de conte personalitzat: «${title}», el llibre ${caArticle(name, gender).de} (${age} anys). Llegeix-lo sencer, pàgina a pàgina, i crea el del teu fill.`,
    textHeading: "El text d'aquest conte d'exemple",
    textIntro: (name, age, gender) =>
      `Aquest és un llibre d'exemple, creat per a ${caArticle(name, gender).bare} (${age} anys). En el teu, el nom, el retrat i l'aventura són els del teu fill.`,
    textToggle: "Llegir el conte complet",
    genre: "Conte infantil personalitzat (exemple)",
    galleryHeading: "Les il·lustracions d'aquest conte",
    galleryIntro: (n) => `La portada i les ${n} escenes pintades a l'aquarel·la per a aquest llibre, en l'ordre en què es llegeixen.`,
    sceneAlt: (title, n, sceneTitle) => `Il·lustració a l'aquarel·la del conte personalitzat «${title}», escena ${n}${sceneTitle ? `: ${sceneTitle}` : ""}`,
    coverCaption: "Portada",
    sceneCaption: (n) => `Escena ${n}`,
    moreHeading: "Altres contes d'exemple",
    relatedHeading: "Continua mirant",
    allExamples: "Tots els contes d'exemple",
  },
  en: {
    seoTitle: (title) => `${title}: personalised book sample`,
    description: (title, name, age) =>
      `A real sample of a personalised children's book: “${title}”, made for ${name} (age ${age}). Read it page by page, then create your child's.`,
    textHeading: "The text of this sample book",
    textIntro: (name, age) =>
      `This is a sample book, made for ${name} (age ${age}). In yours, the name, the portrait and the adventure are your child's.`,
    textToggle: "Read the whole story",
    genre: "Personalised children's book (sample)",
    galleryHeading: "The illustrations of this book",
    galleryIntro: (n) => `The cover and the ${n} watercolour scenes painted for this book, in reading order.`,
    sceneAlt: (title, n, sceneTitle) => `Watercolour illustration from the personalised book “${title}”, scene ${n}${sceneTitle ? `: ${sceneTitle}` : ""}`,
    coverCaption: "Cover",
    sceneCaption: (n) => `Scene ${n}`,
    moreHeading: "More sample books",
    relatedHeading: "Keep looking",
    allExamples: "All sample books",
  },
  fr: {
    seoTitle: (title) => `${title} : exemple de livre personnalisé`,
    description: (title, name, age) =>
      `Exemple réel de livre personnalisé : « ${title} », le livre de ${name} (${age} ans). Lisez-le en entier, page après page, et créez celui de votre enfant.`,
    textHeading: "Le texte de ce livre d'exemple",
    textIntro: (name, age) =>
      `Ceci est un livre d'exemple, créé pour ${name} (${age} ans). Dans le vôtre, le prénom, le portrait et l'aventure sont ceux de votre enfant.`,
    textToggle: "Lire l'histoire complète",
    genre: "Livre personnalisé pour enfant (exemple)",
    galleryHeading: "Les illustrations de ce livre",
    galleryIntro: (n) => `La couverture et les ${n} scènes peintes à l'aquarelle pour ce livre, dans l'ordre de lecture.`,
    sceneAlt: (title, n, sceneTitle) => `Illustration à l'aquarelle du livre personnalisé « ${title} », scène ${n}${sceneTitle ? ` : ${sceneTitle}` : ""}`,
    coverCaption: "Couverture",
    sceneCaption: (n) => `Scène ${n}`,
    moreHeading: "D'autres livres d'exemple",
    relatedHeading: "À voir aussi",
    allExamples: "Tous les livres d'exemple",
  },
};
