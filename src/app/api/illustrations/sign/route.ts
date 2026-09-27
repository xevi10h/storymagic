import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { illustrationPath, illustrationScope } from "@/lib/storage/illustration-refs";
import { ILLUSTRATION_URL_TTL, signIllustrationRefs } from "@/lib/storage/illustration-urls";

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
 *  - legacy `portraits/<uuid>/` only when one of the user's own characters/stories references it
 * Anything else resolves to null. Non-illustration refs are echoed back unchanged.
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
  let needsLegacyCheck = false;
  for (const ref of refs) {
    const path = illustrationPath(ref);
    if (!path) continue;
    const scope = illustrationScope(path);
    if (scope.kind === "story") storyIds.add(scope.storyId);
    if (scope.kind === "legacy-portrait") needsLegacyCheck = true;
  }

  const [ownedStories, ownedLegacy] = await Promise.all([
    storyIds.size > 0
      ? supabase.from("stories").select("id").in("id", [...storyIds]).eq("user_id", user.id)
      : Promise.resolve({ data: [] as { id: string }[] }),
    needsLegacyCheck ? ownedPortraitPaths(supabase, user.id) : Promise.resolve(new Set<string>()),
  ]);
  const owned = new Set((ownedStories.data ?? []).map((s) => s.id.toLowerCase()));
  const userId = user.id.toLowerCase();

  const signed = await signIllustrationRefs(refs, {
    ttl: ILLUSTRATION_URL_TTL.creation,
    allow: (path) => {
      const scope = illustrationScope(path);
      if (scope.kind === "story") return owned.has(scope.storyId);
      if (scope.kind === "user-portrait") return scope.userId === userId;
      if (scope.kind === "legacy-portrait") return ownedLegacy.has(path);
      return false;
    },
  });

  return NextResponse.json(
    { urls: Object.fromEntries(refs.map((ref) => [ref, signed.get(ref) ?? null])) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

/** Legacy portrait paths referenced by the user's own rows. */
async function ownedPortraitPaths(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<Set<string>> {
  const [characters, stories] = await Promise.all([
    supabase.from("characters").select("avatar_url").eq("user_id", userId),
    supabase.from("stories").select("character_portrait_url").eq("user_id", userId),
  ]);
  const out = new Set<string>();
  for (const c of characters.data ?? []) {
    const p = illustrationPath(c.avatar_url);
    if (p) out.add(p);
  }
  for (const s of stories.data ?? []) {
    const p = illustrationPath(s.character_portrait_url);
    if (p) out.add(p);
  }
  return out;
}
