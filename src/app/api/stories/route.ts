import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  // Verify authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { character, templateId, creationMode, decisions, dedication, senderName, ending } = body;

  // Validate required fields
  if (!character?.name || !templateId || !creationMode) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // 1. Upsert character (reuse if same name + user)
  const { data: existingCharacter } = await supabase
    .from("characters")
    .select("id")
    .eq("user_id", user.id)
    .eq("name", character.name)
    .single();

  let characterId: string;

  if (existingCharacter) {
    // Update existing character
    const { error: updateError } = await supabase
      .from("characters")
      .update({
        gender: character.gender,
        age: character.age,
        hair_color: character.hairColor,
        skin_tone: character.skinTone,
        hairstyle: character.hairstyle || "short",
        interests: character.interests,
        city: character.city || null,
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
    // Create new character
    const { data: newCharacter, error: insertError } = await supabase
      .from("characters")
      .insert({
        user_id: user.id,
        name: character.name,
        gender: character.gender,
        age: character.age,
        hair_color: character.hairColor,
        skin_tone: character.skinTone,
        hairstyle: character.hairstyle || "short",
        interests: character.interests,
        city: character.city || null,
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
      story_decisions: decisions || {},
      dedication_text: dedication || null,
      sender_name: senderName || null,
      ending_choice: ending || null,
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
