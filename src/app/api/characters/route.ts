import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { avatarAssetPathSchema, characterLookShape } from "@/lib/character-look";
import { formatChildName } from "@/lib/child-name";
import { checkMemoryRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/characters — save a character on its own (no book), e.g. "Crear su personaje"
 * on the Advent calendar. Same fields, validation and upsert-by-(user, name) as the
 * character step of POST /api/stories, so /create?characterId= prefills it exactly.
 * Needs a session: a signed-in account or the silent guest session (ensureGuestSession).
 *
 * Body: { name, gender, age, skinTone, hairColor, eyeColor?, hairstyle, glasses?, freckles?, avatarAssetPath? }
 *       (UI hex values, as the create flow sends them)
 * 200 { characterId }
 * 400 invalid input · 401 no session · 429 rate limited · 500 write failed
 */
export const runtime = "nodejs";

const characterInputSchema = z.object({
  ...characterLookShape,
  name: z.string().max(50).transform(formatChildName).pipe(z.string().min(1)),
  avatarAssetPath: avatarAssetPathSchema.nullish(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!checkMemoryRateLimit(`characters:${user.id}`, { maxRequests: 30, windowSeconds: 3600 }).allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = characterInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const c = parsed.data;

  // Reads with the caller's RLS client; writes with the service role, owner pinned.
  const admin = createFulfilmentClient();
  const look = {
    gender: c.gender as string,
    age: c.age,
    hair_color: c.hairColor || "brown",
    eye_color: c.eyeColor || null,
    skin_tone: c.skinTone || "medium",
    hairstyle: c.hairstyle || "short",
    favorite_color: c.favoriteColor || null,
    glasses: c.glasses ?? "none",
    freckles: c.freckles ?? false,
    // Face anchor for a later book: the pre-rendered avatar base (never a photo here).
    avatar_url: c.avatarAssetPath ?? null,
  };

  const { data: existing } = await supabase.from("characters").select("id").eq("user_id", user.id).eq("name", c.name).maybeSingle();
  if (existing) {
    const { error } = await admin.from("characters").update(look).eq("id", existing.id).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: "Failed to update character" }, { status: 500 });
    return NextResponse.json({ characterId: existing.id });
  }

  const { data: created, error } = await admin
    .from("characters")
    .insert({ user_id: user.id, name: c.name, interests: [], ...look })
    .select("id")
    .single();
  if (error || !created) return NextResponse.json({ error: "Failed to create character" }, { status: 500 });
  return NextResponse.json({ characterId: created.id });
}
