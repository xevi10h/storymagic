import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch stories with character data
  const { data: stories, error: storiesError } = await supabase
    .from("stories")
    .select("id, title, template_id, creation_mode, status, generated_text, pdf_url, created_at, characters(name, gender, age)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (storiesError) {
    return NextResponse.json(
      { error: "Failed to fetch stories" },
      { status: 500 }
    );
  }

  // Fetch orders with story data
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, format, status, subtotal, total, tracking_number, shipping_name, created_at, story_id, stories(generated_text, characters(name))")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (ordersError) {
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }

  // Fetch characters
  const { data: characters } = await supabase
    .from("characters")
    .select("id, name, gender, age, hair_color, skin_tone, hairstyle, interests, created_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return NextResponse.json({
    stories: stories ?? [],
    orders: orders ?? [],
    characters: characters ?? [],
  });
}
