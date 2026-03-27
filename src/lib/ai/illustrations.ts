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
import { generateFluxPro, generateFluxMax, type FluxResult } from "./flux-kontext";
import { getMockIllustrationUrl } from "./mock-story";
import type { Screenplay, SceneScreenplay } from "./scene-screenplay";
import { getAgeConfig } from "./story-generator";
import type { AssetReference } from "./visual-assets";
export { buildCharacterReference, getGenderColorDirective } from "./character-description";
import { getGenderColorDirective, buildColorAnchor, buildRecraftControls, type CharacterDescriptionInput, type RecraftControls } from "./character-description";

const RECRAFT_BASE = "https://external.api.recraft.ai/v1";
const RECRAFT_GENERATE_URL = `${RECRAFT_BASE}/images/generations`;
const RECRAFT_STYLES_URL = `${RECRAFT_BASE}/styles`;

// Default image size — used when no per-prompt size is specified
const DEFAULT_IMAGE_SIZE = "1024x1024";

// --- Recraft V3 image generation ---

interface RecraftResponse {
  data: { url: string }[];
}

export { type RecraftControls } from "./character-description";

export interface RecraftGenerateOptions {
  styleId?: string;
  style?: string;
  substyle?: string | null;
  size?: string;
  controls?: RecraftControls;
}

async function generateWithRecraft(
  prompt: string,
  apiToken: string,
  options?: RecraftGenerateOptions,
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

  // Recraft V3 controls — color guidance, artistic level, no-text
  if (options?.controls) {
    body.controls = options.controls;
  }

  // 60s timeout per call — prevents hangs in Vercel serverless (undici)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  let response: Response;
  try {
    response = await fetch(RECRAFT_GENERATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    // Surface billing errors loudly so they don't silently fall back to mock
    if (errorBody.includes("not_enough_credits")) {
      throw new Error("RECRAFT_NO_CREDITS: Recraft account has 0 credits — top up at recraft.ai");
    }
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
  options?: RecraftGenerateOptions,
  maxRetries = 2,
): Promise<string> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await generateWithRecraft(prompt, apiToken, options);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      // Billing errors: never retry, propagate immediately so callers can surface them
      if (msg.startsWith("RECRAFT_NO_CREDITS")) throw error;
      // Don't retry other client errors (400, 401, 403, 422) — they won't succeed on retry
      const isClientError = /\b(400|401|403|422)\b/.test(msg) || /bad request|unauthorized|forbidden|validation/i.test(msg);
      if (isClientError || attempt === maxRetries) throw error;

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
  baseStyle: string = "digital_illustration",
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
    formData.append("style", baseStyle);
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
 *   Ages 5-6:   8 secondaries → 2 text_only pages (mostly visual)
 *   Ages 7-9:   6 secondaries → 4 text_only pages (balanced)
 *   Ages 10-12:  4 secondaries → 6 text_only pages (text-heavy)
 */
export function getSecondaryScenes(age: number): number[] {
  if (age <= 4) {
    // All non-spread scenes — every page is visual (pure picture book)
    return [1, 2, 4, 5, 6, 7, 9, 10, 11, 12];
  }
  if (age <= 6) {
    // Mostly visual — early readers still need lots of illustrations
    return [1, 2, 5, 6, 9, 10, 11, 12];
  }
  if (age <= 9) {
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _sceneFirstLine?: string,
): string {
  const composition = SECONDARY_COMPOSITIONS[sceneIndex % SECONDARY_COMPOSITIONS.length];
  // Use primaryPrompt as the visual foundation so the secondary illustration shares the
  // same scene, setting, lighting, atmosphere, and style directives as the primary.
  // Only the camera/composition changes — this is what makes it a "complementary" view.
  //
  // Composition is placed FIRST for maximum weight in the image model.
  // NOTE: sceneFirstLine is intentionally ignored — it is in the story language
  // (e.g. Catalan/Spanish) which would corrupt the English-only image prompt.
  // primaryPrompt already provides the full scene context in English.
  void sceneTitle; void characterRef; // used externally; included in primaryPrompt already
  let prompt = `${composition} ${primaryPrompt}`;
  if (prompt.length > 1000) prompt = prompt.slice(0, 999) + "…";
  return prompt;
}

// --- Public API ---

export interface IllustrationResult {
  imageUrl: string;
  descriptionHash: string;
  provider: "recraft" | "flux" | "mock";
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
    /** Character gender — influences illustration color palette ("boy" | "girl" | "neutral") */
    gender?: string;
    /** Per-image Recraft size (e.g. "1024x1024", "1820x1024", "2048x1024"). Falls back to DEFAULT_IMAGE_SIZE. */
    imageSizes?: string[];
    /** Character input — used to build color anchor for skin/hair/eye realism */
    characterInput?: CharacterDescriptionInput;
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

  // Age-based illustration config (used as fallback when no custom styleId from portrait)
  const ageConf = getAgeConfig(options?.childAge ?? 6);
  // Custom style_id from portrait takes precedence; fall back to age-based community style UUID
  const styleId = options?.styleId ?? ageConf.illustrationStyleId;

  // Gender color directive — applied ONLY to backgrounds, not the character
  const colorDirective = getGenderColorDirective(options?.gender);

  // Color anchor — explicit skin/hair/eye realism enforcement (text-based)
  const colorAnchor = options?.characterInput ? buildColorAnchor(options.characterInput) : "";

  // Recraft controls — RGB color guidance (API-level, much more reliable than text)
  const controls: RecraftControls | undefined = options?.characterInput
    ? buildRecraftControls(options.characterInput, { isPortrait: false })
    : undefined;

  console.log(`[Illustrations] Generating ${imagePrompts.length} images via Recraft V3 (styleId: ${styleId.slice(0, 8)}..., gender: ${options?.gender ?? "neutral"}, controls: ${!!controls})`);

  // Build enhanced prompts with character consistency.
  //
  // Strategy: CHARACTER REF FIRST, then scene, then style, then color anchor LAST.
  // The color anchor at the end acts as a final override to protect skin/hair colors.
  // This ensures character description survives even if truncation occurs (scene gets cut, not character).
  const RECRAFT_MAX_PROMPT = 1000;
  const enhancedPrompts = imagePrompts.map((scenePrompt) => {
    // Build prompt in priority order: character → scene → style → color protection
    const parts: string[] = [];

    // 1. Character reference ALWAYS included at the start for maximum weight
    parts.push(`The protagonist: ${characterRef}.`);

    // 2. Scene description (from architect LLM — may already contain a short character ref)
    parts.push(scenePrompt);

    // 3. Illustration style (if not already in the scene prompt)
    const hasStyle = scenePrompt.toLowerCase().includes(ageConf.illustrationPromptStyle.toLowerCase().slice(0, 30));
    if (!hasStyle) parts.push(ageConf.illustrationPromptStyle);

    // 4. Gender color directive — only if no RGB controls (fallback for scenes without characterInput)
    if (!controls && colorDirective) parts.push(colorDirective);

    // 5. Color anchor LAST — explicit skin/hair/eye protection (highest priority position)
    if (colorAnchor) parts.push(colorAnchor);

    let prompt = parts.join(" ");

    // Truncate to Recraft's limit — character ref is FIRST so it survives,
    // color anchor may get cut but the strong character ref at the start compensates.
    if (prompt.length > RECRAFT_MAX_PROMPT) {
      console.warn(`[Illustrations] Prompt truncated from ${prompt.length} to ${RECRAFT_MAX_PROMPT} chars`);
      prompt = prompt.slice(0, RECRAFT_MAX_PROMPT - 1) + "…";
    }
    return prompt;
  });

  // Build per-image Recraft options with correct sizes
  const sizes = options?.imageSizes ?? [];

  // Generate images in batches of 5.  Recraft allows 100 images/minute so rate
  // limiting isn't the issue.  We use native HTTPS (not undici) for LLM calls,
  // so connection pool pressure is lower than before.
  const BATCH_SIZE = 5;
  const results: PromiseSettledResult<string>[] = [];

  for (let i = 0; i < enhancedPrompts.length; i += BATCH_SIZE) {
    const batch = enhancedPrompts.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map((prompt, batchIndex) => {
        const globalIndex = i + batchIndex;
        const size = sizes[globalIndex] || DEFAULT_IMAGE_SIZE;
        return generateWithRetry(prompt, apiToken, { styleId, size, controls });
      }),
    );
    results.push(...batchResults);
  }

  // Billing check: if any scene hit a no-credits error, propagate immediately.
  // This prevents silently saving mock images when the account is out of credits.
  for (const result of results) {
    if (result.status === "rejected") {
      const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      if (msg.startsWith("RECRAFT_NO_CREDITS")) throw new Error(msg);
    }
  }

  const failedScenes: { scene: number; error: string }[] = [];

  const mapped = results.map((result, index) => {
    if (result.status === "fulfilled") {
      return {
        imageUrl: result.value,
        descriptionHash: hashDescription(imagePrompts[index]),
        provider: "recraft" as const,
      };
    }

    const errorMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
    failedScenes.push({ scene: index + 1, error: errorMsg });
    console.error(`[Illustrations] Scene ${index + 1} FAILED (falling back to mock): ${errorMsg}`);
    return {
      imageUrl: getMockIllustrationUrl(index),
      descriptionHash: hashDescription(imagePrompts[index]),
      provider: "mock" as const,
    };
  });

  if (failedScenes.length > 0) {
    console.error(`[Illustrations] ${failedScenes.length}/${results.length} scenes failed:`, JSON.stringify(failedScenes));
  }

  return mapped;
}

// --- FLUX Kontext illustration generation ---

/**
 * Generate illustrations using FLUX Kontext, driven by a Screenplay and asset references.
 *
 * - 0-1 reference images → FLUX Kontext Pro (single reference)
 * - 2+ reference images  → FLUX Kontext Max (multi-reference composite)
 *
 * @param screenplay - The visual screenplay with per-scene fluxPrompts
 * @param references - Pre-generated asset reference images (base64 + IDs)
 * @param options    - Optional: which scenes to generate, batch size
 */
export async function generateIllustrationsWithFlux(
  screenplay: Screenplay,
  references: AssetReference[],
  options?: {
    sceneNumbers?: number[];
    batchSize?: number;
  },
): Promise<IllustrationResult[]> {
  const mockMode = process.env.MOCK_MODE === "true";
  const hasKey = !!process.env.BFL_API_KEY;

  // Determine which scenes to generate
  const sceneNumbers = options?.sceneNumbers ?? screenplay.scenes.map((s) => s.sceneNumber);
  const batchSize = options?.batchSize ?? 2;

  // Build a lookup map: assetId → base64
  const refMap = new Map<string, string>();
  for (const ref of references) {
    refMap.set(ref.assetId, ref.base64);
  }

  if (mockMode || !hasKey) {
    const reason = mockMode ? "MOCK_MODE=true" : "no BFL_API_KEY";
    console.log(`[FLUX] MOCK MODE — ${reason}, returning placeholder results`);
    return sceneNumbers.map((num, index) => ({
      imageUrl: getMockIllustrationUrl(index),
      descriptionHash: hashDescription(`flux-scene-${num}`),
      provider: "mock" as const,
    }));
  }

  console.log(`[FLUX] Generating ${sceneNumbers.length} scenes (batch size: ${batchSize})`);

  // Build generation tasks
  const tasks: { sceneNumber: number; scene: SceneScreenplay }[] = [];
  for (const num of sceneNumbers) {
    const scene = screenplay.scenes.find((s) => s.sceneNumber === num);
    if (!scene) {
      console.warn(`[FLUX] Scene ${num} not found in screenplay — skipping`);
      continue;
    }
    tasks.push({ sceneNumber: num, scene });
  }

  const results: IllustrationResult[] = [];

  // Process in parallel batches
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async ({ sceneNumber, scene }) => {
        const start = Date.now();

        // Find reference images needed for this scene's characters.
        // Order matters: input_image (first) gets highest priority in FLUX.
        // If primaryCharacter is set and is NOT the protagonist, put their
        // ref first so FLUX prioritizes their visual consistency.
        const sceneRefs: string[] = [];
        const primaryId = scene.primaryCharacter;

        // 1. Primary character ref first (if it exists and has a reference)
        if (primaryId) {
          const primaryBase64 = refMap.get(primaryId);
          if (primaryBase64) {
            sceneRefs.push(primaryBase64);
          }
        }

        // 2. Remaining characters (skip the primary — already added)
        for (const charId of scene.characters) {
          if (charId === primaryId) continue; // already in position 0
          const base64 = refMap.get(charId);
          if (base64) {
            sceneRefs.push(base64);
          }
        }

        let fluxResult: FluxResult;

        if (sceneRefs.length <= 1) {
          // 0-1 reference → FLUX Kontext Pro
          fluxResult = await generateFluxPro(scene.fluxPrompt, {
            inputImage: sceneRefs[0],
            aspectRatio: scene.aspectRatio,
          });
        } else {
          // 2+ references → FLUX Kontext Max
          fluxResult = await generateFluxMax(scene.fluxPrompt, {
            inputImage: sceneRefs[0],
            inputImage2: sceneRefs[1],
            inputImage3: sceneRefs[2],
            inputImage4: sceneRefs[3],
            aspectRatio: scene.aspectRatio,
          });
        }

        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        console.log(`[FLUX] Generated scene ${sceneNumber} in ${elapsed}s`);

        return {
          imageUrl: fluxResult.url,
          descriptionHash: hashDescription(scene.fluxPrompt),
          provider: "flux" as const,
        };
      }),
    );

    results.push(...batchResults);
  }

  return results;
}
