import { NextResponse } from "next/server";
import { buildCharacterReference } from "@/lib/ai/character-description";
import { createStyleFromAvatar, generateWithRetry } from "@/lib/ai/illustrations";
import { getMockPortraitUrl } from "@/lib/ai/mock-story";

// Portrait generation takes ~5-10s with Recraft
export const maxDuration = 30;

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
    const body = await request.json();

    // Skip rate limiting in mock/dev mode — only enforce with real Recraft API
    const mockMode = process.env.MOCK_MODE === "true";
    const recraftApiToken = process.env.RECRAFT_API_TOKEN?.trim();
    const hasRecraft = !mockMode && recraftApiToken && !recraftApiToken.includes("your_");

    // Rate limiting disabled during testing phase
    // TODO: Re-enable before production launch

    const {
      gender, age, skinTone, hairColor, eyeColor, hairstyle, childName,
      interests, specialTrait, favoriteCompanion, favoriteFood, futureDream, city,
    } = body;

    if (!childName || !gender || !age) {
      return NextResponse.json(
        { error: "Missing required fields: childName, gender, age" },
        { status: 400 },
      );
    }

    // Build the character reference text (same one used for all book illustrations)
    const characterRef = buildCharacterReference({
      gender,
      age,
      skinTone,
      hairColor,
      eyeColor,
      hairstyle,
      childName,
    });

    // Build personality context to enrich the portrait beyond physical traits
    const personalityHints = buildPortraitPersonalityHints({
      interests, specialTrait, favoriteCompanion, favoriteFood, futureDream, city,
    });

    if (!hasRecraft) {
      return NextResponse.json({
        portraitUrl: getMockPortraitUrl(),
        recraftStyleId: null,
      });
    }

    // Age-adaptive illustration style — driven entirely by the prompt.
    // Goes from very simple/rounded (toddlers) to more detailed/atmospheric (older kids).
    // Always non-realistic: digital_illustration/child_book is the fixed base.
    const ageStylePrompt = age <= 4
      ? "Very simple rounded shapes, soft pastel watercolor style, large expressive eyes, minimal details, warm dreamy colors."
      : age <= 7
        ? "Charming storybook illustration style, warm glowing colors, expressive face, moderate detail, cozy feel."
        : "Illustrated editorial style, rich warm tones, atmospheric lighting, detailed character design, cinematic mood.";

    const portraitPrompt = [
      characterRef,
      personalityHints,
      "Close-up character portrait, centered in frame, looking at the viewer with a warm natural smile.",
      "Soft gradient background with warm tones.",
      "Three-quarter view, gentle warm lighting from the left.",
      "Expressive eyes, appealing and memorable character.",
      ageStylePrompt,
      "No text in image.",
    ].filter(Boolean).join(" ");

    console.log("[Portrait] Age:", age);
    console.log("[Portrait] Prompt:", portraitPrompt.slice(0, 200), "...");

    // Always use digital_illustration/child_book — no custom styleId so skin/hair colors are respected.
    // The styleId for book illustrations is created FROM this portrait via createStyleFromAvatar.
    const portraitUrl = await generateWithRetry(
      portraitPrompt,
      recraftApiToken!,
      { style: "digital_illustration", substyle: "child_book" },
    );

    // Create custom style_id from the portrait for visual consistency across all book illustrations
    const recraftStyleId = await createStyleFromAvatar(portraitUrl, recraftApiToken!, "digital_illustration");

    return NextResponse.json({
      portraitUrl,
      recraftStyleId,
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

// --- Personality-to-visual mapping for portrait enrichment ---

interface PersonalityInput {
  interests?: string[];
  specialTrait?: string;
  favoriteCompanion?: string;
  favoriteFood?: string;
  futureDream?: string;
  city?: string;
}

/** Maps interests to subtle visual elements for the portrait */
const INTEREST_VISUALS: Record<string, string> = {
  sports: "wearing athletic clothing",
  music: "with a small musical instrument nearby",
  animals: "with a gentle, caring expression and a small animal nearby",
  space: "with stars and cosmic elements in the background",
  castles: "with a castle turret in the background",
  dinosaurs: "with a small toy dinosaur nearby",
};

/** Maps future dreams to clothing/prop hints */
const DREAM_VISUALS: Record<string, string> = {
  astronaut: "wearing a space-themed outfit, stars in the background",
  doctor: "wearing a small lab coat or stethoscope",
  chef: "wearing a chef's hat",
  teacher: "holding a book, studious look",
  artist: "wearing a beret, creative outfit with paint splashes",
  athlete: "wearing sporty athletic gear",
  musician: "with a musical instrument",
  scientist: "wearing goggles or a lab coat",
  firefighter: "wearing a small red firefighter helmet",
  pilot: "wearing aviator goggles",
  vet: "surrounded by small animals",
  dancer: "in ballet or dance outfit",
};

/**
 * Builds subtle visual hints from the child's personality to enrich the portrait.
 * Returns a short sentence or empty string if no personality data is available.
 */
function buildPortraitPersonalityHints(input: PersonalityInput): string {
  const hints: string[] = [];

  // Future dream — strongest visual influence (clothing/props)
  if (input.futureDream) {
    const dreamKey = input.futureDream.toLowerCase();
    // Check exact match first, then partial match
    const match = DREAM_VISUALS[dreamKey]
      || Object.entries(DREAM_VISUALS).find(([k]) => dreamKey.includes(k))?.[1];
    if (match) {
      hints.push(match);
    } else {
      // Free-text dream: let the model interpret it
      hints.push(`dressed as if dreaming of becoming a ${input.futureDream}`);
    }
  }

  // Interests — pick up to 2 for subtle visual elements
  if (input.interests?.length) {
    const visualInterests = input.interests
      .map((i) => INTEREST_VISUALS[i])
      .filter(Boolean)
      .slice(0, 2);
    hints.push(...visualInterests);
  }

  // Companion — if they have a pet/companion, hint at it in the background
  if (input.favoriteCompanion) {
    hints.push(`with a small ${input.favoriteCompanion} companion peeking from behind`);
  }

  // Special trait — use as expression/mood modifier
  if (input.specialTrait) {
    hints.push(`radiating a sense of ${input.specialTrait}`);
  }

  if (hints.length === 0) return "";

  return hints.join(", ") + ".";
}
