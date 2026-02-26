import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

function createPublicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storyId: string }> },
) {
  const { storyId } = await params;
  const supabase = createPublicClient();

  const { data: story, error } = await supabase
    .from("stories")
    .select(`
      id,
      template_id,
      generated_text,
      dedication_text,
      sender_name,
      status,
      characters (name, age, gender, city),
      story_illustrations (scene_number, image_url)
    `)
    .eq("id", storyId)
    .eq("is_showcase", true)
    .eq("status", "ready")
    .single();

  if (error || !story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  return NextResponse.json(story, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
