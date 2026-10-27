// Advent calendar: name + grammatical-gender substitution for the 24 door stories
// (src/lib/advent/stories.ts). Pure and import-free on purpose: the client renders the
// name-only stories in the browser and advent.check.mjs runs it under plain node.
//
// Template tokens (the stories are written natively per language, these only place the
// child in them):
//   {N}  name at the start of a sentence. ca: with the personal article, capitalised
//        ("La Noa", "En Pau", "L'Anna"); es: the name.
//   {n}  name inside a sentence. ca: "la Noa", "en Pau", "l'Anna"; es: the name.
//   {v}  bare name (vocative, "—Gràcies, Noa"; titles in es).
//   {de} "de la Noa", "d'en Pau", "de l'Anna" (ca) / "de Noa" (es).
//   {a}  "a la Noa", "a en Pau", "a l'Anna" (ca) / "a Noa" (es).
//   [boy|girl|neutral]  words that agree with the child; the neutral form is a whole
//        phrase that avoids gender, never an "-e" ending.
// Catalan with an unknown article (neutral gender + consonant, e.g. "Noa") falls back to
// the article-less literary register ("Noa", "de Noa", "a Noa").

export type AdventGender = "boy" | "girl" | "neutral";
export type AdventLocale = "es" | "ca";
/** Catalan personal article, as computed by catalanArticle() in src/lib/name-grammar.ts. */
export type CatalanArticle = "en" | "la" | "l'" | null;

export interface StoryTemplate {
  title: string;
  /** One or two sentences for the door card and the email. */
  teaser: string;
  paragraphs: string[];
  /** Closing bedtime question, printed in italics. */
  question: string;
}

export interface RenderedStory extends StoryTemplate {
  door: number;
}

export interface NameContext {
  locale: AdventLocale;
  name: string;
  gender: AdventGender;
  /** Catalan only (ignored for es). */
  article: CatalanArticle;
}

const VOWEL_START = /^h?[aeiouàáèéíïòóúü]/i;

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The forms of the name for one child (see the token list above). */
export function nameForms(ctx: NameContext): Record<"N" | "n" | "v" | "de" | "a", string> {
  const name = ctx.name.trim();
  if (ctx.locale === "es") {
    return { N: name, n: name, v: name, de: `de ${name}`, a: `a ${name}` };
  }
  const art = ctx.article;
  const withArticle = art === "l'" ? `l'${name}` : art ? `${art} ${name}` : name;
  let de: string;
  if (art === "en") de = `d'en ${name}`;
  else if (art === "la") de = `de la ${name}`;
  else if (art === "l'") de = `de l'${name}`;
  else de = VOWEL_START.test(name) ? `d'${name}` : `de ${name}`;
  return { N: capitalise(withArticle), n: withArticle, v: name, de, a: `a ${withArticle}` };
}

const GENDER_INDEX: Record<AdventGender, number> = { boy: 0, girl: 1, neutral: 2 };

/** Fill one template string. Throws on a malformed gender group (caught by the check). */
export function fillTemplate(text: string, ctx: NameContext): string {
  const forms = nameForms(ctx);
  const idx = GENDER_INDEX[ctx.gender] ?? 2;
  return text
    .replace(/\[([^\]|]*)\|([^\]|]*)\|([^\]|]*)\]/g, (_m, b: string, g: string, n: string) => [b, g, n][idx])
    .replace(/\{(N|n|v|de|a)\}/g, (_m, key: keyof typeof forms) => forms[key]);
}

export function renderStory(door: number, template: StoryTemplate, ctx: NameContext): RenderedStory {
  return {
    door,
    title: fillTemplate(template.title, ctx),
    teaser: fillTemplate(template.teaser, ctx),
    paragraphs: template.paragraphs.map((p) => fillTemplate(p, ctx)),
    question: fillTemplate(template.question, ctx),
  };
}
