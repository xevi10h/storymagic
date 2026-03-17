// Two-tier story generation architecture
//
// PHASE 1 — ARCHITECT (GPT-5.4, single call):
//   Plans the entire book in one coherent creative vision.
//   Outputs: skeleton with 12 rich scene briefs (3-5 sentences each),
//   12 image prompts, cover prompt, titles, dedication, synopsis, final message.
//   Each brief includes: what happens, emotional beat, personal detail integration, hook.
//
// PHASE 2 — EXPANSION (GPT-5.4, 12 parallel calls):
//   Each scene brief gets expanded into full literary prose.
//   The expander receives full context: protagonist details, interests, moral, theme,
//   narrative tone, surrounding scene briefs for continuity, and craft-oriented
//   writing instructions adapted to the child's age band.
//   All 12 calls run in parallel.
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
import { buildCharacterVisualDescription, getGenderColorDirective } from "./character-description";

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
        headers: {
          ...options.headers,
          Connection: "keep-alive",
        },
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

    // Keep TCP connection alive to prevent OS/proxy from closing idle sockets
    // during long LLM generation (GPT-5.4 can take 60-120s)
    req.on("socket", (socket) => {
      socket.setKeepAlive(true, 30_000); // send TCP keepalive every 30s
    });
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

// ── Template narrative tone ──────────────────────────────────────────────────

interface NarrativeTone {
  /** Short label for the architect prompt */
  voice: string;
  /** Craft directives for the expansion writer */
  craftDirectives: string;
  /** Emotional register for this template */
  emotionalRegister: string;
}

const TEMPLATE_TONES: Record<string, NarrativeTone> = {
  space: {
    voice: "Sense-of-wonder & philosophical",
    craftDirectives: "Let silence and scale do the emotional work. Pause to describe how small the protagonist feels against the stars — then show how their curiosity makes them feel enormous. Use poetic imagery for cosmic phenomena. The tone is The Little Prince meets a NASA mission log.",
    emotionalRegister: "awe, loneliness-turned-to-connection, reverence for the unknown",
  },
  forest: {
    voice: "Lyrical & emotionally intimate",
    craftDirectives: "Write as if the forest itself is a character — it breathes, watches, responds. Favor sensory language: damp moss, the snap of a twig, the smell of rain on leaves. Every creature the protagonist meets mirrors something about their own feelings. The tone is Where the Wild Things Are — the adventure is inward as much as outward.",
    emotionalRegister: "tenderness, gentle fear, belonging, wonder at nature's cycles",
  },
  superhero: {
    voice: "Adventurous with dry humor",
    craftDirectives: "Fast pacing and punchy sentences during action. But the heart of the story is in the quiet moments — the doubt before the leap, the choice to help when nobody is watching. Avoid generic 'pow!' energy. The humor should come from the protagonist's inner voice, not from slapstick. Think Pixar's The Incredibles — the powers are fun, but the relationships matter more.",
    emotionalRegister: "excitement, self-doubt, compassion, earned pride",
  },
  pirates: {
    voice: "Swashbuckling & cleverness-driven",
    craftDirectives: "Write with the rhythm of the sea — rolling sentences for calm waters, staccato for storms. The protagonist wins through wit, not force. Include moments of genuine wonder at the ocean. Dialogue should feel scrappy and alive. Think Treasure Island — the romance of adventure with a moral compass underneath.",
    emotionalRegister: "daring, cunning, loyalty, the pull between greed and friendship",
  },
  chef: {
    voice: "Warm, sensory & heartfelt",
    craftDirectives: "Make the reader TASTE and SMELL the story. Every dish is a metaphor for love or connection. The kitchen is both a workplace and a refuge. When the protagonist creates, something emotional is being worked out too — loneliness, missing someone, wanting to impress. Think Ratatouille — cooking is the language of the heart.",
    emotionalRegister: "comfort, generosity, creative joy, nostalgia, sharing",
  },
  dinosaurs: {
    voice: "Exciting & awe-struck",
    craftDirectives: "Ground the prehistoric world with physical detail — feel the earth shake, see the shadow of a wing. The dinosaurs are not cartoons; they have personality, habits, moods. The protagonist earns trust through patience and respect, not bravery. Include moments of genuine scale and danger that resolve through understanding. Think of nature documentaries narrated with a child's heart.",
    emotionalRegister: "awe, respect for creatures different from us, bravery born from empathy",
  },
  castle: {
    voice: "Mysterious & intellectually playful",
    craftDirectives: "Build suspense through unanswered questions — what's behind the door, who left that clue, why does the portrait's eyes seem to follow you? The protagonist solves problems by observing and thinking, not by luck. Each revelation should reframe what came before. Think classic whodunit for children — the satisfaction of figuring it out.",
    emotionalRegister: "curiosity, suspense, the thrill of solving a puzzle, respect for history",
  },
  safari: {
    voice: "Reverent & quietly powerful",
    craftDirectives: "The savanna is majestic — write it with respect, not as a theme park. Animals are not props; they have agency, families, dignity. The protagonist learns by watching and listening, not by conquering. Include moments of stillness that feel as powerful as the action. Think of David Attenborough narrating a sunrise — quiet authority and deep love for the living world.",
    emotionalRegister: "reverence, responsibility, quiet courage, interconnection of all life",
  },
  inventor: {
    voice: "Inventive & problem-solving with heart",
    craftDirectives: "Show the messy process of creation — the failed attempts, the unexpected breakthroughs, the 'what if I try THIS?' moments. The protagonist thinks differently and that's their superpower, not their weakness. Technical details should feel magical, not clinical. Think of a kid's version of The Martian — every problem has a creative solution, and failure is just iteration.",
    emotionalRegister: "frustration-turned-to-eureka, confidence in one's own way of thinking, pride in building something that helps others",
  },
  candy: {
    voice: "Playful, whimsical & generous",
    craftDirectives: "The candy world should feel like stepping into a dream — everything edible, everything surprising, everything just a little bit ridiculous. But underneath the sugar is a story about sharing, generosity, and what really makes something sweet. The tone is Charlie and the Chocolate Factory — pure imagination with a moral backbone. Use synesthesia: what does a lollipop sound like? What color is chocolate laughter?",
    emotionalRegister: "delight, generosity, the difference between sweetness and kindness",
  },
};

function getTemplateTone(templateId: string): NarrativeTone {
  return TEMPLATE_TONES[templateId] || TEMPLATE_TONES.forest;
}

// ── Age config ───────────────────────────────────────────────────────────────

interface AgeConfig {
  sceneCount: number;
  bridgeCount: number;
  wordsPerScene: string;
  textStyle: string;
  /** Narrative voice perspective suited to the age band */
  narrativeVoice: string;
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

  // ── Band 1: Toddlers (2-4) ──────────────────────────────────────────────
  if (age <= 4) {
    return {
      sceneCount: 8,
      bridgeCount: 4,
      wordsPerScene: "50-80",
      narrativeVoice: [
        "VOICE: Warm, close narrator who speaks directly to the child.",
        "Use a mix of simple 3rd person ('Marc ran and ran!') and occasional 2nd person asides ('Can you see what he found?').",
        "The narrator is a loving, playful companion — like a parent reading aloud.",
        "Exclamations, whispers, and gasps are your tools.",
      ].join("\n"),
      textStyle: [
        "Write for a very young child (2-4 years old). 3-5 sentences per scene, 50-80 words.",
        "SHORT sentences (max 10 words). Vocabulary a toddler already knows.",
        `RHYTHM: Use onomatopoeia (${localeConfig.onomatopoeia}), repetition, and musical patterns. Repeat key phrases across scenes like a refrain.`,
        "SENSES: Every scene must include something the child can hear, touch, or see. Not abstract — concrete and physical.",
        "EMOTION: One clear emotion per scene. Name it simply: happy, scared, surprised, proud, safe.",
        "HOOKS: End every scene with a tiny cliffhanger or question that makes the child want to turn the page.",
        "SHOW THE MORAL: The lesson is in what the character DOES, never in what they say. A 3-year-old learns by watching, not by being lectured.",
      ].join("\n"),
      illustrationStyleId,
      illustrationBaseStyle,
      illustrationPromptStyle: illustrationPromptStyle ?? "Whimsical pastel children's book illustration for toddlers, soft dreamy colors, big rounded shapes, exaggerated friendly expressions, simple compositions, gentle lighting, no text in image.",
    };
  }

  // ── Band 2: Early readers (5-6) ───────────────────────────────────────────
  if (age <= 6) {
    return {
      sceneCount: 9,
      bridgeCount: 3,
      wordsPerScene: "70-100",
      narrativeVoice: [
        "VOICE: Warm, playful 3rd person narrator — close to the child but with a storytelling cadence.",
        "The narrator is enthusiastic and encouraging, like a favourite teacher reading aloud.",
        "Short, punchy dialogues — one or two lines at a time. Characters speak the way real 5-year-olds do.",
        "Occasional gentle asides to the reader ('And guess what happened next?').",
      ].join("\n"),
      textStyle: [
        "Write for a child aged 5-6. 4-6 sentences per scene, 70-100 words.",
        "SENTENCES: Keep them short (max 12-15 words). One idea per sentence.",
        "VOCABULARY: Use everyday words a 5-year-old knows. Introduce ONE new word per scene at most — and make its meaning clear from context.",
        `RHYTHM: Use onomatopoeia (${localeConfig.onomatopoeia}), repetition, and playful patterns. Repeated phrases across scenes create comfort.`,
        "PACING: Start each scene with something happening — action first, description later.",
        "SENSES: Every scene includes something concrete the child can hear, touch, smell, or see.",
        "EMOTION: Name feelings clearly (excited, worried, brave, proud) through the character's actions and expressions.",
        "HOOKS: End every scene with a small surprise or question that makes the child want to turn the page.",
        "SHOW THE MORAL: The lesson is in what the character DOES, never in what they say. Show, don't lecture.",
      ].join("\n"),
      illustrationStyleId,
      illustrationBaseStyle,
      illustrationPromptStyle: illustrationPromptStyle ?? "Whimsical nook illumination children's book illustration, warm glowing light, intricate charming details, cozy storybook atmosphere, expressive characters, rich textures, no text in image.",
    };
  }

  // ── Band 3: Confident readers (7-9) ───────────────────────────────────────
  if (age <= 9) {
    return {
      sceneCount: 10,
      bridgeCount: 2,
      wordsPerScene: "110-150",
      narrativeVoice: [
        "VOICE: Engaging 3rd person limited — we follow the protagonist's thoughts and feelings closely.",
        "The narrator has personality: witty, warm, occasionally conspiratorial ('But what Marc didn't know yet was...').",
        "Short dialogues between characters. Dialogue should sound like real kids talk — not adult speeches in a child's mouth.",
        "Occasional asides to the reader are welcome ('And THAT, dear reader, is when things got really interesting').",
      ].join("\n"),
      textStyle: [
        "Write for a child aged 7-9. 5-8 sentences per scene, 110-150 words.",
        "PACING: Open each scene with ACTION, not description. Something is happening from the first sentence.",
        "TENSION: Build small cliffhangers — a noise in the dark, a door that won't open, a friend who's in trouble. Always resolve safely, but let the suspense breathe for a moment.",
        "HUMOR: Include at least one smile-worthy moment per scene. Physical comedy, funny observations, or unexpected reactions.",
        "SENSES: Engage two senses per scene. Not just visual — what does this place smell like? What does the ground feel like under their feet?",
        "EMOTION: The protagonist expresses feelings out loud or through clear physical reactions (stomach flutters, a grin they can't hold back).",
        "HOOKS: Every scene ends on a small question, surprise, or emotional beat that propels the reader forward.",
        "SHOW THE MORAL: The lesson lives in the protagonist's CHOICES. Never state the moral. Let the child feel it through the story.",
      ].join("\n"),
      illustrationStyleId,
      illustrationBaseStyle,
      illustrationPromptStyle: illustrationPromptStyle ?? "Warm storytelling children's book illustration, balanced detail and expression, rich atmospheric scenes, expressive characters, warm color palette, no text in image.",
    };
  }

  // ── Band 4: Pre-teens (10-12) ─────────────────────────────────────────────
  return {
    sceneCount: 12,
    bridgeCount: 0,
    wordsPerScene: "150-200",
    narrativeVoice: [
      "VOICE: Literary 3rd person limited. The reader lives inside the protagonist's head.",
      "Inner monologue is your most powerful tool — let us hear their doubts, hopes, fears, and small triumphs.",
      "The narrator never intrudes. No 'dear reader' asides. The prose IS the character's perception of the world.",
      "Dialogue reveals character: what people say (and don't say) matters more than what happens.",
    ].join("\n"),
    textStyle: [
      "Write for a child aged 10-12. 7-10 rich sentences per scene, 150-200 words.",
      "OPENING: Each scene starts in medias res — mid-action, mid-thought, mid-emotion. Never 'It was a sunny day.'",
      "TENSION: Real stakes. The protagonist can fail, feel afraid, feel alone. Don't rush to comfort — let discomfort teach something before resolving it.",
      "PROSE CRAFT: Use metaphors and sensory details that EARN their place. One precise image beats three vague ones. 'The cave smelled like wet iron and old secrets.'",
      "INNER WORLD: This age craves identity exploration. The protagonist should question themselves, make mistakes, and grow through the story — not just go through it.",
      "DIALOGUE: Meaningful exchanges that reveal relationships. Subtext is welcome — what's unsaid can be as powerful as what's said.",
      "HUMOR: Subtle wit, irony, unexpected observations. Not slapstick.",
      "CALLBACKS: Reference details from earlier in the story. Something small from Scene 1 should matter in Scene 9.",
      "MORAL: NEVER state the lesson. Not even through a wise character's speech. The moral emerges from the protagonist's arc — from what they choose when it costs them something. Show, don't tell. Trust the reader.",
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

/** Model for the architect call — plans the entire book skeleton.
 *  gpt-5.4-mini is 6x faster than gpt-5.4 with equivalent JSON quality. */
const ARCHITECT_MODEL = process.env.OPENAI_ARCHITECT_MODEL || "gpt-5.4-mini";
/** Model for scene expansion — generates the final narrative text.
 *  gpt-5.4-mini balances quality and speed (~8s vs ~54s for gpt-5.4). */
const EXPANSION_MODEL = process.env.OPENAI_EXPANSION_MODEL || "gpt-5.4-mini";

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

  let body = JSON.stringify(payload);
  const start = Date.now();

  const MAX_RETRIES = 1; // 1 retry with same model, then fallback to faster model
  let response: Awaited<ReturnType<typeof nativeFetch>> | undefined;
  let usedModel = model;
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES + 1; attempt++) {
    // After MAX_RETRIES with the original model, try a faster fallback model
    if (attempt > MAX_RETRIES) {
      const FALLBACK_MAP: Record<string, string> = {
        "gpt-5.4": "gpt-5.4-mini",
        "gpt-5.4-mini": "gpt-5.4-nano",
        "gpt-5.3": "gpt-5.4-mini",
        "gpt-5": "gpt-5-mini",
      };
      const fallback = FALLBACK_MAP[model];
      if (!fallback) throw lastError!; // no fallback available
      usedModel = fallback;
      // Rebuild payload with fallback model
      payload.model = usedModel;
      body = JSON.stringify(payload);
      console.warn(`[LLM] Falling back to ${usedModel} after ${MAX_RETRIES + 1} failures with ${model}`);
    }

    try {
      response = await nativeFetch(url, { method: "POST", headers, body: body, timeoutMs });
      if (usedModel !== model) {
        console.log(`[LLM] Fallback ${usedModel} succeeded`);
      }
      break;
    } catch (err) {
      lastError = err;
      const isTransient = err instanceof Error && (
        err.message.includes("socket") ||
        err.message.includes("timed out") ||
        err.message.includes("ECONNRESET") ||
        err.message.includes("EPIPE")
      );
      if (isTransient && attempt <= MAX_RETRIES) {
        const delay = 2000 * Math.pow(2, attempt); // 2s, 4s
        console.warn(`[LLM] ${usedModel} attempt ${attempt + 1} failed: ${err instanceof Error ? err.message : err}. Retrying in ${delay / 1000}s...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      if (attempt > MAX_RETRIES) throw err; // fallback also failed
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

  const tone = getTemplateTone(input.templateId);

  const juntosInstruction = input.creationMode === "juntos"
    ? [
      "MODE: READ TOGETHER — This book will be read aloud by a parent WITH the child.",
      "Design scenes with INTERACTIVE MOMENTS: pauses where the parent can ask 'What do you think happens next?', or where the child can point at the illustration and name things.",
      "Include repetitive refrains or catchphrases that the child can join in saying.",
      "Emotional beats should be shared — moments of awe, laughter, and warmth that parent and child experience together.",
      "For ages 2-4: add at least one physical interaction cue per scene ('Give Marc a high five!', 'Can you roar like the dinosaur?').",
      "The pacing should leave room for conversation — not too dense, not too rushed.",
    ].join("\n")
    : [
      "MODE: GIFT — This book is a gift from a parent to their child.",
      "The story should feel like a love letter disguised as an adventure.",
      "Weave personal details deeply — the child should feel that this story was made ONLY for them.",
      "Include at least one moment that will make the parent emotional when reading it aloud.",
      "The dedication and final message should feel intimate and earned, not generic.",
    ].join("\n");

  const narrativeStructure = buildNarrativeStructure(input, ageConfig);

  // Gender-aware color direction for illustration prompts
  const colorDirective = getGenderColorDirective(input.gender);
  const colorInstruction = colorDirective
    ? `\nCOLOR PALETTE for ALL image prompts: ${colorDirective}`
    : "";

  return `You are a world-class children's book ARCHITECT and STORYTELLER. Your job: plan an ENTIRE personalized book that a child will treasure — a story they'll ask to hear again and again.

You produce a SKELETON — for each scene you write a RICH BRIEF (3-5 sentences: what happens, the emotional beat, how personal details appear, how the moral manifests) that a writer will later expand into full prose. You also produce the FINAL image prompts.

═══════════════════════════════════════════════════
NARRATIVE IDENTITY
═══════════════════════════════════════════════════

TONE & VOICE: ${tone.voice}
${tone.craftDirectives}

EMOTIONAL REGISTER: ${tone.emotionalRegister}

${ageConfig.narrativeVoice}

═══════════════════════════════════════════════════
THE CHILD
═══════════════════════════════════════════════════

- Name: ${input.childName} | Gender: ${genderLabel} | Age: ${input.age}
- City: ${input.city || "a magical city"}
- Interests: ${input.interests.join(", ") || "adventure, imagination"}
${personalSection}

HOW TO USE PERSONAL DETAILS:
- These are NOT cameos to drop in randomly. They are NARRATIVE TOOLS.
- The child's interests should be HOW they solve problems (a kid who loves animals understands a creature's mood; a kid who loves space navigates by the stars).
- The favorite companion (pet/friend) should have a real role — a confidant, a source of courage, a reason to be brave.
- The favorite food should appear in a MEANINGFUL moment — comfort, celebration, memory of home.
- The future dream should connect to the moral — it's the seed of who this child is becoming.
- The special trait should be the HIDDEN SUPERPOWER that saves the day or unlocks the solution.

═══════════════════════════════════════════════════
STORY FRAMEWORK
═══════════════════════════════════════════════════

TEMPLATE: "${input.templateTitle}" | Theme: ${theme}
MORAL: "${moral}"

HOW TO BUILD THE MORAL:
- The moral is NEVER stated aloud by any character. Not even in a wise speech.
- Instead, it is EARNED through the protagonist's arc:
  * Early scenes: show the protagonist LACKING the quality the moral teaches (e.g., a story about courage starts with a child who is afraid).
  * Middle scenes: the protagonist faces situations that REQUIRE the quality — and struggles.
  * Climax: the protagonist CHOOSES the right action even when it costs them something.
  * Resolution: the reader FEELS the moral because they watched the transformation happen.
- The finalMessage can gently echo the moral, but the story itself must have already taught it through action.

${juntosInstruction}

${decisionsContext}

ENDING: ${endingInstruction}
${input.dedication ? `DEDICATION from ${input.senderName || "someone special"}: "${input.dedication}"` : ""}

═══════════════════════════════════════════════════
STORY CRAFT RULES
═══════════════════════════════════════════════════

HOOKS & PACING:
- Every scene brief must end with a HOOK — a question, a surprise, an emotional shift that makes the reader want to turn the page.
- Vary the pacing: action → quiet reflection → tension → wonder → action. Never two scenes with the same energy.
- The story should feel like a JOURNEY, not a sequence of events.

CALLBACKS & DETAILS:
- Plant a small detail in Scenes 1-3 that becomes CRUCIAL in Scenes 9-11.
- Repeat a motif (a phrase, an object, a gesture) at least twice — the repetition creates the feeling of a 'real' story.

EMOTIONAL ARC:
- The protagonist must CHANGE. Who they are at the end is different from who they were at the beginning.
- Include at least one QUIET MOMENT — a pause from the adventure where the protagonist reflects, connects with a companion, or misses home.
- For ages 8-12: include a genuine moment of DOUBT or DARKNESS before the resolution. Don't make everything easy.

═══════════════════════════════════════════════════
IMAGE PROMPT RULES
═══════════════════════════════════════════════════

- ALL text content (titles, briefs, dedication, finalMessage, synopsis) MUST be in ${lang}.
- Image prompts MUST be in ENGLISH (they go to an image generator).
- Protagonist is ALWAYS the child.
- NEVER include text in image prompts.

CHARACTER VISUAL CONSISTENCY (CRITICAL):
- The protagonist looks EXACTLY like this in EVERY image: "${characterVisual}"
- You MUST include this EXACT description verbatim in every imagePrompt. Do NOT paraphrase, omit, or change any physical trait.
- The character's skin tone, hair color, hair style, and eye color must be IDENTICAL across all 12 scenes and the cover.
- Never change the character's appearance to match the scene's theme or setting.

VISUAL JOURNEY — each imagePrompt uses a DIFFERENT composition:
  * Vary camera: wide, medium, close-up, bird's-eye, low angle, over-the-shoulder
  * Vary poses: running, sitting, reaching, crouching, jumping, climbing, hugging
  * Vary framing: small in landscape, filling frame, interacting with objects/creatures
  * NEVER repeat "character standing and looking at something"
${colorInstruction}

═══════════════════════════════════════════════════
OUTPUT SPECIFICATION
═══════════════════════════════════════════════════

AGE: ${input.age} years old

Generate EXACTLY 12 slots: ${ageConfig.sceneCount} scenes + ${ageConfig.bridgeCount} bridges.
- "scene": brief = 3-5 sentences describing what happens + the emotional beat + how personal details appear + the hook at the end. This will be expanded by a writer who needs RICH context.
- "bridge": brief = 1 atmospheric sentence (max 25 words) — this IS the final text, no expansion needed.

${narrativeStructure}

JSON:
{
  "bookTitle": "Primary title in ${lang} — evocative, not generic. Should hint at the personal journey.",
  "titleOptions": ["Title 1", "Title 2", "Title 3", "Title 4"],
  "coverImagePrompt": "ENGLISH. Wide-angle editorial cover. ${characterVisual} as hero, adventurous pose, ${theme} world in background. ${ageConfig.illustrationPromptStyle}",
  "dedication": "Dedication text in ${lang}. If the parent provided one, enhance it. If not, write a warm, personal one using what you know about the child.",
  "scenes": [
    {
      "sceneNumber": 1,
      "type": "scene",
      "title": "Evocative title in ${lang}",
      "brief": "3-5 sentences in ${lang}: what happens, the emotional beat, how a personal detail appears, the hook. Rich enough for a writer to expand.",
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
  "finalMessage": "Closing message in ${lang}. Warm, personal, echoes the moral through emotion — not a lecture. Should feel like a parent's whisper at bedtime.",
  "synopsis": "2-3 sentences in ${lang} for back cover. Should make someone WANT to read this story."
}

ONLY the JSON, no markdown, no code blocks.`;
}

// ── PHASE 2: Scene expansion prompt ──────────────────────────────────────────

function buildExpansionPrompt(
  scene: ArchitectScene,
  input: StoryInput,
  ageConfig: AgeConfig,
  globalContext: {
    bookTitle: string;
    totalScenes: number;
    prevBrief?: string;
    nextBrief?: string;
    moral: string;
    theme: string;
  },
): string {
  const localeConfig = getLocaleConfig(input.locale);
  const lang = localeConfig.language;
  const genderLabel = localeConfig.genderLabels[input.gender];
  const tone = getTemplateTone(input.templateId);

  // Build personal context
  const personalLines: string[] = [];
  if (input.interests.length > 0) personalLines.push(`Interests: ${input.interests.join(", ")}`);
  if (input.specialTrait) personalLines.push(`Special trait: "${input.specialTrait}"`);
  if (input.favoriteCompanion) personalLines.push(`Favorite companion: "${input.favoriteCompanion}"`);
  if (input.favoriteFood) personalLines.push(`Favorite food: "${input.favoriteFood}"`);
  if (input.futureDream) personalLines.push(`Future dream: "${input.futureDream}"`);
  const personalContext = personalLines.length > 0
    ? `\nPERSONAL DETAILS (weave naturally — these are narrative tools, not items to mention in passing):\n${personalLines.join("\n")}`
    : "";

  // Build continuity context
  const continuity: string[] = [];
  if (globalContext.prevBrief) continuity.push(`PREVIOUS SCENE: ${globalContext.prevBrief}`);
  if (globalContext.nextBrief) continuity.push(`NEXT SCENE: ${globalContext.nextBrief}`);
  const continuitySection = continuity.length > 0
    ? `\nSTORY CONTINUITY (ensure smooth transitions):\n${continuity.join("\n")}`
    : "";

  const modeInstruction = input.creationMode === "juntos"
    ? "MODE: Read-together. Include interactive pauses, questions to the child, or moments where the reader can add voices/sounds."
    : "MODE: Gift. Emotional depth — this story is a love letter. Personal details should feel deeply woven, not sprinkled.";

  return `You are a world-class children's book WRITER. Expand the scene brief below into full, polished narrative prose in ${lang}.

═══════ BOOK CONTEXT ═══════
BOOK: "${globalContext.bookTitle}" — scene ${scene.sceneNumber} of ${globalContext.totalScenes}
THEME: ${globalContext.theme}
MORAL: "${globalContext.moral}" — NEVER state this directly. It must emerge from the character's actions and choices.
TONE: ${tone.voice}
${tone.craftDirectives}
${modeInstruction}

═══════ THIS SCENE ═══════
TITLE: "${scene.title}"
BRIEF: "${scene.brief}"
${continuitySection}

═══════ PROTAGONIST ═══════
${input.childName}, ${genderLabel}, ${input.age} years old, from ${input.city || "a magical city"}
${personalContext}

═══════ WRITING CRAFT ═══════
${ageConfig.narrativeVoice}

${ageConfig.textStyle}

═══════ RULES ═══════
- Write ONLY the narrative text. No title, no scene number, no metadata.
- Target: ${ageConfig.wordsPerScene} words.
- Write in ${lang}.
- Stay faithful to the brief — expand and enrich, don't reinvent the plot.
- Open with ACTION or EMOTION, never with flat description.
- End with a HOOK — make the reader want to turn the page.
- The prose should feel like it belongs in a published book, not a school exercise.

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

// ── Exported phases (allow route to parallelize expansion + illustrations) ───

export interface ArchitectResult {
  architect: ArchitectOutput;
  ageConfig: AgeConfig;
  characterVisual: string;
  isMock: boolean;
  /** If mock, the full story is available immediately */
  mockStory?: GeneratedStory;
}

/**
 * Phase 1: Architect — plans the full book skeleton.
 * Returns the blueprint with imagePrompts for each scene.
 * The route can start illustration generation immediately after this,
 * WITHOUT waiting for scene expansion.
 */
export async function generateArchitect(input: StoryInput): Promise<ArchitectResult> {
  const mockMode = process.env.MOCK_MODE === "true";

  if (mockMode || !hasAnyProvider()) {
    const reason = mockMode ? "MOCK_MODE=true" : "no LLM API key";
    console.log(`[StoryGen] MOCK MODE — ${reason}`);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return {
      architect: {} as ArchitectOutput,
      ageConfig: getAgeConfig(input.age, input.locale),
      characterVisual: "",
      isMock: true,
      mockStory: generateMockStory(input),
    };
  }

  const ageConfig = getAgeConfig(input.age, input.locale);
  const characterVisual = buildCharacterVisualDescription(input);

  console.log(`[StoryGen] Phase 1: Architect (${ARCHITECT_MODEL})...`);
  const architectPrompt = buildArchitectPrompt(input);
  const architectRaw = await callLLM(architectPrompt, ARCHITECT_MODEL, { timeoutMs: 120_000 });
  const architect = parseJsonResponse<ArchitectOutput>(architectRaw, ARCHITECT_MODEL);

  // Validate
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

  return { architect, ageConfig, characterVisual, isMock: false };
}

/**
 * Phase 2: Expansion — expands each scene brief into full text.
 * Can run IN PARALLEL with illustration generation since illustrations
 * only need the architect's imagePrompt, not the expanded text.
 */
export async function expandScenes(
  architect: ArchitectOutput,
  input: StoryInput,
  ageConfig: AgeConfig,
): Promise<GeneratedStory> {
  console.log(`[StoryGen] Phase 2: Expanding ${architect.scenes.length} scenes in parallel (${EXPANSION_MODEL})...`);
  const phase2Start = Date.now();

  const template = getTemplateConfig(input.templateId);
  const moral = template?.moral || "Being kind matters";
  const theme = template?.theme || "A magical adventure";

  const expansionResults = await Promise.allSettled(
    architect.scenes.map(async (scene, index): Promise<{ sceneNumber: number; text: string }> => {
      if (scene.type === "bridge") {
        return { sceneNumber: scene.sceneNumber, text: scene.brief };
      }

      const prevBrief = index > 0 ? architect.scenes[index - 1].brief : undefined;
      const nextBrief = index < architect.scenes.length - 1 ? architect.scenes[index + 1].brief : undefined;
      const globalContext = {
        bookTitle: architect.bookTitle,
        totalScenes: 12,
        prevBrief,
        nextBrief,
        moral,
        theme,
      };

      const prompt = buildExpansionPrompt(scene, input, ageConfig, globalContext);
      const raw = await callLLM(prompt, EXPANSION_MODEL, { timeoutMs: 120_000 });
      const parsed = parseJsonResponse<{ text: string }>(raw, `${EXPANSION_MODEL}:scene${scene.sceneNumber}`);
      return { sceneNumber: scene.sceneNumber, text: parsed.text || scene.brief };
    }),
  );

  const phase2Elapsed = ((Date.now() - phase2Start) / 1000).toFixed(1);
  const succeeded = expansionResults.filter(r => r.status === "fulfilled").length;
  const failed = expansionResults.filter(r => r.status === "rejected").length;
  console.log(`[StoryGen] Phase 2 done in ${phase2Elapsed}s — ${succeeded} ok, ${failed} failed`);

  // Merge architect skeleton + expanded texts
  const scenes: GeneratedScene[] = architect.scenes.map((archScene, index) => {
    const result = expansionResults[index];
    let text: string;

    if (result.status === "fulfilled") {
      text = result.value.text;
    } else {
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

  const characterVisual = buildCharacterVisualDescription(input);

  let titleOptions = architect.titleOptions;
  if (!Array.isArray(titleOptions) || titleOptions.length < 1) {
    titleOptions = [architect.bookTitle, ...getFallbackTitles(input.childName, input.locale)];
  }
  titleOptions = titleOptions.slice(0, 4);

  const coverImagePrompt = architect.coverImagePrompt
    || `${characterVisual} as a hero in a triumphant pose, wide cinematic composition, the adventure world filling the background, children's book cover art, vivid colors, no text.`;

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

/** Legacy wrapper — calls architect + expansion sequentially. */
export async function generateStory(input: StoryInput): Promise<GeneratedStory> {
  const result = await generateArchitect(input);
  if (result.isMock && result.mockStory) return result.mockStory;
  return expandScenes(result.architect, input, result.ageConfig);
}
