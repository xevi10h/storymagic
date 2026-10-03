import { cache } from "react";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { illustrationPath, toShowcaseUrl } from "@/lib/storage/illustration-refs";
import { showcaseSlug } from "@/lib/showcase-slug";
import { planBook } from "@/lib/book/book-plan.server";
import { planAssetsOf, type BookPlan, type BookPlanSource } from "@/lib/book/book-plan";
import type { BookPageSource } from "@/lib/book-pages";
import type { GeneratedStory } from "@/lib/ai/story-generator";

// Read-side helper for showcase example stories (is_showcase + finished book).
// Mirrors /api/showcase mapping but runs server-side for the /examples index.

/** A finished book stays a valid example after it is ordered (the owner's print-checked books are). */
export const SHOWCASE_STATUSES = ["ready", "ordered"];

export interface ShowcaseStory {
  id: string;
  /** Readable URL segment: /{locale}/examples/{slug} (see getShowcaseRefs). */
  slug: string;
  /** The book's own locale (the list falls back to other locales when one has none). */
  locale: string;
  templateId: string;
  title: string;
  coverImage: string | null;
  characterName: string;
  characterAge: number;
}

/**
 * Showcase rows have no public RLS policy (children's data: the anon key must not
 * read whole rows). Every showcase reader runs server-side with the service role
 * and MUST filter is_showcase = true and select an explicit column whitelist.
 */
export function showcaseReadClient() {
  return createFulfilmentClient();
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapStory(story: any, slugs: Map<string, string>): ShowcaseStory {
  let generated = story.generated_text as
    | { bookTitle?: string; scenes?: { sceneNumber: number }[] }
    | string
    | null;
  if (typeof generated === "string") {
    try {
      generated = JSON.parse(generated);
    } catch {
      generated = null;
    }
  }
  const illustrations = ((story.story_illustrations as any[]) ?? [])
    .slice()
    .sort((a, b) => a.scene_number - b.scene_number);
  const character = story.characters as any;
  const title: string = story.title || (generated as any)?.bookTitle || "Untitled";
  return {
    id: story.id,
    slug: slugs.get(story.id) ?? showcaseSlug(title),
    locale: story.locale ?? "es",
    templateId: story.template_id,
    // The printed title (stories.title wins over the generated one, like the book itself).
    title,
    // Public `showcase` bucket mirror — children's originals are private.
    coverImage: toShowcaseUrl((illustrationPath(story.cover_image_url) && story.cover_image_url) || illustrations[0]?.image_url, process.env.NEXT_PUBLIC_SUPABASE_URL!),
    characterName: character?.name ?? "",
    characterAge: character?.age ?? 0,
  };
}

const SELECT =
  "id, title, template_id, generated_text, locale, cover_image_url, characters (name, age, gender), story_illustrations (scene_number, image_url)";

// ── Slugs + cross-locale editions ──────────────────────────────────────────

/** One example book in one locale, as its URL and hreflang need it. */
export interface ShowcaseRef {
  id: string;
  locale: string;
  slug: string;
  title: string;
  /** Same book in every locale: the original's id (translations carry story_decisions.showcaseTranslationOf). */
  groupId: string;
}

/**
 * Every published example book with its slug (one small query per request, React
 * cache). The slug is the printed title in that locale; a second book with the same
 * title in the same locale gets its id prefix appended, so every slug is unique
 * per locale and stable (the oldest book keeps the bare slug).
 */
export const getShowcaseRefs = cache(async (): Promise<ShowcaseRef[]> => {
  const { data, error } = await showcaseReadClient()
    .from("stories")
    .select("id, locale, title, created_at, bookTitle:generated_text->>bookTitle, translationOf:story_decisions->>showcaseTranslationOf")
    .eq("is_showcase", true)
    .in("status", SHOWCASE_STATUSES)
    .order("created_at", { ascending: true })
    .limit(500);
  // An outage must not look like "no examples" (a cached 404 / empty sitemap): throw.
  if (error) throw new Error(`showcase refs: ${error.message}`);
  const taken = new Set<string>();
  return (data ?? []).map((row) => {
    const r = row as unknown as { id: string; locale: string | null; title: string | null; bookTitle: string | null; translationOf: string | null };
    const locale = r.locale ?? "es";
    const title = r.title || r.bookTitle || "Untitled";
    let slug = showcaseSlug(title);
    if (taken.has(`${locale}/${slug}`)) slug = `${slug}-${r.id.slice(0, 8)}`;
    taken.add(`${locale}/${slug}`);
    return { id: r.id, locale, slug, title, groupId: r.translationOf || r.id };
  });
});

async function slugMap(): Promise<Map<string, string>> {
  try {
    return new Map((await getShowcaseRefs()).map((r) => [r.id, r.slug]));
  } catch {
    return new Map();
  }
}

/** The book at /{locale}/examples/{slug}, if published. */
export async function findShowcaseRef(locale: string, slug: string): Promise<ShowcaseRef | null> {
  return (await getShowcaseRefs()).find((r) => r.locale === locale && r.slug === slug) ?? null;
}

/**
 * Where a legacy /{locale}/examples/{uuid} URL now lives: the same book's edition
 * in the requested locale, else the book itself in its own locale. Null = no such example.
 */
export async function showcaseRedirectTarget(locale: string, storyId: string): Promise<ShowcaseRef | null> {
  const refs = await getShowcaseRefs();
  const ref = refs.find((r) => r.id === storyId);
  if (!ref) return null;
  return refs.find((r) => r.groupId === ref.groupId && r.locale === locale) ?? ref;
}

/** Every locale edition of one example book (for hreflang and the sitemap). */
export async function showcaseEditions(groupId: string): Promise<ShowcaseRef[]> {
  return (await getShowcaseRefs()).filter((r) => r.groupId === groupId);
}

// ── Full book (viewer + server-rendered text) ──────────────────────────────

/** A published example with everything the viewer draws: the printed book's plan included. */
export interface ShowcaseBookData extends BookPageSource {
  locale: string | null;
  book_plan: BookPlan;
}

/**
 * The whole example book (same columns, public-mirror mapping and print plan as the
 * sample PDF), or null when the id is not a published example. Throws on an outage.
 */
export const getShowcaseBook = cache(async (storyId: string): Promise<ShowcaseBookData | null> => {
  const { data: story, error } = await showcaseReadClient()
    .from("stories")
    .select(`
      id,
      template_id,
      generated_text,
      dedication_text,
      sender_name,
      status,
      title,
      cover_image_url,
      character_portrait_url,
      locale,
      characters (name, age, gender, city, interests, favorite_color, favorite_companion, future_dream, avatar_url),
      story_illustrations (scene_number, image_url, status)
    `)
    .eq("id", storyId)
    .eq("is_showcase", true)
    .in("status", SHOWCASE_STATUSES)
    .maybeSingle();
  // 22P02 = not a UUID → simply not found.
  if (error && error.code !== "22P02") throw new Error(`showcase story ${storyId}: ${error.message}`);
  if (!story) return null;

  const row = story as unknown as ShowcaseBookData & { generated_text: GeneratedStory | string };
  // Normalize generated_text: legacy rows may store it as a string.
  if (typeof row.generated_text === "string") {
    try {
      row.generated_text = JSON.parse(row.generated_text) as GeneratedStory;
    } catch {
      return null;
    }
  }

  // Showcase images are served from the public `showcase` bucket mirror
  // (scripts/publish-showcase.mts); the originals are private children's imagery.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  row.cover_image_url = toShowcaseUrl(row.cover_image_url, supabaseUrl);
  row.character_portrait_url = toShowcaseUrl(row.character_portrait_url, supabaseUrl);
  if (row.characters) row.characters.avatar_url = toShowcaseUrl(row.characters.avatar_url, supabaseUrl);
  for (const ill of row.story_illustrations ?? []) ill.image_url = toShowcaseUrl(ill.image_url, supabaseUrl);

  // The printed book's plan (same planner + fonts as the sample PDF): the viewer draws exactly these pages.
  const assets = planAssetsOf(row.generated_text as GeneratedStory);
  const book_plan = await planBook(row as unknown as BookPlanSource, {
    hero: toShowcaseUrl(assets.finalHero?.url ?? null, supabaseUrl),
    map: assets.mapGame ? toShowcaseUrl(assets.finalMap?.url ?? null, supabaseUrl) : null,
  });
  return { ...(row as ShowcaseBookData), book_plan };
});

// ── Lists ───────────────────────────────────────────────────────────────────

export const getShowcaseStories = cache(async function getShowcaseStories(
  locale: string,
  limit = 24,
): Promise<ShowcaseStory[]> {
  const supabase = showcaseReadClient();

  const base = () =>
    supabase
      .from("stories")
      .select(SELECT)
      .eq("is_showcase", true)
      .in("status", SHOWCASE_STATUSES)
      .order("created_at", { ascending: false })
      .limit(limit);

  // Locale-specific first, fall back to all locales if none.
  const localeRes = await base().eq("locale", locale);
  let rows = localeRes.data ?? [];
  if (rows.length === 0) {
    const allRes = await base();
    rows = allRes.data ?? [];
  }
  const slugs = await slugMap();
  return rows.map((row) => mapStory(row, slugs)).filter((s) => s.coverImage);
});

export interface ShowcaseLikenessBook extends ShowcaseStory {
  /** The child's painted portrait (print hero, else the character portrait). */
  portraitImage: string | null;
  /** The first scenes, in reading order: what a parent sees in the free preview. */
  scenes: string[];
}

/**
 * Flagged books with their portrait and first scenes (the likeness page shows
 * "cover + portrait + first scenes", exactly what the free preview shows). Same
 * filters and public-mirror mapping as /api/showcase/[storyId].
 */
export async function getShowcaseLikenessBooks(locale: string, sceneCount: number, limit = 8): Promise<ShowcaseLikenessBook[]> {
  const supabase = showcaseReadClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const { data, error } = await supabase
    .from("stories")
    .select(`${SELECT}, character_portrait_url`)
    .eq("is_showcase", true)
    .in("status", SHOWCASE_STATUSES)
    .eq("locale", locale)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  const slugs = await slugMap();
  return data
    .map((row: any) => {
      const base = mapStory(row, slugs);
      const generated = typeof row.generated_text === "string" ? safeJson(row.generated_text) : row.generated_text;
      const hero = (generated as { imageAssets?: { finalHero?: { url?: string } } } | null)?.imageAssets?.finalHero?.url ?? null;
      const scenes = ((row.story_illustrations as any[]) ?? [])
        .slice()
        .sort((a, b) => a.scene_number - b.scene_number)
        .map((ill) => toShowcaseUrl(ill.image_url, supabaseUrl))
        .filter((url): url is string => Boolean(url))
        .slice(0, sceneCount);
      return {
        ...base,
        portraitImage: toShowcaseUrl(hero, supabaseUrl) ?? toShowcaseUrl(row.character_portrait_url, supabaseUrl),
        scenes,
      };
    })
    .filter((b) => b.coverImage && b.portraitImage && b.scenes.length === sceneCount);
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
