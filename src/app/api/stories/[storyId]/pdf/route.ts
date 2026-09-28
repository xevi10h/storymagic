import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { bookPdfFilename, getSignedBookDownloadUrl } from "@/lib/supabase/storage";

const PAID_STATUSES = ["paid", "producing", "shipped", "delivered"];

/**
 * Owner download of the customer PDF: `{ url }`, a 10-minute signed Storage URL
 * (the PDF is built by the fulfilment pipeline; nothing is rendered here, and the
 * bytes never pass through this function). Requires a live paid order.
 * Guests and email links use /api/downloads/{token} instead.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ storyId: string }> }) {
  const { storyId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: story } = await supabase
    .from("stories")
    .select("id, user_id, title, pdf_url, generated_text")
    .eq("id", storyId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

  // Orders are checked with the service role (status is not user-writable).
  const { data: paid } = await createFulfilmentClient()
    .from("orders")
    .select("id")
    .eq("story_id", storyId)
    .eq("user_id", user.id)
    .in("status", PAID_STATUSES)
    .limit(1)
    .maybeSingle();
  if (!paid) return NextResponse.json({ error: "not_purchased" }, { status: 403 });
  if (!story.pdf_url) return NextResponse.json({ error: "pdf_not_ready" }, { status: 409 });

  const title = story.title ?? (story.generated_text as { bookTitle?: string } | null)?.bookTitle;
  try {
    const url = await getSignedBookDownloadUrl(createFulfilmentClient(), story.user_id, storyId, bookPdfFilename(title));
    return NextResponse.json({ url }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error(`[pdf] Sign failed for story ${storyId}:`, err);
    return NextResponse.json({ error: "pdf_not_ready" }, { status: 409 });
  }
}
