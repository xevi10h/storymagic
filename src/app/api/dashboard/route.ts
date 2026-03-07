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

  // Run all three queries in parallel for faster response
  const [storiesResult, ordersResult, charactersResult] = await Promise.all([
    supabase
      .from("stories")
      .select("id, title, template_id, creation_mode, status, pdf_url, created_at, characters(name, gender, age)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("id, format, status, subtotal, total, tracking_number, shipping_name, created_at, story_id, stories(generated_text, characters(name))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("characters")
      .select("id, name, gender, age, hair_color, skin_tone, hairstyle, interests, created_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
  ]);

  if (storiesResult.error) {
    return NextResponse.json(
      { error: "Failed to fetch stories" },
      { status: 500 }
    );
  }

  if (ordersResult.error) {
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }

  if (charactersResult.error) {
    return NextResponse.json(
      { error: "Failed to fetch characters" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    stories: storiesResult.data ?? [],
    orders: ordersResult.data ?? [],
    characters: charactersResult.data ?? [],
  });
}
