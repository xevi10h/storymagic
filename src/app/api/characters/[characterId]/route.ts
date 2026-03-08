import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ characterId: string }> }
) {
  const { characterId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: character, error } = await supabase
    .from("characters")
    .select("id, name, gender, age, hair_color, skin_tone, hairstyle, interests, city, special_trait, favorite_companion")
    .eq("id", characterId)
    .eq("user_id", user.id) // ensure ownership
    .single();

  if (error || !character) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 });
  }

  return NextResponse.json({ character });
}
