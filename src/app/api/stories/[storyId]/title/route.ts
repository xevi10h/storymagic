import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createFulfilmentClient } from "@/lib/fulfilment/db";

const MAX_TITLE_LENGTH = 120;
const TITLE_EDITABLE_STATUSES = ["draft", "generating", "preview"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  const { storyId } = await params;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(storyId)) {
    return NextResponse.json({ error: "Invalid story ID" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { title?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : null;
  if (!title || title.length === 0) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return NextResponse.json({ error: `Title must be ${MAX_TITLE_LENGTH} characters or less` }, { status: 400 });
  }

  // Only allow updating the title before the book is paid for (the paid book's
  // PDF / print file carries the title). Clients have no write grant: service role
  // write, owner pinned by user_id.
  const { data, error } = await createFulfilmentClient()
    .from("stories")
    .update({ title })
    .eq("id", storyId)
    .eq("user_id", user.id)
    .in("status", TITLE_EDITABLE_STATUSES)
    .select("id");

  if (error) {
    console.error("[title] update failed:", error.message);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "not_editable" }, { status: 409 });
  }

  return NextResponse.json({ success: true, title });
}
