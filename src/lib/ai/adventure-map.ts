// Adventure map (pages 28–29): an illustrated map of the story's world with an
// age-adapted search-and-find game printed on a paper panel over its right quarter.
//
//   2–4   "Where is…?"   4 things, very simple words
//   5–6   seek and find  6 things + "follow {name}'s trail" (dotted trail in story order)
//   7–12  seek and find  8 things + 3 short questions (answers printed upside down)
//
// The game is decided BEFORE the map is painted, and the map prompt lists exactly
// its items: everything the child is asked to find is in the picture. Items come
// from the frozen image plan (child, recurring cast, recurring world) plus the
// Book Plan's other story objects; their names are already in the book language
// (Book Plan `name`). ONE small LLM call picks the most findable ones, shortens the
// labels the way a child says them, and writes the 7–12 questions from the story
// text. If that call fails, a deterministic game is built from the plan names.
//
// Persisted in stories.generated_text.imageAssets.mapGame (never re-paid on resume).

import { z } from "zod";
import type { BookImagePlan } from "./book-images";
import type { GeneratedStory } from "./story-generator";
import type { ShotSpec } from "./scene-screenplay";
import { CHILD_ID } from "./visual-assets";
import { callOpenAIStructured } from "./openai-http";
import { label as promptLabel } from "./image-prompts";
import { worldLabel } from "./entity-label";

export type MapGameBand = "little" | "middle" | "big";

export interface MapGameItem {
  /** Plan id (child / cast / world / Book Plan object) or "extra-N" for a small story detail */
  id: string;
  /** Book language, completes "Where is …?" (article included, lower-case unless a name) */
  label: string;
  /** English: how it is drawn (plan description, or the LLM's for an extra) */
  drawing: string;
}

export interface MapGame {
  version: 1;
  locale: string;
  age: number;
  band: MapGameBand;
  items: MapGameItem[];
  /** Plan location ids the dotted trail visits, in story order */
  trail: string[];
  /** The trail ends where it started (the story comes home) */
  trailReturns: boolean;
  /** 5–6 only: "Follow {name}'s trail with your finger" in the book language ("" = print the generic line) */
  trailLine: string;
  /** 7–12 only */
  questions: { question: string; answer: string }[];
  source: "llm" | "fallback";
  model?: string;
}

export function mapGameBand(age: number): MapGameBand {
  if (age <= 4) return "little";
  if (age <= 6) return "middle";
  return "big";
}

export const MAP_ITEM_COUNT: Record<MapGameBand, number> = { little: 4, middle: 6, big: 8 };
const QUESTION_COUNT = 3;
const MAX_EXTRAS = 2;
const MAX_LABEL = 34;
const mapGameModel = () => process.env.MAP_GAME_MODEL || "gpt-5.4-mini";

const LANGUAGE: Record<string, { name: string; whereIs: string }> = {
  es: { name: "Spanish (Spain)", whereIs: "¿Dónde está …?" },
  ca: { name: "Catalan (Catalunya)", whereIs: "On és …?" },
  en: { name: "English", whereIs: "Where is …?" },
  fr: { name: "French (France)", whereIs: "Où est … ?" },
};

// ── Candidates ───────────────────────────────────────────────────────────────

interface Candidate {
  id: string;
  kind: "child" | "character" | "object" | "location";
  /** Book language (Book Plan name) */
  name: string;
  drawing: string;
}

function candidatesOf(plan: BookImagePlan, story: GeneratedStory, childName: string): Candidate[] {
  const out: Candidate[] = [{ id: CHILD_ID, kind: "child", name: childName, drawing: "THE CHILD (exactly as on the character sheet)" }];
  for (const c of plan.cast) out.push({ id: c.id, kind: "character", name: c.name, drawing: c.description });
  for (const w of plan.world) out.push({ id: w.id, kind: w.kind, name: w.name, drawing: w.description });
  // One-off story objects of the Book Plan (no sheet, but a canonical English look)
  for (const w of story.bookPlan?.world ?? []) {
    if (w.kind === "object" && !out.some((c) => c.id === w.id)) out.push({ id: w.id, kind: "object", name: w.name, drawing: w.visual });
  }
  return out;
}

/** Recurring locations in the order the story first visits them. */
function trailOf(plan: BookImagePlan): { trail: string[]; returns: boolean } {
  const first = (scenes: number[]) => (scenes.length ? Math.min(...scenes) : Infinity);
  const trail = plan.world
    .filter((w) => w.kind === "location")
    .sort((a, b) => first(a.scenes) - first(b.scenes))
    .map((w) => w.id);
  const lastScene = Math.max(0, ...plan.shots.map((s) => s.sceneNumber));
  const lastShot = plan.shots.find((s) => s.sceneNumber === lastScene);
  const returns = trail.length > 1 && !!lastShot?.world.includes(trail[0]) && !lastShot.world.includes(trail[trail.length - 1]);
  return { trail, returns };
}

// ── Label hygiene ────────────────────────────────────────────────────────────

function cleanLabel(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/^[\s¿¡"«“'‘]+|[\s?!.,;:"»”'’]+$/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanSentence(raw: string, max: number): string {
  const t = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  return t.length > 0 && t.length <= max ? t : "";
}

// ── LLM call ─────────────────────────────────────────────────────────────────

const GameSchema = z.object({
  items: z.array(
    z.object({
      ref: z.string().describe('A candidate id, or "new" for a small detail that appears in the story text but is not a candidate.'),
      label: z.string().describe("Book language. Completes the question stem, singular, definite article included (none before a first name except where the language requires a personal article)."),
      drawing: z.string().describe('English, only for ref "new": what to paint, one short sentence (shape, colours). Empty otherwise.'),
    }),
  ),
  trailLine: z.string().describe("Book language. Only for ages 5–6, otherwise empty."),
  questions: z.array(z.object({ question: z.string(), answer: z.string() })).describe("Only for ages 7–12, otherwise empty."),
});
type GameDraft = z.infer<typeof GameSchema>;

function buildUserPrompt(args: { candidates: Candidate[]; story: GeneratedStory; locale: string; age: number; band: MapGameBand; childName: string }): string {
  const lang = LANGUAGE[args.locale] ?? LANGUAGE.es;
  const n = MAP_ITEM_COUNT[args.band];
  const storyText = args.story.scenes.map((s) => `${s.sceneNumber}. ${s.title}\n${s.text}`).join("\n\n");
  return [
    `Book language: ${lang.name}. Reader: ${args.childName}, ${args.age} years old.`,
    `The last pages of this personalised picture book are an illustrated map of the story's world with a search-and-find game. The map is painted AFTER you choose, from your list, so everything you choose will be in the picture.`,
    `CANDIDATES (id | kind | name in the book | how it is drawn):\n${args.candidates.map((c) => `${c.id} | ${c.kind} | ${c.name} | ${c.drawing}`).join("\n")}`,
    `TASK 1 — choose exactly ${n} things to find, the most fun and recognisable for a ${args.age}-year-old, each one singular and a single concrete thing.`,
    `- Include "${CHILD_ID}" (the reader: label = the name, with the personal article where the language needs it, e.g. Catalan "la Laia", "en Pau") and the main companion if there is one.`,
    `- Never choose something that fills the whole picture (the sky, space, the sea, a forest as a whole); a place is fine only when it is a distinct landmark (a castle, a factory, a lighthouse).`,
    `- You may add up to ${MAX_EXTRAS} small details that really appear in the story text but are not candidates (ref "new", with "drawing").`,
    `- label: completes "${lang.whereIs}" naturally in the book language, as short as a child says it (${args.band === "little" ? "1–3 very simple words" : "1–4 words"}), lower-case except names, no final punctuation. Start from the book's own names (keep proper names exactly as written).`,
    args.band === "middle"
      ? `TASK 2 — trailLine: one short sentence in the book language inviting ${args.childName} to follow ${args.childName}'s dotted trail across the map with a finger (use the name, correct article/possessive for the language). Max 70 characters.`
      : `TASK 2 — trailLine: "" (empty).`,
    args.band === "big"
      ? `TASK 3 — questions: exactly ${QUESTION_COUNT} short questions about this story (what happened, why, who helped), each answerable in 1–4 words from the text; answer = those words. Max 80 characters per question. Simple, warm, never trick questions.`
      : `TASK 3 — questions: [] (empty).`,
    `STORY:\n${storyText}`,
  ].join("\n\n");
}

async function draftWithLlm(args: Parameters<typeof buildUserPrompt>[0]): Promise<{ draft: GameDraft; model: string; costUsd: number }> {
  const res = await callOpenAIStructured({
    model: mapGameModel(),
    system: "You write the search-and-find game of a premium personalised children's picture book. Native, natural, age-appropriate language. Return only the JSON asked for.",
    user: buildUserPrompt(args),
    schemaName: "map_game",
    schema: GameSchema,
    reasoningEffort: "low",
    timeoutMs: 90_000,
    label: "map game",
  });
  return { draft: res.data, model: res.model, costUsd: res.costUsd ?? 0 };
}

// ── Assembly ─────────────────────────────────────────────────────────────────

function assemble(draft: GameDraft | null, candidates: Candidate[], band: MapGameBand): Pick<MapGame, "items" | "trailLine" | "questions"> {
  const n = MAP_ITEM_COUNT[band];
  const items: MapGameItem[] = [];
  const used = new Set<string>();
  let extras = 0;
  for (const it of draft?.items ?? []) {
    if (items.length >= n) break;
    const label = cleanLabel(it.label);
    if (!label || label.length > MAX_LABEL) continue;
    if (it.ref === "new") {
      const drawing = it.drawing.trim();
      if (!drawing || extras >= MAX_EXTRAS) continue;
      items.push({ id: `extra-${++extras}`, label, drawing });
      continue;
    }
    const c = candidates.find((x) => x.id === it.ref);
    if (!c || used.has(c.id)) continue;
    used.add(c.id);
    items.push({ id: c.id, label, drawing: c.drawing });
  }
  // Top up (or the whole list when the LLM failed) from the plan, in a findable order.
  const order: Candidate["kind"][] = ["child", "character", "object", "location"];
  for (const kind of order) {
    for (const c of candidates) {
      if (items.length >= n) break;
      if (c.kind !== kind || used.has(c.id)) continue;
      const label = cleanLabel(c.name);
      if (!label || label.length > MAX_LABEL) continue;
      used.add(c.id);
      items.push({ id: c.id, label, drawing: c.drawing });
    }
  }
  const questions =
    band === "big"
      ? (draft?.questions ?? [])
          .map((q) => ({ question: cleanSentence(q.question, 110), answer: cleanLabel(q.answer) }))
          .filter((q) => q.question && q.answer && q.answer.length <= 50)
          .slice(0, QUESTION_COUNT)
      : [];
  return {
    items,
    trailLine: band === "middle" ? cleanSentence(draft?.trailLine ?? "", 90) : "",
    // All three or none: a half-filled quiz looks broken
    questions: questions.length === QUESTION_COUNT ? questions : [],
  };
}

/**
 * The map's game, in the book language. Never throws for content problems: an
 * LLM failure falls back to the plan's own names (no questions).
 */
export async function buildMapGame(args: {
  plan: BookImagePlan;
  story: GeneratedStory;
  locale: string;
  age: number;
  childName: string;
  label?: string;
}): Promise<{ game: MapGame; costUsd: number }> {
  const locale = LANGUAGE[args.locale] ? args.locale : "es";
  const band = mapGameBand(args.age);
  const candidates = candidatesOf(args.plan, args.story, args.childName);
  const { trail, returns } = trailOf(args.plan);
  let draft: GameDraft | null = null;
  let model: string | undefined;
  let costUsd = 0;
  try {
    const res = await draftWithLlm({ candidates, story: args.story, locale, age: args.age, band, childName: args.childName });
    draft = res.draft;
    model = res.model;
    costUsd = res.costUsd;
  } catch (err) {
    console.error(`[Map game] ${args.label ?? ""} LLM failed, using the plan's names: ${err instanceof Error ? err.message : String(err)}`);
  }
  const content = assemble(draft, candidates, band);
  return {
    game: { version: 1, locale, age: args.age, band, trail, trailReturns: returns, ...content, source: draft ? "llm" : "fallback", model },
    costUsd,
  };
}

// ── The map shot ─────────────────────────────────────────────────────────────

/** Shot number of the adventure map (never a scene: scenes are 1–12, cover 0, hero -1). */
export const MAP_SHOT = -2;

/**
 * The map as a ShotSpec, so it renders, is judged and repaired exactly like
 * every other image (sheet refs, identity lock, QA loop). The frame rules
 * (panel zone, fold, no text) live in image-prompts' "map" branch.
 */
export function mapShot(plan: BookImagePlan, game: MapGame): ShotSpec {
  // English labels (plan names are in the book language), like book-plan toShotSpec;
  // the world block of the prompt still describes each recurring place/object in full.
  const english = (id: string) => {
    const w = plan.world.find((x) => x.id === id);
    return `the ${w ? worldLabel(w) : id.replace(/_/g, " ")}`;
  };
  const inWorld = (id: string) => plan.world.some((w) => w.id === id);
  const castLabel = (id: string) => {
    const c = plan.cast.find((x) => x.id === id);
    return c ? promptLabel(c) : undefined;
  };
  const trailNames = game.trail.filter(inWorld).map(english);
  const trail =
    trailNames.length === 0
      ? "A dotted trail of small painted dashes winds gently across the map and ends where THE CHILD stands."
      : `A dotted trail of small painted dashes winds across the map through the places of the adventure in story order: ${trailNames.map((n, i) => (i === 0 ? `it starts at ${n}` : `then ${n}`)).join(", ")}${game.trailReturns ? `, and finally curls back to ${trailNames[0]}` : ""}. THE CHILD stands on the trail at its very end.`;
  const bare = (text: string) => text.trim().replace(/[.\s]+$/, "");
  const items = game.items.map((it, i) => {
    const what =
      it.id === CHILD_ID
        ? "THE CHILD"
        : (castLabel(it.id) ??
          (inWorld(it.id) ? english(it.id) : it.id.startsWith("extra-") ? bare(it.drawing) : `${english(it.id)} (${bare(it.drawing)})`));
    return `${i + 1}) ${what}`;
  });
  return {
    sceneNumber: MAP_SHOT,
    frame: "map",
    camera: "A gentle high three-quarter bird's-eye view of the whole world of the story, laid out like a treasured picture-book map",
    shotScale: "wide",
    action: `${trail} THE CHILD is small but clearly readable (about one eighth of the picture height), full body, smiling and waving. Search-and-find game: each of these is drawn exactly once, clearly visible and easy to recognise, never hidden or cut off, well apart from one another, none of them tiny (each at least one twelfth of the picture height): ${items.join("; ")}.`,
    setting:
      "Each place of the adventure is a small, lovingly detailed vignette, and gentle landscape that belongs to this world (hills, paths, water, clouds or stars) fills the spaces between them",
    light: "Soft, warm, even storybook light over the whole map",
    cast: [CHILD_ID, ...plan.cast.filter((c) => game.items.some((it) => it.id === c.id)).map((c) => c.id)],
    world: plan.world.filter((w) => game.trail.includes(w.id) || game.items.some((it) => it.id === w.id)).map((w) => w.id),
  };
}

/** English list of what the map must show, for the QA judge. */
export function mapChecklist(plan: BookImagePlan, game: MapGame): string {
  return game.items
    .map((it) => {
      if (it.id === CHILD_ID) return "THE CHILD";
      const cast = plan.cast.find((c) => c.id === it.id);
      if (cast) return promptLabel(cast);
      return it.drawing.trim().replace(/[.\s]+$/, "");
    })
    .join("; ");
}
