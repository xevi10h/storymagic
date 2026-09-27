import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Same limits as story creation (POST /api/stories).
const bodySchema = z
  .object({
    dedication: z.string().max(500).optional(),
    senderName: z.string().max(100).optional(),
  })
  .refine((b) => b.dedication !== undefined || b.senderName !== undefined, { message: "empty_update" });

/**
 * Update the parent's dedication while the preview is painted (screen 4) or
 * from the book preview (screen 5). Stored VERBATIM: no trimming, no rewriting;
 * the PDF and the viewer print exactly this text.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ storyId: string }> }) {
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

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const update: { dedication_text?: string | null; sender_name?: string | null } = {};
  if (parsed.data.dedication !== undefined) {
    update.dedication_text = parsed.data.dedication.trim() ? parsed.data.dedication : null;
  }
  if (parsed.data.senderName !== undefined) {
    update.sender_name = parsed.data.senderName.trim() ? parsed.data.senderName : null;
  }

  // Editable until the book is ordered (never after: the print file is fixed).
  const { data, error } = await supabase
    .from("stories")
    .update(update)
    .eq("id", storyId)
    .eq("user_id", user.id)
    .in("status", ["draft", "generating", "preview"])
    .select("id, dedication_text, sender_name");

  if (error) {
    console.error("[dedication] update failed:", error.message);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "not_editable" }, { status: 409 });
  }

  return NextResponse.json({
    dedication: data[0].dedication_text,
    senderName: data[0].sender_name,
  });
}
