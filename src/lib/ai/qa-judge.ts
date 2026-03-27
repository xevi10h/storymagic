// QA Judge — automated quality review for book illustrations
//
// Uses OpenAI Vision (gpt-4o) to analyze each illustration against its
// scene text and reference images. Returns a structured report with
// per-scene scores and specific issues.

import { callLLM, parseJsonResponse } from "./story-generator";
import type { Screenplay } from "./scene-screenplay";
import type { AssetReference } from "./visual-assets";

// ── Types ────────────────────────────────────────────────────────

export interface QAVerdict {
  sceneNumber: number;
  score: number;              // 1-10
  coherenceScore: number;     // Text-image alignment (1-10)
  consistencyScore: number;   // Character consistency (1-10)
  qualityScore: number;       // Visual quality — no borders, watermarks (1-10)
  issues: string[];           // Specific problems found
  suggestion: string;         // How to fix (for regeneration prompt)
}

export interface QAResult {
  overallScore: number;       // Average of all scene scores
  verdicts: QAVerdict[];
  scenesToRegenerate: number[];  // Scene numbers scoring below threshold
  iterationNumber: number;
}

// ── Config ───────────────────────────────────────────────────────

const QA_MODEL = process.env.OPENAI_QA_MODEL || "gpt-4o";
const SCORE_THRESHOLD = 7;     // Scenes below this get regenerated
const MAX_IMAGES_PER_CALL = 16; // gpt-4o supports many images per call

// ── Image conversion helpers ────────────────────────────────────

/**
 * Converts an image URL or raw base64 string to a data URI that
 * OpenAI Vision can consume directly (no external download needed).
 */
async function toDataUri(input: string): Promise<string> {
  // Already a data URI — pass through
  if (input.startsWith("data:")) return input;

  // Raw base64 string (no URL scheme) — wrap as PNG data URI
  if (!input.startsWith("http")) {
    return `data:image/png;base64,${input}`;
  }

  // HTTP(S) URL — download and convert to base64 data URI
  const response = await fetch(input, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    throw new Error(`Failed to download image for QA: ${response.status} ${input.slice(0, 100)}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "image/png";
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

// ── Main ─────────────────────────────────────────────────────────

/**
 * Review all illustrations for quality and consistency.
 *
 * Sends illustration URLs + reference images + screenplay specs to
 * OpenAI Vision for analysis. Returns scores and issues.
 */
export async function judgeIllustrations(
  illustrations: { sceneNumber: number; imageUrl: string }[],
  assetReferences: AssetReference[],
  screenplay: Screenplay,
  characterRef: string,
  iterationNumber = 1,
): Promise<QAResult> {
  const mockMode = process.env.MOCK_MODE === "true";
  if (mockMode) {
    console.log("[QA Judge] Mock mode — skipping review");
    return {
      overallScore: 10,
      verdicts: illustrations.map((ill) => ({
        sceneNumber: ill.sceneNumber,
        score: 10,
        coherenceScore: 10,
        consistencyScore: 10,
        qualityScore: 10,
        issues: [],
        suggestion: "",
      })),
      scenesToRegenerate: [],
      iterationNumber,
    };
  }

  const start = Date.now();
  console.log(`[QA Judge] Reviewing ${illustrations.length} illustrations (iteration ${iterationNumber})...`);

  // Build the image list as base64 data URIs.
  // gpt-4o cannot download from Supabase Storage URLs (timeout),
  // so we convert everything to inline data URIs.
  const imageDataUris: string[] = [];

  // Add up to 4 reference images — prefer base64 (already in memory), fallback to URL download
  const refImages = assetReferences.slice(0, 4);
  for (const ref of refImages) {
    try {
      if (ref.base64) {
        imageDataUris.push(`data:image/png;base64,${ref.base64}`);
      } else if (ref.storageUrl) {
        imageDataUris.push(await toDataUri(ref.storageUrl));
      }
    } catch (err) {
      console.warn(`[QA Judge] Failed to convert ref ${ref.assetId} to data URI:`, err);
    }
  }
  const refCount = imageDataUris.length;

  // Add illustration images — download each URL and convert to data URI
  for (const ill of illustrations) {
    if (ill.imageUrl) {
      try {
        imageDataUris.push(await toDataUri(ill.imageUrl));
      } catch (err) {
        console.warn(`[QA Judge] Failed to convert scene ${ill.sceneNumber} image to data URI:`, err);
      }
    }
  }

  // Limit total images to avoid exceeding model limits
  if (imageDataUris.length > MAX_IMAGES_PER_CALL) {
    imageDataUris.splice(MAX_IMAGES_PER_CALL);
  }

  const illustrationCount = imageDataUris.length - refCount;
  if (illustrationCount === 0) {
    console.warn("[QA Judge] No illustration images could be converted to data URIs — skipping review");
    return {
      overallScore: 0,
      verdicts: [],
      scenesToRegenerate: illustrations.map((i) => i.sceneNumber),
      iterationNumber,
    };
  }
  console.log(`[QA Judge] Converted ${refCount} refs + ${illustrationCount} illustrations to data URIs`);

  // Build the scene specs summary for the prompt
  const sceneSpecs = illustrations
    .map((ill) => {
      const spec = screenplay.scenes.find((s) => s.sceneNumber === ill.sceneNumber);
      return `Scene ${ill.sceneNumber}: ${spec?.keyActions || "Unknown"} | Characters: ${spec?.characters.join(", ") || "none"} | Mood: ${spec?.emotionalTone || "unknown"} | Expected: ${spec?.fluxPrompt?.slice(0, 200) || "no spec"}`;
    })
    .join("\n");

  const prompt = `You are an expert children's book editor and art director. Review these illustrations for a children's picture book.

REFERENCE IMAGES (first ${refCount} images): These are the character/object reference sheets. All illustrations must maintain visual consistency with these references.

CHARACTER DESCRIPTION: ${characterRef}

SCENE SPECIFICATIONS:
${sceneSpecs}

ILLUSTRATION IMAGES (images ${refCount + 1} to ${imageDataUris.length}): These are the scene illustrations to review, in order of scene number.

For each scene illustration, evaluate:

1. COHERENCE (1-10): Does the illustration match what the scene text describes? Are the right characters present? Is the action correct?
2. CONSISTENCY (1-10): Do the characters look like the reference images? Same proportions, colors, features?
3. QUALITY (1-10): Is it full-bleed (no white borders/margins)? No watermarks or signatures? No text baked into the image? Good composition? Appropriate for a children's book?

SCORING:
- 10 = Perfect
- 8-9 = Good, minor issues
- 6-7 = Acceptable but should improve
- 1-5 = Must regenerate

For each scene scoring below 7 overall, provide a specific "suggestion" for how to fix the prompt to get a better result.

Output JSON:
{
  "verdicts": [
    {
      "sceneNumber": 1,
      "score": 8,
      "coherenceScore": 9,
      "consistencyScore": 7,
      "qualityScore": 8,
      "issues": ["Character's hair color slightly different from reference"],
      "suggestion": ""
    }
  ]
}`;

  try {
    const raw = await callLLM(prompt, QA_MODEL, {
      json: true,
      timeoutMs: 120_000,
      images: imageDataUris,
    });

    const parsed = parseJsonResponse<{
      verdicts: QAVerdict[];
    }>(raw, "QA Judge");

    // Calculate overall score
    const verdicts = parsed.verdicts;
    const overallScore =
      verdicts.length > 0
        ? Math.round(
            (verdicts.reduce((sum, v) => sum + v.score, 0) / verdicts.length) * 10,
          ) / 10
        : 0;

    // Identify scenes needing regeneration
    const scenesToRegenerate = verdicts
      .filter((v) => v.score < SCORE_THRESHOLD)
      .map((v) => v.sceneNumber);

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(
      `[QA Judge] Review complete in ${elapsed}s — overall: ${overallScore}/10, ` +
        `${scenesToRegenerate.length} scene(s) to regenerate: [${scenesToRegenerate.join(", ")}]`,
    );

    return {
      overallScore,
      verdicts,
      scenesToRegenerate,
      iterationNumber,
    };
  } catch (err) {
    // QA failure is non-fatal — log and return all-pass
    console.error("[QA Judge] Review failed (non-fatal):", err);
    return {
      overallScore: 0,
      verdicts: [],
      scenesToRegenerate: [],
      iterationNumber,
    };
  }
}
