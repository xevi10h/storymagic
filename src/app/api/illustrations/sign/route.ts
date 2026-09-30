import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { illustrationPath, illustrationScope } from "@/lib/storage/illustration-refs";
import { ILLUSTRATION_URL_TTL, signIllustrationRefs, userAccess } from "@/lib/storage/illustration-urls";

const bodySchema = z.object({
  refs: z.array(z.string().min(1).max(2000)).min(1).max(50),
});

/**
 * POST /api/illustrations/sign  { refs: string[] } → { urls: { [ref]: string | null } }
 *
 * Re-signs illustration refs (object paths, legacy public URLs or expired signed
 * URLs) for their owner — e.g. the avatar kept in the creation flow's localStorage.
 * Owner = the signed-in user, incl. anonymous guests:
 *  - `<storyId>/...`            the user owns the story (RLS client + user_id filter)
 *  - `portraits/<userId>/...`   userId is the caller
 * Anything else — incl. legacy `portraits/<uuid>/` files, whose owner is not in the
 * path — resolves to null. Non-illustration refs are echoed back unchanged.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const refs = parsed.data.refs;

  const storyIds = new Set<string>();
  for (const ref of refs) {
    const path = illustrationPath(ref);
    if (!path) continue;
    const scope = illustrationScope(path);
    if (scope.kind === "story") storyIds.add(scope.storyId);
  }

  const { data: ownedStories } =
    storyIds.size > 0
      ? await supabase.from("stories").select("id").in("id", [...storyIds]).eq("user_id", user.id)
      : { data: [] as { id: string }[] };

  const signed = await signIllustrationRefs(refs, {
    ttl: ILLUSTRATION_URL_TTL.creation,
    // Caller's own folders only: stories they own + portraits/<their id>/.
    allow: userAccess({ userId: user.id, storyIds: (ownedStories ?? []).map((s) => s.id) }),
  });

  return NextResponse.json(
    { urls: Object.fromEntries(refs.map((ref) => [ref, signed.get(ref) ?? null])) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

