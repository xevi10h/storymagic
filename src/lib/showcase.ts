import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { illustrationPath, toShowcaseUrl } from "@/lib/storage/illustration-refs";

// Read-side helper for showcase example stories (is_showcase + finished book).
// Mirrors /api/showcase mapping but runs server-side for the /examples index.

/** A finished book stays a valid example after it is ordered (the owner's print-checked books are). */
export const SHOWCASE_STATUSES = ["ready", "ordered"];

export interface ShowcaseStory {
  id: string;
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
function mapStory(story: any): ShowcaseStory {
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
  return {
    id: story.id,
    templateId: story.template_id,
    title: (generated as any)?.bookTitle ?? "Untitled",
    // Public `showcase` bucket mirror — children's originals are private.
    coverImage: toShowcaseUrl((illustrationPath(story.cover_image_url) && story.cover_image_url) || illustrations[0]?.image_url, process.env.NEXT_PUBLIC_SUPABASE_URL!),
    characterName: character?.name ?? "",
    characterAge: character?.age ?? 0,
  };
}

const SELECT =
  "id, template_id, generated_text, locale, cover_image_url, characters (name, age, gender), story_illustrations (scene_number, image_url)";

export async function getShowcaseStories(
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
  return rows.map(mapStory).filter((s) => s.coverImage);
}
