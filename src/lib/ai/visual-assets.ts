// Visual Asset Tree — extracts recurring visual elements from a story
// and generates FLUX Kontext reference images for character consistency.
//
// WORKFLOW:
//   1. extractVisualAssets() — single LLM call analyzes all 12 scene briefs/imagePrompts
//      and identifies recurring characters, objects, vehicles, creatures.
//   2. generateReferenceImages() — generates a reference sheet for each asset
//      using FLUX Kontext Pro on a plain white background, then uploads to Supabase.
//
// The resulting AssetReference[] is consumed downstream when generating scene
// illustrations, ensuring consistent character appearance across all 12 scenes.

import { SupabaseClient } from "@supabase/supabase-js";
import { callLLM, parseJsonResponse, type ArchitectOutput, type AgeConfig } from "./story-generator";
import { generateFluxPro } from "./flux-kontext";
import { uploadReferenceFromBase64 } from "../supabase/storage";

// ── Types ────────────────────────────────────────────────────────────────────

export interface VisualAsset {
  id: string;             // e.g. "protagonist", "companion_droid", "object_sword"
  type: "character" | "object" | "vehicle" | "creature";
  name: string;           // Display name e.g. "Silver Droid"
  description: string;    // Full visual description for FLUX prompt
  refPrompt: string;      // The prompt used to generate the reference sheet
  scenes: number[];       // Which scenes use this asset
}

export interface AssetTree {
  assets: VisualAsset[];
  styleDirective: string; // Global art style instruction
}

export interface AssetReference {
  assetId: string;
  base64: string;         // Reference image as base64
  storageUrl: string;     // Permanent Supabase URL
}

// ── Mock mode check ──────────────────────────────────────────────────────────

function isMockMode(): boolean {
  return process.env.MOCK_MODE === "true";
}

// ── Mock data ────────────────────────────────────────────────────────────────

function buildMockAssetTree(characterRef: string, styleDirective: string): AssetTree {
  return {
    assets: [
      {
        id: "protagonist",
        type: "character",
        name: "Protagonist",
        description: characterRef,
        refPrompt: `${characterRef} Character reference sheet on plain white background. No text, no signature.`,
        scenes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      },
    ],
    styleDirective,
  };
}

// ── Extract Visual Assets ────────────────────────────────────────────────────

/** Max assets to extract. Higher = more ref images but more generation time/cost. */
const MAX_ASSETS = 8;

/**
 * Scans all image prompts for named entities that should have been extracted
 * as visual assets. Returns names that appear in 2+ image prompts but are
 * missing from the asset tree.
 */
function findMissingNamedCharacters(
  architect: ArchitectOutput,
  assets: VisualAsset[],
): { name: string; scenes: number[] }[] {
  // Collect all "named X" patterns from image prompts:
  //   "a small silver robot named Bolt"  → "Bolt"
  //   "a three-eyed alien named Zix"     → "Zix"
  //   "named Nova"                       → "Nova"
  const namePattern = /(?:named|called)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g;
  const nameToScenes = new Map<string, number[]>();

  for (const scene of architect.scenes) {
    const text = `${scene.brief || ""} ${scene.imagePrompt || ""}`;
    let match: RegExpExecArray | null;
    namePattern.lastIndex = 0;
    while ((match = namePattern.exec(text)) !== null) {
      const name = match[1];
      const list = nameToScenes.get(name) || [];
      if (!list.includes(scene.sceneNumber)) list.push(scene.sceneNumber);
      nameToScenes.set(name, list);
    }
  }

  // Check which names are missing from the extracted assets
  const assetNames = new Set(
    assets.map((a) => a.name.toLowerCase()),
  );
  const assetDescs = assets.map((a) => a.description.toLowerCase()).join(" ");

  const missing: { name: string; scenes: number[] }[] = [];
  for (const [name, scenes] of nameToScenes) {
    if (scenes.length < 2) continue; // Only care about recurring names
    const nameLower = name.toLowerCase();
    // Check if this name appears in any asset name or description
    if (assetNames.has(nameLower)) continue;
    if (assetDescs.includes(nameLower)) continue;
    missing.push({ name, scenes });
  }

  return missing;
}

/**
 * Analyzes all 12 scene briefs and image prompts to extract ALL recurring
 * visual elements (characters, objects, vehicles, creatures).
 *
 * The protagonist is ALWAYS the first asset, built from `characterRef`.
 * Returns up to MAX_ASSETS assets. Every named character that appears in
 * 2+ scenes MUST be extracted as a separate asset.
 *
 * @param architect - The architect output with all 12 scene briefs and image prompts
 * @param characterRef - The protagonist's full visual description string
 * @param ageConfig - Age configuration (used for illustrationBaseStyle)
 * @returns AssetTree with extracted assets and a global style directive
 */
export async function extractVisualAssets(
  architect: ArchitectOutput,
  characterRef: string,
  ageConfig: AgeConfig,
): Promise<AssetTree> {
  const styleDirective = ageConfig.illustrationBaseStyle;

  if (isMockMode()) {
    console.log("[Visual Assets] Mock mode — returning hardcoded asset tree");
    return buildMockAssetTree(characterRef, styleDirective);
  }

  const model = process.env.OPENAI_ARCHITECT_MODEL || "gpt-4o-mini";

  // Build scene data with clear character identification cues
  const sceneSummaries = architect.scenes
    .map((s) =>
      `Scene ${s.sceneNumber} (${s.type}): "${s.title}"\n` +
      `Brief: ${s.brief}\n` +
      `Image prompt: ${s.imagePrompt}`)
    .join("\n\n");

  // Pre-scan for named characters to include in the prompt as hints
  const namePattern = /(?:named|called)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g;
  const allNames = new Set<string>();
  for (const scene of architect.scenes) {
    const text = `${scene.brief || ""} ${scene.imagePrompt || ""}`;
    let match: RegExpExecArray | null;
    namePattern.lastIndex = 0;
    while ((match = namePattern.exec(text)) !== null) {
      allNames.add(match[1]);
    }
  }
  const namedCharHint = allNames.size > 0
    ? `\nNAMED CHARACTERS DETECTED IN THE TEXT: ${[...allNames].join(", ")}. Each of these MUST be a separate asset if they appear in 2+ scenes.`
    : "";

  const prompt = `You are a visual asset analyst for a children's book illustration pipeline.

Below are 12 scene briefs and their image prompts. Your task is to identify ALL recurring visual elements that need consistent appearance across illustrations. These will be used to generate reference sheets for an AI image generator.

CRITICAL RULES — READ CAREFULLY:

1. PROTAGONIST FIRST: The protagonist MUST be the first asset, with id "protagonist".

2. EVERY NAMED CHARACTER IS A SEPARATE ASSET: If a character has a name (e.g., "Bolt", "Zix", "Nova"), it MUST be its own asset — even if it is the same type as another character. Two robots with different names = two separate assets. A robot and an alien = two separate assets.

3. DISTINGUISH BY CONTEXT: Characters that appear in different parts of the story (e.g., a pet at home vs a companion in space) may look completely different. If they have different names or descriptions, they are DIFFERENT assets.

4. NEVER MERGE CHARACTERS: Do NOT combine two named characters into one asset. "Bolt" (a small silver home robot) and "a friendly robot with a map screen" (a space companion) are TWO SEPARATE assets, not one.

5. ALL TYPES WELCOME: Extract characters, creatures, aliens, robots, magical objects, vehicles — anything that must look the same whenever it appears.

6. MINIMUM 2 SCENES: Only include elements that appear in at least 2 scenes.

7. MAXIMUM ${MAX_ASSETS} ASSETS: Protagonist + up to ${MAX_ASSETS - 1} supporting elements.

8. DETAILED DESCRIPTIONS: For each asset, write a specific visual description with: physical form, size relative to the protagonist, colors, textures, distinguishing features, clothing/accessories.

9. REFERENCE PROMPTS: For refPrompt, write a prompt to generate a clear character/object design on a plain white background. Be specific about the exact visual appearance.

10. For the PROTAGONIST, use this exact description as basis:
    "${characterRef}"
${namedCharHint}

SCENES:
${sceneSummaries}

Return a JSON object:
{
  "assets": [
    {
      "id": "protagonist",
      "type": "character",
      "name": "<protagonist name>",
      "description": "<detailed visual description>",
      "refPrompt": "<prompt for reference sheet on white background>",
      "scenes": [1, 2, 3, ...]
    },
    {
      "id": "<snake_case_id>",
      "type": "character" | "object" | "vehicle" | "creature",
      "name": "<display name, e.g. Zix>",
      "description": "<detailed visual description — form, size, colors, features>",
      "refPrompt": "<prompt for reference sheet on white background>",
      "scenes": [<scene numbers>]
    }
  ]
}`;

  const start = Date.now();
  const raw = await callLLM(prompt, model, { json: true });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[Visual Assets] Extracted assets in ${elapsed}s`);

  const parsed = parseJsonResponse<{ assets: VisualAsset[] }>(raw, "visual-assets-extraction");

  // Ensure protagonist is always first and uses the provided characterRef
  const protagonistIndex = parsed.assets.findIndex((a) => a.id === "protagonist");
  if (protagonistIndex === -1) {
    parsed.assets.unshift({
      id: "protagonist",
      type: "character",
      name: "Protagonist",
      description: characterRef,
      refPrompt: `${characterRef} Character reference sheet on plain white background. No text, no signature.`,
      scenes: architect.scenes.map((s) => s.sceneNumber),
    });
  } else if (protagonistIndex > 0) {
    const [protagonist] = parsed.assets.splice(protagonistIndex, 1);
    parsed.assets.unshift(protagonist);
  }

  // ── Post-validation: check for missed named characters ────────────────────
  const missing = findMissingNamedCharacters(architect, parsed.assets);
  if (missing.length > 0) {
    console.warn(`[Visual Assets] WARNING: ${missing.length} named character(s) missing from extraction:`);
    for (const m of missing) {
      console.warn(`  - "${m.name}" appears in scenes [${m.scenes.join(", ")}]`);

      // Auto-add missing characters if we still have room
      if (parsed.assets.length < MAX_ASSETS) {
        const id = m.name.toLowerCase().replace(/\s+/g, "_");
        // Extract a description from the image prompts where this name appears
        const descParts: string[] = [];
        for (const scene of architect.scenes) {
          if (!m.scenes.includes(scene.sceneNumber)) continue;
          const prompt = scene.imagePrompt || "";
          // Find the sentence containing this name
          const sentences = prompt.split(/[.,]/).filter((s) => s.toLowerCase().includes(m.name.toLowerCase()));
          if (sentences.length > 0) {
            descParts.push(sentences[0].trim());
            break; // One good description is enough
          }
        }
        const desc = descParts[0] || `A character named ${m.name}`;

        parsed.assets.push({
          id,
          type: "character",
          name: m.name,
          description: desc,
          refPrompt: `Children's book illustration style. Character design sheet of ${m.name}: ${desc}. Front view, standing pose, plain white background. No text, no signature.`,
          scenes: m.scenes,
        });
        console.warn(`  → Auto-added "${m.name}" as asset "${id}"`);
      }
    }
  }

  // Enforce the asset cap
  const assets = parsed.assets.slice(0, MAX_ASSETS);

  console.log(`[Visual Assets] Final asset tree: ${assets.length} assets — [${assets.map((a) => a.id).join(", ")}]`);

  return {
    assets,
    styleDirective,
  };
}

// ── Generate Reference Images ────────────────────────────────────────────────

/**
 * Generates a FLUX Kontext Pro reference sheet for each visual asset,
 * then uploads each to Supabase Storage.
 *
 * Generation runs in parallel batches of 2-3 to balance speed and API limits.
 *
 * @param assetTree - The asset tree from extractVisualAssets()
 * @param supabase - Authenticated Supabase client
 * @param storyId - The story UUID (used as storage folder)
 * @returns Array of AssetReference with base64 data and permanent storage URLs
 */
export async function generateReferenceImages(
  assetTree: AssetTree,
  supabase: SupabaseClient,
  storyId: string,
): Promise<AssetReference[]> {
  if (isMockMode()) {
    console.log("[Visual Assets] Mock mode — returning mock references");
    return assetTree.assets.map((asset) => ({
      assetId: asset.id,
      base64: "",
      storageUrl: `https://mock.supabase.co/storage/v1/object/public/illustrations/${storyId}/ref-${asset.id}.png`,
    }));
  }

  const BATCH_SIZE = 3;
  const results: AssetReference[] = [];

  for (let i = 0; i < assetTree.assets.length; i += BATCH_SIZE) {
    const batch = assetTree.assets.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (asset) => {
        // Build a safe prompt that forces illustration style (not photorealistic)
        let refPrompt: string;
        const illustrationStyle = "Children's book illustration style, warm soft watercolor and digital painting, cute cartoon proportions with large expressive eyes, NOT photorealistic, NOT a photograph.";
        if (asset.type === "character" || asset.type === "creature") {
          refPrompt = [
            `${illustrationStyle} Character design sheet of ${asset.name}:`,
            asset.description.replace(/natural realistic/gi, "illustrated cartoon style"),
            "Front view, standing pose, plain white background.",
            "Cute storybook illustration style with soft colors. No branded logos, no real brand names.",
            "Character design reference. No text, no signature.",
          ].join(" ");
        } else {
          refPrompt = [
            `${illustrationStyle}`,
            asset.refPrompt,
            "Plain white background. Cute storybook style with soft colors.",
            "Design reference. No text, no signature.",
          ].join(" ");
        }

        const start = Date.now();
        let fluxResult;
        try {
          fluxResult = await generateFluxPro(refPrompt);
        } catch (err) {
          // If moderation or generation fails, return empty ref (non-fatal)
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[Visual Assets] Ref generation failed for ${asset.name} (non-fatal): ${msg.slice(0, 100)}`);
          return {
            assetId: asset.id,
            base64: "",
            storageUrl: "",
          };
        }
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        console.log(`[Visual Assets] Generated ref for ${asset.name} in ${elapsed}s`);

        const storageUrl = await uploadReferenceFromBase64(
          supabase,
          storyId,
          asset.id,
          fluxResult.base64,
        );

        return {
          assetId: asset.id,
          base64: fluxResult.base64,
          storageUrl,
        };
      }),
    );

    results.push(...batchResults);
  }

  return results;
}
