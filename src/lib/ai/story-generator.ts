// Two-tier story generation architecture
//
// PHASE 1 — ARCHITECT (GPT-5.4, single call):
//   Plans the entire book in one coherent creative vision.
//   Outputs: skeleton with 12 scene briefs, 12 image prompts, cover prompt,
//   secondary prompts, titles, dedication, synopsis, final message.
//   The text for each scene is a SHORT brief (2-3 sentences summarizing what happens).
//
// PHASE 2 — EXPANSION (gpt-5-mini, 12 parallel calls):
//   Each scene brief gets expanded into full narrative text by a fast, cheap model.
//   All 12 calls run in parallel → completes in ~10-15s.
//
// Both phases use native Node.js https to bypass Next.js undici socket drops.

import * as https from "node:https";
import * as http from "node:http";
import {
  getTemplateConfig,
  getDecisionNarrative,
  getEndingNarrative,
  getAtmosphereNarrative,
} from "@/lib/create-store";
import { generateMockStory } from "./mock-story";
import { buildCharacterVisualDescription } from "./character-description";

// ── Native HTTPS fetch (bypasses undici) ─────────────────────────────────────

function nativeFetch(
  url: string,
  options: { method: string; headers: Record<string, string>; body: string; timeoutMs?: number },
): Promise<{ ok: boolean; status: number; text: () => Promise<string>; json: () => Promise<unknown> }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === "https:" ? https : http;
    const timeoutMs = options.timeoutMs ?? 180_000;

    const req = transport.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: options.method,
        headers: options.headers,
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf-8");
          const status = res.statusCode ?? 500;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            text: () => Promise.resolve(body),
            json: () => Promise.resolve(JSON.parse(body)),
          });
        });
        res.on("error", reject);
      },
    );

    req.on("timeout", () => {
      req.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
    });
    req.on("error", reject);
    req.write(options.body);
    req.end();
  });
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface GeneratedScene {
  sceneNumber: number;
  title: string;
  text: string;
  imagePrompt: string;
  type: "scene" | "bridge";
}

export interface GeneratedStory {
  bookTitle: string;
  titleOptions: string[];
  coverImagePrompt: string;
  scenes: GeneratedScene[];
  dedication: string;
  finalMessage: string;
  synopsis: string;
}

/** Intermediate format returned by the architect — briefs instead of full text */
interface ArchitectScene {
  sceneNumber: number;
  title: string;
  brief: string;       // 2-3 sentence summary of what happens
  imagePrompt: string;  // Final image prompt (English)
  type: "scene" | "bridge";
}

interface ArchitectOutput {
  bookTitle: string;
  titleOptions: string[];
  coverImagePrompt: string;
  scenes: ArchitectScene[];
  dedication: string;
  finalMessage: string;
  synopsis: string;
}

// ── Age config ───────────────────────────────────────────────────────────────

interface AgeConfig {
  sceneCount: number;
  bridgeCount: number;
  wordsPerScene: string;
  textStyle: string;
  /** Recraft community style UUID — pass as style_id in generation requests */
  illustrationStyleId: string;
  /** Base style for custom style creation (POST /v1/styles) — always digital_illustration */
  illustrationBaseStyle: string;
  illustrationPromptStyle: string;
}

function getAgeConfig(age: number, locale?: string): AgeConfig {
  const localeConfig = getLocaleConfig(locale);

  // Default styles per age band (fallback when no override provided)
  const DEFAULT_STYLE_2_4 = "f8a6d90e-e29a-4d73-8f9d-3a5909162a09"; // Whimsy Pastel Mode
  const DEFAULT_STYLE_5_6 = "99303d77-4f0d-4e89-b2cb-302ac3f46717"; // Whimsical Nook
  const DEFAULT_STYLE_7_9 = "002b8065-25a9-4d91-a260-8db3692a3865"; // Warm Storytelling
  const DEFAULT_STYLE_10_12 = "cf3f45c6-a0b9-4220-a9f1-cc57b951247e"; // Classic Oasis

  const defaultStyleId = age <= 4 ? DEFAULT_STYLE_2_4
    : age <= 6 ? DEFAULT_STYLE_5_6
    : age <= 9 ? DEFAULT_STYLE_7_9
    : DEFAULT_STYLE_10_12;

  const illustrationStyleId = defaultStyleId;
  const illustrationBaseStyle = "digital_illustration";
  const illustrationPromptStyle = null;

  if (age <= 4) {
    return {
      sceneCount: 8,
      bridgeCount: 4,
      wordsPerScene: "50-80",
      textStyle: [
        "Write for a very young child (2-4 years old).",
        "Use SHORT, simple sentences (max 10 words each). 3-5 sentences per scene.",
        "Vocabulary must be basic: familiar words a toddler knows.",
        `Use onomatopoeia (${localeConfig.onomatopoeia}), repetition, and musical rhythm.`,
        "Include sensory moments: sounds, textures, colors.",
        "For 'juntos' mode: add spots where the parent can pause with interactive questions.",
        "Emotions should be simple and clear: happy, scared, surprised, proud.",
        "No complex metaphors or abstract concepts.",
      ].join("\n"),
      illustrationStyleId,
      illustrationBaseStyle,
      illustrationPromptStyle: illustrationPromptStyle ?? "Whimsical pastel children's book illustration for toddlers, soft dreamy colors, big rounded shapes, exaggerated friendly expressions, simple compositions, gentle lighting, no text in image.",
    };
  }

  if (age <= 7) {
    return {
      sceneCount: 10,
      bridgeCount: 2,
      wordsPerScene: "100-140",
      textStyle: [
        "Write for a child aged 5-7.",
        "5-7 sentences per scene (~100-140 words).",
        "Use lively, playful language with short dialogues between characters.",
        "Include humor, rhetorical questions, and moments of wonder.",
        "Sensory details: sounds, smells, textures — but not overwhelming.",
        "The protagonist should express simple thoughts and emotions out loud.",
        "Vocabulary is richer than toddler level but still accessible: no abstract words.",
        "Build small moments of tension and relief — kids this age love suspense with safe resolution.",
      ].join("\n"),
      illustrationStyleId,
      illustrationBaseStyle,
      illustrationPromptStyle: illustrationPromptStyle ?? "Whimsical nook illumination children's book illustration, warm glowing light, intricate charming details, cozy storybook atmosphere, expressive characters, rich textures, no text in image.",
    };
  }

  return {
    sceneCount: 12,
    bridgeCount: 0,
    wordsPerScene: "150-200",
    textStyle: [
      "Write for a child aged 8-12.",
      "7-10 rich narrative sentences per scene (~150-200 words).",
      "Use vivid prose with sensory details, inner monologue, metaphors, and emotional depth.",
      "Include meaningful dialogues that reveal character.",
      "The protagonist should have internal conflicts, doubts, and growth moments.",
      "Vocabulary can be sophisticated: the reader is capable and curious.",
      "Explore complex emotions: loyalty, sacrifice, identity, belonging.",
      "Build genuine narrative tension — the stakes should feel real.",
      "Subtle humor and wit are welcome. Avoid being preachy — show the moral through action, not words.",
    ].join("\n"),
    illustrationStyleId,
    illustrationBaseStyle,
    illustrationPromptStyle: illustrationPromptStyle ?? "Warm nostalgic Aesopus illustration style, timeless classic book aesthetic, elegant detailed linework, warm earthy tones, sophisticated cinematic compositions, no text in image.",
  };
}

export { getAgeConfig };

export interface StoryInput {
  childName: string;
  gender: "boy" | "girl" | "neutral";
  age: number;
  city: string;
  interests: string[];
  specialTrait?: string;
  favoriteCompanion?: string;
  favoriteFood?: string;
  futureDream?: string;
  hairColor?: string;
  eyeColor?: string;
  skinTone?: string;
  hairstyle?: string;
  templateId: string;
  templateTitle: string;
  creationMode: "solo" | "juntos";
  decisions: Record<string, unknown>;
  dedication?: string;
  senderName?: string;
  endingChoice?: string;
  endingNote?: string;
  locale?: string;
}

// ── Locale helpers ───────────────────────────────────────────────────────────

interface LocaleConfig {
  /** Full language name for LLM prompts (e.g. "Spanish (Spain)") */
  language: string;
  /** Gender label for boy/girl/neutral */
  genderLabels: { boy: string; girl: string; neutral: string };
  /** Onomatopoeia examples for toddler text */
  onomatopoeia: string;
}

const LOCALE_CONFIGS: Record<string, LocaleConfig> = {
  es: {
    language: "Spanish (Spain)",
    genderLabels: { boy: "niño", girl: "niña", neutral: "niñe" },
    onomatopoeia: "¡SPLASH! ¡BUM! ¡FIUUU!",
  },
  ca: {
    language: "Catalan",
    genderLabels: { boy: "nen", girl: "nena", neutral: "infant" },
    onomatopoeia: "¡SPLASH! ¡BUM! ¡FIUUU!",
  },
  en: {
    language: "English",
    genderLabels: { boy: "boy", girl: "girl", neutral: "child" },
    onomatopoeia: "SPLASH! BOOM! WHOOSH!",
  },
  fr: {
    language: "French",
    genderLabels: { boy: "garçon", girl: "fille", neutral: "enfant" },
    onomatopoeia: "SPLASH ! BOUM ! WHOUSH !",
  },
};

function getLocaleConfig(locale?: string): LocaleConfig {
  return LOCALE_CONFIGS[locale || "es"] || LOCALE_CONFIGS.es;
}

// ── Model config ─────────────────────────────────────────────────────────────

/** Premium model for the architect call — plans the entire book */
const ARCHITECT_MODEL = process.env.OPENAI_ARCHITECT_MODEL || "gpt-5.4";
/** Fast model for parallel scene expansion */
const EXPANSION_MODEL = process.env.OPENAI_EXPANSION_MODEL || "gpt-5-mini";

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (key && !key.includes("your_") && !key.includes("_here")) return key;
  throw new Error("OPENAI_API_KEY not configured in .env.local");
}

export function hasAnyProvider(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return !!key && !key.includes("your_") && !key.includes("_here");
}

// ── LLM call helper ──────────────────────────────────────────────────────────

async function callLLM(
  prompt: string,
  model: string,
  options?: { json?: boolean; timeoutMs?: number },
): Promise<string> {
  const apiKey = getApiKey();
  const url = "https://api.openai.com/v1/chat/completions";
  const useJson = options?.json ?? true;
  const timeoutMs = options?.timeoutMs ?? 120_000;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    model,
    messages: [{ role: "user", content: prompt }],
  };
  if (useJson) {
    payload.response_format = { type: "json_object" };
  }

  const body = JSON.stringify(payload);
  const start = Date.now();

  const MAX_RETRIES = 2;
  let response: Awaited<ReturnType<typeof nativeFetch>> | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      response = await nativeFetch(url, { method: "POST", headers, body, timeoutMs });
      break;
    } catch (err) {
      const isTransient = err instanceof Error && (
        err.message.includes("socket") ||
        err.message.includes("timed out") ||
        err.message.includes("ECONNRESET") ||
        err.message.includes("EPIPE")
      );
      if (isTransient && attempt < MAX_RETRIES) {
        console.warn(`[LLM] ${model} attempt ${attempt + 1} failed: ${err instanceof Error ? err.message : err}`);
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      throw err;
    }
  }

  if (!response) throw new Error(`All fetch attempts to ${model} failed`);

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`${model} error (${response.status}): ${errorBody}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await response.json()) as any;
  const content: string | undefined = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`Empty response from ${model}`);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[LLM] ${model} responded in ${elapsed}s (${content.length} chars)`);

  return content;
}

function parseJsonResponse<T>(raw: string, label: string): T {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error(`[StoryGen] JSON parse failed (${label}). First 500 chars:`, cleaned.slice(0, 500));
    throw new Error(`Invalid JSON from ${label}: ${err instanceof Error ? err.message : "parse error"}`);
  }
}

// ── Narrative context helpers ────────────────────────────────────────────────

function buildDecisionsContext(input: StoryInput): string {
  const template = getTemplateConfig(input.templateId);
  if (!template) return "";

  const lines: string[] = [];
  const decisions = input.decisions as Record<string, string>;

  if (decisions.encounter) {
    const narrative = getDecisionNarrative(template, "encounter", decisions.encounter);
    if (narrative) lines.push(`- ENCOUNTER: ${narrative}`);
  }
  if (decisions.companion) {
    const narrative = getDecisionNarrative(template, "companion", decisions.companion);
    if (narrative) lines.push(`- COMPANION: ${narrative}`);
  }
  if (decisions.challenge) {
    const narrative = getDecisionNarrative(template, "challenge", decisions.challenge);
    if (narrative) lines.push(`- CHALLENGE: ${narrative}`);
  }
  if (decisions.timeOfDay || decisions.setting) {
    const atm = getAtmosphereNarrative(template, decisions.timeOfDay, decisions.setting);
    if (atm.time) lines.push(`- ATMOSPHERE (time): ${atm.time}`);
    if (atm.setting) lines.push(`- ATMOSPHERE (setting): ${atm.setting}`);
  }
  if (decisions.specialMoment) {
    lines.push(`- SPECIAL MOMENT (requested by parent): "${decisions.specialMoment}" — weave this naturally`);
  }

  if (lines.length === 0) return "";
  return `\nSTORY DECISIONS (incorporate ALL):\n${lines.join("\n")}`;
}

export { buildCharacterVisualDescription } from "./character-description";

// ── Narrative structure ──────────────────────────────────────────────────────

function buildNarrativeStructure(input: StoryInput, ageConfig: AgeConfig): string {
  const name = input.childName;
  const city = input.city || "their city";

  if (ageConfig.bridgeCount === 4) {
    return `
NARRATIVE STRUCTURE — 8 scenes + 4 bridges:

BLOCK 1 — "MI MUNDO"
  Slot 1 [scene]: ${name} in ${city}. Personality through actions.
  Slot 2 [scene]: What ${name} loves. Use interests naturally.
  Slot 3 [bridge]: Something changes. Anticipation.

BLOCK 2 — "LA LLAMADA"
  Slot 4 [scene]: Adventure world opens. Template theme.
  Slot 5 [scene]: First ally appears. Bond through action.
  Slot 6 [bridge]: Wonder and excitement.

BLOCK 3 — "EL CAMINO"
  Slot 7 [scene]: Exploring. Interests as tools/skills.
  Slot 8 [scene]: Small challenge — overcome with help.
  Slot 9 [bridge]: Tension builds.

BLOCK 4 — "LA PRUEBA Y EL REGRESO"
  Slot 10 [scene]: Big challenge arrives.
  Slot 11 [scene]: Inner strength. Moral through action.
  Slot 12 [bridge]: Coming home transformed.`;
  }

  if (ageConfig.bridgeCount === 2) {
    return `
NARRATIVE STRUCTURE — 10 scenes + 2 bridges:

BLOCK 1 — "MI MUNDO"
  Slot 1 [scene]: ${name} in ${city}. Personality through routine.
  Slot 2 [scene]: First hint of adventure.
  Slot 3 [bridge]: Threshold between ordinary and extraordinary.

BLOCK 2 — "LA LLAMADA"
  Slot 4 [scene]: Adventure world opens.
  Slot 5 [scene]: Meeting ally/companion.

BLOCK 3 — "EL CAMINO"
  Slot 6 [scene]: Wonders of new world.
  Slot 7 [scene]: First test.
  Slot 8 [scene]: Emotional moment, deepening bonds.
  Slot 9 [bridge]: Calm before the storm.

BLOCK 4 — "LA PRUEBA"
  Slot 10 [scene]: Great challenge.
  Slot 11 [scene]: Breakthrough, courage.

BLOCK 5 — "VOLVER A CASA"
  Slot 12 [scene]: Returning transformed.`;
  }

  return `
NARRATIVE STRUCTURE — 12 scenes, no bridges:

BLOCK 1 — "MI MUNDO"
  Slot 1 [scene]: ${name} in ${city}. Personality, routine, inner world.
  Slot 2 [scene]: Anomaly. The ordinary cracks.

BLOCK 2 — "LA LLAMADA"
  Slot 3 [scene]: Entering the unknown. Fear vs curiosity.
  Slot 4 [scene]: First encounter — unexpected shift.
  Slot 5 [scene]: Meeting ally. Bonding through vulnerability.

BLOCK 3 — "EL CAMINO"
  Slot 6 [scene]: New world's wonders. Interests in unexpected ways.
  Slot 7 [scene]: Test reveals hidden strengths.
  Slot 8 [scene]: Quiet intimate moment. Calm before the storm.

BLOCK 4 — "LA PRUEBA"
  Slot 9 [scene]: Main obstacle. Stakes are real.
  Slot 10 [scene]: Darkest moment. Doubt, fear.
  Slot 11 [scene]: Breakthrough. True courage.

BLOCK 5 — "VOLVER A CASA"
  Slot 12 [scene]: Home transformed. Carry the lesson.`;
}

// ── PHASE 1: Architect prompt ────────────────────────────────────────────────

function buildArchitectPrompt(input: StoryInput): string {
  const localeConfig = getLocaleConfig(input.locale);
  const lang = localeConfig.language;
  const ageConfig = getAgeConfig(input.age, input.locale);
  const template = getTemplateConfig(input.templateId);
  const theme = template?.theme || "A magical adventure";
  const moral = template?.moral || "Being kind matters";
  const characterVisual = buildCharacterVisualDescription(input);
  const genderLabel = localeConfig.genderLabels[input.gender];

  let endingInstruction = "End the story in a warm, satisfying way.";
  if (input.endingChoice && template) {
    const endingNarrative = getEndingNarrative(template, input.endingChoice);
    if (endingNarrative) endingInstruction = endingNarrative;
  }
  if (input.endingNote) {
    endingInstruction += ` Parent requested for the ending: "${input.endingNote}"`;
  }

  const decisionsContext = buildDecisionsContext(input);

  const personalDetails: string[] = [];
  if (input.specialTrait) personalDetails.push(`- Special trait: "${input.specialTrait}"`);
  if (input.favoriteCompanion) personalDetails.push(`- Favorite companion: "${input.favoriteCompanion}" — should appear in the story`);
  if (input.favoriteFood) personalDetails.push(`- Favorite food: "${input.favoriteFood}" — mention at a natural moment`);
  if (input.futureDream) personalDetails.push(`- Future dream: "${input.futureDream}" — weave into motivation`);
  const personalSection = personalDetails.length > 0
    ? `\nPERSONAL DETAILS (make the story unique):\n${personalDetails.join("\n")}`
    : "";

  const modeInstruction = input.creationMode === "juntos"
    ? "READ TOGETHER by parent and child. Short sentences, playful language, interactive pauses."
    : "GIFT from a parent. Emotional depth, callbacks to personal details.";

  const narrativeStructure = buildNarrativeStructure(input, ageConfig);

  return `You are a world-class children's book ARCHITECT. Your job: plan an ENTIRE personalized book in one coherent creative vision.

You produce a SKELETON — for each scene you write a SHORT BRIEF (2-3 sentences summarizing what happens, the emotion, key details) that a writer will later expand. You also produce the FINAL image prompts (ready for the illustrator).

RULES:
- ALL text content (titles, briefs, dedication, finalMessage, synopsis) MUST be written in ${lang}.
- Image prompts MUST be in ENGLISH (they go to an image generator).
- Protagonist is ALWAYS the child below.
- NEVER include text in image prompts.
- Protagonist visual in EVERY image prompt: "${characterVisual}" — after action/setting.
- Plan a VISUAL JOURNEY — each imagePrompt uses a DIFFERENT composition:
  * Vary camera: wide, medium, close-up, bird's-eye, low angle, over-the-shoulder
  * Vary poses: running, sitting, reaching, crouching, jumping, climbing, hugging
  * Vary framing: small in landscape, filling frame, interacting with objects/creatures
  * NEVER repeat "character standing and looking at something"

AGE: ${input.age} years old
MODE: ${modeInstruction}

PROTAGONIST:
- Name: ${input.childName} | Gender: ${genderLabel} | Age: ${input.age}
- City: ${input.city || "una ciudad mágica"}
- Interests: ${input.interests.join(", ") || "adventure, imagination"}
${personalSection}

TEMPLATE: "${input.templateTitle}" | Theme: ${theme} | Moral: ${moral}
${decisionsContext}

ENDING: ${endingInstruction}
${input.dedication ? `DEDICATION from ${input.senderName || "someone special"}: "${input.dedication}"` : ""}

Generate EXACTLY 12 slots: ${ageConfig.sceneCount} scenes + ${ageConfig.bridgeCount} bridges.
- "scene": brief = 2-3 sentences describing what happens + emotion + key actions
- "bridge": brief = 1 atmospheric sentence (max 25 words) — this IS the final text, no expansion needed

${narrativeStructure}

JSON:
{
  "bookTitle": "Primary title in ${lang}",
  "titleOptions": ["Title 1", "Title 2", "Title 3", "Title 4"],
  "coverImagePrompt": "ENGLISH. Wide-angle editorial cover. ${characterVisual} as hero, adventurous pose, ${theme} world in background. ${ageConfig.illustrationPromptStyle}",
  "dedication": "Dedication text in ${lang}",
  "scenes": [
    {
      "sceneNumber": 1,
      "type": "scene",
      "title": "Evocative title in ${lang}",
      "brief": "2-3 sentences in ${lang}: what happens, the emotion, the key action. This will be expanded by a writer.",
      "imagePrompt": "ENGLISH. Action + setting first, then ${characterVisual} with specific pose. Camera: [angle]. ${ageConfig.illustrationPromptStyle}"
    },
    {
      "sceneNumber": 3,
      "type": "bridge",
      "brief": "One atmospheric sentence in ${lang} (max 25 words). This IS the final text.",
      "title": "Short evocative title",
      "imagePrompt": "ENGLISH atmospheric. Mood + environment. ${characterVisual} small/silhouetted. ${ageConfig.illustrationPromptStyle}"
    }
  ],
  "finalMessage": "Closing message in ${lang}, tied to the moral.",
  "synopsis": "2-3 sentences in ${lang} for back cover."
}

ONLY the JSON, no markdown, no code blocks.`;
}

// ── PHASE 2: Scene expansion prompt ──────────────────────────────────────────

function buildExpansionPrompt(
  scene: ArchitectScene,
  input: StoryInput,
  ageConfig: AgeConfig,
  globalContext: { bookTitle: string; totalScenes: number },
): string {
  const localeConfig = getLocaleConfig(input.locale);
  const lang = localeConfig.language;
  const genderLabel = localeConfig.genderLabels[input.gender];

  return `You are a children's book writer. Expand this scene brief into full narrative text in ${lang}.

BOOK: "${globalContext.bookTitle}" — scene ${scene.sceneNumber} of ${globalContext.totalScenes}
SCENE TITLE: "${scene.title}"
SCENE BRIEF: "${scene.brief}"

PROTAGONIST: ${input.childName}, ${genderLabel}, ${input.age}, ${input.city || "a magical city"}

WRITING STYLE:
${ageConfig.textStyle}

RULES:
- Write ONLY the narrative text for this scene. No title, no scene number.
- Target: ${ageConfig.wordsPerScene} words.
- Write in ${lang}.
- Stay faithful to the brief — expand, don't reinvent.
- Make it vivid, emotional, age-appropriate.

Return a JSON object: { "text": "the full narrative text" }`;
}

// ── Locale-aware fallbacks ───────────────────────────────────────────────────

function getFallbackTitles(childName: string, locale?: string): string[] {
  switch (locale) {
    case "ca":
      return [`La gran aventura d'${childName}`, `${childName} i el món màgic`, `El viatge d'${childName}`];
    case "en":
      return [`${childName}'s Great Adventure`, `${childName} and the Magic World`, `The Journey of ${childName}`];
    case "fr":
      return [`La grande aventure de ${childName}`, `${childName} et le monde magique`, `Le voyage de ${childName}`];
    default:
      return [`La gran aventura de ${childName}`, `${childName} y el mundo mágico`, `El viaje de ${childName}`];
  }
}

function getFallbackSynopsis(childName: string, locale?: string): string {
  switch (locale) {
    case "ca":
      return `${childName} està a punt de viure l'aventura més extraordinària de la seva vida. Amb valentia, imaginació i el cor ple de ganes, s'endinsarà en un món on tot és possible. Estàs a punt per acompanyar-lo?`;
    case "en":
      return `${childName} is about to live the most extraordinary adventure of their life. With courage, imagination, and a heart full of wonder, they'll step into a world where anything is possible. Are you ready to join them?`;
    case "fr":
      return `${childName} est sur le point de vivre l'aventure la plus extraordinaire de sa vie. Avec courage, imagination et le cœur plein d'envie, il s'aventurera dans un monde où tout est possible. Es-tu prêt à l'accompagner ?`;
    default:
      return `${childName} está a punto de vivir la aventura más extraordinaria de su vida. Con valentía, imaginación y el corazón lleno de ganas, se adentrará en un mundo donde todo es posible. ¿Estás listo para acompañarle?`;
  }
}

// ── Main entry point ─────────────────────────────────────────────────────────

export async function generateStory(input: StoryInput): Promise<GeneratedStory> {
  const mockMode = process.env.MOCK_MODE === "true";

  if (mockMode || !hasAnyProvider()) {
    const reason = mockMode ? "MOCK_MODE=true" : "no LLM API key";
    console.log(`[StoryGen] MOCK MODE — ${reason}`);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return generateMockStory(input);
  }

  const ageConfig = getAgeConfig(input.age, input.locale);
  const characterVisual = buildCharacterVisualDescription(input);

  // ── PHASE 1: Architect call (GPT-5.4) ──────────────────────────────────────
  console.log(`[StoryGen] Phase 1: Architect (${ARCHITECT_MODEL})...`);
  const architectPrompt = buildArchitectPrompt(input);
  const architectRaw = await callLLM(architectPrompt, ARCHITECT_MODEL, { timeoutMs: 120_000 });
  const architect = parseJsonResponse<ArchitectOutput>(architectRaw, ARCHITECT_MODEL);

  // Validate architect output
  if (!architect.bookTitle || !architect.scenes || !Array.isArray(architect.scenes)) {
    throw new Error(`${ARCHITECT_MODEL} returned invalid skeleton: missing bookTitle or scenes`);
  }
  if (architect.scenes.length < 12) {
    throw new Error(`${ARCHITECT_MODEL} returned ${architect.scenes.length} scenes (need 12)`);
  }
  if (architect.scenes.length > 12) {
    architect.scenes = architect.scenes.slice(0, 12);
  }

  // Normalize scene numbers
  for (let i = 0; i < 12; i++) {
    architect.scenes[i].sceneNumber = i + 1;
    if (!architect.scenes[i].type || !["scene", "bridge"].includes(architect.scenes[i].type)) {
      architect.scenes[i].type = "scene";
    }
  }

  console.log(`[StoryGen] Phase 1 done: "${architect.bookTitle}" — ${architect.scenes.filter(s => s.type === "scene").length} scenes, ${architect.scenes.filter(s => s.type === "bridge").length} bridges`);

  // ── PHASE 2: Parallel scene expansion (gpt-5-mini × 12) ───────────────────
  console.log(`[StoryGen] Phase 2: Expanding ${architect.scenes.length} scenes in parallel (${EXPANSION_MODEL})...`);
  const phase2Start = Date.now();

  const globalContext = { bookTitle: architect.bookTitle, totalScenes: 12 };

  const expansionResults = await Promise.allSettled(
    architect.scenes.map(async (scene): Promise<{ sceneNumber: number; text: string }> => {
      // Bridges already have final text in their brief — no expansion needed
      if (scene.type === "bridge") {
        return { sceneNumber: scene.sceneNumber, text: scene.brief };
      }

      const prompt = buildExpansionPrompt(scene, input, ageConfig, globalContext);
      const raw = await callLLM(prompt, EXPANSION_MODEL, { timeoutMs: 60_000 });
      const parsed = parseJsonResponse<{ text: string }>(raw, `${EXPANSION_MODEL}:scene${scene.sceneNumber}`);
      return { sceneNumber: scene.sceneNumber, text: parsed.text || scene.brief };
    }),
  );

  const phase2Elapsed = ((Date.now() - phase2Start) / 1000).toFixed(1);
  const succeeded = expansionResults.filter(r => r.status === "fulfilled").length;
  const failed = expansionResults.filter(r => r.status === "rejected").length;
  console.log(`[StoryGen] Phase 2 done in ${phase2Elapsed}s — ${succeeded} ok, ${failed} failed`);

  // ── Merge architect skeleton + expanded texts ──────────────────────────────
  const scenes: GeneratedScene[] = architect.scenes.map((archScene, index) => {
    const result = expansionResults[index];
    let text: string;

    if (result.status === "fulfilled") {
      text = result.value.text;
    } else {
      // Fallback: use the architect brief as-is
      console.warn(`[StoryGen] Scene ${archScene.sceneNumber} expansion failed, using brief as fallback`);
      text = archScene.brief;
    }

    return {
      sceneNumber: archScene.sceneNumber,
      title: archScene.title,
      text,
      imagePrompt: archScene.imagePrompt,
      type: archScene.type,
    };
  });

  // ── Post-processing ────────────────────────────────────────────────────────

  // Title options
  let titleOptions = architect.titleOptions;
  if (!Array.isArray(titleOptions) || titleOptions.length < 1) {
    titleOptions = [architect.bookTitle, ...getFallbackTitles(input.childName, input.locale)];
  }
  titleOptions = titleOptions.slice(0, 4);

  // Cover prompt fallback
  const coverImagePrompt = architect.coverImagePrompt
    || `${characterVisual} as a hero in a triumphant pose, wide cinematic composition, the adventure world filling the background, children's book cover art, vivid colors, no text.`;

  // Synopsis fallback
  const synopsis = architect.synopsis || getFallbackSynopsis(input.childName, input.locale);

  return {
    bookTitle: architect.bookTitle,
    titleOptions,
    coverImagePrompt,
    scenes,
    dedication: architect.dedication || "",
    finalMessage: architect.finalMessage || "",
    synopsis,
  };
}
