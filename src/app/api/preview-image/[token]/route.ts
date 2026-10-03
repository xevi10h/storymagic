import { NextResponse } from "next/server";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { SHAREABLE_STORY_STATUSES, verifyPreviewShareToken } from "@/lib/share/preview-share-token";
import { getIllustrationUrl, storyOnlyAccess } from "@/lib/storage/illustration-urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Long enough for a mail client's image proxy to fetch it after the redirect. */
const SIGNED_TTL_S = 10 * 60;

/**
 * Cover of a story preview for emails (the abandoned-preview reminders). The private
 * `illustrations` bucket only hands out short-lived signed URLs, which would be dead by
 * the time an email is opened: this capability URL (the read-only share token, 30 days,
 * verified before any database access) redirects to a fresh one. It only ever serves the
 * cover of that one story, the same image the share link already shows.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const verified = verifyPreviewShareToken(token);
  if (!verified.ok) return new NextResponse(null, { status: 404 });

  const { data: story, error } = await createFulfilmentClient()
    .from("stories")
    .select("id, cover_image_url")
    .eq("id", verified.storyId)
    .in("status", [...SHAREABLE_STORY_STATUSES])
    .maybeSingle();
  if (error) console.error(`[preview-image] Loading story ${verified.storyId} failed: ${error.message}`);
  if (!story?.cover_image_url) return new NextResponse(null, { status: 404 });

  const url = await getIllustrationUrl(story.cover_image_url, { ttl: SIGNED_TTL_S, allow: storyOnlyAccess(story.id) });
  // Only our own storage or site may be a redirect target (a non-illustration ref is returned as is).
  if (!url || !/^https?:\/\//.test(url)) return new NextResponse(null, { status: 404 });

  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: url,
      // The token is a capability: keep it out of shared caches and referrers.
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
    },
  });
}
