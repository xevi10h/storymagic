// QA Judge — automated quality review for book illustrations
//
// Uses Gemini 2.5 Flash (vision) to score each illustration against its scene
// spec and the visual-bible reference images. Returns per-scene scores + issues.
//
// Why Gemini 2.5 Flash (not gpt-4o): ~10× cheaper on vision, handles many images
// per call, and consolidates on the same Google key already used for image work.

import { parseJsonResponse } from "./story-generator";
import type { Screenplay } from "./scene-screenplay";
import type { AssetReference } from "./visual-assets";

// ── Types ────────────────────────────────────────────────────────

export interface QAVerdict {
  sceneNumber: number;
  score: number;              // 1-10 overall
  coherenceScore: number;     // Text-image alignment (1-10)
  consistencyScore: number;   // Character/world consistency vs references (1-10)
  qualityScore: number;       // Visual quality — no borders, watermarks (1-10)
  issues: string[];           // Specific problems found
  suggestion: string;         // How to fix (for regeneration prompt)
}

export interface QAResult {
  overallScore: number;       // Average of all scene scores
  verdicts: QAVerdict[];
  scenesToRegenerate: number[];  // Scene numbers failing a threshold
  iterationNumber: number;
  /** True when the judge could not run (Gemini error/no key) → book shipped UNREVIEWED. */
  skipped?: boolean;
}

// ── Config ───────────────────────────────────────────────────────

const QA_MODEL = process.env.GEMINI_QA_MODEL || "gemini-2.5-flash";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
function geminiKey(): string {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
}

const SCORE_THRESHOLD = 7;        // overall below this → regenerate
const CONSISTENCY_THRESHOLD = 8;  // consistency is brand-critical → stricter
const MAX_REF_IMAGES = 8;         // cap reference sheets sent to the judge

// ── Image helpers ────────────────────────────────────────────────

interface InlinePart { mimeType: string; data: string }

/** Convert a base64 string / data URI / http URL into Gemini inlineData. */
async function toInline(input: string): Promise<InlinePart> {
  if (input.startsWith("data:")) {
    const m = input.match(/^data:([^;]+);base64,(.*)$/);
    if (m) return { mimeType: m[1], data: m[2] };
  }
  if (!input.startsWith("http")) return { mimeType: "image/png", data: input };
  const res = await fetch(input, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Failed to download image for QA: ${res.status} ${input.slice(0, 100)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return { mimeType: res.headers.get("content-type") || "image/png", data: buf.toString("base64") };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Main ─────────────────────────────────────────────────────────

/**
 * Review all illustrations for quality and consistency with the visual bible.
 */
export async function judgeIllustrations(
  illustrations: { sceneNumber: number; imageUrl: string }[],
  assetReferences: AssetReference[],
  screenplay: Screenplay,
  characterRef: string,
  iterationNumber = 1,
): Promise<QAResult> {
  const mockMode = process.env.MOCK_MODE === "true";
  if (mockMode || !geminiKey()) {
    if (!mockMode) console.warn("[QA Judge] No GEMINI/GOOGLE key — skipping review (all-pass)");
    return {
      overallScore: mockMode ? 10 : 0,
      verdicts: illustrations.map((ill) => ({
        sceneNumber: ill.sceneNumber, score: 10, coherenceScore: 10, consistencyScore: 10, qualityScore: 10, issues: [], suggestion: "",
      })),
      scenesToRegenerate: [],
      iterationNumber,
    };
  }

  const start = Date.now();
  console.log(`[QA Judge] Reviewing ${illustrations.length} illustrations via ${QA_MODEL} (iteration ${iterationNumber})...`);

  // Reference images first (base64 preferred, fallback to URL download)
  const parts: ({ text: string } | { inlineData: InlinePart })[] = [];
  const refs = assetReferences.slice(0, MAX_REF_IMAGES);
  const refInlines: InlinePart[] = [];
  for (const ref of refs) {
    try {
      if (ref.base64) refInlines.push({ mimeType: "image/png", data: ref.base64 });
      else if (ref.storageUrl) refInlines.push(await toInline(ref.storageUrl));
    } catch (err) {
      console.warn(`[QA Judge] Failed to load ref ${ref.assetId}:`, err);
    }
  }

  // Illustration images
  const illInlines: { sceneNumber: number; part: InlinePart }[] = [];
  for (const ill of illustrations) {
    if (!ill.imageUrl) continue;
    try {
      illInlines.push({ sceneNumber: ill.sceneNumber, part: await toInline(ill.imageUrl) });
    } catch (err) {
      console.warn(`[QA Judge] Failed to load scene ${ill.sceneNumber} image:`, err);
    }
  }

  if (illInlines.length === 0) {
    console.warn("[QA Judge] No illustration images loaded — skipping review");
    return { overallScore: 0, verdicts: [], scenesToRegenerate: illustrations.map((i) => i.sceneNumber), iterationNumber };
  }

  const refIds = refs.map((r) => r.assetId);
  const sceneSpecs = illInlines
    .map(({ sceneNumber }) => {
      const spec = screenplay.scenes.find((s) => s.sceneNumber === sceneNumber);
      const entities = [spec?.primaryCharacter, ...(spec?.characters || []), spec?.locationAsset, ...(spec?.props || [])].filter(Boolean);
      return `Scene ${sceneNumber}: ${spec?.keyActions || "?"} | Should contain entities: ${entities.join(", ") || "none"} | Mood: ${spec?.emotionalTone || "?"}`;
    })
    .join("\n");

  const prompt = `You are an expert children's book art director. Review these watercolor illustrations.

The FIRST ${refInlines.length} images are the VISUAL BIBLE reference sheets (in order: ${refIds.join(", ")}). Every illustration must keep characters, locations, wardrobe and props consistent with these references.

CHARACTER: ${characterRef}

SCENE SPECS (the following ${illInlines.length} images are the scene illustrations, in this order):
${sceneSpecs}

For EACH scene illustration rate 1-10:
1. coherenceScore: does it match the scene action + contain the expected entities?
2. consistencyScore: do the character, location, wardrobe and props match the reference sheets (same faces, colors, shapes)?
3. qualityScore: authentic watercolor children's-book look, full-bleed (no borders), no text/watermark, good composition?
"score" = overall (weighted toward consistency + coherence).
For any scene scoring low, give a concrete "suggestion" to fix the prompt.

Output ONLY JSON:
{"verdicts":[{"sceneNumber":1,"score":8,"coherenceScore":9,"consistencyScore":8,"qualityScore":8,"issues":["..."],"suggestion":""}]}`;

  // Assemble parts: prompt text, then refs, then illustrations (order matters for the spec mapping)
  parts.push({ text: prompt });
  for (const r of refInlines) parts.push({ inlineData: r });
  for (const { part } of illInlines) parts.push({ inlineData: part });

  try {
    // Call Gemini with retry on transient overload (503/429)
    let res: Response | undefined, lastTxt = "";
    for (let attempt = 0; attempt < 4; attempt++) {
      res = await fetch(`${GEMINI_BASE}/${QA_MODEL}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey() },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ["TEXT"], temperature: 0 } }),
        signal: AbortSignal.timeout(120_000),
      });
      if (res.ok) break;
      lastTxt = await res.text();
      if (res.status === 503 || res.status === 429) { await sleep(5000 * (attempt + 1)); continue; }
      break;
    }
    if (!res || !res.ok) throw new Error(`Gemini QA ${res?.status}: ${lastTxt}`);

    const j = await res.json();
    const text = (j.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || "").join("");
    const parsed = parseJsonResponse<{ verdicts: QAVerdict[] }>(text, "QA Judge");
    const verdicts = parsed.verdicts || [];

    const overallScore = verdicts.length
      ? Math.round((verdicts.reduce((s, v) => s + v.score, 0) / verdicts.length) * 10) / 10
      : 0;

    // Fail a scene if overall is low OR consistency (brand-critical) is below its stricter bar.
    const scenesToRegenerate = verdicts
      .filter((v) => v.score < SCORE_THRESHOLD || v.consistencyScore < CONSISTENCY_THRESHOLD)
      .map((v) => v.sceneNumber);

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[QA Judge] Done in ${elapsed}s — overall ${overallScore}/10, regenerate: [${scenesToRegenerate.join(", ")}]`);

    return { overallScore, verdicts, scenesToRegenerate, iterationNumber };
  } catch (err) {
    // QA failure is non-fatal — but the book then ships WITHOUT any review.
    // Surface it loudly (skipped:true) so the caller can flag/alert instead of
    // silently treating it as "all scenes passed".
    console.error(`[QA Judge] ⚠️ REVIEW SKIPPED — book will ship UNREVIEWED (iteration ${iterationNumber}):`, err);
    return { overallScore: 0, verdicts: [], scenesToRegenerate: [], iterationNumber, skipped: true };
  }
}
