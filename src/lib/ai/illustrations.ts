// Illustration generation for story scenes
//
// Providers (auto-detected from env vars):
//   RECRAFT_API_TOKEN → Recraft V3 (digital_illustration/child_book) — $0.04/img
//   No key           → Mock placeholders (local dev)
//
// Character consistency:
//   1. Custom style_id created from the user's avatar image (visual reference)
//   2. Identical character description prepended to every prompt (text reference)

import crypto from "crypto";
import { getMockIllustrationUrl } from "./mock-story";
import { getAgeConfig } from "./story-generator";
export { buildCharacterReference } from "./character-description";

const RECRAFT_BASE = "https://external.api.recraft.ai/v1";
const RECRAFT_GENERATE_URL = `${RECRAFT_BASE}/images/generations`;
const RECRAFT_STYLES_URL = `${RECRAFT_BASE}/styles`;

// Default image size — used when no per-prompt size is specified
const DEFAULT_IMAGE_SIZE = "1024x1024";

// --- Recraft V3 image generation ---

interface RecraftResponse {
  data: { url: string }[];
}

async function generateWithRecraft(
  prompt: string,
  apiToken: string,
  options?: { styleId?: string; style?: string; substyle?: string | null; size?: string },
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: Record<string, any> = {
    prompt,
    model: "recraftv3",
    size: options?.size || DEFAULT_IMAGE_SIZE,
    n: 1,
    response_format: "url",
  };

  if (options?.styleId) {
    body.style_id = options.styleId;
  } else {
    body.style = options?.style || "digital_illustration";
    if (options?.substyle) {
      body.substyle = options.substyle;
    }
  }

  const response = await fetch(RECRAFT_GENERATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Recraft error (${response.status}): ${errorBody}`);
  }

  const data: RecraftResponse = await response.json();

  if (!data.data?.[0]?.url) {
    throw new Error("Recraft returned no image URL");
  }

  return data.data[0].url;
}

export async function generateWithRetry(
  prompt: string,
  apiToken: string,
  options?: { styleId?: string; style?: string; substyle?: string | null; size?: string },
  maxRetries = 2,
): Promise<string> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await generateWithRecraft(prompt, apiToken, options);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delay = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
      console.warn(`[Illustrations] Retry ${attempt + 1} after ${delay}ms for prompt: ${prompt.slice(0, 60)}...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Unreachable");
}

// --- Custom style from avatar ---

/**
 * Creates a Recraft custom style using the user's avatar as a visual reference.
 * This ensures illustrations are visually influenced by the character the user created.
 * Returns the style_id UUID, or null if creation fails.
 *
 * Supports:
 * - DiceBear API URLs (converts SVG→PNG via path replacement)
 * - Regular image URLs (Supabase storage, etc.)
 */
export async function createStyleFromAvatar(
  avatarUrl: string,
  apiToken: string,
): Promise<string | null> {
  try {
    // Resolve the correct image URL based on the source
    let fetchUrl: string;
    if (avatarUrl.includes("api.dicebear.com") && avatarUrl.includes("/svg?")) {
      // DiceBear SVG → PNG conversion (supported by DiceBear API)
      fetchUrl = avatarUrl.replace("/svg?", "/png?") + "&size=512";
    } else if (avatarUrl.startsWith("http")) {
      // Direct image URL (Supabase storage, etc.)
      fetchUrl = avatarUrl;
    } else {
      // Data URI or SVG string — not fetchable, skip style creation
      console.warn("[Illustrations] Avatar format not supported for style creation, using fallback");
      return null;
    }

    const imageResponse = await fetch(fetchUrl);
    if (!imageResponse.ok) {
      console.warn("[Illustrations] Failed to download avatar image:", imageResponse.status);
      return null;
    }

    const imageBlob = await imageResponse.blob();

    const formData = new FormData();
    formData.append("style", "digital_illustration");
    formData.append("file", imageBlob, "avatar.png");

    const response = await fetch(RECRAFT_STYLES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.warn("[Illustrations] Style creation failed:", errorBody);
      return null;
    }

    const data = await response.json();
    const styleId = data.id;

    if (styleId) {
      console.log(`[Illustrations] Custom style created: ${styleId}`);
    }

    return styleId || null;
  } catch (error) {
    console.warn("[Illustrations] Style creation error:", error);
    return null;
  }
}

// --- Secondary illustration prompts ---

/**
 * Scenes that get a secondary illustration (different angle/moment).
 * Excludes spread scenes (3, 8) — both pages of a spread use the same panoramic image.
 * Count is age-dependent: young kids get more visual pages, older kids more text.
 *
 *   Ages 2-4:  10 secondaries → 0 text_only pages (pure picture book)
 *   Ages 5-7:   6 secondaries → 4 text_only pages (balanced)
 *   Ages 8-12:  4 secondaries → 6 text_only pages (text-heavy)
 */
export function getSecondaryScenes(age: number): number[] {
  if (age <= 4) {
    // All non-spread scenes — every page is visual
    return [1, 2, 4, 5, 6, 7, 9, 10, 11, 12];
  }
  if (age <= 7) {
    // Balanced — key narrative beats get secondaries
    return [1, 5, 6, 9, 11, 12];
  }
  // Older readers — fewer secondaries, more room for text
  return [1, 6, 9, 12];
}

/**
 * Builds a complementary secondary prompt from the primary prompt.
 * Uses varied composition strategies to avoid visual monotony.
 * Each secondary scene gets a different visual approach.
 */
const SECONDARY_COMPOSITIONS = [
  "Extreme close-up on the character's hands interacting with an important object from this scene. Shallow depth of field, warm lighting.",
  "Bird's-eye view looking down at the scene from above. The character appears small in the environment, surrounded by details of the world.",
  "Low-angle perspective looking up at the character, making them appear heroic and brave. Dramatic sky or ceiling above.",
  "Wide environmental shot — the character is small in the frame, with the vast landscape or setting filling most of the image. Atmospheric perspective.",
  "Over-the-shoulder view from behind the character, looking at what they see. We share their point of view discovering something.",
  "Detail shot of the scene's most magical or important element (an object, creature, or place) with the character blurred in the background.",
  "Medium shot showing the character in motion — running, jumping, or reaching — captured mid-action with dynamic energy.",
  "Silhouette or backlit composition — the character outlined against a dramatic light source (sunset, doorway, magical glow).",
];

export function buildSecondaryPrompt(
  primaryPrompt: string,
  sceneTitle: string,
  characterRef: string,
  sceneIndex: number = 0,
): string {
  const composition = SECONDARY_COMPOSITIONS[sceneIndex % SECONDARY_COMPOSITIONS.length];
  return `${sceneTitle}. ${composition} ${characterRef}. Children's book illustration, rich textures, no text in image.`;
}

// --- Public API ---

export interface IllustrationResult {
  imageUrl: string;
  descriptionHash: string;
  provider: "recraft" | "mock";
}

export function hashDescription(description: string): string {
  return crypto.createHash("sha256").update(description.toLowerCase().trim()).digest("hex");
}

/**
 * Generate illustrations for all scenes in a story.
 *
 * IMPORTANT: Pass a pre-created styleId for consistency across all images
 * in the same book (cover, portrait, scenes). The styleId should be created
 * once via createStyleFromAvatar() and reused for every generation call.
 *
 * Flow:
 * 1. Use provided styleId (or fall back to age-based style if none)
 * 2. Generate all illustrations in parallel
 * 3. If no RECRAFT_API_TOKEN → return mock placeholders
 */
export async function generateIllustrationsForStory(
  imagePrompts: string[],
  characterRef: string,
  options?: {
    styleId?: string | null;
    childAge?: number;
    /** Per-image Recraft size (e.g. "1024x1024", "1820x1024", "2048x1024"). Falls back to DEFAULT_IMAGE_SIZE. */
    imageSizes?: string[];
  },
): Promise<IllustrationResult[]> {
  const mockMode = process.env.MOCK_MODE === "true";
  const apiToken = process.env.RECRAFT_API_TOKEN?.trim();
  const hasToken = apiToken && !apiToken.includes("your_") && !apiToken.includes("_here");

  if (mockMode || !hasToken) {
    const reason = mockMode ? "MOCK_MODE=true" : "no RECRAFT_API_TOKEN";
    console.log(`[Illustrations] MOCK MODE — ${reason}, using pre-generated Supabase images`);
    return imagePrompts.map((prompt, index) => ({
      imageUrl: getMockIllustrationUrl(index),
      descriptionHash: hashDescription(prompt),
      provider: "mock" as const,
    }));
  }

  // Age-based illustration style (used as fallback when no custom styleId)
  const ageConf = getAgeConfig(options?.childAge ?? 6);
  const styleId = options?.styleId ?? null;

  const styleLabel = styleId
    ? `custom style ${styleId.slice(0, 8)}...`
    : `${ageConf.illustrationStyle}/${ageConf.illustrationSubstyle ?? "default"}`;
  console.log(`[Illustrations] Generating ${imagePrompts.length} images via Recraft V3 (${styleLabel})`);

  // Enhance each prompt: scene description first (for visual variety),
  // character reference appended (for consistency), style suffix last.
  const enhancedPrompts = imagePrompts.map((scenePrompt) => {
    const hasCharRef = scenePrompt.toLowerCase().includes(characterRef.toLowerCase().slice(0, 20));
    const suffix = hasCharRef ? "" : ` The protagonist: ${characterRef}.`;
    return `${scenePrompt}.${suffix} ${ageConf.illustrationPromptStyle}`;
  });

  // Build per-image Recraft options with correct sizes
  const sizes = options?.imageSizes ?? [];

  // Generate all images in parallel (Recraft allows 100 images/minute)
  const results = await Promise.allSettled(
    enhancedPrompts.map((prompt, index) => {
      const size = sizes[index] || DEFAULT_IMAGE_SIZE;
      const recraftOpts = styleId
        ? { styleId, size }
        : { style: ageConf.illustrationStyle, substyle: ageConf.illustrationSubstyle, size };
      return generateWithRetry(prompt, apiToken, recraftOpts);
    }),
  );

  return results.map((result, index) => {
    if (result.status === "fulfilled") {
      return {
        imageUrl: result.value,
        descriptionHash: hashDescription(imagePrompts[index]),
        provider: "recraft" as const,
      };
    }

    console.error(`[Illustrations] Scene ${index + 1} failed:`, result.reason);
    return {
      imageUrl: getMockIllustrationUrl(index),
      descriptionHash: hashDescription(imagePrompts[index]),
      provider: "mock" as const,
    };
  });
}
