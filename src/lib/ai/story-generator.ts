// Story generation entry points.
//
// The whole book (manuscript + shot plan) is written by ONE structured LLM call
// — the Book Plan (./book-plan.ts). Text and illustrations derive from the same
// object, so they cannot drift apart. This module keeps the pipeline-facing API:
//
//   generateArchitect(input) → runs the Book Plan and returns the legacy
//                              ArchitectOutput view (plus `plan`) so the image
//                              pipeline (visual assets / screenplay) keeps working
//   expandScenes(...)        → pure adapter, no LLM: the prose is already in the plan
//   reviewAndRefineStory(...)→ deprecated no-op (replaced by deterministic checks
//                              + targeted repair inside generateBookPlan)
//
// Also exports the generic JSON-mode helper `callLLM` used by the visual-asset,
// screenplay and QA modules.

import { generateMockStory } from "./mock-story";
import {
  generateBookPlan,
  getPlanSpec,
  planToArchitectOutput,
  planToGeneratedStory,
  buildPlanChildDescription,
  type BookPlan,
  type BookPlanProgress,
  type BookPlanReport,
} from "./book-plan";
import { getOpenAIKey, modelAcceptsTemperature, nativeFetch } from "./openai-http";

export { nativeFetch } from "./openai-http";
export { buildCharacterVisualDescription } from "./character-description";

// ── Types ────────────────────────────────────────────────────────────────────

export interface GeneratedScene {
  sceneNumber: number;
  title: string;
  text: string;
  imagePrompt: string;
  type: "scene" | "bridge";
}

export interface GeneratedStory {
  bookTitle: string;
  titleOptions: string[];
  coverImagePrompt: string;
  scenes: GeneratedScene[];
  /** Printed dedication: the parent's text VERBATIM when they wrote one. */
  dedication: string;
  dedicationSource?: "parent" | "generated" | "none";
  finalMessage: string;
  synopsis: string;
  /** The plan text and images were derived from (absent on legacy stories). */
  bookPlan?: BookPlan;
}

/** Legacy per-scene skeleton consumed by visual-assets / scene-screenplay. */
export interface ArchitectScene {
  sceneNumber: number;
  title: string;
  /** English: illustrated moment + shot action (from the Book Plan) */
  brief: string;
  /** English prompt assembled deterministically from the plan's shot fields */
  imagePrompt: string;
  type: "scene" | "bridge";
}

export interface ArchitectOutput {
  bookTitle: string;
  titleOptions: string[];
  coverImagePrompt: string;
  scenes: ArchitectScene[];
  dedication: string;
  finalMessage: string;
  synopsis: string;
  /** Source plan — prefer consuming this over the legacy fields. */
  plan?: BookPlan;
}

export interface StoryInput {
  childName: string;
  gender: "boy" | "girl" | "neutral";
  age: number;
  city: string;
  interests: string[];
  favoriteColor?: string;
  favoriteCompanion?: string;
  futureDream?: string;
  hairColor?: string;
  eyeColor?: string;
  skinTone?: string;
  hairstyle?: string;
  /** Avatar builder: "none" | "{round|square}-{dark|red}" (characters.glasses) */
  glasses?: string;
  freckles?: boolean;
  templateId: string;
  templateTitle: string;
  creationMode: "solo" | "juntos";
  decisions: Record<string, unknown>;
  dedication?: string;
  senderName?: string;
  endingChoice?: string;
  endingNote?: string;
  locale?: string;
}

// ── Age config (illustration style + book shape) ─────────────────────────────

export interface AgeConfig {
  sceneCount: number;
  bridgeCount: number;
  /** "min-max" words for a regular scene (from the Book Plan spec) */
  wordsPerScene: string;
  /** Recraft community style UUID — pass as style_id in generation requests */
  illustrationStyleId: string;
  /** Base style for custom style creation (POST /v1/styles) — always digital_illustration */
  illustrationBaseStyle: string;
  illustrationPromptStyle: string;
}

export function getAgeConfig(age: number): AgeConfig {
  const spec = getPlanSpec(age);
  const bridgeCount = spec.bridgeSlots.length;
  const base = {
    sceneCount: 12 - bridgeCount,
    bridgeCount,
    wordsPerScene: `${spec.scene.min}-${spec.scene.max}`,
    illustrationBaseStyle: "digital_illustration",
  };
  if (age <= 4) {
    return {
      ...base,
      illustrationStyleId: "f8a6d90e-e29a-4d73-8f9d-3a5909162a09", // Whimsy Pastel Mode
      illustrationPromptStyle: "Whimsical pastel children's book illustration for toddlers, soft dreamy colors, big rounded shapes, exaggerated friendly expressions, simple compositions, gentle lighting, no text in image.",
    };
  }
  if (age <= 6) {
    return {
      ...base,
      illustrationStyleId: "99303d77-4f0d-4e89-b2cb-302ac3f46717", // Whimsical Nook
      illustrationPromptStyle: "Whimsical nook illumination children's book illustration, warm glowing light, intricate charming details, cozy storybook atmosphere, expressive characters, rich textures, no text in image.",
    };
  }
  if (age <= 9) {
    return {
      ...base,
      illustrationStyleId: "002b8065-25a9-4d91-a260-8db3692a3865", // Warm Storytelling
      illustrationPromptStyle: "Warm storytelling children's book illustration, balanced detail and expression, rich atmospheric scenes, expressive characters, warm color palette, no text in image.",
    };
  }
  return {
    ...base,
    illustrationStyleId: "cf3f45c6-a0b9-4220-a9f1-cc57b951247e", // Classic Oasis
    illustrationPromptStyle: "Warm nostalgic Aesopus illustration style, timeless classic book aesthetic, elegant detailed linework, warm earthy tones, sophisticated cinematic compositions, no text in image.",
  };
}

// ── Provider / generic JSON-mode LLM helper ──────────────────────────────────

export function hasAnyProvider(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return !!key && !key.includes("your_") && !key.includes("_here");
}

/** True when generateArchitect returns the mock story (no paid calls may start). */
export function isMockGeneration(): boolean {
  return process.env.MOCK_MODE === "true" || !hasAnyProvider();
}

/**
 * Generic chat completion (JSON mode by default). Used by visual-assets,
 * scene-screenplay and qa-judge. The Book Plan uses strict Structured Outputs
 * via `callOpenAIStructured` instead.
 */
export async function callLLM(
  prompt: string,
  model: string,
  options?: { json?: boolean; timeoutMs?: number; images?: string[] },
): Promise<string> {
  const apiKey = getOpenAIKey();
  const url = "https://api.openai.com/v1/chat/completions";
  const useJson = options?.json ?? true;
  const timeoutMs = options?.timeoutMs ?? 120_000;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  const payload: Record<string, unknown> = {
    model,
    messages: [
      {
        role: "system",
        content: "You are a world-class children's book author and editor with deep expertise in child development psychology, linguistics, and age-appropriate storytelling. You write with the precision of a published author and the warmth of a gifted parent. Your prose is always calibrated exactly to the cognitive, emotional, and linguistic development stage of the target child — never above it, never below it. You have written hundreds of acclaimed children's books across all age groups.",
      },
      {
        role: "user",
        content: options?.images?.length
          ? [
              ...options.images.map((u) => ({ type: "image_url" as const, image_url: { url: u } })),
              { type: "text" as const, text: prompt },
            ]
          : prompt,
      },
    ],
  };
  // Reasoning models only accept the default temperature.
  if (modelAcceptsTemperature(model)) payload.temperature = 0.8;
  if (useJson) payload.response_format = { type: "json_object" };

  let body = JSON.stringify(payload);
  const start = Date.now();

  const MAX_RETRIES = 1; // 1 retry with same model, then fallback to faster model
  let response: Awaited<ReturnType<typeof nativeFetch>> | undefined;
  let usedModel = model;
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES + 1; attempt++) {
    if (attempt > MAX_RETRIES) {
      const FALLBACK_MAP: Record<string, string> = {
        "gpt-5.4": "gpt-5.4-mini",
        "gpt-5.4-mini": "gpt-5.4-nano",
        "gpt-5": "gpt-5-mini",
      };
      const fallback = FALLBACK_MAP[model];
      if (!fallback) throw lastError;
      usedModel = fallback;
      payload.model = usedModel;
      body = JSON.stringify(payload);
      console.warn(`[LLM] Falling back to ${usedModel} after ${MAX_RETRIES + 1} failures with ${model}`);
    }

    try {
      response = await nativeFetch(url, { method: "POST", headers, body, timeoutMs });
      if (usedModel !== model) console.log(`[LLM] Fallback ${usedModel} succeeded`);
      break;
    } catch (err) {
      lastError = err;
      const isTransient = err instanceof Error && /socket|timed out|ECONNRESET|EPIPE/.test(err.message);
      if (isTransient && attempt <= MAX_RETRIES) {
        const delay = 2000 * Math.pow(2, attempt);
        console.warn(`[LLM] ${usedModel} attempt ${attempt + 1} failed: ${err instanceof Error ? err.message : err}. Retrying in ${delay / 1000}s...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      if (attempt > MAX_RETRIES) throw err;
    }
  }

  if (!response) throw new Error(`All fetch attempts to ${model} failed`);
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`${model} error (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`Empty response from ${model}`);

  console.log(`[LLM] ${model} responded in ${((Date.now() - start) / 1000).toFixed(1)}s (${content.length} chars)`);
  return content;
}

export function parseJsonResponse<T>(raw: string, label: string): T {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error(`[StoryGen] JSON parse failed (${label}). First 500 chars:`, cleaned.slice(0, 500));
    throw new Error(`Invalid JSON from ${label}: ${err instanceof Error ? err.message : "parse error"}`);
  }
}

// ── Pipeline entry points ────────────────────────────────────────────────────

export interface ArchitectResult {
  architect: ArchitectOutput;
  ageConfig: AgeConfig;
  /** The child's canonical Character Bible description (same bytes as the image prompts). */
  characterVisual: string;
  isMock: boolean;
  /** If mock, the full story is available immediately */
  mockStory?: GeneratedStory;
  /** The Book Plan (absent in mock mode) */
  plan?: BookPlan;
  planReport?: BookPlanReport;
}

/**
 * Writes the whole book (manuscript + shot plan) in one structured call and
 * returns the legacy ArchitectOutput view with `plan` attached. The route can
 * start illustration work immediately: the prose is already done.
 */
export async function generateArchitect(
  input: StoryInput,
  opts?: {
    /** Streaming hook: fires when the cover shot / each scene shot is final (start preview images early). */
    onProgress?: (progress: BookPlanProgress) => void;
  },
): Promise<ArchitectResult> {
  const mockMode = process.env.MOCK_MODE === "true";
  const ageConfig = getAgeConfig(input.age);

  if (isMockGeneration()) {
    console.log(`[StoryGen] MOCK MODE — ${mockMode ? "MOCK_MODE=true" : "no LLM API key"}`);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const mockStory = generateMockStory(input);
    return {
      architect: mockStory.bookPlan
        ? planToArchitectOutput(mockStory.bookPlan, buildPlanChildDescription(input))
        : ({} as ArchitectOutput),
      ageConfig,
      characterVisual: buildPlanChildDescription(input),
      isMock: true,
      mockStory,
      plan: mockStory.bookPlan,
    };
  }

  const characterVisual = buildPlanChildDescription(input);
  const { plan, report } = await generateBookPlan(input, { onProgress: opts?.onProgress });
  const architect = planToArchitectOutput(plan, characterVisual);
  return { architect, ageConfig, characterVisual, isMock: false, plan, planReport: report };
}

/**
 * Former 12-call prose expansion. The prose now comes from the Book Plan, so
 * this is a pure adapter (no LLM call).
 */
export async function expandScenes(
  architect: ArchitectOutput,
  input: StoryInput,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _ageConfig?: AgeConfig,
): Promise<GeneratedStory> {
  if (!architect.plan) throw new Error("[StoryGen] expandScenes requires an ArchitectOutput produced from a Book Plan");
  return planToGeneratedStory(architect.plan, buildPlanChildDescription(input));
}

/** Architect + adapter in one call. */
export async function generateStory(input: StoryInput): Promise<GeneratedStory> {
  const result = await generateArchitect(input);
  if (result.isMock && result.mockStory) return result.mockStory;
  return expandScenes(result.architect, input);
}

/**
 * @deprecated No-op kept for call-site compatibility. The old editorial review
 * never applied a fix (it asked for a top-level JSON array while forcing
 * json_object mode). Its job is now done inside generateBookPlan by
 * deterministic checks (length, gender agreement, Catalan article, refrain)
 * plus a targeted repair call. Remove the call from the route.
 */
export async function reviewAndRefineStory(
  story: GeneratedStory,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _input?: StoryInput,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _ageConfig?: AgeConfig,
): Promise<GeneratedStory> {
  return story;
}
