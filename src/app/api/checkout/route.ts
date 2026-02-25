import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, PRICING, ADDONS, type BookFormat, type AddonId } from "@/lib/stripe";

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
  const { storyId, format, addons: addonIds = [] } = body as {
    storyId: string;
    format: BookFormat;
    addons: AddonId[];
  };

  // Validate format
  if (!PRICING[format]) {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }

  // Validate story exists and belongs to user
  const { data: story, error: storyError } = await supabase
    .from("stories")
    .select("id, generated_text, characters(name)")
    .eq("id", storyId)
    .eq("user_id", user.id)
    .single();

  if (storyError || !story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  if (!story.generated_text) {
    return NextResponse.json(
      { error: "Story not yet generated" },
      { status: 400 }
    );
  }

  // Build line items for Stripe
  const generatedText = story.generated_text as { bookTitle?: string };
  const bookTitle = generatedText.bookTitle ?? "Cuento personalizado";
  const characterName = (story.characters as { name: string } | null)?.name ?? "tu hijo/a";

  const lineItems: {
    price_data: {
      currency: string;
      product_data: { name: string; description?: string };
      unit_amount: number;
    };
    quantity: number;
  }[] = [
    {
      price_data: {
        currency: "eur",
        product_data: {
          name: `${bookTitle} (${PRICING[format].label})`,
          description: `Libro personalizado para ${characterName}. ${PRICING[format].description}`,
        },
        unit_amount: PRICING[format].price,
      },
      quantity: 1,
    },
  ];

  // Add selected add-ons
  const validAddons: AddonId[] = [];
  for (const addonId of addonIds) {
    if (ADDONS[addonId as AddonId]) {
      const addon = ADDONS[addonId as AddonId];
      validAddons.push(addonId as AddonId);
      lineItems.push({
        price_data: {
          currency: "eur",
          product_data: {
            name: addon.label,
            description: addon.description,
          },
          unit_amount: addon.price,
        },
        quantity: 1,
      });
    }
  }

  // Calculate totals for DB
  const subtotal =
    PRICING[format].price +
    validAddons.reduce((sum, id) => sum + ADDONS[id].price, 0);

  try {
    // Create Stripe Checkout Session
    const origin = new URL(request.url).origin;

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      customer_email: user.email ?? undefined,
      metadata: {
        story_id: storyId,
        user_id: user.id,
        format,
        addons: JSON.stringify(validAddons),
      },
      shipping_address_collection: {
        allowed_countries: [
          "ES", "FR", "DE", "IT", "PT", "GB", "NL", "BE", "AT", "CH",
          "IE", "SE", "DK", "NO", "FI", "PL", "CZ", "GR",
        ],
      },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/crear/${storyId}/preview`,
    });

    // Create pending order in DB
    await supabase.from("orders").insert({
      user_id: user.id,
      story_id: storyId,
      stripe_checkout_session_id: session.id,
      format,
      addons: JSON.parse(JSON.stringify(validAddons)),
      subtotal: subtotal / 100,
      total: subtotal / 100,
      status: "pending",
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
