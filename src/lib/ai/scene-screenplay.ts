// Scene Screenplay Generator
//
// Creates detailed illustration specifications ("visual screenplay") for each scene,
// replacing simple imagePrompt strings with rich, visually distinct scene descriptions.
//
// Uses a single LLM call to produce 12 scene specs + 1 cover spec, ensuring:
//   - Each scene has a different camera angle from its neighbors
//   - Each scene has a different color palette from its neighbors
//   - Character reference descriptions are placed FIRST in every fluxPrompt
//   - Every fluxPrompt ends with the full-bleed / no-border directive
//   - fluxPrompt stays under 900 characters

import { callLLM, parseJsonResponse, type ArchitectOutput, type AgeConfig } from "./story-generator";
import type { AssetTree } from "./visual-assets";
import { SCENE_LAYOUT_PAIRS } from "@/components/book-viewer/types";

// ── Layout-aware aspect ratios ───────────────────────────────────────────────
// Maps PDF layout types to the closest FLUX-supported aspect ratio.
// Spread scenes need a wide panoramic image; others use square or slightly wide.
const LAYOUT_TO_FLUX_ASPECT: Record<string, string> = {
  immersive: "1:1",
  split_top: "4:3",
  split_bottom: "4:3",
  full_illustration: "1:1",
  illustration_text: "16:9",
  spread_left: "16:9",    // FLUX's widest — closest to 2:1 panoramic
};

/** Returns the correct FLUX aspect ratio for a given scene number (1-based). */
function getSceneAspectRatio(sceneNumber: number): string {
  const pair = SCENE_LAYOUT_PAIRS[(sceneNumber - 1) % SCENE_LAYOUT_PAIRS.length];
  return LAYOUT_TO_FLUX_ASPECT[pair[0]] || "1:1";
}

/** Returns scene numbers that are double-page spreads. */
function getSpreadSceneNumbers(): number[] {
  return SCENE_LAYOUT_PAIRS
    .map((pair, i) => (pair[0] === "spread_left" ? i + 1 : -1))
    .filter((n) => n > 0);
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface SceneScreenplay {
  sceneNumber: number;
  composition: string;        // Camera angle, framing description
  lighting: string;           // Light sources, time of day, mood
  characters: string[];       // Asset IDs from AssetTree that appear
  primaryCharacter?: string;  // Asset ID whose ref gets input_image (primary FLUX slot)
  keyActions: string;         // What is happening in the frame
  environment: string;        // Background, setting details
  emotionalTone: string;      // The feeling the image should evoke
  differentiationNote: string; // How this scene differs visually from adjacent scenes
  aspectRatio: string;        // "1:1", "4:3", "16:9"
  fluxPrompt: string;         // Final assembled prompt for FLUX (max 900 chars)
}

export interface Screenplay {
  scenes: SceneScreenplay[];
  coverSpec: SceneScreenplay;
  globalStyle: string;         // Consistent style directive
}

// ── Constants ────────────────────────────────────────────────────────────────

const SCREENPLAY_MODEL = process.env.OPENAI_ARCHITECT_MODEL || "gpt-4o-mini";
const MAX_FLUX_PROMPT_LENGTH = 1000;

// ── Mock mode helper ─────────────────────────────────────────────────────────

function buildMockScreenplay(architect: ArchitectOutput): Screenplay {
  const scenes: SceneScreenplay[] = architect.scenes.map((scene) => ({
    sceneNumber: scene.sceneNumber,
    composition: "Medium shot, eye-level camera angle",
    lighting: "Warm natural daylight",
    characters: [],
    primaryCharacter: undefined,
    keyActions: scene.brief || "",
    environment: "Storybook setting",
    emotionalTone: "Warm and inviting",
    differentiationNote: "Mock mode — no differentiation applied",
    aspectRatio: getSceneAspectRatio(scene.sceneNumber),
    fluxPrompt: scene.imagePrompt,
  }));

  const coverSpec: SceneScreenplay = {
    sceneNumber: 0,
    composition: "Heroic wide shot, low camera angle",
    lighting: "Golden hour, dramatic rim lighting",
    characters: [],
    primaryCharacter: "protagonist",
    keyActions: "Protagonist standing tall with key companion",
    environment: "Iconic location from the story",
    emotionalTone: "Epic and inviting",
    differentiationNote: "Cover — most dramatic image of the book",
    aspectRatio: "1:1",
    fluxPrompt: architect.coverImagePrompt,
  };

  return {
    scenes,
    coverSpec,
    globalStyle: "Children's book illustration, digital painting",
  };
}

// ── LLM prompt builder ───────────────────────────────────────────────────────

function buildScreenplayPrompt(
  architect: ArchitectOutput,
  assetTree: AssetTree,
  characterRef: string,
  ageConfig: AgeConfig,
): string {
  // Format scene briefs
  const scenesBlock = architect.scenes
    .map(
      (s) =>
        `Scene ${s.sceneNumber} (${s.type}): "${s.title}"\n` +
        `  Brief: ${s.brief}\n` +
        `  Original imagePrompt: ${s.imagePrompt}`,
    )
    .join("\n\n");

  // Format asset tree entries
  const assetsBlock = assetTree.assets
    .map(
      (a) =>
        `- ID: ${a.id} | Name: ${a.name} | Type: ${a.type}\n` +
        `  Description: ${a.description}\n` +
        `  Appears in scenes: ${a.scenes.join(", ")}`,
    )
    .join("\n");

  // Compute per-scene aspect ratios and identify spreads
  const spreadNums = getSpreadSceneNumbers();
  const sceneAspectBlock = architect.scenes
    .map((s) => `  Scene ${s.sceneNumber}: aspectRatio="${getSceneAspectRatio(s.sceneNumber)}"${spreadNums.includes(s.sceneNumber) ? " (PANORAMIC SPREAD — compose for WIDE 16:9, NOT square)" : ""}`)
    .join("\n");

  return `You are a visual director creating image generation prompts for a children's picture book.

Each fluxPrompt you write will be sent DIRECTLY to an AI image generator (FLUX Kontext). The generator creates images from text descriptions. It does NOT understand editing instructions, meta-commentary, or abstract concepts — it only understands CONCRETE VISUAL DESCRIPTIONS of what should appear in the image.

CRITICAL RULES FOR fluxPrompt:
1. Write ONLY concrete visual descriptions. Describe what the viewer SEES: characters, objects, setting, lighting, colors, composition.
2. NEVER include editing instructions, annotations, labels, arrows, or meta-text like "editing instruction", "change this", "doorstep", etc.
3. NEVER use words like "reference image", "input image", "transform", "edit", "modify" — describe the scene as if it's being created from scratch.
4. Start EVERY fluxPrompt with the protagonist's physical description: "${characterRef}"
5. After the character, describe: what they are DOING, WHERE they are (full detailed environment with colors), the LIGHTING and TIME OF DAY, and any other characters/objects.
6. EVERY scene MUST have a FULL DETAILED BACKGROUND — a room, a landscape, a planet, space, etc. NEVER a white/blank/empty background.
7. End EVERY fluxPrompt with: "Children's book watercolor illustration style, warm soft colors, gentle lighting, cute cartoon proportions, NOT photorealistic, NOT a photograph. Full bleed edge-to-edge illustration. No borders, no white edges, no text, no signature, no watermark, no branded logos."
8. Keep each fluxPrompt under ${MAX_FLUX_PROMPT_LENGTH} characters.
9. Each scene MUST have a DIFFERENT camera angle from its neighbors.
10. Each scene MUST have a DIFFERENT dominant color palette from its neighbors.
11. Use asset IDs in the "characters" array.
12. The cover should be the most dramatic — protagonist in a heroic pose.

ASPECT RATIOS — MANDATORY (these match the book's physical page layout):
${sceneAspectBlock}
  Cover: aspectRatio="1:1"

IMPORTANT: Scenes ${spreadNums.join(" and ")} are DOUBLE-PAGE PANORAMIC SPREADS. Their fluxPrompt MUST describe a WIDE horizontal composition — place the character to one side with a vast environment stretching across. Think cinematic widescreen, NOT a close-up portrait.

PRIMARY CHARACTER — for each scene, set "primaryCharacter" to the asset ID of the character that is MOST VISUALLY PROMINENT or FEATURED in that scene. This character's reference image will be given highest priority in the image generator.
- If the scene is a close-up or focuses on a secondary character (companion, creature, etc.), set primaryCharacter to THAT character, NOT the protagonist.
- If the protagonist is the focus (most scenes), set primaryCharacter to "protagonist".
- This is critical for visual consistency of secondary characters.

GOOD fluxPrompt example:
"A 7-year-old girl with long brown hair, olive skin, wearing a yellow hoodie, kneeling on a glowing alien planet surface next to a small silver robot. Purple crystalline mountains rise in the background. Twin moons shine in a deep violet sky. The girl points excitedly at a trail of golden star-lights stretching across the horizon. Warm golden light from the stars illuminates their faces. Children's book digital illustration, warm soft colors, gentle lighting. Full bleed edge-to-edge illustration. No borders, no white edges, no text, no signature, no watermark."

BAD fluxPrompt example (DO NOT DO THIS):
"Show the protagonist from the reference image in scene 3 environment. Edit the background to show space. Transform the character pose to be more dynamic."

STORY TITLE: ${architect.bookTitle}

STORY SCENES:
${scenesBlock}

VISUAL ASSETS:
${assetsBlock}

CHARACTER REFERENCE (use this EXACT text at the start of every fluxPrompt):
${characterRef}

COVER IMAGE PROMPT (original):
${architect.coverImagePrompt}

ART STYLE: ${ageConfig.illustrationPromptStyle}

Respond with a JSON object:
{
  "globalStyle": "one-sentence style directive",
  "coverSpec": {
    "sceneNumber": 0,
    "composition": "camera angle",
    "lighting": "light description",
    "characters": ["asset-id-1"],
    "primaryCharacter": "protagonist",
    "keyActions": "what happens",
    "environment": "full background description",
    "emotionalTone": "feeling",
    "differentiationNote": "how cover differs",
    "aspectRatio": "1:1",
    "fluxPrompt": "CONCRETE visual description starting with character ref, ending with style directive"
  },
  "scenes": [
    {
      "sceneNumber": 1,
      "composition": "...",
      "lighting": "...",
      "characters": ["..."],
      "primaryCharacter": "protagonist",
      "keyActions": "...",
      "environment": "...",
      "emotionalTone": "...",
      "differentiationNote": "...",
      "aspectRatio": "1:1",
      "fluxPrompt": "..."
    }
  ]
}

Produce exactly ${architect.scenes.length} scene entries. Every fluxPrompt must be a concrete visual description with a full background environment.`;
}

// ── Prompt length enforcement ────────────────────────────────────────────────

const FLUX_SUFFIX =
  " Children's book watercolor illustration, warm soft colors, NOT photorealistic. Full bleed edge-to-edge. No borders, no white edges, no text, no signature, no watermark, no branded logos.";

function enforcePromptLength(spec: SceneScreenplay): void {
  if (spec.fluxPrompt.length <= MAX_FLUX_PROMPT_LENGTH) return;

  // If the suffix is present, truncate the body and re-append
  const hasSuffix = spec.fluxPrompt.endsWith(FLUX_SUFFIX.trim());
  if (hasSuffix) {
    const body = spec.fluxPrompt.slice(
      0,
      spec.fluxPrompt.length - FLUX_SUFFIX.trim().length,
    );
    const maxBody = MAX_FLUX_PROMPT_LENGTH - FLUX_SUFFIX.length;
    spec.fluxPrompt = body.slice(0, maxBody).trimEnd() + FLUX_SUFFIX;
  } else {
    // Suffix missing — truncate and append it
    const maxBody = MAX_FLUX_PROMPT_LENGTH - FLUX_SUFFIX.length;
    spec.fluxPrompt =
      spec.fluxPrompt.slice(0, maxBody).trimEnd() + FLUX_SUFFIX;
  }
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function generateScreenplay(
  architect: ArchitectOutput,
  assetTree: AssetTree,
  characterRef: string,
  ageConfig: AgeConfig,
): Promise<Screenplay> {
  const mockMode = process.env.MOCK_MODE === "true";

  if (mockMode) {
    console.log("[Screenplay] MOCK_MODE — returning passthrough screenplay");
    return buildMockScreenplay(architect);
  }

  const start = Date.now();

  const prompt = buildScreenplayPrompt(architect, assetTree, characterRef, ageConfig);
  const raw = await callLLM(prompt, SCREENPLAY_MODEL, {
    json: true,
    timeoutMs: 120_000,
  });

  const result = parseJsonResponse<Screenplay>(raw, "Screenplay");

  // Validate structure
  if (!result.scenes || !Array.isArray(result.scenes)) {
    throw new Error("[Screenplay] LLM returned invalid structure: missing scenes array");
  }
  if (result.scenes.length < architect.scenes.length) {
    throw new Error(
      `[Screenplay] LLM returned ${result.scenes.length} scenes but expected ${architect.scenes.length}`,
    );
  }
  if (!result.coverSpec) {
    throw new Error("[Screenplay] LLM returned invalid structure: missing coverSpec");
  }

  // Enforce correct aspect ratios — override LLM output with layout-derived values
  for (const scene of result.scenes) {
    const correctAspect = getSceneAspectRatio(scene.sceneNumber);
    if (scene.aspectRatio !== correctAspect) {
      console.log(`[Screenplay] Correcting scene ${scene.sceneNumber} aspectRatio: "${scene.aspectRatio}" → "${correctAspect}"`);
      scene.aspectRatio = correctAspect;
    }
    enforcePromptLength(scene);
  }
  // Cover is always 1:1
  result.coverSpec.aspectRatio = "1:1";
  enforcePromptLength(result.coverSpec);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[Screenplay] Generated screenplay in ${elapsed}s`);

  return result;
}
