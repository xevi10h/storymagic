import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { buildCharacterReference } from "@/lib/ai/character-description";
import { createStyleFromAvatar, generateWithRetry } from "@/lib/ai/illustrations";
import { getAgeConfig } from "@/lib/ai/story-generator";
import { getMockPortraitUrl } from "@/lib/ai/mock-story";

// Portrait generation takes ~5-10s with Recraft
export const maxDuration = 30;

// --- IP-based rate limiting (in-memory, resets on deploy) ---
const RATE_LIMIT_MAX = 10; // max portraits per IP
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour window

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

/**
 * POST /api/characters/portrait
 *
 * Generates a single AI portrait using the book's age-appropriate illustration
 * style (Recraft V3). The same image serves as both:
 * 1. WOW moment — the user sees their character in the book's art style
 * 2. Style reference — used to create a Recraft style_id for visual consistency
 *
 * Portrait style matches the book: child_book for all ages, with age-adapted prompts.
 * Rate limited to 10 generations per IP per hour.
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

    if (hasRecraft) {
      const headersList = await headers();
      const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim()
        || headersList.get("x-real-ip")
        || "unknown";
      const { allowed } = checkRateLimit(ip);

      if (!allowed) {
        return NextResponse.json(
          { error: "Too many portrait generations. Please try again later." },
          {
            status: 429,
            headers: { "Retry-After": "3600", "X-RateLimit-Remaining": "0" },
          },
        );
      }
    }

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

    const ageConf = getAgeConfig(age);

    // Single image: portrait in the book's age-appropriate style.
    // Uses portrait composition (close-up, warm lighting) but with the same
    // illustration style that will appear in the book — ensures visual coherence.
    // This image also serves as the reference for creating the Recraft style_id.
    const portraitPrompt = [
      characterRef,
      personalityHints,
      "Close-up character portrait, centered in frame, looking at the viewer with a warm natural smile.",
      "Soft gradient background with warm tones.",
      "Three-quarter view, gentle warm lighting from the left.",
      "Expressive eyes, appealing and memorable character.",
      ageConf.illustrationPromptStyle,
      "No text in image.",
    ].filter(Boolean).join(" ");

    console.log("[Portrait] Age:", age, "Style:", ageConf.illustrationStyle, "/", ageConf.illustrationSubstyle);
    console.log("[Portrait] Prompt:", portraitPrompt.slice(0, 200), "...");

    const portraitUrl = await generateWithRetry(
      portraitPrompt,
      recraftApiToken!,
      { style: ageConf.illustrationStyle, substyle: ageConf.illustrationSubstyle },
    );

    // Create style_id from the portrait for visual consistency across book illustrations
    const recraftStyleId = await createStyleFromAvatar(portraitUrl, recraftApiToken!);

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
