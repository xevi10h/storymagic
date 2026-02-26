import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Use service-level client to bypass RLS for the showcase query
// (RLS policies also allow this, but service key avoids auth dependency)
function createPublicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function GET() {
  const supabase = createPublicClient();

  const { data: stories, error } = await supabase
    .from("stories")
    .select(`
      id,
      template_id,
      generated_text,
      characters (name, age, gender),
      story_illustrations (scene_number, image_url)
    `)
    .eq("is_showcase", true)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) {
    console.error("[Showcase] Error fetching showcase stories:", error);
    return NextResponse.json(
      { error: "Failed to fetch showcase stories" },
      { status: 500 },
    );
  }

  // Transform data to only expose what the landing page needs
  const showcase = (stories ?? []).map((story) => {
    const generated = story.generated_text as unknown as {
      bookTitle: string;
      scenes: { sceneNumber: number }[];
    } | null;

    const illustrations = (
      story.story_illustrations as unknown as {
        scene_number: number;
        image_url: string | null;
      }[]
    ).sort((a, b) => a.scene_number - b.scene_number);

    // Use the first illustration as the cover image
    const coverImage = illustrations[0]?.image_url ?? null;

    const character = story.characters as unknown as {
      name: string;
      age: number;
      gender: string;
    };

    return {
      id: story.id,
      templateId: story.template_id,
      title: generated?.bookTitle ?? "Untitled",
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
