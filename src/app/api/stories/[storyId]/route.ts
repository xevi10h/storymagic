import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { redactPreviewProgress, redactStoryForViewer } from "@/lib/preview-access";
import { isStoryPurchased } from "@/lib/story-purchase";
import { signPreviewProgress, signStoryRowImages } from "@/lib/storage/illustration-urls";

/**
 * The owner's story. Paywall: until the story is bought (live paid order) only the
 * free preview leaves the server (lib/preview-access.ts): locked scenes come back
 * as empty placeholders and their images are never signed.
 *
 * Rows are read with the service role and an explicit owner filter (user_id =
 * the session's user): clients have no SELECT grant on stories.generated_text /
 * story_illustrations.prompt_used (migration 20260930180000_paywall_columns.sql).
 */
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

  const db = createFulfilmentClient();

  // Light mode: status + preview progress for polling (/generar every 3 s, checkout
  // success). Avoids the JOINs on characters + story_illustrations.
  const url = new URL(request.url);
  const isLight = url.searchParams.get("light") === "true";

  if (isLight) {
    const { data: story, error } = await db
      .from("stories")
      // preview_progress: { coverUrl?, scenes: [{ index, url }], total } while generating
      // (src/lib/ai/preview-book.ts PreviewProgress); null before the first image.
      .select("id, status, title, preview_progress")
      .eq("id", storyId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }
    // Progress images are object paths in the private bucket: sign them for the owner
    // (free preview scenes only — the preview never paints more).
    const previewProgress = await signPreviewProgress(redactPreviewProgress(story.preview_progress), user.id, story.id);
    return NextResponse.json({ ...story, preview_progress: previewProgress }, { headers: { "Cache-Control": "private, no-store" } });
  }

  // Full mode: everything the preview / book page renders.
  const { data: row, error } = await db
    .from("stories")
    .select("*, characters(*), story_illustrations(*)")
    .eq("id", storyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  const purchased = await isStoryPurchased(row);
  const story = redactStoryForViewer(row, purchased);

  // Children's images live in a private bucket: hand the owner 1-hour signed URLs
  // (after redaction: locked scenes have no ref left to sign).
  await signStoryRowImages(story, user.id);
  return NextResponse.json(story, { headers: { "Cache-Control": "private, no-store" } });
}
