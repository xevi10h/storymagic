import { NextResponse } from "next/server";
import { getShowcaseBook } from "@/lib/showcase";

// The whole example book (viewer data + the printed book's plan). Same loader as
// the server-rendered /[locale]/examples/[slug] page (lib/showcase.ts).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storyId: string }> },
) {
  const { storyId } = await params;
  let story;
  try {
    story = await getShowcaseBook(storyId);
  } catch (error) {
    console.error("[Showcase] Error loading showcase story:", error);
    return NextResponse.json({ error: "Failed to load story" }, { status: 500 });
  }
  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  return NextResponse.json(story, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
