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
import { generateFlux2 } from "./flux2";
import { WATERCOLOR_REF_STYLE } from "./style";
import { uploadReferenceFromBase64 } from "../supabase/storage";

// ── Types ────────────────────────────────────────────────────────────────────

/** Entity categories that must stay visually consistent across the whole book. */
export type VisualAssetType =
  | "character"
  | "creature"
  | "object"
  | "vehicle"
  | "location"   // recurring setting (cockpit, forest, bedroom) — the "stage"
  | "wardrobe"   // a key outfit the protagonist/companion wears across scenes
  | "prop";      // a story-significant object (magic wand, red flag, map)

export interface VisualAsset {
  id: string;             // e.g. "protagonist", "companion_droid", "location_cockpit", "prop_red_flag"
  type: VisualAssetType;
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
const MAX_ASSETS = 10;

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

  const prompt = `You are a visual asset analyst building the "visual bible" for a children's book illustration pipeline.

Below are 12 scene briefs and their image prompts. Identify ALL recurring visual elements that must look IDENTICAL every time they appear — not just characters, but the whole world: settings, key outfits, and story props. These become reference sheets fed to an AI image generator, so consistency across the book depends on you catching them.

CRITICAL RULES — READ CAREFULLY:

1. PROTAGONIST FIRST: The protagonist MUST be the first asset, with id "protagonist".

2. EVERY NAMED CHARACTER IS A SEPARATE ASSET: If a character has a name (e.g., "Bolt", "Zix", "Nova"), it MUST be its own asset — even if it is the same type as another character. Two robots with different names = two separate assets. A robot and an alien = two separate assets.

3. DISTINGUISH BY CONTEXT: Characters that appear in different parts of the story (e.g., a pet at home vs a companion in space) may look completely different. If they have different names or descriptions, they are DIFFERENT assets.

4. NEVER MERGE CHARACTERS: Do NOT combine two named characters into one asset.

5. EXTRACT THE WHOLE WORLD, not just characters. Use these types:
   - "character" / "creature": people, animals, aliens, robots.
   - "vehicle": ships, cars, etc.
   - "location": a recurring SETTING the story returns to (e.g. the spaceship cockpit, the grandmother's kitchen, a specific forest clearing). The stage must look the same each visit. id like "location_cockpit".
   - "wardrobe": a distinctive OUTFIT worn across multiple scenes (e.g. the white astronaut suit with a red star). Only if it recurs and is visually specific. id like "wardrobe_spacesuit".
   - "prop": a story-significant OBJECT that recurs (e.g. a red flag, a magic compass, a teddy bear). id like "prop_red_flag".

6. MINIMUM 2 SCENES: Only include elements that appear in at least 2 scenes.

7. MAXIMUM ${MAX_ASSETS} ASSETS total: Protagonist + up to ${MAX_ASSETS - 1} supporting elements. Prioritize: protagonist > named characters > primary recurring location > key wardrobe > key props.

8. DETAILED DESCRIPTIONS: For each asset, write a specific visual description (form, size relative to protagonist, colors, textures, distinguishing features). For locations: architecture/landscape, key furniture/landmarks, color/mood. For wardrobe: garment, colors, patches/details. For props: shape, material, colors, markings.

9. REFERENCE PROMPTS (refPrompt): describe a clean design reference. Characters/creatures/props/wardrobe → on a plain white background. Locations → an empty establishing shot of the setting with NO characters present.

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
      "type": "character" | "creature" | "object" | "vehicle" | "location" | "wardrobe" | "prop",
      "name": "<display name>",
      "description": "<detailed visual description>",
      "refPrompt": "<prompt for reference sheet — white background for things, empty establishing shot for locations>",
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
  options?: {
    /** The child's real avatar/portrait (base64) — anchors the protagonist sheet to the actual child. */
    protagonistAvatarBase64?: string;
    /** Per-stage image model (preview→fast/cheap, final→premium). */
    imageModel?: { provider?: string; falModel?: string; scale?: number };
  },
): Promise<AssetReference[]> {
  if (isMockMode()) {
    console.log("[Visual Assets] Mock mode — returning mock references");
    return assetTree.assets.map((asset) => ({
      assetId: asset.id,
      base64: "",
      storageUrl: `https://mock.supabase.co/storage/v1/object/public/illustrations/${storyId}/ref-${asset.id}.png`,
    }));
  }

  // Sheets are independent of each other → safe to parallelize. Stay well under
  // BFL's 24-concurrent-task ceiling (scenes run in a later phase).
  const BATCH_SIZE = Number(process.env.FLUX2_CONCURRENCY) || 8;
  const results: AssetReference[] = [];

  for (let i = 0; i < assetTree.assets.length; i += BATCH_SIZE) {
    const batch = assetTree.assets.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (asset) => {
        // Build a type-aware reference prompt in the SAME watercolor style as the
        // scenes — so scenes and references share one visual distribution.
        const desc = asset.description.replace(/natural realistic/gi, "illustrated watercolor style");
        let refPrompt: string;
        let aspectRatio = "1:1";
        switch (asset.type) {
          case "character":
          case "creature":
            refPrompt = `${WATERCOLOR_REF_STYLE} Character design reference sheet of ${asset.name}: ${desc}. Front view, full body, standing neutral pose, plain white background. No text, no signature, no branded logos.`;
            break;
          case "location":
            // Empty stage — no characters — so the setting stays consistent on every visit.
            refPrompt = `${WATERCOLOR_REF_STYLE} Establishing shot of a setting: ${desc}. Empty scene with NO people and NO characters present. Wide environment view. No text, no signature.`;
            aspectRatio = "4:3";
            break;
          case "wardrobe":
            refPrompt = `${WATERCOLOR_REF_STYLE} Costume design reference: ${desc}. The outfit shown clearly, plain white background. No text, no signature.`;
            break;
          default: // object | vehicle | prop
            refPrompt = `${WATERCOLOR_REF_STYLE} Object design reference: ${asset.refPrompt || desc}. Plain white background. No text, no signature.`;
        }

        // Anchor the protagonist sheet to the child's REAL avatar (identity lock).
        const inputImages =
          asset.id === "protagonist" && options?.protagonistAvatarBase64
            ? [options.protagonistAvatarBase64]
            : undefined;

        const start = Date.now();
        let fluxResult;
        try {
          fluxResult = await generateFlux2(refPrompt, { aspectRatio, inputImages, provider: options?.imageModel?.provider, falModel: options?.imageModel?.falModel });
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
        console.log(`[Visual Assets] Generated ${asset.type} ref for ${asset.name} in ${elapsed}s`);

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
