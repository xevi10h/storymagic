import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkMemoryRateLimit } from "@/lib/rate-limit";
import { getSiteUrl } from "@/lib/email/send";
import { SHAREABLE_STORY_STATUSES, createPreviewShareToken, previewShareUrl } from "@/lib/share/preview-share-token";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bodySchema = z.object({ locale: z.enum(["es", "ca", "en", "fr"]).default("es") });

/**
 * Owner-only: a read-only share link to the story's PREVIEW (works in any browser,
 * expires after 30 days). The link is a signed token (lib/share/preview-share-token.ts),
 * so creating one writes nothing; the per-user limit only slows scripted loops.
 * Response: { url, path, expiresAt } — never cached.
 */
export async function POST(request: Request, { params }: { params: Promise<{ storyId: string }> }) {
  const { storyId } = await params;
  if (!UUID_RE.test(storyId)) {
    return NextResponse.json({ error: "invalid_story_id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rl = checkMemoryRateLimit(`share_preview:${user.id}`, { maxRequests: 30, windowSeconds: 600 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const json: unknown = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json ?? {});
  const locale = parsed.success ? parsed.data.locale : "es";

  // RLS client + user_id filter: only the owner can mint a link for this story.
  const { data: story } = await supabase
    .from("stories")
    .select("id, status")
    .eq("id", storyId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!story || !(SHAREABLE_STORY_STATUSES as readonly string[]).includes(story.status)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { token, expiresAt } = createPreviewShareToken(story.id);
  return NextResponse.json(
    {
      url: previewShareUrl(getSiteUrl(), locale, token),
      // Same link relative to the current origin (the client prefers it: works on previews/dev too).
      path: previewShareUrl("", locale, token),
      expiresAt: expiresAt.toISOString(),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
