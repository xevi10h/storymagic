import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ILLUSTRATION_URL_TTL, signIllustrationRefs, signPreviewProgress, signStoryRowImages, userAccess } from "@/lib/storage/illustration-urls";
import { planBook } from "@/lib/book/book-plan.server";
import { planAssetsOf, type BookPlanSource } from "@/lib/book/book-plan";
import type { GeneratedStory } from "@/lib/ai/story-generator";

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
      // preview_progress: { coverUrl?, scenes: [{ index, url }], total } while generating
      // (src/lib/ai/preview-book.ts PreviewProgress); null before the first image.
      .select("id, status, generated_text, title, preview_progress")
      .eq("id", storyId)
      .eq("user_id", user.id)
      .single();

    if (error || !story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }
    // Progress images are object paths in the private bucket: sign them for the owner.
    const previewProgress = await signPreviewProgress(story.preview_progress, user.id, story.id);
    return NextResponse.json({ ...story, preview_progress: previewProgress }, { headers: { "Cache-Control": "private, no-store" } });
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

  // Children's images live in a private bucket: hand the owner 1-hour signed URLs.
  await signStoryRowImages(story, user.id);

  // The printed book's plan (the PDF's planner + fonts), so the viewer shows exactly the printed
  // pages — including the hero portrait (p27) and the adventure map (pp. 28–29) once they exist.
  let book_plan = null;
  const generated = story.generated_text as unknown as GeneratedStory | null;
  const character = story.characters as unknown as { name?: string } | null;
  if (generated?.scenes?.length && character?.name) {
    const assets = planAssetsOf(generated);
    const refs = [assets.finalHero?.url ?? null, assets.mapGame ? (assets.finalMap?.url ?? null) : null];
    const signed = await signIllustrationRefs(refs, { ttl: ILLUSTRATION_URL_TTL.ui, allow: userAccess({ userId: user.id, storyIds: [story.id] }) });
    const sign = (ref: string | null) => (ref ? (signed.get(ref) ?? null) : null);
    book_plan = await planBook(story as unknown as BookPlanSource, { hero: sign(refs[0]), map: sign(refs[1]) });
  }
  return NextResponse.json({ ...story, book_plan }, { headers: { "Cache-Control": "private, no-store" } });
}
