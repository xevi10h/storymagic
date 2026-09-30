import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { freeImageRefs } from "@/lib/preview-access";
import { isStoryPurchased } from "@/lib/story-purchase";
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
 * Paywall: for a story that is not bought yet only its free-preview images (cover,
 * portrait, the free scenes — lib/preview-access.ts freeImageRefs) are signed.
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

  // Owned stories (service role + explicit owner filter) with what decides the paywall.
  const { data: ownedStories } =
    storyIds.size > 0
      ? await createFulfilmentClient()
          .from("stories")
          .select("id, status, is_showcase, cover_image_url, character_portrait_url, generated_text, preview_progress, story_illustrations(scene_number, image_url)")
          .in("id", [...storyIds])
          .eq("user_id", user.id)
      : { data: [] };

  // Bought stories: their whole folder. Unpaid ones: only the free-preview refs.
  const fullStoryIds: string[] = [];
  const freePaths = new Set<string>();
  for (const story of ownedStories ?? []) {
    if (await isStoryPurchased(story)) {
      fullStoryIds.push(story.id);
      continue;
    }
    for (const ref of freeImageRefs(story)) {
      const path = illustrationPath(ref);
      if (path) freePaths.add(path);
    }
  }
  const ownerAccess = userAccess({ userId: user.id, storyIds: fullStoryIds });

  const signed = await signIllustrationRefs(refs, {
    ttl: ILLUSTRATION_URL_TTL.creation,
    // Caller's own folders only: bought stories they own, the free preview of the
    // others, and portraits/<their id>/.
    allow: (path) => ownerAccess(path) || freePaths.has(path),
  });

  return NextResponse.json(
    { urls: Object.fromEntries(refs.map((ref) => [ref, signed.get(ref) ?? null])) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

