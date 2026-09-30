// English labels for the Book Plan's cast and world in image prompts.
//
// The Book Plan names characters and places in the BOOK language ("las ardillas",
// "la casa de Noa", "el dinosaurio naranja"), while every image prompt is English.
// Mixing them produced "The s ardillas" (an article regex that matched "la" inside
// "las" and needed no space after it), "The el dinosaurio naranja looks like
// this" and "casa de the child" (a Spanish id with the child's name scrubbed). The
// plan now carries an English `label` per entity; these helpers are the single
// way prompts name an entity, with a safe fallback for plans frozen before it.

/** Leading articles in es / ca / fr / en, longest first, each followed by a space (or l'/l’ + letter). */
const ARTICLE = /^(?:(?:els|les|los|las|the|una|uno|une|des|el|la|le|en|na|un)\s+|l['’](?=\p{L}))/iu;

/** "las ardillas" → "ardillas", "l'Anna" → "Anna"; never touches a name that merely starts like an article ("Leo", "Lana", "Elsa", "Enzo"). */
export function stripArticle(name: string): string {
  const trimmed = name.trim();
  const stripped = trimmed.replace(ARTICLE, "").trim();
  return stripped || trimmed;
}

/** One English label: whitespace collapsed, no leading article, no trailing punctuation. */
export function cleanEntityLabel(label: string): string {
  return stripArticle(label.replace(/\s+/g, " ")).replace(/[\s.,;:]+$/, "");
}

interface Named {
  id: string;
  name: string;
  /** English label from the Book Plan (absent on plans frozen before 2026-09-30) */
  label?: string;
}

/**
 * How a cast member is named in English prompts (upper-cased by the prompt
 * builders): the plan's English label, else the book-language name without its
 * article (proper names are the same in every language).
 */
export function castLabel(member: Named): string {
  return cleanEntityLabel(member.label?.trim() || member.name);
}

/**
 * How a world asset (location/object) is named in English prompts: the plan's
 * English label, else its snake_case id as words (the book-language name would
 * put Spanish/Catalan/French words and articles into the English prompt).
 */
export function worldLabel(asset: Named): string {
  return cleanEntityLabel(asset.label?.trim() || asset.id.replace(/_/g, " "));
}
