import { NextResponse } from "next/server";
import { illustrationPath, toShowcaseUrl } from "@/lib/storage/illustration-refs";
import { SHOWCASE_STATUSES, getShowcaseRefs, showcaseReadClient } from "@/lib/showcase";
import { showcaseSlug } from "@/lib/showcase-slug";

export async function GET(request: Request) {
  const supabase = showcaseReadClient();

  // Optional locale filter from query param
  const { searchParams } = new URL(request.url);
  const locale = searchParams.get("locale");

  let query = supabase
    .from("stories")
    .select(`
      id,
      title,
      template_id,
      generated_text,
      locale,
      cover_image_url,
      characters (name, age, gender),
      story_illustrations (scene_number, image_url)
    `)
    .eq("is_showcase", true)
    .in("status", SHOWCASE_STATUSES)
    .order("created_at", { ascending: false })
    .limit(10);

  if (locale) {
    query = query.eq("locale", locale);
  }

  const { data: stories, error } = await query;

  if (error) {
    console.error("[Showcase] Error fetching showcase stories:", error);
    return NextResponse.json(
      { error: "Failed to fetch showcase stories" },
      { status: 500 },
    );
  }

  // Readable /examples/{slug} links (an outage there degrades to the title's slug).
  const slugs = new Map((await getShowcaseRefs().catch(() => [])).map((r) => [r.id, r.slug]));

  // Transform data to only expose what the landing page needs
  const showcase = (stories ?? []).map((story) => {
    // Normalize: generated_text may be string (text column) or object (jsonb)
    let generated = story.generated_text as unknown as {
      bookTitle: string;
      scenes: { sceneNumber: number }[];
    } | null;
    if (typeof generated === "string") {
      try { generated = JSON.parse(generated); } catch { generated = null; }
    }

    const illustrations = (
      story.story_illustrations as unknown as {
        scene_number: number;
        image_url: string | null;
      }[]
    )
      // Mock/dev illustrations point at assets that no longer exist —
      // never surface them on the landing page.
      .filter((i) => i.image_url && !i.image_url.includes("/illustrations/mock/"))
      .sort((a, b) => a.scene_number - b.scene_number);

    // The book's cover art when we host it (legacy covers point at Recraft), else its first scene.
    // Public `showcase` bucket mirror — children's originals are private.
    const coverImage = toShowcaseUrl((illustrationPath(story.cover_image_url) && story.cover_image_url) || illustrations[0]?.image_url, process.env.NEXT_PUBLIC_SUPABASE_URL!);

    const character = story.characters as unknown as {
      name: string;
      age: number;
      gender: string;
    };

    const title = story.title || generated?.bookTitle || "Untitled";
    return {
      id: story.id,
      slug: slugs.get(story.id) ?? showcaseSlug(title),
      locale: story.locale ?? "es",
      templateId: story.template_id,
      title,
      coverImage,
      characterName: character?.name ?? "",
      characterAge: character?.age ?? 0,
      totalPages: (generated?.scenes?.length ?? 0) + 4, // cover + dedication + scenes + final + back
    };
  });

  return NextResponse.json(showcase, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
