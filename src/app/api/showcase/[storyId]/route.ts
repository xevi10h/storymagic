import { NextResponse } from "next/server";
import { toShowcaseUrl } from "@/lib/storage/illustration-refs";
import { SHOWCASE_STATUSES, showcaseReadClient } from "@/lib/showcase";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storyId: string }> },
) {
  const { storyId } = await params;
  const supabase = showcaseReadClient();

  const { data: story, error } = await supabase
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
    .single();

  if (error || !story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  // Normalize generated_text: DB column may be text (string) or jsonb (object)
  if (typeof story.generated_text === "string") {
    try {
      (story as Record<string, unknown>).generated_text = JSON.parse(story.generated_text as string);
    } catch {
      return NextResponse.json({ error: "Invalid story data" }, { status: 500 });
    }
  }

  // Showcase images are served from the public `showcase` bucket mirror
  // (scripts/publish-showcase.mts); the originals are private children's imagery.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  story.cover_image_url = toShowcaseUrl(story.cover_image_url, supabaseUrl);
  story.character_portrait_url = toShowcaseUrl(story.character_portrait_url, supabaseUrl);
  const character = story.characters as unknown as { avatar_url: string | null } | null;
  if (character) character.avatar_url = toShowcaseUrl(character.avatar_url, supabaseUrl);
  for (const ill of (story.story_illustrations ?? []) as unknown as { image_url: string | null }[]) {
    ill.image_url = toShowcaseUrl(ill.image_url, supabaseUrl);
  }

  return NextResponse.json(story, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
