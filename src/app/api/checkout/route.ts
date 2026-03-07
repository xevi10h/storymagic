import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, PRICING, ADDONS, type BookFormat, type AddonId } from "@/lib/stripe";

export async function POST(request: Request) {
  const supabase = await createClient();

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
    .select("id, status, generated_text, characters(name)")
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

  // Accept both preview and ready stories for purchase
  if (story.status !== "preview" && story.status !== "ready") {
    return NextResponse.json(
      { error: "Story is not ready for purchase" },
      { status: 400 }
    );
  }

  // Determine if format requires shipping
  const formatConfig = PRICING[format];
  const requiresShipping = formatConfig.requiresShipping;

  // Build line items for Stripe
  const generatedText = story.generated_text as { bookTitle?: string };
  const bookTitle = generatedText.bookTitle ?? "Personalized Story";
  const characterName = (story.characters as { name: string } | null)?.name ?? "";

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
          name: `${bookTitle} (${formatConfig.label})`,
          description: characterName ? `Personalized book for ${characterName}` : "Personalized children's book",
        },
        unit_amount: formatConfig.price,
      },
      quantity: 1,
    },
  ];

  // Filter addons: only allow physical-only addons when format requires shipping
  // Deduplicate to prevent double-charging
  const validAddons: AddonId[] = [];
  const seenAddons = new Set<string>();
  if (requiresShipping) {
    for (const addonId of addonIds) {
      if (seenAddons.has(addonId)) continue;
      seenAddons.add(addonId);

      if (ADDONS[addonId as AddonId]) {
        const addon = ADDONS[addonId as AddonId];
        validAddons.push(addonId as AddonId);
        lineItems.push({
          price_data: {
            currency: "eur",
            product_data: {
              name: addon.label,
            },
            unit_amount: addon.price,
          },
          quantity: 1,
        });
      }
    }
  }

  const subtotal =
    formatConfig.price +
    validAddons.reduce((sum, id) => sum + ADDONS[id].price, 0);

  try {
    const origin = new URL(request.url).origin;

    // Build Stripe session options — shipping only for physical formats
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionOptions: Record<string, any> = {
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
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/crear/${storyId}/preview`,
    };

    if (requiresShipping) {
      sessionOptions.shipping_address_collection = {
        allowed_countries: [
          "ES", "FR", "DE", "IT", "PT", "GB", "NL", "BE", "AT", "CH",
          "IE", "SE", "DK", "NO", "FI", "PL", "CZ", "GR",
        ],
      };
    }

    const session = await getStripe().checkout.sessions.create(sessionOptions);

    // Create pending order in DB
    const { error: orderError } = await supabase.from("orders").insert({
      user_id: user.id,
      story_id: storyId,
      stripe_checkout_session_id: session.id,
      format,
      addons: JSON.parse(JSON.stringify(validAddons)),
      subtotal: subtotal / 100,
      total: subtotal / 100,
      status: "pending",
    });

    if (orderError) {
      try {
        await getStripe().checkout.sessions.expire(session.id);
      } catch {
        console.error("Failed to expire Stripe session after order insert failure:", session.id);
      }
      console.error("Failed to create order:", orderError);
      return NextResponse.json(
        { error: "Failed to create order" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
