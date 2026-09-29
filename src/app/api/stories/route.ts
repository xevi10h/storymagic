import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import type { Json } from "@/lib/database.types";
import { ownedPortraitPath } from "@/lib/storage/illustration-urls";
import { avatarAssetPathSchema, characterLookShape } from "@/lib/character-look";

const VALID_TEMPLATE_IDS = ["space", "forest", "superhero", "pirates", "chef", "dinosaurs", "castle", "safari", "inventor", "candy"] as const;
const VALID_MODES = ["solo", "juntos"] as const;
const VALID_LOCALES = ["es", "ca", "en", "fr"] as const;

const storyInputSchema = z.object({
  character: z.object({
    ...characterLookShape,
    name: z.string().min(1).max(50),
    interests: z.array(z.string().max(50)).max(4).optional(),
    city: z.string().max(100).optional(),
    favoriteCompanion: z.string().max(100).optional(),
    futureDream: z.string().max(150).optional(),
  }),
  templateId: z.enum(VALID_TEMPLATE_IDS),
  creationMode: z.enum(VALID_MODES),
  decisions: z.record(z.string(), z.unknown()).optional().default({}),
  dedication: z.string().max(500).optional(),
  senderName: z.string().max(100).optional(),
  ending: z.string().max(100).optional(),
  /** Portrait from POST /api/characters/portrait: signed URL, legacy public URL or object path. */
  portraitUrl: z.string().max(2000).nullish(),
  /** Pre-rendered watercolor avatar ("Créalo tú"), used as the face anchor when there is no portrait. */
  avatarAssetPath: avatarAssetPathSchema.nullish(),
  recraftStyleId: z.string().max(100).nullish(),
  locale: z.enum(VALID_LOCALES).optional().default("es"),
  /** From POST /api/characters/prepare: the generate route reuses its child sheet if the traits still match */
  characterPrepId: z.string().uuid().nullish(),
});

/** A retry of the same creation arrives within seconds; a deliberate second identical book later is still a new draft. */
const DRAFT_REUSE_WINDOW_MS = 10 * 60_000;

/** JSON with sorted keys: jsonb does not keep the client's key order. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableJson((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export async function POST(request: Request) {
  const supabase = await createClient();

  // Verify authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = storyInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { character, templateId, creationMode, decisions, dedication, senderName, ending, portraitUrl, avatarAssetPath, recraftStyleId, locale, characterPrepId } = parsed.data;

  // 1. Upsert character (reuse if same name + user)
  const { data: existingCharacter } = await supabase
    .from("characters")
    .select("id")
    .eq("user_id", user.id)
    .eq("name", character.name)
    .single();

  let characterId: string;

  // Shared optional fields (undefined = skip on update, null = clear on insert)
  const optionalFields = {
    hairstyle: character.hairstyle || "short",
    interests: character.interests ?? [],
    city: character.city || null,
    favorite_color: character.favoriteColor || null,
    favorite_companion: character.favoriteCompanion || null,
    future_dream: character.futureDream || null,
    glasses: character.glasses ?? "none",
    freckles: character.freckles ?? false,
    // Face anchor of the character sheet: the object path of the user's OWN portrait
    // (private bucket), else the pre-rendered avatar asset path. MOCK_MODE keeps picsum URLs.
    avatar_url:
      ownedPortraitPath(portraitUrl, user.id) ??
      avatarAssetPath ??
      (process.env.MOCK_MODE === "true" ? portraitUrl || null : null),
  };

  if (existingCharacter) {
    // Update existing character — all fields optional in update type
    const { error: updateError } = await supabase
      .from("characters")
      .update({
        gender: character.gender as string,
        age: character.age,
        hair_color: character.hairColor || undefined,
        eye_color: character.eyeColor || undefined,
        skin_tone: character.skinTone || undefined,
        ...optionalFields,
      })
      .eq("id", existingCharacter.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update character" },
        { status: 500 }
      );
    }
    characterId = existingCharacter.id;
  } else {
    // Create new character — hair_color & skin_tone are required strings
    const { data: newCharacter, error: insertError } = await supabase
      .from("characters")
      .insert({
        user_id: user.id,
        name: character.name,
        gender: character.gender as string,
        age: character.age,
        hair_color: character.hairColor || "brown",
        eye_color: character.eyeColor || null,
        skin_tone: character.skinTone || "medium",
        ...optionalFields,
      })
      .select("id")
      .single();

    if (insertError || !newCharacter) {
      return NextResponse.json(
        { error: "Failed to create character" },
        { status: 500 }
      );
    }
    characterId = newCharacter.id;
  }

  // Only the caller's own prep may be linked (the generate route re-checks it too);
  // an unknown / foreign id is dropped silently: the prep is only an accelerator.
  let ownPrepId: string | null = null;
  if (characterPrepId) {
    const { data: prep } = await supabase
      .from("character_preps")
      .select("id")
      .eq("id", characterPrepId)
      .eq("user_id", user.id)
      .maybeSingle();
    ownPrepId = prep?.id ?? null;
  }

  // 2. Idempotent create: a client that timed out and retries (or a double tap)
  // gets the draft its first request already created instead of a second one.
  // Same user + character + world + path + language within the last few minutes
  // and still an untouched draft = the same request.
  const { data: recentDrafts } = await supabase
    .from("stories")
    .select("id, story_decisions")
    .eq("user_id", user.id)
    .eq("character_id", characterId)
    .eq("template_id", templateId)
    .eq("creation_mode", creationMode)
    .eq("locale", locale)
    .eq("status", "draft")
    .gte("created_at", new Date(Date.now() - DRAFT_REUSE_WINDOW_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(5);
  const decisionsKey = stableJson(decisions || {});
  const reusable = recentDrafts?.find((d) => stableJson(d.story_decisions ?? {}) === decisionsKey);
  if (reusable) {
    // Refresh what the parent may have edited in between (dedication, prep link).
    await supabase
      .from("stories")
      .update({ dedication_text: dedication || null, sender_name: senderName || null, ending_choice: ending || null, character_prep_id: ownPrepId })
      .eq("id", reusable.id)
      .eq("status", "draft");
    return NextResponse.json({ storyId: reusable.id, characterId });
  }

  // 3. Create story draft
  const draft = {
    user_id: user.id,
    character_id: characterId,
    template_id: templateId,
    creation_mode: creationMode,
    story_decisions: (decisions || {}) as Json,
    dedication_text: dedication || null,
    sender_name: senderName || null,
    ending_choice: ending || null,
    recraft_style_id: recraftStyleId || null,
    // Ownership + trait match are re-checked by the generate route before any reuse.
    character_prep_id: ownPrepId,
    locale,
    status: "draft",
  };
  let { data: story, error: storyError } = await supabase.from("stories").insert(draft).select("id").single();
  if (storyError?.code === "23503" && draft.character_prep_id) {
    // Unknown prep id (FK): the prep is only an accelerator — create the story without it.
    ({ data: story, error: storyError } = await supabase.from("stories").insert({ ...draft, character_prep_id: null }).select("id").single());
  }

  if (storyError || !story) {
    return NextResponse.json(
      { error: "Failed to create story" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    storyId: story.id,
    characterId,
  });
}
