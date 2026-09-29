// QA judge — reviews each final illustration against the character sheet AND
// the scene's text, with OpenAI vision (same OPENAI_API_KEY as everything else;
// the old Gemini judge silently skipped whenever GEMINI_API_KEY was missing).
//
// One call per scene (sheet + scene image + text), run in parallel: a clean
// 1-to-1 mapping between verdict and image. A failing verdict carries a concrete
// fix instruction that the pipeline applies by EDITING the image (repairShot).
//
// Anatomy is inspected separately, figure by figure, on zoomed crops: judged on
// the whole picture, every model tested (gpt-5.4-mini/5.4/5.5, any resolution or
// reasoning effort) passed a printed cover whose robot had both arms coming from
// one side; the same models only see it when the figure fills the frame.

import sharp from "sharp";
import { parseJsonResponse } from "./story-generator";
import { openAIKey } from "./openai-image";
import { toServerFetchUrl } from "@/lib/storage/illustration-urls";
import { describeError, fetchWithRetry, isNetworkError } from "./net-retry";

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
  /** Hard failures that always regenerate: text in image, duplicated character, wrong gender/character, broken anatomy */
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
  /** 1–12 scene; final-book.ts also judges the cover (0) and the hero portrait (-1) */
  sceneNumber: number;
  imageUrl: string;
  /** The page text the child reads (story language); empty for the cover / hero portrait */
  text: string;
  /** What the illustration should show (English shot summary, incl. page-specific rules) */
  shot: string;
  /** Who must be in frame, e.g. ["THE CHILD", "PIP"] */
  present: string[];
  /** Recurring characters that must NOT be in frame */
  absent: string[];
}

const SCORE_THRESHOLD = 7;
const CONSISTENCY_THRESHOLD = 8;
const JUDGE_CONCURRENCY = 6;
/** Figures inspected per image (child + companions; more is noise in the background) */
const MAX_FIGURES = 4;
/** Margin around a located figure, as a fraction of the image side */
const FIGURE_PAD = 0.03;
const judgeModel = () => process.env.QA_JUDGE_MODEL || "gpt-5.4-mini";
/** Measured: gpt-5.4-mini misses broken limbs even on a zoomed crop; gpt-5.4 finds them. */
const anatomyModel = () => process.env.QA_ANATOMY_MODEL || "gpt-5.4";

type Content = ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail: "high" } })[];

async function loadImage(input: Buffer | string): Promise<Buffer> {
  if (typeof input !== "string") return input;
  const res = await fetchWithRetry(await toServerFetchUrl(input), { timeoutMs: 30_000, label: "QA image" });
  if (!res.ok) throw new Error(`QA image download failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

async function toDataUri(buf: Buffer, maxEdge: number): Promise<string> {
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
${scene.text ? `Page text (the reader sees this next to the picture): "${scene.text}"\n` : ""}
Score 1–10:
- consistencyScore: every recurring character in frame matches the sheet — same face, skin tone, hair colour AND style, eye colour, outfit, gender and apparent age. A different-looking child is 1–3.
- coherenceScore: the picture shows the moment of the page text and the shot (right action, setting, who is present). A character listed as NOT in frame that is clearly visible → coherenceScore at most 5 (name them in "issues").
- qualityScore: hand-painted watercolor look, art reaches every edge (no border/frame/white margin), no anatomy errors.
"score" = overall, weighted toward consistency and coherence.
Set "hardFail": true if ANY of: letters/words/text/signature anywhere in the image; a recurring character appears twice; the child's gender or identity is different; it copies the model-sheet layout (turnaround poses on plain paper).
"issues": short concrete problems. "fix": ONE imperative instruction that tells an illustrator exactly what to change (empty if nothing).

Return ONLY JSON: {"score":8,"consistencyScore":8,"coherenceScore":8,"qualityScore":8,"hardFail":false,"issues":[],"fix":""}`;
}

/** One JSON chat call with the retry policy of the judge (429 / 5xx / connectivity; a 90 s timeout is not repeated). */
async function callJson<T>(key: string, model: string, content: Content, label: string, effort: "low" | "medium" = "low"): Promise<T> {
  let lastErr = "";
  const body = JSON.stringify({
    model,
    reasoning_effort: effort,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content }],
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(90_000),
      });
    } catch (err) {
      // A review lost to a network blip would leave its image unreviewed (see judgeScenes).
      if (!isNetworkError(err)) throw err;
      lastErr = describeError(err);
      await new Promise((r) => setTimeout(r, 2_000 * 2 ** attempt));
      continue;
    }
    const text = await res.text();
    if (res.ok) {
      const out = (JSON.parse(text) as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? "";
      return parseJsonResponse<T>(out, label);
    }
    lastErr = `${res.status} ${text.slice(0, 200)}`;
    if (res.status !== 429 && res.status < 500) break;
    await new Promise((r) => setTimeout(r, 3_000 * (attempt + 1)));
  }
  throw new Error(`${label} failed: ${lastErr}`);
}

const image = (url: string) => ({ type: "image_url" as const, image_url: { url, detail: "high" as const } });

interface FigureBox {
  name: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface AnatomyFinding {
  name: string;
  problem: string;
  fix: string;
}

const ANATOMY_PROMPT = (name: string) => `Anatomy check of the ${name} in this crop of a children's picture-book illustration (other figures may be partly visible; judge only the ${name}).
Trace every arm and leg (and wing, tail or tentacle) back to the exact point where it joins the body, and check that every shoulder and hip joint on the body has its own limb attached.
Broken anatomy: a joint left empty while a limb grows from somewhere else (the neck, the head, the middle of the chest, right next to the other limb); two arms or two legs coming from the same side of the body; a missing, extra, fused or floating limb, hand or finger; a limb bending the wrong way.
Not broken: a limb hidden behind an object or another figure, or cut by the edge of the crop.
"fix": ONE imperative instruction for the illustrator that corrects the ${name} (empty if not broken).
Return ONLY JSON: {"broken":false,"problem":"","fix":""}`;

/** Locate the figures, then inspect each one on a zoomed crop. */
async function inspectAnatomy(key: string, buf: Buffer, uri: string, label: string): Promise<AnatomyFinding[]> {
  const located = await callJson<{ figures?: Partial<FigureBox>[] }>(
    key,
    judgeModel(),
    [
      {
        type: "text",
        text: 'List every clearly visible figure in this illustration (child, person, animal, robot, creature; skip tiny background figures). Give each a short name and a bounding box that contains its WHOLE body with all limbs, as fractions 0–1 of the image width and height. Return ONLY JSON: {"figures":[{"name":"girl","x0":0.1,"y0":0.2,"x1":0.4,"y1":0.9}]}',
      },
      image(uri),
    ],
    `${label} figures`,
  );
  const { width = 0, height = 0 } = await sharp(buf).metadata();
  const clamp = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : NaN);
  const figures = (located.figures ?? [])
    .map((f) => ({ name: String(f.name || "figure"), x0: clamp(f.x0), y0: clamp(f.y0), x1: clamp(f.x1), y1: clamp(f.y1) }))
    .filter((f) => f.x1 > f.x0 && f.y1 > f.y0)
    .slice(0, MAX_FIGURES);

  const findings = await Promise.all(
    figures.map(async (f) => {
      const left = Math.floor(Math.max(0, f.x0 - FIGURE_PAD) * width);
      const top = Math.floor(Math.max(0, f.y0 - FIGURE_PAD) * height);
      const right = Math.ceil(Math.min(1, f.x1 + FIGURE_PAD) * width);
      const bottom = Math.ceil(Math.min(1, f.y1 + FIGURE_PAD) * height);
      const crop = await sharp(buf).extract({ left, top, width: right - left, height: bottom - top }).toBuffer();
      const v = await callJson<{ broken?: unknown; problem?: unknown; fix?: unknown }>(
        key,
        anatomyModel(),
        [{ type: "text", text: ANATOMY_PROMPT(f.name) }, image(await toDataUri(crop, 1024))],
        `${label} anatomy ${f.name}`,
        "medium", // measured: low found the robot's empty shoulder 2/3 times, medium 3/3
      );
      return v.broken === true ? { name: f.name, problem: String(v.problem ?? "broken anatomy"), fix: String(v.fix ?? "") } : null;
    }),
  );
  return findings.filter((x): x is AnatomyFinding => x !== null);
}

interface ArtDirection {
  score: number;
  consistencyScore: number;
  coherenceScore: number;
  qualityScore: number;
  hardFail: boolean;
  issues: string[];
  fix: string;
}

/** The art director's call (sheet + image + brief), normalised. */
async function artDirection(key: string, sheetUri: string, imageUri: string, scene: QAScene, characters: string, label: string): Promise<ArtDirection> {
  const v = await callJson<Partial<QAVerdict>>(key, judgeModel(), [{ type: "text", text: buildPrompt(scene, characters) }, image(sheetUri), image(imageUri)], label);
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? Math.max(1, Math.min(10, x)) : 1);
  return {
    score: num(v.score),
    consistencyScore: num(v.consistencyScore),
    coherenceScore: num(v.coherenceScore),
    qualityScore: num(v.qualityScore),
    hardFail: v.hardFail === true,
    issues: Array.isArray(v.issues) ? v.issues.map(String) : [],
    fix: typeof v.fix === "string" ? v.fix.trim() : "",
  };
}

/**
 * Fails by at most one point on the soft thresholds, with no hard failure. The
 * judge's scores wobble by about a point between identical calls (measured: the
 * same map scored 6 → repair, then 8 → pass), and a repair is a $0.10–0.17 edit
 * that can also degrade a good picture, so such a call is confirmed first.
 */
function isBorderlineFail(v: ArtDirection): boolean {
  return failsQa(v) && !v.hardFail && v.score >= SCORE_THRESHOLD - 1 && v.consistencyScore >= CONSISTENCY_THRESHOLD - 1;
}

/**
 * Second opinion on a borderline fail (one extra ~$0.003 mini call): the verdict
 * is the mean of both scores, and a hard failure from either call stands. The
 * first call's issues/fix are kept (the second's are added when it saw a hard failure).
 */
function mergeOpinions(a: ArtDirection, b: ArtDirection): ArtDirection {
  const mean = (x: number, y: number) => Math.round(((x + y) / 2) * 10) / 10;
  return {
    score: mean(a.score, b.score),
    consistencyScore: mean(a.consistencyScore, b.consistencyScore),
    coherenceScore: mean(a.coherenceScore, b.coherenceScore),
    qualityScore: mean(a.qualityScore, b.qualityScore),
    hardFail: a.hardFail || b.hardFail,
    issues: b.hardFail ? [...a.issues, ...b.issues] : a.issues,
    fix: b.hardFail ? [a.fix, b.fix].filter(Boolean).join(" ") : a.fix,
  };
}

async function judgeOne(key: string, sheetUri: string, scene: QAScene, characters: string): Promise<QAVerdict> {
  const label = `QA scene ${scene.sceneNumber}`;
  const buf = await loadImage(scene.imageUrl);
  const imageUri = await toDataUri(buf, 1024);
  const [first, anatomy] = await Promise.all([
    artDirection(key, sheetUri, imageUri, scene, characters, label),
    // An anatomy inspection that cannot run leaves the main verdict standing.
    inspectAnatomy(key, buf, imageUri, label).catch((err: unknown) => {
      console.error(`[QA Judge] ${label} anatomy check skipped: ${err instanceof Error ? err.message : String(err)}`);
      return [] as AnatomyFinding[];
    }),
  ]);
  let v = first;
  // Anatomy findings are a hard fail on their own: no second opinion needed then.
  if (anatomy.length === 0 && isBorderlineFail(first)) {
    const second = await artDirection(key, sheetUri, imageUri, scene, characters, `${label} second opinion`).catch((err: unknown) => {
      console.error(`[QA Judge] ${label} second opinion failed (${err instanceof Error ? err.message : String(err)}) — first verdict stands`);
      return null;
    });
    if (second) {
      v = mergeOpinions(first, second);
      console.log(
        `[QA Judge] ${label}: borderline ${first.score}/${first.consistencyScore} → second opinion ${second.score}/${second.consistencyScore}${second.hardFail ? " HARD" : ""} → ${v.score}/${v.consistencyScore}`,
      );
    }
  }
  return {
    sceneNumber: scene.sceneNumber,
    score: v.score,
    consistencyScore: v.consistencyScore,
    coherenceScore: v.coherenceScore,
    qualityScore: anatomy.length ? 1 : v.qualityScore,
    hardFail: v.hardFail || anatomy.length > 0,
    issues: [...v.issues, ...anatomy.map((a) => `${a.name}: ${a.problem}`)],
    // Anatomy first: it is the defect the edit must not skip.
    fix: [...anatomy.map((a) => a.fix.trim()), v.fix].filter(Boolean).join(" "),
  };
}

export function failsQa(v: Pick<QAVerdict, "hardFail" | "score" | "consistencyScore">): boolean {
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
