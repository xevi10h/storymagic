// Advent stories for one child (client + server): the Catalan personal article comes from
// the shared name grammar (src/lib/name-grammar.ts), the substitution from ./render.

import { catalanArticle } from "@/lib/name-grammar";
import { nameForms, renderStory, type AdventGender, type AdventLocale, type NameContext, type RenderedStory, type StoryTemplate } from "./render";

export function asAdventGender(value: unknown): AdventGender {
  return value === "boy" || value === "girl" ? value : "neutral";
}

export function nameContext(locale: AdventLocale, name: string, gender: AdventGender): NameContext {
  return { locale, name: name.trim(), gender, article: locale === "ca" ? catalanArticle(name.trim(), gender) : null };
}

/** The name inside a sentence: "Noa" (es) / "la Noa", "en Pau", "l'Anna" (ca, after "amb", "per a"…). */
export function adventNameIn(locale: AdventLocale, name: string, gender: AdventGender): string {
  return nameForms(nameContext(locale, name, gender)).n;
}

/** "de Noa" (es) / "de la Noa", "d'en Pau" (ca). */
export function adventDeName(locale: AdventLocale, name: string, gender: AdventGender): string {
  return nameForms(nameContext(locale, name, gender)).de;
}

export function personalizeStory(door: number, template: StoryTemplate, locale: AdventLocale, name: string, gender: AdventGender): RenderedStory {
  return renderStory(door, template, nameContext(locale, name, gender));
}
