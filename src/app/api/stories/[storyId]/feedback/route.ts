import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { PREVIEW_FEEDBACK_REASONS } from "@/lib/preview-feedback";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bodySchema = z.object({ reason: z.enum(PREVIEW_FEEDBACK_REASONS), locale: z.string().max(5).optional() });

/**
 * One-tap "¿Qué te frena?" answer from the book preview (PreviewFeedback). One row per
 * story, the last answer wins. Owner only; service-role write (the table has no client grants).
 */
export async function POST(request: Request, { params }: { params: Promise<{ storyId: string }> }) {
  const { storyId } = await params;
  if (!UUID_RE.test(storyId)) return NextResponse.json({ error: "invalid_story_id" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const db = createFulfilmentClient();
  const { data: story } = await db.from("stories").select("id").eq("id", storyId).eq("user_id", user.id).maybeSingle();
  if (!story) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { error } = await db.from("preview_feedback").upsert(
    { story_id: storyId, user_id: user.id, reason: parsed.data.reason, locale: parsed.data.locale ?? null, updated_at: new Date().toISOString() },
    { onConflict: "story_id" },
  );
  if (error) {
    console.warn(`[preview-feedback] write failed: ${error.message}`);
    return NextResponse.json({ error: "write_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
