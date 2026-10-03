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
  },
};
