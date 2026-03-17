import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  const { storyId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Light mode: only fetch status + generated_text for polling.
  // Avoids expensive JOINs on characters + story_illustrations every 3 seconds.
  const url = new URL(request.url);
  const isLight = url.searchParams.get("light") === "true";

  if (isLight) {
    const { data: story, error } = await supabase
      .from("stories")
      .select("id, status, generated_text, title")
      .eq("id", storyId)
      .eq("user_id", user.id)
      .single();

    if (error || !story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }
    return NextResponse.json(story);
  }

  // Full mode: fetch everything (for preview page, etc.)
  const { data: story, error } = await supabase
    .from("stories")
    .select("*, characters(*), story_illustrations(*)")
    .eq("id", storyId)
    .eq("user_id", user.id)
    .single();

  if (error || !story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  return NextResponse.json(story);
}
