import { createClient } from "@supabase/supabase-js";

// Read-side helper for showcase example stories (is_showcase + ready).
// Mirrors /api/showcase mapping but runs server-side for the /ejemplo index.

export interface ShowcaseStory {
  id: string;
  templateId: string;
  title: string;
  coverImage: string | null;
  characterName: string;
  characterAge: number;
}

function publicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
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
    coverImage: illustrations[0]?.image_url ?? null,
    characterName: character?.name ?? "",
    characterAge: character?.age ?? 0,
  };
}

const SELECT =
  "id, template_id, generated_text, locale, characters (name, age, gender), story_illustrations (scene_number, image_url)";

export async function getShowcaseStories(
  locale: string,
  limit = 24,
): Promise<ShowcaseStory[]> {
  const supabase = publicClient();

  const base = () =>
    supabase
      .from("stories")
      .select(SELECT)
      .eq("is_showcase", true)
      .eq("status", "ready")
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
