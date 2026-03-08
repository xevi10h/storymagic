import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import type { Json } from "@/lib/database.types";

const VALID_TEMPLATE_IDS = ["space", "forest", "superhero", "pirates", "chef", "dinosaurs", "castle", "safari", "inventor", "candy"] as const;
const VALID_MODES = ["solo", "juntos"] as const;
const VALID_GENDERS = ["boy", "girl", "neutral"] as const;

const storyInputSchema = z.object({
  character: z.object({
    name: z.string().min(1).max(100),
    gender: z.enum(VALID_GENDERS),
    age: z.number().int().min(1).max(12),
    hairColor: z.string().max(20).optional(),
    eyeColor: z.string().max(20).optional(),
    skinTone: z.string().max(20).optional(),
    hairstyle: z.string().max(30).optional(),
    interests: z.array(z.string().max(50)).max(10).optional(),
    city: z.string().max(100).optional(),
    specialTrait: z.string().max(300).optional(),
    favoriteCompanion: z.string().max(200).optional(),
    favoriteFood: z.string().max(100).optional(),
    futureDream: z.string().max(150).optional(),
  }),
  templateId: z.enum(VALID_TEMPLATE_IDS),
  creationMode: z.enum(VALID_MODES),
  decisions: z.record(z.string(), z.unknown()).optional().default({}),
  dedication: z.string().max(500).optional(),
  senderName: z.string().max(100).optional(),
  ending: z.string().max(100).optional(),
  portraitUrl: z.string().url().max(2000).nullish(),
  recraftStyleId: z.string().max(100).nullish(),
});

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

  const { character, templateId, creationMode, decisions, dedication, senderName, ending, portraitUrl, recraftStyleId } = parsed.data;

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
    special_trait: character.specialTrait || null,
    favorite_companion: character.favoriteCompanion || null,
    favorite_food: character.favoriteFood || null,
    future_dream: character.futureDream || null,
    avatar_url: portraitUrl || null,
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

  // 2. Create story draft
  const { data: story, error: storyError } = await supabase
    .from("stories")
    .insert({
      user_id: user.id,
      character_id: characterId,
      template_id: templateId,
      creation_mode: creationMode,
      story_decisions: (decisions || {}) as Json,
      dedication_text: dedication || null,
      sender_name: senderName || null,
      ending_choice: ending || null,
      recraft_style_id: recraftStyleId || null,
      status: "draft",
    })
    .select("id")
    .single();

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
