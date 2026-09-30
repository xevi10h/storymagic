import { STORY_TEMPLATES, type StoryTemplateConfig } from "@/lib/create-store";

/** Real book made on the platform (GET /api/showcase). */
export interface ShowcaseBook {
  id: string;
  templateId: string;
  title: string;
  coverImage: string | null;
}

export type AgeFilter = "all" | "2-4" | "5-7" | "8-12";

export const AGE_FILTERS: AgeFilter[] = ["all", "2-4", "5-7", "8-12"];

const AGE_BUCKETS: Record<Exclude<AgeFilter, "all">, readonly [number, number]> = {
  "2-4": [2, 4],
  "5-7": [5, 7],
  "8-12": [8, 12],
};

/**
 * A world belongs to every age bucket its own range (ageMin–ageMax) touches, so the
 * filter always agrees with the age badge on the card: "Cuentos para 2–4 años" never
 * shows a card that says "5–8 años". A 2–5 world shows under 2–4 and 5–7.
 */
export function fitsAgeFilter(template: Pick<StoryTemplateConfig, "ageMin" | "ageMax">, filter: AgeFilter): boolean {
  if (filter === "all") return true;
  const [min, max] = AGE_BUCKETS[filter];
  return template.ageMin <= max && template.ageMax >= min;
}

/** One card per world: the template, plus the newest real book painted in it (if any). */
export interface CatalogWorld {
  template: StoryTemplateConfig;
  example: ShowcaseBook | null;
}

/** Worlds with a real example first (proof), then the rest in catalog order. */
export function buildCatalog(showcase: ShowcaseBook[]): CatalogWorld[] {
  const exampleByTemplate = new Map<string, ShowcaseBook>();
  for (const book of showcase) {
    // The API returns newest first: keep the first book per world, and only books with art.
    if (book.coverImage && !exampleByTemplate.has(book.templateId)) exampleByTemplate.set(book.templateId, book);
  }
  const worlds = STORY_TEMPLATES.map((template) => ({ template, example: exampleByTemplate.get(template.id) ?? null }));
  return [...worlds.filter((w) => w.example), ...worlds.filter((w) => !w.example)];
}
