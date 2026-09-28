import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ILLUSTRATION_URL_TTL, signIllustrationRefs, userAccess } from "@/lib/storage/illustration-urls";

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
      .select("id, title, template_id, creation_mode, status, pdf_url, created_at, generated_text, characters(name, gender, age)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("id, format, status, subtotal, total, tracking_number, tracking_url, shipping_name, created_at, story_id, stories(generated_text, characters(name))")
      .eq("user_id", user.id)
      // Abandoned checkouts (pending / expired) are not orders to the customer.
      .not("status", "in", "(pending,cancelled)")
      .order("created_at", { ascending: false }),
    supabase
      .from("characters")
      .select(`
        id, name, gender, age, hair_color, skin_tone, hairstyle, interests, avatar_url, created_at,
        stories!character_id(id, title, status, template_id, generated_text)
      `)
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

  // Avatar portraits live in a private bucket: sign them for their owner.
  const characters = charactersResult.data ?? [];
  const signed = await signIllustrationRefs(
    characters.map((c) => c.avatar_url),
    { ttl: ILLUSTRATION_URL_TTL.ui, allow: userAccess({ userId: user.id, allowLegacyPortraits: true }) },
  );

  return NextResponse.json(
    {
      stories: storiesResult.data ?? [],
      orders: ordersResult.data ?? [],
      characters: characters.map((c) => ({ ...c, avatar_url: c.avatar_url ? (signed.get(c.avatar_url) ?? null) : null })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
