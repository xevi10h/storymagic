// QA judge — reviews each final illustration against the character sheet AND
// the scene's text, with OpenAI vision (same OPENAI_API_KEY as everything else;
// the old Gemini judge silently skipped whenever GEMINI_API_KEY was missing).
//
// One call per scene (sheet + scene image + text), run in parallel: a clean
// 1-to-1 mapping between verdict and image. A failing verdict carries a concrete
// fix instruction that the pipeline applies by EDITING the image (repairShot).

import sharp from "sharp";
import { parseJsonResponse } from "./story-generator";
import { openAIKey } from "./openai-image";

export interface QAVerdict {
  sceneNumber: number;
  /** 1–10 overall */
  score: number;
  /** Same child / companions as the sheet (face, hair, skin, outfit, gender, age) */
  consistencyScore: number;
  /** Matches the scene text and shot */
  coherenceScore: number;
  /** Watercolor look, full bleed, no text, anatomy */
  qualityScore: number;
  issues: string[];
  /** One imperative correction for the illustrator (edit instruction) */
  fix: string;
  /** Hard failures that always regenerate: text in image, duplicated character, wrong gender/character */
  hardFail: boolean;
}

export interface QAResult {
  overallScore: number;
  verdicts: QAVerdict[];
  scenesToRegenerate: number[];
  iterationNumber: number;
  /** True when the judge could not run → the book ships UNREVIEWED (callers must log loudly). */
  skipped?: boolean;
  skipReason?: string;
}

export interface QAScene {
  sceneNumber: number;
  imageUrl: string;
  /** The page text the child reads (story language) */
  text: string;
  /** What the illustration should show (English shot summary) */
  shot: string;
  /** Who must be in frame, e.g. ["THE CHILD", "PIP"] */
  present: string[];
  /** Recurring characters that must NOT be in frame */
  absent: string[];
}

const SCORE_THRESHOLD = 7;
const CONSISTENCY_THRESHOLD = 8;
const JUDGE_CONCURRENCY = 6;
const judgeModel = () => process.env.QA_JUDGE_MODEL || "gpt-5.4-mini";

async function toDataUri(input: Buffer | string, maxEdge: number): Promise<string> {
  let buf: Buffer;
  if (typeof input === "string") {
    const res = await fetch(input, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`QA image download failed (${res.status})`);
    buf = Buffer.from(await res.arrayBuffer());
  } else {
    buf = input;
  }
  const jpeg = await sharp(buf).resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

function buildPrompt(scene: QAScene, characters: string): string {
  return `You are the art director of a premium personalised children's picture book. Review ONE illustration.

The FIRST image is the character model sheet — the single source of truth for how the recurring characters look.
The SECOND image is the illustration to review.

CHARACTERS (canonical descriptions):
${characters}

This illustration must show: ${scene.shot}
Must be in frame: ${scene.present.join(", ") || "(no recurring character)"}.
Must NOT be in frame: ${scene.absent.join(", ") || "(nobody excluded)"}.
Page text (the reader sees this next to the picture): "${scene.text}"

Score 1–10:
- consistencyScore: every recurring character in frame matches the sheet — same face, skin tone, hair colour AND style, eye colour, outfit, gender and apparent age. A different-looking child is 1–3.
- coherenceScore: the picture shows the moment of the page text and the shot (right action, setting, who is present).
- qualityScore: hand-painted watercolor look, art reaches every edge (no border/frame/white margin), no anatomy errors.
"score" = overall, weighted toward consistency and coherence.
Set "hardFail": true if ANY of: letters/words/text/signature anywhere in the image; a recurring character appears twice; the child's gender or identity is different; a character listed as NOT in frame is visible; it copies the model-sheet layout (turnaround poses on plain paper).
"issues": short concrete problems. "fix": ONE imperative instruction that tells an illustrator exactly what to change (empty if nothing).

Return ONLY JSON: {"score":8,"consistencyScore":8,"coherenceScore":8,"qualityScore":8,"hardFail":false,"issues":[],"fix":""}`;
}

async function judgeOne(key: string, sheetUri: string, scene: QAScene, characters: string): Promise<QAVerdict> {
  const imageUri = await toDataUri(scene.imageUrl, 1024);
  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: judgeModel(),
        reasoning_effort: "low",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: buildPrompt(scene, characters) },
              { type: "image_url", image_url: { url: sheetUri, detail: "high" } },
              { type: "image_url", image_url: { url: imageUri, detail: "high" } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(90_000),
    });
    const text = await res.text();
    if (res.ok) {
      const content = (JSON.parse(text) as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? "";
      const v = parseJsonResponse<Partial<QAVerdict>>(content, `QA scene ${scene.sceneNumber}`);
      const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? Math.max(1, Math.min(10, x)) : 1);
      return {
        sceneNumber: scene.sceneNumber,
        score: num(v.score),
        consistencyScore: num(v.consistencyScore),
        coherenceScore: num(v.coherenceScore),
        qualityScore: num(v.qualityScore),
        hardFail: v.hardFail === true,
        issues: Array.isArray(v.issues) ? v.issues.map(String) : [],
        fix: typeof v.fix === "string" ? v.fix : "",
      };
    }
    lastErr = `${res.status} ${text.slice(0, 200)}`;
    if (res.status !== 429 && res.status < 500) break;
    await new Promise((r) => setTimeout(r, 3_000 * (attempt + 1)));
  }
  throw new Error(`QA judge failed for scene ${scene.sceneNumber}: ${lastErr}`);
}

export function failsQa(v: QAVerdict): boolean {
  return v.hardFail || v.score < SCORE_THRESHOLD || v.consistencyScore < CONSISTENCY_THRESHOLD;
}

/**
 * Judge every scene. Never throws: if the judge cannot run at all, returns
 * `skipped: true` with the reason (callers log it as a loud warning). A scene
 * whose individual review failed is left out of `verdicts` (not regenerated).
 */
export async function judgeScenes(args: {
  scenes: QAScene[];
  sheet: Buffer;
  /** "THE CHILD: …\nPIP: …" */
  characters: string;
  iterationNumber: number;
}): Promise<QAResult> {
  const { scenes, iterationNumber } = args;
  if (process.env.MOCK_MODE === "true") {
    return { overallScore: 10, verdicts: [], scenesToRegenerate: [], iterationNumber, skipped: true, skipReason: "MOCK_MODE" };
  }
  const key = openAIKey();
  if (!key) return { overallScore: 0, verdicts: [], scenesToRegenerate: [], iterationNumber, skipped: true, skipReason: "OPENAI_API_KEY missing" };

  const started = Date.now();
  try {
    const sheetUri = await toDataUri(args.sheet, 1536);
    const verdicts: QAVerdict[] = [];
    const queue = [...scenes];
    let failures = 0;
    const worker = async () => {
      for (let scene = queue.shift(); scene; scene = queue.shift()) {
        try {
          verdicts.push(await judgeOne(key, sheetUri, scene, args.characters));
        } catch (err) {
          failures++;
          console.error(`[QA Judge] ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(JUDGE_CONCURRENCY, scenes.length) }, worker));
    if (verdicts.length === 0 && scenes.length > 0) {
      return { overallScore: 0, verdicts: [], scenesToRegenerate: [], iterationNumber, skipped: true, skipReason: `all ${failures} scene reviews failed` };
    }
    verdicts.sort((a, b) => a.sceneNumber - b.sceneNumber);
    const overallScore = Math.round((verdicts.reduce((s, v) => s + v.score, 0) / verdicts.length) * 10) / 10;
    const scenesToRegenerate = verdicts.filter(failsQa).map((v) => v.sceneNumber);
    console.log(
      `[QA Judge] ${judgeModel()} pass ${iterationNumber}: ${verdicts.length}/${scenes.length} reviewed in ${((Date.now() - started) / 1000).toFixed(0)}s — overall ${overallScore}/10, regenerate [${scenesToRegenerate.join(", ")}]`,
    );
    return { overallScore, verdicts, scenesToRegenerate, iterationNumber };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { overallScore: 0, verdicts: [], scenesToRegenerate: [], iterationNumber, skipped: true, skipReason: reason };
  }
}
