import { STORY_TEMPLATES, type StoryTemplateConfig } from "@/lib/create-store";
import { AGE_BANDS, type AgeBandSlug } from "@/lib/product-facts";

/** Real book made on the platform (GET /api/showcase). */
export interface ShowcaseBook {
  id: string;
  /** /examples/{slug} in the book's own locale. */
  slug: string;
  locale: string;
  templateId: string;
  title: string;
  coverImage: string | null;
}

export type AgeFilter = "all" | AgeBandSlug;

export const AGE_FILTERS: AgeFilter[] = ["all", ...AGE_BANDS.map((b) => b.slug)];

const AGE_BUCKETS = Object.fromEntries(AGE_BANDS.map((b) => [b.slug, [b.min, b.max] as const])) as Record<
  AgeBandSlug,
  readonly [number, number]
>;

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

/**
 * Only worlds with a real example book (owner decision 2026-10-09: the template-only art reads as
 * a different, flatter product). The other worlds stay creatable in /create and keep their SEO pages.
 * If the showcase is empty (fetch failed), every world is shown so the catalog never renders blank.
 */
export function buildCatalog(showcase: ShowcaseBook[]): CatalogWorld[] {
  const exampleByTemplate = new Map<string, ShowcaseBook>();
  for (const book of showcase) {
    // The API returns newest first: keep the first book per world, and only books with art.
    if (book.coverImage && !exampleByTemplate.has(book.templateId)) exampleByTemplate.set(book.templateId, book);
  }
  const worlds = STORY_TEMPLATES.map((template) => ({ template, example: exampleByTemplate.get(template.id) ?? null }));
  const withExample = worlds.filter((w) => w.example);
  return withExample.length > 0 ? withExample : worlds;
}
