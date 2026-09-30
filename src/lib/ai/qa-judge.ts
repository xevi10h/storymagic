// QA judge — reviews each final illustration against the character sheet(s) AND
// what the page says, with OpenAI vision (same OPENAI_API_KEY as everything else).
//
// Design (2026-09-30 rework, measured on scripts/qa-eval — recall 2/12 → see
// docs/generation-pipeline.md): the old single holistic call answered 9/9/9 for
// almost everything, with the issues it did notice not affecting pass/fail. Now
// pass/fail is decided in CODE from explicit, per-check answers:
//
//   1. CLAIMS (text only, no image): the page text + illustrated moment → a short
//      list of concrete, checkable visual facts ("the whale is asleep", "Miga, the
//      head cook, is a woman", "the toy lies next to the pillow"). Written before
//      anyone looks at the picture, so the verifier cannot rationalise the image.
//   2. VERIFY (vision, strict JSON schema): each claim → shown / contradicted /
//      cannot tell; each recurring character → how many times it appears; child
//      identity; lettering; sheet layout copied; impossible scene logic.
//   3. ANATOMY: every figure located, cropped at full resolution and its limbs
//      COUNTED (arms, hands, legs, fins/flippers/wings) by the stronger model.
//      Judged on the whole picture, every model tested passed a robot with both
//      arms on one side and a child with a third hand; on the crop they see it.
//
// A failing verdict carries one concrete fix that the pipeline applies by editing
// the image (repairShot).

import sharp from "sharp";
import { parseJsonResponse } from "./story-generator";
import { openAIKey } from "./openai-image";
import { estimateCostUsd } from "./openai-http";
import { toServerFetchUrl } from "@/lib/storage/illustration-urls";
import { describeError, fetchWithRetry, isNetworkError } from "./net-retry";

export interface QAVerdict {
  sceneNumber: number;
  /** 1–10 overall; capped at 5 by any failed check (see verdictFrom) */
  score: number;
  /** Same child / companions as the sheet (face, hair, skin, outfit, gender, age) */
  consistencyScore: number;
  /** Matches the page text and shot */
  coherenceScore: number;
  /** Watercolor look, full bleed, no text, anatomy */
  qualityScore: number;
  issues: string[];
  /** One imperative correction for the illustrator (edit instruction) */
  fix: string;
  /** Hard failures: text in image, duplicated character, wrong gender/character, sheet layout, broken anatomy */
  hardFail: boolean;
}

export interface QAResult {
  overallScore: number;
  verdicts: QAVerdict[];
  scenesToRegenerate: number[];
  iterationNumber: number;
  /** Judge spend of this call (all models), from the API usage */
  costUsd?: number;
  /** True when the judge could not run → the book ships UNREVIEWED (callers must log loudly). */
  skipped?: boolean;
  skipReason?: string;
}

export interface QAScene {
  /** 1–12 scene; final-book.ts also judges the cover (0), the hero portrait (-1) and the map (-2) */
  sceneNumber: number;
  imageUrl: string;
  /** The page text the child reads (story language); empty for the cover / hero portrait / map */
  text: string;
  /** English: the exact moment of the page the picture shows (Book Plan illustratedMoment) */
  moment?: string;
  /** What the illustration should show (English shot summary, incl. page-specific rules) */
  shot: string;
  /** Things the picture must show that are not in the page text (e.g. the map's search-and-find items) */
  mustShow?: string[];
  /** Who must be in frame, e.g. ["THE CHILD", "PIP"] */
  present: string[];
  /** Recurring characters that must NOT be in frame */
  absent: string[];
}

const SCORE_THRESHOLD = 7;
const CONSISTENCY_THRESHOLD = 8;
/** Any failed check caps the overall score here (below SCORE_THRESHOLD → repair). */
const FAILED_CHECK_SCORE = 5;
const JUDGE_CONCURRENCY = 6;
/** Figures inspected per image (child + companions; more is noise in the background) */
const MAX_FIGURES = 4;
/** Margin around a located figure, as a fraction of the image side */
const FIGURE_PAD = 0.03;
/**
 * gpt-5.4 family `detail: "high"`: ≤ 2048 px per side and ≤ 2,500 patches of
 * 32 px (developers.openai.com/api/docs/guides/images-vision). We resize to that
 * budget ourselves so small details (an open eye on a far whale, a third hand)
 * survive: the old 1024 px downscale threw away 60 % of a 2432² page.
 */
const MAX_PATCHES = 2500;
const MAX_EDGE = 2048;
/** References (sheets) and per-figure crops: a figure crop is already zoomed, 1024 px was enough to count limbs. */
const REF_EDGE = 1536;
const CROP_EDGE = 1024;
const judgeModel = () => process.env.QA_JUDGE_MODEL || "gpt-5.4-mini";
/** Measured: gpt-5.4-mini misses broken limbs even on a zoomed crop; gpt-5.4 finds them. */
const anatomyModel = () => process.env.QA_ANATOMY_MODEL || "gpt-5.4";

type Content = ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail: "high" } })[];

/** Accumulates the judge's spend (from each response's usage). */
interface Meter {
  costUsd: number;
}

async function loadImage(input: Buffer | string): Promise<Buffer> {
  if (typeof input !== "string") return input;
  const res = await fetchWithRetry(await toServerFetchUrl(input), { timeoutMs: 30_000, label: "QA image" });
  if (!res.ok) throw new Error(`QA image download failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

/** JPEG data URI within `maxEdge` and the model's high-detail patch budget (never enlarged). */
async function toDataUri(buf: Buffer, maxEdge = MAX_EDGE): Promise<string> {
  const { width = 1, height = 1 } = await sharp(buf).metadata();
  let scale = Math.min(1, maxEdge / Math.max(width, height));
  // Largest scale whose 32 px patch grid fits the budget.
  while (Math.ceil((width * scale) / 32) * Math.ceil((height * scale) / 32) > MAX_PATCHES) scale *= 0.98;
  const w = Math.max(1, Math.floor(width * scale));
  const h = Math.max(1, Math.floor(height * scale));
  const jpeg = await sharp(buf).resize(w, h, { fit: "fill" }).jpeg({ quality: 88 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

const image = (url: string) => ({ type: "image_url" as const, image_url: { url, detail: "high" as const } });

/**
 * One strict-schema chat call with the judge's retry policy (429 / 5xx /
 * connectivity; a 90 s timeout is not repeated). Its cost is added to `meter`.
 */
async function callJson<T>(
  key: string,
  model: string,
  content: Content,
  schema: { name: string; schema: object },
  label: string,
  meter: Meter,
  effort: "low" | "medium" = "low",
): Promise<T> {
  let lastErr = "";
  const body = JSON.stringify({
    model,
    reasoning_effort: effort,
    response_format: { type: "json_schema", json_schema: { name: schema.name, strict: true, schema: schema.schema } },
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
      const json = JSON.parse(text) as {
        model?: string;
        choices?: { message?: { content?: string; refusal?: string | null } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } };
      };
      const u = json.usage ?? {};
      meter.costUsd +=
        estimateCostUsd(json.model ?? model, {
          inputTokens: u.prompt_tokens ?? 0,
          cachedInputTokens: u.prompt_tokens_details?.cached_tokens ?? 0,
          outputTokens: u.completion_tokens ?? 0,
          reasoningTokens: 0,
        }) ?? 0;
      const message = json.choices?.[0]?.message;
      if (message?.refusal) throw new Error(`${label} refused: ${message.refusal}`);
      return parseJsonResponse<T>(message?.content ?? "", label);
    }
    lastErr = `${res.status} ${text.slice(0, 200)}`;
    if (res.status !== 429 && res.status < 500) break;
    await new Promise((r) => setTimeout(r, 3_000 * (attempt + 1)));
  }
  throw new Error(`${label} failed: ${lastErr}`);
}

// Strict-schema helpers (every property required, no additional properties).
const str = { type: "string" } as const;
const bool = { type: "boolean" } as const;
const int = { type: "integer" } as const;
function obj(properties: Record<string, object>) {
  return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
}
const arr = (items: object) => ({ type: "array", items });

// ── 1. Claims: what the picture must show, from the words alone ──────────────

export interface Claim {
  claim: string;
  quote: string;
  /** Must be visible (the map's search-and-find items): "not_shown" fails too */
  required?: boolean;
}

/**
 * Kinds of fact a picture must honour literally. A pose or motion ("running")
 * is left to the illustrator's staging, so "action" facts are extracted (to keep
 * them out of the other kinds) but never checked.
 */
const CHECKED_KINDS = ["who_and_how_many", "gender", "state", "holding_or_wearing", "object_position", "place"] as const;
type ClaimKind = (typeof CHECKED_KINDS)[number] | "action";

interface RawClaim extends Claim {
  kind: ClaimKind;
  /** True only if the fact still holds at the illustrated moment (not before/after it on the page) */
  holdsAtMoment: boolean;
}

const CLAIMS_SCHEMA = {
  name: "page_claims",
  schema: obj({
    claims: arr(obj({ claim: str, quote: str, kind: { type: "string", enum: [...CHECKED_KINDS, "action"] }, holdsAtMoment: bool })),
  }),
};

function claimsPrompt(scene: QAScene, characters: string): string {
  return `You prepare the checklist an art director uses to review ONE illustration of a children's picture book. You do NOT see the picture.

PAGE TEXT (book language, the reader sees it next to the picture):
"""${scene.text}"""
${scene.moment ? `THE PICTURE SHOWS THIS MOMENT OF THE PAGE: ${scene.moment}\n` : ""}
CHARACTERS (canonical looks):
${characters}

List the concrete visual facts that MUST be true in a picture of that moment, according to the page text. Include only facts the text states or unmistakably implies, that a viewer could check by looking:
- who is there and how many (e.g. "three squirrels");
- the gender of every named or described person the text refers to with gendered words (e.g. "la maestra Miga" → "Miga, the cook, is a woman");
- states that still hold at that moment (asleep → eyes closed; wet; broken; lit or dark; open or closed);
- what someone holds, wears (incl. bare feet or socks) or does, and where an object is when the text says so (e.g. "the toy dinosaur lies next to the pillow");
- where the scene takes place (e.g. "they are inside the lighthouse's lamp room").
Skip feelings, sounds, smells, dialogue content, habits, and anything about the protagonist's usual look (the sheet covers it). Write each fact in English, short and checkable, with the exact words of the text it comes from in "quote".
"kind": who_and_how_many | gender | state | holding_or_wearing | object_position | place | action (a pose or movement).
"holdsAtMoment": true only if the fact is still true at the moment the picture shows; false for what happens earlier or later on the page and has changed by then.
At most 8 facts; none if the text gives nothing checkable.`;
}

async function extractClaims(key: string, scene: QAScene, characters: string, label: string, meter: Meter): Promise<Claim[]> {
  if (!scene.text.trim()) return [];
  const out = await callJson<{ claims: RawClaim[] }>(key, judgeModel(), [{ type: "text", text: claimsPrompt(scene, characters) }], CLAIMS_SCHEMA, `${label} claims`, meter);
  return out.claims
    .filter((c) => c.claim.trim() && c.holdsAtMoment && (CHECKED_KINDS as readonly string[]).includes(c.kind))
    .map(({ claim, quote }) => ({ claim, quote }))
    .slice(0, 8);
}

// ── 2. Verify: per-check answers on the picture ──────────────────────────────

export interface Verification {
  claims: { index: number; verdict: "shown" | "not_shown" | "contradicted"; evidence: string; obvious: boolean }[];
  characters: { name: string; visible: boolean; sameIndividualTwice: boolean }[];
  insideOf: string;
  insideOfAlsoVisibleOutside: boolean;
  childSameAsSheet: boolean;
  childGenderMatches: boolean;
  textInImage: boolean;
  sheetLayoutCopied: boolean;
  impossibleScene: string[];
  consistencyScore: number;
  coherenceScore: number;
  qualityScore: number;
  fix: string;
}

const VERIFY_SCHEMA = {
  name: "illustration_review",
  schema: obj({
    claims: arr(obj({ index: int, verdict: { type: "string", enum: ["shown", "not_shown", "contradicted"] }, evidence: str, obvious: bool })),
    characters: arr(obj({ name: str, visible: bool, sameIndividualTwice: bool })),
    insideOf: str,
    insideOfAlsoVisibleOutside: bool,
    childSameAsSheet: bool,
    childGenderMatches: bool,
    textInImage: bool,
    sheetLayoutCopied: bool,
    impossibleScene: arr(str),
    consistencyScore: int,
    coherenceScore: int,
    qualityScore: int,
    fix: str,
  }),
};

function verifyPrompt(scene: QAScene, claims: string[], characters: string, sheets: number): string {
  const named = [...new Set([...scene.present, ...scene.absent])];
  const sheetLine =
    sheets === 2
      ? "The FIRST and SECOND images are character model sheets — the single source of truth for how the recurring characters look. The THIRD image is the illustration to review."
      : "The FIRST image is the character model sheet — the single source of truth for how the recurring characters look. The SECOND image is the illustration to review.";
  return `You are the art director of a premium personalised children's picture book, reviewing ONE illustration before it is printed. Be exact: parents notice every mistake.
${sheetLine}

CHARACTERS (canonical descriptions):
${characters}

The illustration should show: ${scene.shot}
${scene.text ? `Page text (book language): """${scene.text}"""\n` : ""}
Answer every check from what is actually painted:
1. "claims": for EACH numbered fact below, "shown" (the picture agrees), "not_shown" (not in view, hidden, too small or left out: a picture need not show everything), or "contradicted" (the picture shows something INCOMPATIBLE with it: open eyes for someone asleep, a man for a woman, the object held by someone else or lying somewhere else, a different number). "evidence": what you see. "obvious": a parent reading the page next to the picture would clearly notice the contradiction (false for "shown"/"not_shown" and for doubtful cases).
${claims.length ? claims.map((c, i) => `   ${i}. ${c}`).join("\n") : "   (no facts to check)"}
2. "characters": one entry for each of ${named.length ? named.join(", ") : "(none)"}. "visible": the character itself is in the picture (a toy, poster or drawing of a similar creature is not the character). "sameIndividualTwice": that same individual is painted twice in the one picture (a group such as the cooks or three squirrels is one entry: several members is normal, not a duplicate).
   "insideOf": the landmark building, vehicle or structure the characters are inside ("" if outdoors or in an ordinary room). "insideOfAlsoVisibleOutside": that same structure, or an identical-looking one of the same kind, is ALSO painted outside through a window or in the distance (e.g. inside a lighthouse, a lighthouse outside; inside a rocket, the rocket outside). Ordinary houses, trees or hills outside do not count.
3. "childSameAsSheet": THE CHILD (if in the picture) is recognisably the child of the sheet — face, skin tone, hair colour and style, eye colour, glasses, outfit. "childGenderMatches": the child reads as the sheet's gender. Both true when the child is absent.
4. "textInImage": any letters, words, numbers or signature anywhere. "sheetLayoutCopied": the picture copies the model sheet (turnaround poses on plain paper).
5. "impossibleScene": physically or logically impossible things, each as a short sentence (e.g. the building the characters are inside also visible outside its own window; the same unique landmark or object twice; one object in two places at once). Magic that the story itself describes is not impossible. Empty if none.
6. Scores 1–10: consistencyScore (recurring characters match the sheets), coherenceScore (the picture tells this page), qualityScore (hand-painted watercolor, art to every edge).
7. "fix": ONE imperative instruction that tells an illustrator exactly what to change to solve every problem you found (empty if none). If a figure holds something with a hand it does not have, say which object to remove.`;
}

// ── 3. Anatomy: limbs counted on zoomed per-figure crops ─────────────────────

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

const LOCATE_SCHEMA = {
  name: "figures",
  schema: obj({ figures: arr(obj({ name: str, x0: { type: "number" }, y0: { type: "number" }, x1: { type: "number" }, y1: { type: "number" } })) }),
};

const LIMBS_SCHEMA = {
  name: "limb_count",
  schema: obj({
    bodyPlan: str,
    arms: int,
    hands: int,
    legs: int,
    finsWingsFlippers: int,
    expectedArms: int,
    expectedHands: int,
    expectedLegs: int,
    expectedFinsWingsFlippers: int,
    broken: bool,
    problem: str,
    fix: str,
  }),
};

interface LimbCount {
  bodyPlan: string;
  arms: number;
  hands: number;
  legs: number;
  finsWingsFlippers: number;
  expectedArms: number;
  expectedHands: number;
  expectedLegs: number;
  expectedFinsWingsFlippers: number;
  broken: boolean;
  problem: string;
  fix: string;
}

const LIMBS_PROMPT = (name: string) => `Anatomy check of the ${name} in this crop of a children's picture-book illustration (other figures may be partly visible; judge only the ${name}).
"bodyPlan": what it is and its normal limbs (e.g. "human child: 2 arms, 2 hands, 2 legs"; "dolphin: 2 pectoral flippers, 1 dorsal fin, 1 tail fluke, no arms"; "long-necked dinosaur: 4 legs, no arms").
Count what is PAINTED for this ${name}: every arm, every hand (including hands holding an object, and hands in front of the face), every leg, every fin/wing/flipper. Trace each one back to where it joins the body: a hand whose arm cannot be traced to its own shoulder still counts as a hand. The "expected…" fields are the normal numbers for this body plan that could be visible from this angle.
Broken anatomy: more limbs or hands than the body plan has (a third hand, an extra flipper or an arm-like flipper on a sea animal); two arms or two legs coming from the same side; a joint left empty while a limb grows from somewhere else; a fused, floating or backwards-bending limb.
Not broken: a limb hidden behind an object or another figure, or cut by the edge of the crop (count only what is painted).
"fix": ONE imperative instruction for the illustrator that corrects the ${name} (empty if not broken); when an extra hand holds an object, say to remove that hand AND the object it holds.`;

/** Deterministic reading of a limb count: extra limbs are broken even when the model's own "broken" says no. */
function limbProblem(c: LimbCount): string | null {
  const extra: string[] = [];
  if (c.arms > c.expectedArms) extra.push(`${c.arms} arms (expected ${c.expectedArms})`);
  if (c.hands > c.expectedHands) extra.push(`${c.hands} hands (expected ${c.expectedHands})`);
  if (c.legs > c.expectedLegs) extra.push(`${c.legs} legs (expected ${c.expectedLegs})`);
  if (c.finsWingsFlippers > c.expectedFinsWingsFlippers) extra.push(`${c.finsWingsFlippers} fins/wings/flippers (expected ${c.expectedFinsWingsFlippers})`);
  if (extra.length) return `${extra.join(", ")}${c.problem ? ` — ${c.problem}` : ""}`;
  return c.broken ? c.problem || "broken anatomy" : null;
}

/** Locate the figures, then count each one's limbs on a zoomed full-resolution crop. */
async function inspectAnatomy(key: string, buf: Buffer, uri: string, label: string, meter: Meter): Promise<AnatomyFinding[]> {
  const located = await callJson<{ figures: FigureBox[] }>(
    key,
    judgeModel(),
    [
      {
        type: "text",
        text: 'List every clearly visible figure in this illustration (child, person, animal, robot, creature; also a toy or plush held by someone; skip tiny background figures), most prominent first. Give each a short name and a bounding box that contains its WHOLE body with every limb, fin, wing and tail, as fractions 0–1 of the image width and height.',
      },
      image(uri),
    ],
    LOCATE_SCHEMA,
    `${label} figures`,
    meter,
  );
  const { width = 0, height = 0 } = await sharp(buf).metadata();
  const clamp = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : NaN);
  const figures = located.figures
    .map((f) => ({ name: f.name || "figure", x0: clamp(f.x0), y0: clamp(f.y0), x1: clamp(f.x1), y1: clamp(f.y1) }))
    .filter((f) => f.x1 > f.x0 && f.y1 > f.y0)
    .slice(0, MAX_FIGURES);

  const findings = await Promise.all(
    figures.map(async (f) => {
      const left = Math.floor(Math.max(0, f.x0 - FIGURE_PAD) * width);
      const top = Math.floor(Math.max(0, f.y0 - FIGURE_PAD) * height);
      const right = Math.ceil(Math.min(1, f.x1 + FIGURE_PAD) * width);
      const bottom = Math.ceil(Math.min(1, f.y1 + FIGURE_PAD) * height);
      const crop = await sharp(buf).extract({ left, top, width: right - left, height: bottom - top }).toBuffer();
      const c = await callJson<LimbCount>(
        key,
        anatomyModel(),
        [{ type: "text", text: LIMBS_PROMPT(f.name) }, image(await toDataUri(crop, CROP_EDGE))],
        LIMBS_SCHEMA,
        `${label} anatomy ${f.name}`,
        meter,
        "medium", // measured: low found the robot's empty shoulder 2/3 times, medium 3/3
      );
      const problem = limbProblem(c);
      return problem ? { name: f.name, problem, fix: c.fix.trim() || `Correct the ${f.name}'s anatomy: ${problem}.` } : null;
    }),
  );
  return findings.filter((x): x is AnatomyFinding => x !== null);
}

// ── Verdict ──────────────────────────────────────────────────────────────────

interface ArtDirection {
  score: number;
  consistencyScore: number;
  coherenceScore: number;
  qualityScore: number;
  hardFail: boolean;
  issues: string[];
  fix: string;
}

const clampScore = (x: number) => (Number.isFinite(x) ? Math.max(1, Math.min(10, Math.round(x))) : 1);

/**
 * Pass/fail from the per-check answers — never from the model's own overall
 * impression. Hard: lettering, sheet layout, a recurring character twice, a
 * different child. Soft (repairable by an edit): a contradicted fact, an
 * excluded character in frame, a required one missing, impossible scene logic.
 */
export function verdictFrom(scene: QAScene, claims: Claim[], v: Verification): ArtDirection {
  const issues: string[] = [];
  let hard = false;
  let soft = false;
  const hardFail = (issue: string) => {
    hard = true;
    issues.push(issue);
  };
  const softFail = (issue: string) => {
    soft = true;
    issues.push(issue);
  };
  const norm = (s: string) => s.trim().toUpperCase();
  const entry = (name: string) => v.characters.find((c) => norm(c.name) === norm(name));
  const childInFrame = scene.present.includes("THE CHILD");

  if (v.textInImage) hardFail("letters/text in the image");
  if (v.sheetLayoutCopied) hardFail("copies the model-sheet layout");
  if (childInFrame && !v.childSameAsSheet) hardFail("THE CHILD does not match the sheet");
  if (childInFrame && !v.childGenderMatches) hardFail("THE CHILD's gender differs from the sheet");
  for (const name of scene.present) {
    const e = entry(name);
    if (e?.sameIndividualTwice) hardFail(`${name} appears twice`);
    if (e && !e.visible) softFail(`${name} must be in the picture but is missing`);
  }
  for (const name of scene.absent) if (entry(name)?.visible) softFail(`${name} must NOT be in the picture but is visible`);
  if (v.insideOf.trim() && v.insideOfAlsoVisibleOutside) softFail(`impossible scene: inside the ${v.insideOf.trim()}, yet it is also visible outside`);
  for (const c of v.claims) {
    const claim = claims[c.index];
    if (!claim) continue;
    if (claim.required && c.verdict !== "shown") softFail(`missing: ${claim.quote} — ${c.evidence}`);
    else if (c.verdict === "contradicted" && c.obvious) softFail(`contradicts the text ("${claim.quote}"): ${claim.claim} — ${c.evidence}`);
  }
  for (const s of v.impossibleScene) if (s.trim()) softFail(`impossible scene: ${s.trim()}`);

  const consistencyScore = clampScore(v.consistencyScore);
  const coherenceScore = clampScore(v.coherenceScore);
  const qualityScore = clampScore(v.qualityScore);
  const mean = Math.round((consistencyScore * 2 + coherenceScore * 2 + qualityScore) / 5);
  return {
    score: hard || soft ? Math.min(FAILED_CHECK_SCORE, mean) : mean,
    consistencyScore,
    coherenceScore: soft ? Math.min(FAILED_CHECK_SCORE, coherenceScore) : coherenceScore,
    qualityScore,
    hardFail: hard,
    issues,
    fix: v.fix.trim(),
  };
}

async function artDirection(key: string, sheetUris: string[], imageUri: string, scene: QAScene, claims: Claim[], characters: string, label: string, meter: Meter): Promise<ArtDirection> {
  const claimLines = [...claims.map((c) => c.claim), ...(scene.mustShow ?? []).map((m) => `${m} is clearly visible and recognisable`)];
  const all: Claim[] = [...claims, ...(scene.mustShow ?? []).map((m) => ({ claim: `${m} is clearly visible and recognisable`, quote: m, required: true }))];
  const v = await callJson<Verification>(
    key,
    judgeModel(),
    [{ type: "text", text: verifyPrompt(scene, claimLines, characters, sheetUris.length) }, ...sheetUris.map(image), image(imageUri)],
    VERIFY_SCHEMA,
    label,
    meter,
  );
  return verdictFrom(scene, all, v);
}

/**
 * Fails only on the consistency score, by one point, with no failed check. The
 * judge's scores wobble by about a point between identical calls, and a repair
 * is a $0.10–0.17 edit that can also degrade a good picture, so such a call is
 * confirmed first.
 */
function isBorderlineFail(v: ArtDirection): boolean {
  return failsQa(v) && !v.hardFail && v.issues.length === 0 && v.consistencyScore === CONSISTENCY_THRESHOLD - 1;
}

async function judgeOne(key: string, sheetUris: string[], scene: QAScene, characters: string, meter: Meter): Promise<QAVerdict> {
  const label = `QA scene ${scene.sceneNumber}`;
  const buf = await loadImage(scene.imageUrl);
  const imageUri = await toDataUri(buf);
  const [first, anatomy] = await Promise.all([
    extractClaims(key, scene, characters, label, meter).then((claims) => artDirection(key, sheetUris, imageUri, scene, claims, characters, label, meter)),
    // An anatomy inspection that cannot run leaves the main verdict standing.
    inspectAnatomy(key, buf, imageUri, label, meter).catch((err: unknown) => {
      console.error(`[QA Judge] ${label} anatomy check skipped: ${err instanceof Error ? err.message : String(err)}`);
      return [] as AnatomyFinding[];
    }),
  ]);
  let v = first;
  if (anatomy.length === 0 && isBorderlineFail(first)) {
    const second = await extractClaims(key, scene, characters, label, meter)
      .then((claims) => artDirection(key, sheetUris, imageUri, scene, claims, characters, `${label} second opinion`, meter))
      .catch((err: unknown) => {
        console.error(`[QA Judge] ${label} second opinion failed (${err instanceof Error ? err.message : String(err)}) — first verdict stands`);
        return null;
      });
    if (second) {
      v = second.issues.length || second.hardFail ? second : { ...first, consistencyScore: Math.max(first.consistencyScore, second.consistencyScore) };
      console.log(`[QA Judge] ${label}: borderline consistency ${first.consistencyScore} → second opinion ${second.consistencyScore} → ${v.consistencyScore}`);
    }
  }
  return {
    sceneNumber: scene.sceneNumber,
    score: anatomy.length ? Math.min(FAILED_CHECK_SCORE, v.score) : v.score,
    consistencyScore: v.consistencyScore,
    coherenceScore: v.coherenceScore,
    qualityScore: anatomy.length ? 1 : v.qualityScore,
    hardFail: v.hardFail || anatomy.length > 0,
    issues: [...anatomy.map((a) => `${a.name}: ${a.problem}`), ...v.issues],
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
  /** The second sheet (companions 3–5), when the book has one */
  extraSheet?: Buffer | null;
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
  const meter: Meter = { costUsd: 0 };
  try {
    const sheetUris = await Promise.all([args.sheet, ...(args.extraSheet ? [args.extraSheet] : [])].map((b) => toDataUri(b, REF_EDGE)));
    const verdicts: QAVerdict[] = [];
    const queue = [...scenes];
    let failures = 0;
    const worker = async () => {
      for (let scene = queue.shift(); scene; scene = queue.shift()) {
        try {
          verdicts.push(await judgeOne(key, sheetUris, scene, args.characters, meter));
        } catch (err) {
          failures++;
          console.error(`[QA Judge] ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(JUDGE_CONCURRENCY, scenes.length) }, worker));
    const costUsd = Math.round(meter.costUsd * 10000) / 10000;
    if (verdicts.length === 0 && scenes.length > 0) {
      return { overallScore: 0, verdicts: [], scenesToRegenerate: [], iterationNumber, costUsd, skipped: true, skipReason: `all ${failures} scene reviews failed` };
    }
    verdicts.sort((a, b) => a.sceneNumber - b.sceneNumber);
    const overallScore = Math.round((verdicts.reduce((s, v) => s + v.score, 0) / verdicts.length) * 10) / 10;
    const scenesToRegenerate = verdicts.filter(failsQa).map((v) => v.sceneNumber);
    console.log(
      `[QA Judge] ${judgeModel()}+${anatomyModel()} pass ${iterationNumber}: ${verdicts.length}/${scenes.length} reviewed in ${((Date.now() - started) / 1000).toFixed(0)}s, $${costUsd.toFixed(3)} — overall ${overallScore}/10, regenerate [${scenesToRegenerate.join(", ")}]`,
    );
    return { overallScore, verdicts, scenesToRegenerate, iterationNumber, costUsd };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { overallScore: 0, verdicts: [], scenesToRegenerate: [], iterationNumber, costUsd: meter.costUsd, skipped: true, skipReason: reason };
  }
}
