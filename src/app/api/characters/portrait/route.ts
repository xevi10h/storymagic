import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildPortraitCharacterReference,
  buildColorAnchor,
  buildRecraftControls,
  type PortraitPersonalityInput,
} from "@/lib/ai/character-description";
import { createStyleFromAvatar, generateWithRetry } from "@/lib/ai/illustrations";
import { getMockPortraitUrl } from "@/lib/ai/mock-story";

// Portrait generation takes ~5-10s with Recraft
export const maxDuration = 30;

const portraitInputSchema = z.object({
  childName: z.string().min(1).max(50),
  gender: z.enum(["boy", "girl", "neutral"]),
  age: z.number().int().min(1).max(12),
  skinTone: z.string().max(20).optional(),
  hairColor: z.string().max(20).optional(),
  eyeColor: z.string().max(20).optional(),
  hairstyle: z.string().max(30).optional(),
  interests: z.array(z.string().max(50)).max(4).optional(),
  specialTrait: z.string().max(200).optional(),
  favoriteCompanion: z.string().max(100).optional(),
  favoriteFood: z.string().max(100).optional(),
  futureDream: z.string().max(150).optional(),
  city: z.string().max(100).optional(),
});

/**
 * POST /api/characters/portrait
 *
 * Generates a single AI portrait using the book's age-appropriate illustration
 * style (Recraft V3). The same image serves as both:
 * 1. WOW moment — the user sees their character in the book's art style
 * 2. Style reference — used to create a Recraft style_id for visual consistency
 *
 * Portrait style matches the book: child_book for all ages, with age-adapted prompts.
 *
 * Returns: { portraitUrl, recraftStyleId }
 */
export async function POST(request: Request) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = portraitInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    // Skip rate limiting in mock/dev mode — only enforce with real Recraft API
    const mockMode = process.env.MOCK_MODE === "true";
    const recraftApiToken = process.env.RECRAFT_API_TOKEN?.trim();
    const hasRecraft = !mockMode && recraftApiToken && !recraftApiToken.includes("your_");

    const {
      gender, age, skinTone, hairColor, eyeColor, hairstyle, childName,
      interests, specialTrait, favoriteCompanion, favoriteFood, futureDream, city,
    } = parsed.data;

    const charInput = { gender, age, skinTone, hairColor, eyeColor, hairstyle, childName };
    const personality: PortraitPersonalityInput = {
      interests, specialTrait, favoriteCompanion, favoriteFood, futureDream, city,
    };

    // Build portrait using the standardized layered system:
    // Layer 1 (physical) + Layer 2 (outfit) + Layer 3 (props) + Layer 4 (expression)
    const portraitCharRef = buildPortraitCharacterReference(charInput, personality);
    // Layer 5 — color protection
    const colorAnchor = buildColorAnchor(charInput);

    if (!hasRecraft) {
      return NextResponse.json({
        portraitUrl: getMockPortraitUrl(),
        recraftStyleId: null,
      });
    }

    // Age-adaptive illustration style — driven entirely by the prompt.
    // Goes from very simple/rounded (toddlers) to more detailed (older kids).
    // Always non-realistic: digital_illustration/child_book is the fixed base.
    const ageStylePrompt = age <= 4
      ? "Very simple rounded shapes, soft pastel watercolor style, large expressive eyes, minimal details, warm cozy colors."
      : age <= 6
        ? "Charming storybook illustration style, warm natural colors, expressive face, moderate detail, cozy feel."
        : age <= 9
          ? "Warm storytelling illustration style, balanced detail and expression, rich atmospheric quality, expressive character design."
          : "Detailed children's book illustration style, warm natural lighting, expressive character design, clean colors.";

    const portraitPrompt = [
      portraitCharRef + ".",
      "Close-up character portrait, centered, three-quarter view, warm smile.",
      "Clean soft-colored background, gentle natural lighting.",
      ageStylePrompt,
      colorAnchor,
      "No text in image.",
    ].filter(Boolean).join(" ");

    // Build Recraft controls — passes skin/hair/eye colors as actual RGB values
    const controls = buildRecraftControls(charInput, { isPortrait: true });

    // Pre-baked portrait style: ensures all portraits share the same art style.
    // Created once via: npx tsx scripts/create-portrait-style.ts <url1> [url2] ...
    const portraitStyleId = process.env.RECRAFT_PORTRAIT_STYLE_ID?.trim();

    console.log("[Portrait] Age:", age);
    console.log("[Portrait] Prompt:", portraitPrompt.slice(0, 200), "...");
    console.log("[Portrait] Prompt length:", portraitPrompt.length);
    console.log("[Portrait] Controls:", JSON.stringify(controls));
    console.log("[Portrait] Style:", portraitStyleId ? `pre-baked (${portraitStyleId.slice(0, 8)}...)` : "digital_illustration/child_book");

    // If a pre-baked style exists, use it (style_id); otherwise fall back to digital_illustration/child_book.
    // Pre-baked style guarantees identical art style across ALL portraits.
    const portraitUrl = await generateWithRetry(
      portraitPrompt,
      recraftApiToken!,
      portraitStyleId
        ? { styleId: portraitStyleId, controls }
        : { style: "digital_illustration", substyle: "child_book", controls },
    );

    // Create custom style_id from the portrait for visual consistency across all book illustrations
    const recraftStyleId = await createStyleFromAvatar(portraitUrl, recraftApiToken!, "digital_illustration");

    if (!recraftStyleId) {
      console.warn("[Portrait] Style creation returned null — illustrations will use age-based community style");
    }

    return NextResponse.json({
      portraitUrl,
      recraftStyleId,
      styleWarning: recraftStyleId ? undefined : "custom_style_failed",
    });
  } catch (error: unknown) {
    console.error("[Portrait] Generation failed:", error);
    return NextResponse.json(
      {
        error: "Portrait generation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
