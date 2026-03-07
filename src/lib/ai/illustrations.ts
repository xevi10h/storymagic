// Illustration generation for story scenes
//
// Providers (auto-detected from env vars):
//   RECRAFT_API_TOKEN → Recraft V3 (digital_illustration/child_book) — $0.04/img
//   No key           → Mock placeholders (local dev)
//
// Character consistency:
//   1. Custom style_id created from the user's DiceBear avatar (visual reference)
//   2. Identical character description prepended to every prompt (text reference)

import crypto from "crypto";
import { getMockIllustrationUrl } from "./mock-story";

const RECRAFT_BASE = "https://external.api.recraft.ai/v1";
const RECRAFT_GENERATE_URL = `${RECRAFT_BASE}/images/generations`;
const RECRAFT_STYLES_URL = `${RECRAFT_BASE}/styles`;

// Square format — works for both full-bleed and vignette layouts in the PDF
const IMAGE_SIZE = "1024x1024";
const FALLBACK_STYLE = "digital_illustration";
const FALLBACK_SUBSTYLE = "child_book";

// --- Recraft V3 image generation ---

interface RecraftResponse {
  data: { url: string }[];
}

async function generateWithRecraft(
  prompt: string,
  apiToken: string,
  styleId?: string,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: Record<string, any> = {
    prompt,
    model: "recraftv3",
    size: IMAGE_SIZE,
    n: 1,
    response_format: "url",
  };

  if (styleId) {
    body.style_id = styleId;
  } else {
    body.style = FALLBACK_STYLE;
    body.substyle = FALLBACK_SUBSTYLE;
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

async function generateWithRetry(
  prompt: string,
  apiToken: string,
  styleId?: string,
  maxRetries = 2,
): Promise<string> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await generateWithRecraft(prompt, apiToken, styleId);
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
 * Creates a Recraft custom style using the user's DiceBear avatar as reference.
 * This ensures illustrations are visually influenced by the character the user created.
 * Returns the style_id UUID, or null if creation fails.
 */
export async function createStyleFromAvatar(
  avatarUrl: string,
  apiToken: string,
): Promise<string | null> {
  try {
    // Convert DiceBear SVG URL to PNG (change extension)
    const pngUrl = avatarUrl.replace("/svg?", "/png?") + "&size=512";

    const imageResponse = await fetch(pngUrl);
    if (!imageResponse.ok) {
      console.warn("[Illustrations] Failed to download avatar PNG:", imageResponse.status);
      return null;
    }

    const imageBlob = await imageResponse.blob();

    const formData = new FormData();
    formData.append("style", FALLBACK_STYLE);
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

// --- Character consistency ---

/**
 * Builds an ultra-detailed character description for Recraft prompts.
 * This exact text is prepended to EVERY scene prompt for visual consistency.
 */
export function buildCharacterReference(input: {
  gender: "boy" | "girl" | "neutral";
  age: number;
  skinTone?: string;
  hairColor?: string;
  hairstyle?: string;
  childName: string;
  interests?: string[];
}): string {
  const parts: string[] = [];

  const genderWord = input.gender === "boy" ? "boy" : input.gender === "girl" ? "girl" : "child";
  parts.push(`A ${input.age}-year-old ${genderWord} named ${input.childName}`);

  if (input.skinTone) {
    const skinMap: Record<string, string> = {
      "#fce4d6": "with light peachy skin",
      "#eebb99": "with warm medium-light skin",
      "#c68642": "with warm medium-brown skin",
      "#8d5524": "with rich dark brown skin",
      "#523218": "with deep dark skin",
    };
    parts.push(skinMap[input.skinTone] || "");
  }

  if (input.hairColor) {
    const hairMap: Record<string, string> = {
      "#2a2a2a": "jet black hair",
      "#5d4037": "dark brown hair",
      "#8d6e63": "chestnut brown hair",
      "#e6c07b": "golden blonde hair",
      "#d84315": "bright red hair",
    };
    const hairDesc = hairMap[input.hairColor] || "";

    const hairstyleMap: Record<string, string> = {
      short: "short",
      curly: "curly",
      spiky: "spiky",
      buzz: "very short buzz-cut",
      long: "long flowing",
      pigtails: "two pigtails with",
      bob: "bob-cut",
      medium: "medium-length",
    };
    const styleDesc = input.hairstyle ? (hairstyleMap[input.hairstyle] || input.hairstyle) : "short";
    parts.push(`${styleDesc} ${hairDesc}`);
  }

  // Add clothing based on age and gender for consistency
  if (input.age <= 5) {
    parts.push("wearing a colorful t-shirt and comfortable pants");
  } else if (input.age <= 8) {
    parts.push("wearing a casual hoodie and jeans");
  } else {
    parts.push("wearing a casual jacket and pants");
  }

  // Expression for consistency
  parts.push("with bright curious eyes and a warm smile");

  return parts.filter(Boolean).join(", ");
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
 * Flow:
 * 1. If avatarUrl provided → create custom Recraft style from avatar
 * 2. Generate all illustrations in parallel using style_id (or fallback to child_book)
 * 3. If no RECRAFT_API_TOKEN → return mock placeholders
 */
export async function generateIllustrationsForStory(
  imagePrompts: string[],
  characterRef: string,
  avatarUrl?: string,
): Promise<IllustrationResult[]> {
  const mockMode = process.env.MOCK_MODE === "true";
  const apiToken = process.env.RECRAFT_API_TOKEN;
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

  // Create custom style from avatar for character consistency
  let styleId: string | null = null;
  if (avatarUrl) {
    styleId = await createStyleFromAvatar(avatarUrl, apiToken);
  }

  const styleLabel = styleId ? `custom style ${styleId.slice(0, 8)}...` : "child_book fallback";
  console.log(`[Illustrations] Generating ${imagePrompts.length} images via Recraft V3 (${styleLabel})`);

  // Enhance each prompt with the character reference for consistency
  const enhancedPrompts = imagePrompts.map((scenePrompt) => {
    const hasCharRef = scenePrompt.toLowerCase().includes(characterRef.toLowerCase().slice(0, 20));
    const prefix = hasCharRef ? "" : `${characterRef}. `;
    return `${prefix}${scenePrompt}. Children's book illustration, soft warm palette, gentle lighting, no text in image.`;
  });

  // Generate all images in parallel (Recraft allows 100 images/minute)
  const results = await Promise.allSettled(
    enhancedPrompts.map((prompt) =>
      generateWithRetry(prompt, apiToken, styleId ?? undefined),
    ),
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
