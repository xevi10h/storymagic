// Book Plan — the single source of truth for a book's text AND its images.
//
// ONE structured LLM call writes the whole manuscript in the target locale from
// the parent's story-tree path, together with the shot plan (cast, world
// assets and per-scene shot fields). Text and illustrations therefore come from
// the same object: the screenplay / image prompt assembly consumes the shots,
// the book viewer and PDF consume the text.
//
// Quality is enforced structurally, not by prompt wording:
//   - zod schema → OpenAI Structured Outputs (strict json_schema)
//   - deterministic checks: per-slot word budget (sized to the printed page),
//     sentence length for young readers, grammatical gender agreement with the
//     child's `gender`, Catalan personal article, refrain presence (2–4 mode),
//     id integrity between shots and the cast/world bible
//   - targeted repair: only offending scenes are rewritten, with the full
//     manuscript as context so the voice holds; re-checked, max 2 rounds
//   - the parent's dedication is never sent for rewriting: it is copied verbatim
//
// Plan modes are chosen by age: refrain (2–4, read-aloud rhythmic pattern),
// picture (5–6), chapter (7–9), literary (10–12).

import { z } from "zod";
import {
  getTemplateConfig,
  getEndingNarrative,
  getDecisionNarrative,
  getAtmosphereNarrative,
  FAVORITE_COLORS,
  type TreeChoice,
} from "@/lib/create-store";
import { getStoryTree, tx } from "@/lib/story-trees";
import { buildCharacterVisualDescription } from "./character-description";
import { callOpenAIStructured, type LLMUsage, type ReasoningEffort } from "./openai-http";
import type { StoryInput, GeneratedStory, GeneratedScene, ArchitectOutput } from "./story-generator";
import type { CastMember, VisualCast, WorldAsset } from "./visual-assets";
import type { ShotFrame, ShotList, ShotSpec } from "./scene-screenplay";

// ── Models (env-configurable) ────────────────────────────────────────────────

/** Writes the whole book in one call. Literary quality in ca/es/fr matters more than cost (1 call/book). */
export const BOOK_PLAN_MODEL = process.env.OPENAI_BOOK_PLAN_MODEL || "gpt-5.5";
export const BOOK_PLAN_REASONING = (process.env.OPENAI_BOOK_PLAN_REASONING || "low") as ReasoningEffort;
/** Rewrites only the scenes that failed a deterministic check. Same model by default so the voice matches. */
export const BOOK_REPAIR_MODEL = process.env.OPENAI_BOOK_REPAIR_MODEL || BOOK_PLAN_MODEL;
export const BOOK_REPAIR_REASONING = (process.env.OPENAI_BOOK_REPAIR_REASONING || "low") as ReasoningEffort;
const MAX_REPAIR_ROUNDS = 2;

// ── Layout facts (mirror src/lib/pdf/layout.ts SCENE_LAYOUTS) ────────────────

export const SCENE_COUNT = 12;
/** Scenes printed as a double-page panorama: text overlays the image, so it must be short. */
export const PANORAMIC_SCENES: readonly number[] = [3, 8];

// ── Plan spec by age ─────────────────────────────────────────────────────────

export type PlanMode = "refrain" | "picture" | "chapter" | "literary";

export interface WordBudget {
  min: number;
  max: number;
  /** Paragraph/dialogue-line budget: each one starts a new printed line. */
  maxParagraphs: number;
}

export interface PlanSpec {
  mode: PlanMode;
  ageBand: string;
  bridgeSlots: readonly number[];
  /** Words for a regular single-page scene */
  scene: WordBudget;
  /** Words for a panoramic spread scene (text over the image) */
  panoramic: WordBudget;
  /** Words for a bridge (one line, display type) */
  bridge: WordBudget;
  /** Longest sentence allowed (words), null = no limit */
  maxSentenceWords: number | null;
  /** Refrain must appear in at least this many slots (0 = optional) */
  minRefrainSlots: number;
}

// Budgets calibrated against the real print planner (planInteriorPages) at the
// age's intended body size. Dialogue-heavy prose spends a line per paragraph,
// so the caps sit below the plain-prose capacity (10–12: ~320 words in 3
// paragraphs, but ~210 words in 10 paragraphs already shrinks the type).
// findPrintFitViolations checks the real fit on top of these budgets.
export function getPlanSpec(age: number): PlanSpec {
  if (age <= 4) {
    return {
      mode: "refrain",
      ageBand: "2-4",
      bridgeSlots: [3, 6, 9, 12],
      scene: { min: 20, max: 50, maxParagraphs: 4 },
      panoramic: { min: 15, max: 45, maxParagraphs: 3 },
      bridge: { min: 3, max: 15, maxParagraphs: 1 },
      maxSentenceWords: 14,
      minRefrainSlots: 5,
    };
  }
  if (age <= 6) {
    return {
      mode: "picture",
      ageBand: "5-6",
      bridgeSlots: [3, 9],
      scene: { min: 50, max: 90, maxParagraphs: 5 },
      panoramic: { min: 30, max: 55, maxParagraphs: 3 },
      bridge: { min: 4, max: 20, maxParagraphs: 1 },
      maxSentenceWords: 22,
      minRefrainSlots: 0,
    };
  }
  if (age <= 9) {
    return {
      mode: "chapter",
      ageBand: "7-9",
      bridgeSlots: [3, 9],
      scene: { min: 100, max: 150, maxParagraphs: 6 },
      panoramic: { min: 50, max: 90, maxParagraphs: 3 },
      bridge: { min: 4, max: 25, maxParagraphs: 1 },
      maxSentenceWords: null,
      minRefrainSlots: 0,
    };
  }
  return {
    mode: "literary",
    ageBand: "10-12",
    bridgeSlots: [],
    scene: { min: 150, max: 220, maxParagraphs: 6 },
    panoramic: { min: 70, max: 110, maxParagraphs: 3 },
    bridge: { min: 4, max: 25, maxParagraphs: 1 },
    maxSentenceWords: null,
    minRefrainSlots: 0,
  };
}

export function getSlotType(spec: PlanSpec, sceneNumber: number): "scene" | "bridge" {
  return spec.bridgeSlots.includes(sceneNumber) ? "bridge" : "scene";
}

export function getSlotBudget(spec: PlanSpec, sceneNumber: number): WordBudget {
  if (getSlotType(spec, sceneNumber) === "bridge") return spec.bridge;
  return PANORAMIC_SCENES.includes(sceneNumber) ? spec.panoramic : spec.scene;
}

// ── Schema ───────────────────────────────────────────────────────────────────

const ID = z.string().regex(/^[a-z][a-z0-9_]*$/);

/** Reserved id of the main child in every shot (same as visual-assets CHILD_ID). */
export const PLAN_CHILD_ID = "child";

const ShotSchema = z.object({
  action: z.string().describe('English, 1–3 sentences. The single instant the illustration shows: what everyone present does, poses, expressions, the objects they touch. Call the main child "the child", never by name. Do not describe how characters look.'),
  setting: z.string().describe("English. The full background environment with its colours (never blank). Name the recurring location if it is one."),
  castIds: z.array(ID).describe('Everyone recurring who is visible: "child" and/or ids from `cast`. Nobody else from the cast appears.'),
  worldIds: z.array(ID).describe("Ids from `world` (recurring locations/objects) visible in this shot."),
  camera: z.string().describe("English. Angle + framing + placement, e.g. 'low-angle medium shot, the child at left, the lighthouse towering right'."),
  shotScale: z.enum(["close", "medium", "wide"]),
  light: z.string().describe("English. Light source, time of day, mood."),
});

const SceneSchema = z.object({
  sceneNumber: z.number().int().min(1).max(SCENE_COUNT),
  type: z.enum(["scene", "bridge"]),
  title: z.string().describe("Scene title in the book language, max ~5 words."),
  text: z.string().describe("The printed text of this spread, in the book language, within the slot's word budget."),
  illustratedMoment: z.string().describe('English, one sentence: the exact moment of the text that the illustration depicts ("the child", never the name).'),
  shot: ShotSchema,
});

const CastSchema = z.object({
  id: ID,
  name: z.string().describe("Name as used in the text (book language)."),
  kind: z.enum(["character", "creature"]).describe('"creature" for animals, magical beings, robots; "character" for people.'),
  visual: z.string().describe("English, 1–2 sentences. Species or body type, size relative to a small child, main colours, face details, ONE distinctive accessory. No personality, no actions, no written text."),
});

const WorldSchema = z.object({
  id: ID,
  name: z.string(),
  kind: z.enum(["location", "object"]),
  visual: z.string().describe("English. Locations: architecture or landscape, landmarks, colours. Objects: shape, material, colours, markings. No written text."),
});

// Property order = generation order. The bible (cast, world) and the cover come
// before the scenes so a streaming consumer can start the cover and scene 1
// images while the rest of the book is still being written.
const BasePlanSchema = z.object({
  title: z.string().describe("Book title in the book language. Evocative, personal, max ~7 words."),
  alternateTitles: z.array(z.string()).min(2).max(3),
  refrain: z.string().describe('The repeated line or motif phrase, in the book language, exactly as it appears in the text ("" only if the mode does not use one).'),
  setupPayoff: z.object({
    detail: z.string().describe("English. The concrete object or action planted early that matters at the climax."),
    setupScene: z.number().int().min(1).max(SCENE_COUNT),
    payoffScene: z.number().int().min(1).max(SCENE_COUNT),
  }),
  cast: z.array(CastSchema).describe('Every recurring character other than the main child (reserved id "child", never listed here).'),
  world: z.array(WorldSchema).describe("Recurring locations and story objects, including the child's home/city."),
  cover: ShotSchema.describe("The cover: the child (and at most the main companion) in a gentle heroic moment from the story's world; calm space in the upper third for the title."),
  scenes: z.array(SceneSchema).length(SCENE_COUNT),
  synopsis: z.string().describe("2–3 sentences for the back cover, in the book language."),
  finalMessage: z.string().describe("Closing page message in the book language, 1–3 sentences, like a whisper at bedtime."),
});

const PlanWithDedicationSchema = BasePlanSchema.extend({
  dedication: z.string().describe("A short warm dedication in the book language (the parent did not write one)."),
});

export type BookPlanDraft = z.infer<typeof BasePlanSchema> & { dedication?: string };
export type PlanScene = z.infer<typeof SceneSchema>;
export type PlanShot = z.infer<typeof ShotSchema>;
export type PlanCastMember = z.infer<typeof CastSchema>;
export type PlanWorldAsset = z.infer<typeof WorldSchema>;

export interface BookPlan extends BookPlanDraft {
  version: 1;
  locale: string;
  mode: PlanMode;
  childName: string;
  gender: StoryInput["gender"];
  age: number;
  /** "parent" = input.dedication copied verbatim; "generated" = plan.dedication. */
  dedicationSource: "parent" | "generated" | "none";
  /** Final dedication to print (verbatim when the parent wrote it). */
  dedicationText: string;
  model: string;
}

const RepairSchema = z.object({
  scenes: z.array(
    z.object({
      sceneNumber: z.number().int().min(1).max(SCENE_COUNT),
      title: z.string(),
      text: z.string(),
    }),
  ),
});

// ── Locale facts ─────────────────────────────────────────────────────────────

interface LocaleFacts {
  language: string;
  notes: string;
}

const LOCALE_FACTS: Record<string, LocaleFacts> = {
  es: {
    language: "Spanish (Spain)",
    notes: "Peninsular Spanish as published in Spain. Dialogue with raya (—) or « ».",
  },
  ca: {
    language: "Catalan",
    notes:
      "Standard Catalan as written and published in Catalunya, with the idiom of a native Catalan author: no castellanismes and no Spanish calques in vocabulary or syntax. Personal names always take the personal article in narration (en Pau, la Laia, l'Anna, d'en Pau, a la Laia); a bare name is only correct when a character addresses someone directly. Dialogue with guions (—) or « ».",
  },
  en: {
    language: "English",
    notes: "Natural English as in a contemporary UK/US picture book. Dialogue in quotation marks.",
  },
  fr: {
    language: "French (France)",
    notes:
      "French as published in France. Dialogue with guillemets (« ») and tirets. For ages 7+ narrate in the passé simple as French children's books do; for younger readers use the présent or passé composé.",
  },
};

function getLocaleFacts(locale: string): LocaleFacts {
  return LOCALE_FACTS[locale] ?? LOCALE_FACTS.es;
}

// ── Template tone ────────────────────────────────────────────────────────────

interface NarrativeTone {
  voice: string;
  craft: string;
  register: string;
}

const TEMPLATE_TONES: Record<string, NarrativeTone> = {
  space: {
    voice: "Sense of wonder, gently philosophical",
    craft: "Let silence and scale do the emotional work: the child feels tiny against the stars, and curiosity makes them feel enormous. Poetic imagery for cosmic phenomena, grounded in concrete detail.",
    register: "awe, loneliness turned into connection, reverence for the unknown",
  },
  forest: {
    voice: "Lyrical and emotionally intimate",
    craft: "The forest is a character that breathes, watches and answers. Sensory language: damp moss, a twig snapping, rain on leaves. Each creature mirrors something the child feels.",
    register: "tenderness, gentle fear, belonging, wonder at nature's cycles",
  },
  superhero: {
    voice: "Adventurous with dry humour",
    craft: "Punchy sentences in action; the heart lives in the quiet moments — the doubt before the leap, helping when nobody watches. Humour from the child's inner voice, not slapstick.",
    register: "excitement, self-doubt, compassion, earned pride",
  },
  pirates: {
    voice: "Swashbuckling and clever",
    craft: "The rhythm of the sea: rolling sentences in calm water, short ones in storms. The child wins by wit, not force. Scrappy, lively dialogue and real wonder at the ocean.",
    register: "daring, cunning, loyalty, the pull between greed and friendship",
  },
  chef: {
    voice: "Warm, sensory and heartfelt",
    craft: "The reader should taste and smell the story. Every dish carries love or connection; while the child cooks, a feeling is being worked out.",
    register: "comfort, generosity, creative joy, sharing",
  },
  dinosaurs: {
    voice: "Exciting and awe-struck",
    craft: "Physical detail makes the prehistoric world real: the ground shakes, a wing's shadow passes. Dinosaurs have habits and moods; the child earns trust through patience and respect.",
    register: "awe, respect for creatures different from us, bravery born of empathy",
  },
  castle: {
    voice: "Mysterious and intellectually playful",
    craft: "Suspense through unanswered questions. The child solves problems by observing and thinking; each revelation reframes what came before.",
    register: "curiosity, suspense, the thrill of solving a puzzle",
  },
  safari: {
    voice: "Reverent and quietly powerful",
    craft: "The savanna is majestic, not a theme park. Animals have families and dignity. The child learns by watching and listening; stillness is as powerful as action.",
    register: "reverence, responsibility, quiet courage, interconnection of life",
  },
  inventor: {
    voice: "Inventive, problem-solving, with heart",
    craft: "Show the messy process: failed attempts, unexpected breakthroughs, 'what if I try this?'. Thinking differently is the child's strength. Technical details feel magical, not clinical.",
    register: "frustration turned into eureka, pride in building something that helps",
  },
  candy: {
    voice: "Playful, whimsical and generous",
    craft: "A dream where everything is edible and a little ridiculous; underneath, a story about sharing and what really makes something sweet. Synaesthesia welcome.",
    register: "delight, generosity, the difference between sweetness and kindness",
  },
};

// ── Mode craft + beat maps ───────────────────────────────────────────────────

const MODE_CRAFT: Record<PlanMode, string> = {
  refrain:
    "READ-ALOUD REFRAIN BOOK (ages 2–4). An adult reads it aloud to a very young child. Build the whole book on a repeating pattern: a short, musical refrain (put it in `refrain`) returns word for word in at least 6 slots so the child can say it along, and the pattern of each page is recognisable (situation → sound or action → refrain). Short sentences, concrete everyday words, sounds and onomatopoeia, one clear feeling per page named plainly, gentle anticipation instead of suspense. Home → small adventure → home. The lesson may be said simply near the end.",
  picture:
    "PICTURE BOOK (ages 5–6). A warm storyteller voice, short lines of dialogue, cause and effect visible on every page, at most one new word per page made clear by context, a small surprise at each page turn. A motif or recurring phrase helps. The lesson may be named gently once, near the end.",
  chapter:
    "STORY BOOK (ages 7–9). Close third person inside the child's head, with brief flashes of thought; natural, short dialogue; child-safe suspense that breathes before it resolves; humour from the child's point of view. The moral lives in the child's choices and is never stated.",
  literary:
    "LITERARY STORY (ages 10–12). Close third person with real interiority: doubt, contradiction, growth. Dialogue with subtext. One precise image beats three vague ones. A genuine dark moment before an earned resolution. The moral is never stated, by anyone.",
};

const BEATS: Record<PlanMode, string[]> = {
  refrain: [
    "At home in the real city: who the child is, through play and routine. The refrain is born here.",
    "The child notices something small and wonderful nearby.",
    "One warm line: the magic beckons.",
    "Into the magical place; a friendly first encounter.",
    "Friendship or a special object; joy.",
    "One line: a small, gentle problem appears.",
    "First try — it does not quite work, and that is fine.",
    "Try again with kindness or a new idea — it works.",
    "One line of celebration.",
    "Celebration together; the lesson said simply.",
    "Back home, safe; home feels even better now.",
    "The softest closing line (the refrain, one last time).",
  ],
  picture: [
    "The child in the real city: personality, what they love.",
    "A wish, a goal or someone to help: clear motivation.",
    "One line: the adventure opens.",
    "Stepping into the new world: excitement and a little nervousness.",
    "A new friend or ally; why they make a good team.",
    "A clear problem arises because of something specific.",
    "First attempt: partial progress, something still wrong; the child worries.",
    "A quiet moment; a small idea sparks.",
    "One line: hope arrives.",
    "The new approach works — show the consequence.",
    "Celebration and gratitude; the lesson named gently once.",
    "Home again, happy and changed; circular closure.",
  ],
  chapter: [
    "The child in the real city: routine and inner world; plant the setup detail.",
    "First hint that today is different: curiosity with a little fear.",
    "One atmospheric line: the threshold.",
    "The adventure world opens; its rules are different.",
    "Meeting the key ally through a shared moment, not a speech.",
    "Wonders and strangeness; the child's interests become real traits here.",
    "A first real test reveals a strength or a weakness.",
    "A quiet, intimate moment; the child reflects.",
    "One line: the calm breaks.",
    "The great challenge; real stakes; the child doubts.",
    "Breakthrough through the child's own choice; the setup pays off.",
    "Home, transformed; the setup detail carries new meaning.",
  ],
  literary: [
    "The ordinary world in the real city: personality, routine, inner life; plant the setup detail.",
    "A crack in the ordinary: something impossible to ignore.",
    "Crossing into the unknown despite doubt; it costs something small.",
    "First unexpected encounter; assumptions challenged.",
    "Meeting the ally, bonding through vulnerability.",
    "The new world's wonders and rules; the child's traits matter in unexpected ways.",
    "A test that reveals a hidden strength or exposes a flaw.",
    "The calm before the storm: a conversation, a memory, doubt.",
    "The main obstacle; real stakes; the setup detail returns.",
    "The darkest moment; the child considers giving up. Let it breathe.",
    "Breakthrough through a costly choice.",
    "The return, transformed; the setup detail carries new meaning.",
  ],
};

/** Slot by which each tree step (chapter 1, 2, 3) must have happened. */
const TREE_ANCHORS = [4, 7, 10];

// ── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the author and art director of a personalised children's picture book. In one pass you write the complete manuscript of a 12-spread book and the shot plan its illustrator will follow, as one JSON object matching the schema.

THE MANUSCRIPT
- Write natively in the book language, as an acclaimed children's author from that language community would: idiomatic, rhythmic, made to be read aloud. Do not think in English and translate.
- It is one book with one voice. Keep the same narrator, tense and rhythm from the first page to the last. A refrain or motif returns exactly as first written.
- Follow the story path the parent chose, in order, at the slots indicated. Connect the beats with cause and effect; add no unrelated plot turns. Characters named in the path keep those names.
- Plant the setup detail early and pay it off at the climax, as declared in setupPayoff.
- The protagonist is the child described. Use the child's name naturally, not in every sentence. Personal details (interests, colour, pet, dream) are character colour: each appears once or twice in the whole book, where it fits, never as a checklist.
- The real world comes first: opening pages happen in the child's real city and are plausible there. The fantasy world is entered through an explicit magical transition, and the story comes home at the end.
- The text sits beside its illustration: it narrates the illustrated moment but does not inventory the picture; it carries what a picture cannot — thoughts, sounds, dialogue, what happens next.
- Each slot has a word and paragraph budget: it is the space on the printed page, where every paragraph or line of dialogue starts a new line. Stay inside it; keep short exchanges of dialogue inside fuller paragraphs.
- Every adjective, participle and pronoun that refers to the protagonist agrees with the protagonist's grammatical gender given in the brief.

THE SHOT PLAN
- Shot fields and all visual descriptions are in English, concrete and visual: what the camera sees. Never written words, letters or signs in the image.
- The main child has the reserved id "child". In English fields call them "the child", never by name, and never describe their face, hair, skin or clothes: the illustrator already has the child's character sheet.
- Every other recurring character is defined once in \`cast\`, every recurring place or story object once in \`world\`, each with a stable snake_case id and a precise visual description, and shots refer to them by id. Shots describe what characters do, never how they look.
- shot.action is the single instant of illustratedMoment, and that instant is narrated in the text.
- castIds lists exactly who from the cast is visible (include "child" when the child is visible). Nobody else from the cast appears.
- Vary camera and shot scale between neighbouring scenes. Panoramic slots are wide compositions: the child small, the scenery stretching across both pages.`;

function colorName(hex?: string): string | undefined {
  if (!hex) return undefined;
  return FAVORITE_COLORS.find((c) => c.color === hex)?.id ?? hex;
}

function genderGrammar(input: StoryInput): string {
  if (input.gender === "girl") return "feminine (a girl)";
  if (input.gender === "boy") return "masculine (a boy)";
  return "unspecified: the parent chose not to state it. Avoid gendered agreement for the protagonist where the language allows (invariable adjectives, the name, rephrasing).";
}

export interface StoryPathStep {
  chapter: number;
  situation: string;
  choice: string;
}

/** The parent's branching path, resolved in the book locale (situation + chosen option). */
export function resolveStoryPath(input: StoryInput): StoryPathStep[] {
  const treePath = (input.decisions as Record<string, unknown>).treePath as TreeChoice[] | undefined;
  const tree = getStoryTree(input.templateId);
  if (!treePath?.length || !tree) return [];
  const locale = input.locale || "es";
  const fill = (s: string) => s.replaceAll("{name}", input.childName);
  const steps: StoryPathStep[] = [];
  for (const choice of treePath) {
    const node = tree.nodes[choice.nodeId];
    const opt = node?.options.find((o) => o.id === choice.optionId);
    if (!node || !opt) continue;
    steps.push({ chapter: node.chapter, situation: fill(tx(node.question, locale)), choice: fill(tx(opt.narrative, locale)) });
  }
  return steps;
}

function legacyDecisions(input: StoryInput): string[] {
  const template = getTemplateConfig(input.templateId);
  if (!template) return [];
  const d = input.decisions as Record<string, string>;
  const lines: string[] = [];
  for (const key of ["encounter", "companion", "challenge"] as const) {
    if (d[key]) {
      const n = getDecisionNarrative(template, key, d[key]);
      if (n) lines.push(`${key}: ${n}`);
    }
  }
  const atm = getAtmosphereNarrative(template, d.timeOfDay, d.setting);
  if (atm.time) lines.push(`time: ${atm.time}`);
  if (atm.setting) lines.push(`setting: ${atm.setting}`);
  if (d.specialMoment) lines.push(`special moment requested by the parent: "${d.specialMoment}"`);
  return lines;
}

export function buildPlanUserPrompt(input: StoryInput, spec: PlanSpec): string {
  const locale = input.locale || "es";
  const facts = getLocaleFacts(locale);
  const template = getTemplateConfig(input.templateId);
  const tone = TEMPLATE_TONES[input.templateId] ?? TEMPLATE_TONES.forest;
  const path = resolveStoryPath(input);
  const legacy = path.length ? [] : legacyDecisions(input);

  let ending = "A warm, satisfying ending.";
  if (input.endingChoice && template) ending = getEndingNarrative(template, input.endingChoice) ?? ending;
  if (input.endingNote) ending += ` The parent asks for the ending: "${input.endingNote}"`;

  const child = [
    `Name: ${input.childName}`,
    `Age: ${input.age}`,
    `Grammatical gender: ${genderGrammar(input)}`,
    `City: ${input.city || "(not given — use an unnamed, ordinary town)"}`,
    input.interests.length ? `Interests: ${input.interests.join(", ")}` : null,
    colorName(input.favoriteColor) ? `Favourite colour: ${colorName(input.favoriteColor)}` : null,
    input.favoriteCompanion
      ? `Real-life companion (pet or friend from the real world; if it appears in the story it goes in the cast): ${input.favoriteCompanion}`
      : null,
    input.futureDream ? `Dream for the future: ${input.futureDream}` : null,
  ].filter(Boolean);

  const slots = Array.from({ length: SCENE_COUNT }, (_, i) => {
    const n = i + 1;
    const type = getSlotType(spec, n);
    const budget = getSlotBudget(spec, n);
    const layout = PANORAMIC_SCENES.includes(n) ? "panoramic double-page spread, text over the image" : "single page";
    const anchor = TREE_ANCHORS.map((a, k) => (a === n && path[k] ? ` Story path step ${k + 1} must have happened by here.` : "")).join("");
    return `Slot ${n} [${type}] (${layout}; ${budget.min}–${budget.max} words, at most ${budget.maxParagraphs} paragraph${budget.maxParagraphs > 1 ? "s" : ""}): ${BEATS[spec.mode][i]}${anchor}`;
  });

  const sections: string[] = [
    `BOOK LANGUAGE: ${facts.language} (${locale}). ${facts.notes}`,
    `MODE\n${MODE_CRAFT[spec.mode]}${spec.maxSentenceWords ? ` Sentences of at most ${spec.maxSentenceWords} words.` : ""}${
      input.creationMode === "juntos" && spec.mode !== "refrain"
        ? " The book is read together by an adult and the child: leave two or three natural pauses where the reader can ask the child about the picture."
        : ""
    }`,
    `THE CHILD\n${child.join("\n")}`,
    `WORLD\nTemplate: ${input.templateTitle} — ${template?.theme ?? "a magical adventure"}\nMoral (never preached${spec.mode === "refrain" || spec.mode === "picture" ? ", may be said simply once near the end" : ", never stated"}): ${template?.moral ?? "Kindness matters"}\nTone: ${tone.voice}. ${tone.craft}\nEmotional register: ${tone.register}`,
    path.length
      ? `STORY PATH (chosen by the parent, in the book language; follow in order)\n${path
          .map((s, i) => `Step ${i + 1} (chapter ${s.chapter})\n  Situation: ${s.situation}\n  Choice: ${s.choice}`)
          .join("\n")}`
      : legacy.length
        ? `STORY DECISIONS (weave all of them)\n${legacy.join("\n")}`
        : "",
    `ENDING\n${ending}`,
    input.dedication?.trim()
      ? "DEDICATION\nThe parent wrote their own dedication; it is printed separately on the first page. Do not write one and do not quote it."
      : `DEDICATION\nThe parent wrote none: write a short, warm one in \`dedication\`${input.senderName ? ` (from ${input.senderName})` : ""}.`,
    `BOOK SHAPE — 12 slots (use exactly these types)\n${slots.join("\n")}`,
  ];
  return sections.filter(Boolean).join("\n\n");
}

// ── Deterministic checks ─────────────────────────────────────────────────────

export interface PlanViolation {
  sceneNumber: number;
  code: "length" | "print_fit" | "sentence_length" | "gender" | "personal_article" | "refrain" | "title_length";
  message: string;
}

const LETTER = "\\p{L}";

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => /\p{L}|\d/u.test(w)).length;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+|\n+/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Gender agreement: the child's name followed by a copula/state verb and an
// inflecting adjective or participle. Only unambiguous endings/lexicon entries
// are judged; anything else is left alone.

interface GenderLexicon {
  copulas: string[];
  adverbs: string[];
  masc: RegExp;
  fem: RegExp;
  mascWords: string[];
  femWords: string[];
  ignore: string[];
}

const GENDER_LEXICON: Record<string, GenderLexicon> = {
  es: {
    copulas: ["está", "estaba", "estuvo", "estará", "estaría", "es", "era", "fue", "parecía", "parece", "se sentía", "se siente", "se sintió", "se quedó", "se queda", "se quedaba", "quedó", "seguía", "sigue", "se puso", "se pone", "se ponía", "ha sido", "había sido"],
    adverbs: ["muy", "tan", "súper", "super", "un poco", "algo", "bastante", "totalmente", "completamente", "todavía", "aún", "ya", "más", "casi", "no"],
    masc: /^\p{L}+(ado|ido|oso|ito|ísimo)$/u,
    fem: /^\p{L}+(ada|ida|osa|ita|ísima)$/u,
    mascWords: ["contento", "solo", "quieto", "listo", "tranquilo", "seguro", "pequeño", "despierto", "dispuesto", "atento", "lleno", "serio", "nuevo", "orgulloso"],
    femWords: ["contenta", "sola", "quieta", "lista", "tranquila", "segura", "pequeña", "despierta", "dispuesta", "atenta", "llena", "seria", "nueva", "orgullosa"],
    ignore: ["sido", "pido", "nido", "ruido", "olvido", "latido", "sonido", "vestido", "partido", "sentido", "rato", "un", "una", "de", "en"],
  },
  ca: {
    copulas: ["està", "estava", "estarà", "estaria", "és", "era", "va ser", "semblava", "sembla", "se sentia", "es sentia", "se sent", "es sent", "es va sentir", "es va quedar", "es quedava", "es queda", "va quedar", "seguia", "continuava", "es va posar", "es posava", "ha estat", "havia estat"],
    adverbs: ["molt", "tan", "una mica", "força", "ben", "del tot", "encara", "ja", "més", "gairebé", "no", "tota", "tot"],
    masc: /^\p{L}+(at|it|ut|ós|òs)$/u,
    fem: /^\p{L}+(ada|ida|uda|osa)$/u,
    mascWords: ["content", "sol", "quiet", "tranquil", "segur", "petit", "despert", "atent", "ple", "nou", "orgullós", "preparat", "fort"],
    femWords: ["contenta", "sola", "quieta", "tranquil·la", "segura", "petita", "desperta", "atenta", "plena", "nova", "orgullosa", "preparada", "forta"],
    ignore: ["tot", "molt", "llit", "crit", "dit", "fruit", "nit", "pit", "minut", "estat", "costat", "ciutat", "amistat", "veritat"],
  },
  fr: {
    copulas: ["est", "était", "fut", "sera", "serait", "semblait", "semble", "sembla", "se sentait", "se sent", "se sentit", "restait", "reste", "resta", "demeurait", "devint", "devient", "s'est", "s'était", "avait été", "a été"],
    adverbs: ["très", "si", "tout", "toute", "un peu", "assez", "complètement", "déjà", "encore", "plus", "bien", "vraiment", "pas", "n'", "ne"],
    masc: /^\p{L}+(é|eux|if)$/u,
    fem: /^\p{L}+(ée|euse|ive)$/u,
    mascWords: ["content", "seul", "prêt", "petit", "grand", "surpris", "assis", "endormi", "ravi", "déçu", "perdu", "parti", "venu", "inquiet", "fier", "gentil", "prudent", "attentif", "tout"],
    femWords: ["contente", "seule", "prête", "petite", "grande", "surprise", "assise", "endormie", "ravie", "déçue", "perdue", "partie", "venue", "inquiète", "fière", "gentille", "prudente", "attentive", "toute"],
    ignore: ["été", "thé", "côté", "bébé", "café", "blé", "clé", "pied", "dé"],
  },
};

/** Name as it appears in the text; the Catalan article (en/la/l') precedes it. */
function nameRegexSource(name: string): string {
  return `(?<![${LETTER}])${escapeRegex(name)}(?![${LETTER}])`;
}

function findGenderIssues(text: string, locale: string, name: string, gender: StoryInput["gender"], otherNames: string[]): string[] {
  if (gender === "neutral") return [];
  const issues: string[] = [];

  if (locale === "en") {
    const wrong = gender === "girl" ? /\b(he|him|his|himself)\b/i : /\b(she|her|hers|herself)\b/i;
    const nameRe = new RegExp(nameRegexSource(name), "u");
    for (const s of splitSentences(text)) {
      if (!nameRe.test(s)) continue;
      if (otherNames.some((o) => o && new RegExp(nameRegexSource(o), "u").test(s))) continue;
      const m = s.match(wrong);
      if (m) issues.push(`"${m[0]}" in «${s}» refers to ${name}, who is a ${gender}`);
    }
    return issues;
  }

  const lex = GENDER_LEXICON[locale];
  if (!lex) return [];
  const copula = lex.copulas.map(escapeRegex).sort((a, b) => b.length - a.length).join("|");
  const adverb = lex.adverbs.map(escapeRegex).sort((a, b) => b.length - a.length).join("|");
  const re = new RegExp(
    `${nameRegexSource(name)}\\s+(?:(?:${adverb})\\s+)?(?:${copula})\\s+(?:(?:${adverb})\\s*)*([${LETTER}·]+)`,
    "giu",
  );
  for (const m of text.matchAll(re)) {
    const word = m[1].toLowerCase();
    if (lex.ignore.includes(word)) continue;
    const isMasc = lex.mascWords.includes(word) || (lex.masc.test(word) && !lex.femWords.includes(word));
    const isFem = lex.femWords.includes(word) || (lex.fem.test(word) && !lex.mascWords.includes(word));
    if (gender === "girl" && isMasc && !isFem) issues.push(`«${m[0]}»: "${m[1]}" is masculine but ${name} is a girl`);
    if (gender === "boy" && isFem && !isMasc) issues.push(`«${m[0]}»: "${m[1]}" is feminine but ${name} is a boy`);
  }
  return issues;
}

/** Remove dialogue (quoted and dash-introduced lines), where a bare vocative name is correct. */
function stripDialogue(text: string): string {
  return text
    .replace(/«[^»]*»/g, " ")
    .replace(/“[^”]*”/g, " ")
    .replace(/"[^"]*"/g, " ")
    .split("\n")
    .map((line) => (/^\s*[—–-]/.test(line) ? " " : line.replace(/—[^—\n]*(—|$)/g, " ")))
    .join("\n");
}

function findCatalanArticleIssues(text: string, name: string, gender: StoryInput["gender"]): string[] {
  const issues: string[] = [];
  const vowel = /^[aeiouàèéíòóúAEIOUÀÈÉÍÒÓÚhH]/.test(name);
  const n = escapeRegex(name);
  const after = `(?![${LETTER}])`;
  if (gender === "girl" && new RegExp(`(?<![${LETTER}])(en|d'en|a en) ${n}${after}`, "iu").test(text)) {
    issues.push(`masculine article "en" before ${name}, who is a girl (use "la"/"l'")`);
  }
  if (gender === "boy" && new RegExp(`(?<![${LETTER}])(la|de la|a la) ${n}${after}`, "iu").test(text)) {
    issues.push(`feminine article "la" before ${name}, who is a boy (use "en"${vowel ? '/"l\'"' : ""})`);
  }
  // Bare name in narration (dialogue removed; a following comma = vocative).
  const narration = stripDialogue(text);
  const bare = new RegExp(`(?<![${LETTER}'’])${n}${after}(?!\\s*,)`, "gu");
  for (const m of narration.matchAll(bare)) {
    const before = narration.slice(Math.max(0, m.index - 4), m.index);
    if (/(en |la |l'|l’|n'|n’)$/i.test(before)) continue;
    if (/[,¡!¿?]\s*$/.test(before)) continue; // vocative: "Bona nit, Pau."
    issues.push(`bare name "${name}" without personal article in narration: «…${narration.slice(Math.max(0, m.index - 20), m.index + name.length + 20).trim()}…»`);
    break;
  }
  return issues;
}

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function validatePlan(plan: BookPlanDraft, input: StoryInput, spec: PlanSpec): PlanViolation[] {
  const locale = input.locale || "es";
  const violations: PlanViolation[] = [];
  const otherNames = plan.cast.map((c) => c.name).filter((n) => n && n !== input.childName);
  const refrainKey = normalizeForMatch(plan.refrain);
  let refrainSlots = 0;

  for (const scene of plan.scenes) {
    const n = scene.sceneNumber;
    const budget = getSlotBudget(spec, n);
    const words = countWords(scene.text);
    if (words > budget.max) {
      violations.push({ sceneNumber: n, code: "length", message: `${words} words; the printed page holds at most ${budget.max} (aim for ${budget.min}–${budget.max}). Shorten it, keeping the same events and the illustrated moment.` });
    } else if (words < Math.floor(budget.min * 0.6)) {
      violations.push({ sceneNumber: n, code: "length", message: `${words} words; this slot needs ${budget.min}–${budget.max}. Develop it, keeping the same events.` });
    }
    if (spec.maxSentenceWords) {
      const long = splitSentences(scene.text).find((s) => countWords(s) > spec.maxSentenceWords! + 3);
      if (long) violations.push({ sceneNumber: n, code: "sentence_length", message: `sentence of ${countWords(long)} words (max ${spec.maxSentenceWords}): «${long}»` });
    }
    for (const issue of findGenderIssues(scene.text, locale, input.childName, input.gender, otherNames)) {
      violations.push({ sceneNumber: n, code: "gender", message: `gender agreement: ${issue}` });
    }
    if (locale === "ca") {
      for (const issue of findCatalanArticleIssues(scene.text, input.childName, input.gender)) {
        violations.push({ sceneNumber: n, code: "personal_article", message: issue });
      }
    }
    if (scene.title.length > 42) {
      violations.push({ sceneNumber: n, code: "title_length", message: `title has ${scene.title.length} characters; it must fit two lines (max ~40).` });
    }
    if (refrainKey && normalizeForMatch(scene.text).includes(refrainKey)) refrainSlots++;
  }

  if (spec.minRefrainSlots > 0 && refrainSlots < spec.minRefrainSlots) {
    const missing = plan.scenes
      .filter((s) => s.type === "scene" && !(refrainKey && normalizeForMatch(s.text).includes(refrainKey)))
      .slice(0, spec.minRefrainSlots - refrainSlots);
    for (const s of missing) {
      violations.push({ sceneNumber: s.sceneNumber, code: "refrain", message: `the refrain «${plan.refrain}» must appear word for word in this page (it appears in ${refrainSlots} of the required ${spec.minRefrainSlots} slots).` });
    }
  }
  return violations;
}

/** Allowed type shrink before a page counts as "does not fit" (0.5 pt is invisible). */
const PRINT_SHRINK_TOLERANCE_PT = 0.6;

/**
 * Checks each scene against the REAL print planner (same fonts and boxes as the
 * PDF). Paragraph breaks (dialogue) cost whole lines, so word counts alone are
 * not enough. Bridges use display type and are covered by the word budget.
 * Non-fatal: if the PDF module can't load, only the word budget applies.
 */
export async function findPrintFitViolations(plan: BookPlanDraft, input: StoryInput): Promise<PlanViolation[]> {
  try {
    const [{ ensurePdfFontsLoaded }, { planInteriorPages }, { getPdfTextConfig }] = await Promise.all([
      import("@/lib/pdf/fonts"),
      import("@/lib/pdf/layout"),
      import("@/lib/pdf/theme"),
    ]);
    await ensurePdfFontsLoaded();
    const bodyPt = getPdfTextConfig(input.age).body;
    const images = new Set(Array.from({ length: SCENE_COUNT }, (_, i) => i + 1));
    const smallestBody = (scenes: GeneratedScene[]): number => {
      const layout = planInteriorPages({
        story: { bookTitle: plan.title, titleOptions: [], coverImagePrompt: "", scenes, dedication: "", finalMessage: plan.finalMessage, synopsis: "" },
        characterAge: input.age,
        dedicationText: input.dedication ?? null,
        senderName: input.senderName ?? null,
        availableImages: images,
      });
      let min = Infinity;
      for (const page of layout.pages) {
        if (page.kind === "text" && page.variant !== "puente") min = Math.min(min, page.bodyType.fontSize);
        else if (page.kind === "spread" && page.half === "right") min = Math.min(min, page.overlay.type.fontSize);
      }
      return min;
    };
    const asScenes = (only?: number): GeneratedScene[] =>
      plan.scenes.map((s) => ({ sceneNumber: s.sceneNumber, title: s.title, type: s.type, imagePrompt: "", text: only === undefined || only === s.sceneNumber ? s.text : "." }));

    if (smallestBody(asScenes()) >= bodyPt - PRINT_SHRINK_TOLERANCE_PT) return [];
    const out: PlanViolation[] = [];
    for (const s of plan.scenes) {
      if (s.type === "bridge") continue;
      const size = smallestBody(asScenes(s.sceneNumber));
      if (size < bodyPt - PRINT_SHRINK_TOLERANCE_PT) {
        const paragraphs = s.text.split(/\n+/).filter((p) => p.trim()).length;
        out.push({
          sceneNumber: s.sceneNumber,
          code: "print_fit",
          // Text area scales with the square of the type size.
          message: `on the printed page this text only fits at ${size}pt instead of ${bodyPt}pt (${countWords(s.text)} words in ${paragraphs} paragraphs; every paragraph or dialogue line starts a new line). Cut it to about ${Math.floor(countWords(s.text) * (size / bodyPt) ** 2 * 0.9)} words, with fewer, fuller paragraphs.`,
        });
      }
    }
    return out;
  } catch (err) {
    console.warn("[BookPlan] print-fit check unavailable (word budget only):", err instanceof Error ? err.message : err);
    return [];
  }
}

async function checkPlan(plan: BookPlanDraft, input: StoryInput, spec: PlanSpec): Promise<PlanViolation[]> {
  const base = validatePlan(plan, input, spec);
  const tooLong = new Set(base.filter((v) => v.code === "length").map((v) => v.sceneNumber));
  const print = (await findPrintFitViolations(plan, input)).filter((v) => !tooLong.has(v.sceneNumber));
  return [...base, ...print];
}

/** Early, final-for-images view of the plan while it is still streaming. */
export interface BookPlanProgress {
  title?: string;
  /** Complete (normalised like the final plan) from the first report on. */
  cast: PlanCastMember[];
  /** Empty until the cover is complete (the world list is only final then). */
  world: PlanWorldAsset[];
  /** null in the first, cast-only report. */
  cover: PlanShot | null;
  /** Completed scenes so far, in order. Their shots are final; their text may still be repaired. */
  scenes: PlanScene[];
}

// ── Normalisation (ids, types, spreads) ──────────────────────────────────────

function scrubChildName(text: string, childName: string): string {
  const name = childName.trim();
  if (!name) return text;
  return text.replace(new RegExp(`(?<![${LETTER}])${escapeRegex(name)}(?![${LETTER}])('s)?`, "giu"), (_m, poss: string | undefined) => (poss ? "the child's" : "the child"));
}

/**
 * Ids leaking into English prose confuse the image model: cast ids become the
 * character's name ("tin" → "Tin"), world ids plain words ("toy_rocket" → "toy rocket").
 */
function humanizeIds(text: string, cast: PlanCastMember[], world: PlanWorldAsset[]): string {
  let out = text;
  const swap = (id: string, label: string) => {
    out = out.replace(new RegExp(`(?<![\\w'’])${escapeRegex(id)}(?![\\w'’])`, "g"), label);
  };
  for (const c of cast) swap(c.id, c.name.replace(/^(el|la|los|las|els|les|en|l'|l’|le|the)\s*/i, ""));
  for (const w of world) if (w.id.includes("_")) swap(w.id, w.id.replace(/_/g, " "));
  return out;
}

/** Deterministic orthography fixes (IEC 2017: "sóc" lost its diacritic). */
function normalizeLocaleText(text: string, locale: string): string {
  if (locale !== "ca") return text;
  return text.replace(/(?<![\p{L}])([Ss])óc(?![\p{L}])/gu, "$1oc");
}

function normalizeShot(shot: PlanShot, n: number, cast: PlanCastMember[], world: PlanWorldAsset[], childName: string, quiet = false): PlanShot {
  const castIds = new Set([PLAN_CHILD_ID, ...cast.map((c) => c.id)]);
  const worldIds = new Set(world.map((w) => w.id));
  const unknown = [...shot.castIds, ...shot.worldIds].filter((id) => !castIds.has(id) && !worldIds.has(id));
  if (unknown.length && !quiet) console.warn(`[BookPlan] shot ${n}: dropping unknown ids ${unknown.join(", ")}`);
  const scrub = (t: string) => scrubChildName(humanizeIds(t.trim(), cast, world), childName);
  return {
    action: scrub(shot.action),
    setting: scrub(shot.setting),
    castIds: [...new Set(shot.castIds.filter((id) => castIds.has(id)))],
    worldIds: [...new Set(shot.worldIds.filter((id) => worldIds.has(id)))],
    camera: scrub(shot.camera),
    // Panoramas are wide by construction (print layout), never trust the LLM here.
    shotScale: PANORAMIC_SCENES.includes(n) ? "wide" : shot.shotScale,
    light: scrub(shot.light),
  };
}

/** Cast/world exactly as normalizeDraft stores them (shared with the streaming view so both agree byte for byte). */
function normalizeBible(draftCast: PlanCastMember[], draftWorld: PlanWorldAsset[], childName: string): { cast: PlanCastMember[]; world: PlanWorldAsset[] } {
  return {
    cast: draftCast.filter((c) => c.id !== PLAN_CHILD_ID).map((c) => ({ ...c, visual: scrubChildName(c.visual, childName) })),
    world: draftWorld.map((w) => ({ ...w, visual: scrubChildName(w.visual, childName) })),
  };
}

export function normalizeDraft(draft: BookPlanDraft, spec: PlanSpec, childName: string, locale: string): BookPlanDraft {
  const { cast, world } = normalizeBible(draft.cast, draft.world, childName);

  const byNumber = new Map(draft.scenes.map((s) => [s.sceneNumber, s]));
  const ordered = byNumber.size === SCENE_COUNT
    ? Array.from({ length: SCENE_COUNT }, (_, i) => byNumber.get(i + 1)!)
    : draft.scenes.map((s, i) => ({ ...s, sceneNumber: i + 1 }));

  const scenes = ordered.map((s) => ({
    ...s,
    type: getSlotType(spec, s.sceneNumber),
    title: normalizeLocaleText(s.title, locale),
    text: normalizeLocaleText(s.text, locale),
    illustratedMoment: scrubChildName(humanizeIds(s.illustratedMoment, cast, world), childName),
    shot: normalizeShot(s.shot, s.sceneNumber, cast, world, childName),
  }));

  const cover = normalizeShot(draft.cover, 0, cast, world, childName);
  // The cover always shows the child.
  if (!cover.castIds.includes(PLAN_CHILD_ID)) cover.castIds = [PLAN_CHILD_ID, ...cover.castIds];

  return {
    ...draft,
    cast,
    world,
    alternateTitles: draft.alternateTitles.filter((t) => t.trim() && t.trim() !== draft.title.trim()),
    scenes,
    cover,
  };
}

// ── Repair ───────────────────────────────────────────────────────────────────

function buildRepairPrompt(plan: BookPlanDraft, input: StoryInput, spec: PlanSpec, violations: PlanViolation[]): string {
  const facts = getLocaleFacts(input.locale || "es");
  const byScene = new Map<number, string[]>();
  for (const v of violations) byScene.set(v.sceneNumber, [...(byScene.get(v.sceneNumber) ?? []), v.message]);
  const manuscript = plan.scenes
    .map((s) => `[Slot ${s.sceneNumber} · ${s.type} · ${getSlotBudget(spec, s.sceneNumber).min}–${getSlotBudget(spec, s.sceneNumber).max} words] ${s.title}\n${s.text}\n(Illustrated moment: ${s.illustratedMoment})`)
    .join("\n\n");
  const fixes = [...byScene.entries()]
    .sort(([a], [b]) => a - b)
    .map(([n, msgs]) => `Slot ${n}:\n${msgs.map((m) => `  - ${m}`).join("\n")}`)
    .join("\n");
  return `BOOK LANGUAGE: ${facts.language}. ${facts.notes}
Protagonist: ${input.childName}, age ${input.age}, grammatical gender ${genderGrammar(input)}.
${plan.refrain ? `Refrain (must stay word for word): «${plan.refrain}»\n` : ""}
MANUSCRIPT
${manuscript}

AN AUTOMATIC CHECK FOUND THESE PROBLEMS
${fixes}

Rewrite only the listed slots so every problem is solved. Keep the same events, the illustrated moment, the characters' names, and the voice and rhythm of the rest of the book. Return each rewritten slot with its title and full text.`;
}

const REPAIR_SYSTEM = "You are the author of this children's book, revising specific pages after a proofreading pass. You keep the book's voice exactly and change only what is needed.";

// ── Main entry ───────────────────────────────────────────────────────────────

export interface BookPlanReport {
  model: string;
  repairModel: string;
  planMs: number;
  repairMs: number[];
  totalMs: number;
  usage: LLMUsage;
  costUsd: number;
  initialViolations: PlanViolation[];
  finalViolations: PlanViolation[];
}

export interface BookPlanResult {
  plan: BookPlan;
  report: BookPlanReport;
}

function addUsage(a: LLMUsage, b: LLMUsage): LLMUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    cachedInputTokens: a.cachedInputTokens + b.cachedInputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    reasoningTokens: a.reasoningTokens + b.reasoningTokens,
  };
}

const PartialBibleSchema = z.object({
  title: z.string().optional(),
  cast: z.array(CastSchema).optional(),
  world: z.array(WorldSchema).optional(),
  cover: ShotSchema.optional(),
  scenes: z.array(z.unknown()).optional(),
});

/**
 * Streaming view of a partial plan. parsePartialJson keeps only completed
 * objects/arrays, and properties are generated in schema order (… cast, world,
 * cover, scenes), so:
 *   - `cast` is complete once `world` (or anything after it) is present,
 *   - `world` is complete once `cover` is present.
 * Returns null until the cast is complete.
 */
export function readProgress(partial: unknown, spec: PlanSpec, childName: string): BookPlanProgress | null {
  const bible = PartialBibleSchema.safeParse(partial);
  if (!bible.success || !bible.data.cast) return null;
  const castComplete = bible.data.world !== undefined || bible.data.cover !== undefined;
  if (!castComplete) return null;
  const worldComplete = bible.data.cover !== undefined && bible.data.world !== undefined;
  const { cast, world } = normalizeBible(bible.data.cast, worldComplete ? bible.data.world! : [], childName);
  if (!bible.data.cover || !worldComplete) {
    return { title: bible.data.title, cast, world, cover: null, scenes: [] };
  }
  const draft = {
    cover: bible.data.cover,
    scenes: (bible.data.scenes ?? [])
      .map((raw) => SceneSchema.safeParse(raw))
      .filter((r) => r.success)
      .map((r) => r.data!),
  };
  const cover = normalizeShot(draft.cover, 0, cast, world, childName, true);
  if (!cover.castIds.includes(PLAN_CHILD_ID)) cover.castIds = [PLAN_CHILD_ID, ...cover.castIds];
  return {
    title: bible.data.title,
    cast,
    world,
    cover,
    scenes: draft.scenes.map((s, i) => ({
      ...s,
      sceneNumber: i + 1,
      type: getSlotType(spec, i + 1),
      illustratedMoment: scrubChildName(humanizeIds(s.illustratedMoment, cast, world), childName),
      shot: normalizeShot(s.shot, i + 1, cast, world, childName, true),
    })),
  };
}

export async function generateBookPlan(
  input: StoryInput,
  opts?: {
    model?: string;
    reasoningEffort?: ReasoningEffort;
    repairModel?: string;
    /**
     * Streams the plan and reports progress whenever the cover or a new scene is
     * complete, so the preview can start the cover + scene 1 images early.
     * Called again from scratch if the request is retried: keep it idempotent.
     */
    onProgress?: (progress: BookPlanProgress) => void;
  },
): Promise<BookPlanResult> {
  const start = Date.now();
  const spec = getPlanSpec(input.age);
  const model = opts?.model ?? BOOK_PLAN_MODEL;
  const repairModel = opts?.repairModel ?? opts?.model ?? BOOK_REPAIR_MODEL;
  const parentDedication = input.dedication?.trim() ? input.dedication : undefined;
  const schema: z.ZodType<BookPlanDraft> = parentDedication ? BasePlanSchema : PlanWithDedicationSchema;

  console.log(`[BookPlan] ${model} (${spec.mode}, age ${input.age}, ${input.locale || "es"})...`);
  // Fires on: cast complete → cover complete → each new scene. Within one
  // streamed attempt progress only grows, so a view that went backwards (cover
  // gone, fewer scenes) means callOpenAIStructured retried from scratch: reset
  // and report the new attempt's plan (consumers key their work by content).
  const none = { cast: false, cover: false, scenes: 0 };
  let reported = { ...none };
  const onPartial = opts?.onProgress
    ? (partial: unknown) => {
        const progress = readProgress(partial, spec, input.childName);
        if (!progress) return;
        const hasCover = !!progress.cover;
        if ((reported.cover && !hasCover) || progress.scenes.length < reported.scenes) reported = { ...none };
        const isNew = !reported.cast || (hasCover && !reported.cover) || progress.scenes.length > reported.scenes;
        if (!isNew) return;
        reported = { cast: true, cover: reported.cover || hasCover, scenes: Math.max(reported.scenes, progress.scenes.length) };
        opts.onProgress!(progress);
      }
    : undefined;
  const first = await callOpenAIStructured({
    model,
    system: SYSTEM_PROMPT,
    user: buildPlanUserPrompt(input, spec),
    schemaName: "book_plan",
    schema,
    reasoningEffort: opts?.reasoningEffort ?? BOOK_PLAN_REASONING,
    timeoutMs: 240_000,
    maxCompletionTokens: 32_000,
    label: "book-plan",
    onPartial,
  });
  let usage = first.usage;
  let costUsd = first.costUsd ?? 0;
  let draft = normalizeDraft(first.data, spec, input.childName, input.locale || "es");
  const initialViolations = await checkPlan(draft, input, spec);
  let violations = initialViolations;
  const repairMs: number[] = [];

  for (let round = 1; round <= MAX_REPAIR_ROUNDS && violations.length > 0; round++) {
    console.log(`[BookPlan] repair round ${round}: ${violations.length} issue(s) in slots [${[...new Set(violations.map((v) => v.sceneNumber))].join(", ")}]`);
    for (const v of violations) console.log(`  slot ${v.sceneNumber} ${v.code}: ${v.message}`);
    try {
      const repair = await callOpenAIStructured({
        model: repairModel,
        system: REPAIR_SYSTEM,
        user: buildRepairPrompt(draft, input, spec, violations),
        schemaName: "scene_repair",
        schema: RepairSchema,
        reasoningEffort: BOOK_REPAIR_REASONING,
        timeoutMs: 180_000,
        maxCompletionTokens: 16_000,
        label: `book-plan-repair-${round}`,
      });
      repairMs.push(repair.elapsedMs);
      usage = addUsage(usage, repair.usage);
      costUsd += repair.costUsd ?? 0;
      const flagged = new Set(violations.map((v) => v.sceneNumber));
      const fixes = new Map(repair.data.scenes.filter((s) => flagged.has(s.sceneNumber)).map((s) => [s.sceneNumber, s]));
      draft = {
        ...draft,
        scenes: draft.scenes.map((s) => {
          const f = fixes.get(s.sceneNumber);
          const locale = input.locale || "es";
          return f && f.text.trim()
            ? { ...s, title: normalizeLocaleText(f.title.trim() || s.title, locale), text: normalizeLocaleText(f.text.trim(), locale) }
            : s;
        }),
      };
    } catch (err) {
      console.warn(`[BookPlan] repair round ${round} failed (keeping current text):`, err instanceof Error ? err.message : err);
      break;
    }
    violations = await checkPlan(draft, input, spec);
  }
  if (violations.length) {
    console.warn(`[BookPlan] ${violations.length} issue(s) remain after repair:`);
    for (const v of violations) console.warn(`  slot ${v.sceneNumber} ${v.code}: ${v.message}`);
  }

  const dedicationText = parentDedication ?? draft.dedication?.trim() ?? "";
  const plan: BookPlan = {
    ...draft,
    version: 1,
    locale: input.locale || "es",
    mode: spec.mode,
    childName: input.childName,
    gender: input.gender,
    age: input.age,
    dedicationSource: parentDedication ? "parent" : dedicationText ? "generated" : "none",
    dedicationText,
    model: first.model,
  };
  const totalMs = Date.now() - start;
  console.log(`[BookPlan] done in ${(totalMs / 1000).toFixed(1)}s ~$${costUsd.toFixed(3)} — "${plan.title}"`);
  return {
    plan,
    report: { model: first.model, repairModel, planMs: first.elapsedMs, repairMs, totalMs, usage, costUsd, initialViolations, finalViolations: violations },
  };
}

// ── Consumer contract ────────────────────────────────────────────────────────
//
// The image pipeline consumes the plan through planToVisualCast + planToShotList
// (exact visual-assets / scene-screenplay types), which replace the
// extractVisualCast and generateShotList LLM calls. planToGeneratedStory feeds
// the viewer/PDF; planToArchitectOutput is the legacy view.

/** Recurring secondary characters kept consistent via sheets (mirrors visual-assets MAX_CAST). */
export const VISUAL_MAX_CAST = 5;
export const VISUAL_MAX_WORLD = 5;

function scenesWith(plan: BookPlanDraft, pred: (shot: PlanShot) => boolean): number[] {
  return plan.scenes.filter((s) => pred(s.shot)).map((s) => s.sceneNumber);
}

/**
 * VisualCast for the image engine: cast members and world assets that recur
 * (2+ scenes), most frequent first, with canonical English descriptions.
 * One-off characters are inlined into their shot's action by planToShotList.
 */
export function planToVisualCast(plan: BookPlanDraft): VisualCast {
  const byUse = <T extends { scenes: number[] }>(a: T, b: T) => b.scenes.length - a.scenes.length;
  const cast: CastMember[] = plan.cast
    .map((c) => ({ id: c.id, name: c.name, kind: c.kind, description: c.visual, scenes: scenesWith(plan, (sh) => sh.castIds.includes(c.id)) }))
    .filter((c) => c.scenes.length >= 2)
    .sort(byUse)
    .slice(0, VISUAL_MAX_CAST);
  const world: WorldAsset[] = plan.world
    .map((w) => ({ id: w.id, name: w.name, kind: w.kind, description: w.visual, scenes: scenesWith(plan, (sh) => sh.worldIds.includes(w.id)) }))
    .filter((w) => w.scenes.length >= 2)
    .sort(byUse)
    .slice(0, VISUAL_MAX_WORLD);
  return { cast, world };
}

/**
 * One plan shot → ShotSpec for the image engine. Exported for the streaming
 * preview, which builds specs from a partial plan (BookPlanProgress) with a
 * provisional visual cast.
 */
export function toShotSpec(plan: Pick<BookPlanDraft, "cast" | "world">, shot: PlanShot, sceneNumber: number, frame: ShotFrame, visual: VisualCast): ShotSpec {
  const castKept = new Set(visual.cast.map((c) => c.id));
  const worldKept = new Set(visual.world.map((w) => w.id));
  // Characters/objects without a reference sheet are described inline so they still look right.
  const inline = [
    ...shot.castIds.filter((id) => id !== PLAN_CHILD_ID && !castKept.has(id)).map((id) => plan.cast.find((c) => c.id === id)),
    ...shot.worldIds.filter((id) => !worldKept.has(id)).map((id) => plan.world.find((w) => w.id === id)),
  ]
    .filter((x): x is PlanCastMember | PlanWorldAsset => !!x)
    // Cast keep their proper name; world items get an English label (their name is in the book language).
    .map((x) => `${"kind" in x && (x.kind === "location" || x.kind === "object") ? x.id.replace(/_/g, " ") : x.name}: ${x.visual}`);
  return {
    sceneNumber,
    frame,
    camera: shot.camera,
    shotScale: frame === "panorama" ? "wide" : shot.shotScale,
    action: inline.length ? `${shot.action} (${inline.join(" ")})` : shot.action,
    setting: shot.setting,
    light: shot.light,
    cast: shot.castIds.filter((id) => id === PLAN_CHILD_ID || castKept.has(id)),
    world: shot.worldIds.filter((id) => worldKept.has(id)),
  };
}

/**
 * ShotList for the image engine. `frameFor` is scene-screenplay's
 * frameForScene (injected to keep this module free of runtime cycles).
 */
export function planToShotList(plan: BookPlanDraft, frameFor: (sceneNumber: number) => ShotFrame, visual: VisualCast = planToVisualCast(plan)): ShotList {
  return {
    shots: plan.scenes.map((s) => toShotSpec(plan, s.shot, s.sceneNumber, frameFor(s.sceneNumber), visual)),
    cover: toShotSpec(plan, plan.cover, 0, "cover", visual),
  };
}

/**
 * Plain deterministic English prompt for one shot (the viewer's alt text,
 * `story_illustrations.prompt_used` fallback, legacy Recraft path). The image
 * engine builds its own prompts from planToShotList.
 */
export function buildShotPrompt(plan: BookPlanDraft, shot: PlanShot, childDescription: string, panoramic: boolean): string {
  const who = shot.castIds.map((id) => {
    if (id === PLAN_CHILD_ID) return `The child: ${childDescription}.`;
    const c = plan.cast.find((m) => m.id === id);
    return c ? `${c.name}: ${c.visual}` : "";
  });
  const things = shot.worldIds.map((id) => plan.world.find((w) => w.id === id)).filter((w): w is PlanWorldAsset => !!w);
  const absent = plan.cast.filter((c) => !shot.castIds.includes(c.id)).map((c) => c.name);
  return [
    shot.action,
    ...who,
    `Setting: ${shot.setting}`,
    things.length ? `Recurring elements: ${things.map((w) => `${w.name} (${w.visual})`).join("; ")}.` : "",
    `Camera: ${shot.camera}${panoramic ? "; wide double-page panorama" : ""}. Light: ${shot.light}.`,
    absent.length ? `Not in this picture: ${absent.join(", ")}.` : "",
    "No written text in the image.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function planToGeneratedStory(plan: BookPlan, childDescription: string): GeneratedStory {
  const scenes: GeneratedScene[] = plan.scenes.map((s) => ({
    sceneNumber: s.sceneNumber,
    title: s.title,
    text: s.text,
    imagePrompt: buildShotPrompt(plan, s.shot, childDescription, PANORAMIC_SCENES.includes(s.sceneNumber)),
    type: s.type,
  }));
  return {
    bookTitle: plan.title,
    titleOptions: [plan.title, ...plan.alternateTitles].slice(0, 4),
    coverImagePrompt: buildShotPrompt(plan, plan.cover, childDescription, false),
    scenes,
    dedication: plan.dedicationText,
    dedicationSource: plan.dedicationSource,
    finalMessage: plan.finalMessage,
    synopsis: plan.synopsis,
    bookPlan: plan,
  };
}

/** Legacy ArchitectOutput view (brief = English illustrated moment + action). */
export function planToArchitectOutput(plan: BookPlan, childDescription: string): ArchitectOutput {
  const story = planToGeneratedStory(plan, childDescription);
  return {
    bookTitle: story.bookTitle,
    titleOptions: story.titleOptions,
    coverImagePrompt: story.coverImagePrompt,
    scenes: plan.scenes.map((s, i) => ({
      sceneNumber: s.sceneNumber,
      title: s.title,
      brief: `${s.illustratedMoment} ${s.shot.action}`,
      imagePrompt: story.scenes[i].imagePrompt,
      type: s.type,
    })),
    dedication: story.dedication,
    finalMessage: story.finalMessage,
    synopsis: story.synopsis,
    plan,
  };
}

/** The child's canonical description (Character Bible) — same bytes as the image prompts. */
export function buildPlanChildDescription(input: StoryInput): string {
  return buildCharacterVisualDescription({
    gender: input.gender,
    age: input.age,
    skinTone: input.skinTone,
    hairColor: input.hairColor,
    eyeColor: input.eyeColor,
    hairstyle: input.hairstyle,
    favoriteColor: input.favoriteColor,
    glasses: input.glasses,
    freckles: input.freckles,
  });
}
