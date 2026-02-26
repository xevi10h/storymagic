// Multi-provider LLM for story generation (plain fetch, no SDK)
//
// Supported providers (auto-detected from env vars, checked in order):
//   ANTHROPIC_API_KEY → Claude Sonnet (premium, production)
//   GROQ_API_KEY      → Groq (Llama 3.3 70B)    — 1,000 RPD, free
//   CEREBRAS_API_KEY  → Cerebras (Llama 3.3 70B) — 14,400 RPD, free
//   GEMINI_API_KEY    → Google AI Studio          — 20 RPD, free

import {
  getTemplateConfig,
  getDecisionNarrative,
  getEndingNarrative,
  getAtmosphereNarrative,
} from "@/lib/create-store";

export interface GeneratedScene {
  sceneNumber: number;
  title: string;
  text: string;
  imagePrompt: string;
}

export interface GeneratedStory {
  bookTitle: string;
  scenes: GeneratedScene[];
  dedication: string;
  finalMessage: string;
}

export interface StoryInput {
  childName: string;
  gender: "boy" | "girl" | "neutral";
  age: number;
  city: string;
  interests: string[];
  specialTrait?: string;
  favoriteCompanion?: string;
  hairColor?: string;
  skinTone?: string;
  hairstyle?: string;
  templateId: string;
  templateTitle: string;
  creationMode: "solo" | "juntos";
  decisions: Record<string, unknown>;
  dedication?: string;
  senderName?: string;
  endingChoice?: string;
}

// --- Provider abstraction ---

interface ProviderConfig {
  name: string;
  buildFetchArgs: (prompt: string, apiKey: string) => { url: string; init: RequestInit };
  extractContent: (data: Record<string, unknown>) => string | undefined;
}

const PROVIDERS: Record<string, ProviderConfig> = {
  anthropic: {
    name: "Claude Sonnet 4",
    buildFetchArgs: (prompt, apiKey) => ({
      url: "https://api.anthropic.com/v1/messages",
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8192,
          messages: [{ role: "user", content: prompt }],
        }),
      },
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extractContent: (data: any) => {
      const block = data.content?.find((b: { type: string }) => b.type === "text");
      return block?.text;
    },
  },

  groq: {
    name: "Groq (Llama 3.3 70B)",
    buildFetchArgs: (prompt, apiKey) => ({
      url: "https://api.groq.com/openai/v1/chat/completions",
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.8,
          response_format: { type: "json_object" },
        }),
      },
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extractContent: (data: any) => data.choices?.[0]?.message?.content,
  },

  cerebras: {
    name: "Cerebras (Llama 3.3 70B)",
    buildFetchArgs: (prompt, apiKey) => ({
      url: "https://api.cerebras.ai/v1/chat/completions",
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.8,
          response_format: { type: "json_object" },
        }),
      },
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extractContent: (data: any) => data.choices?.[0]?.message?.content,
  },

  gemini: {
    name: "Gemini 2.5 Flash",
    buildFetchArgs: (prompt, apiKey) => ({
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            responseMimeType: "application/json",
          },
        }),
      },
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extractContent: (data: any) => data.candidates?.[0]?.content?.parts?.[0]?.text,
  },
};

const PROVIDER_ENV_KEYS = [
  { envKey: "ANTHROPIC_API_KEY", providerId: "anthropic" },
  { envKey: "GROQ_API_KEY", providerId: "groq" },
  { envKey: "CEREBRAS_API_KEY", providerId: "cerebras" },
  { envKey: "GEMINI_API_KEY", providerId: "gemini" },
] as const;

function getProvider(): { config: ProviderConfig; apiKey: string } {
  for (const { envKey, providerId } of PROVIDER_ENV_KEYS) {
    const apiKey = process.env[envKey];
    if (apiKey && !apiKey.includes("your_") && !apiKey.includes("_here")) {
      return { config: PROVIDERS[providerId], apiKey };
    }
  }

  throw new Error(
    "No LLM API key configured. Set one of: ANTHROPIC_API_KEY (production), GROQ_API_KEY (free), CEREBRAS_API_KEY, or GEMINI_API_KEY in .env.local\n" +
      "Free keys: https://console.groq.com (Groq) or https://cloud.cerebras.ai (Cerebras)\n" +
      "Production: https://console.anthropic.com (Claude)"
  );
}

// --- Narrative context builder ---

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
    lines.push(`- SPECIAL MOMENT (requested by parent): "${decisions.specialMoment}" — weave this naturally into the story`);
  }

  if (lines.length === 0) return "";

  return `\nSTORY DECISIONS (chosen by the reader — incorporate ALL of these into the story):\n${lines.join("\n")}`;
}

// Exported so illustrations.ts can build the same character reference
export function buildCharacterVisualDescription(input: StoryInput): string {
  const parts: string[] = [];

  const genderWord = input.gender === "boy" ? "boy" : input.gender === "girl" ? "girl" : "child";
  parts.push(`${genderWord}, ${input.age} years old`);

  if (input.skinTone) {
    const skinMap: Record<string, string> = {
      "#fce4d6": "light skin",
      "#eebb99": "medium-light skin",
      "#c68642": "medium-dark skin",
      "#8d5524": "dark skin",
      "#523218": "very dark skin",
    };
    parts.push(skinMap[input.skinTone] || "");
  }

  if (input.hairColor) {
    const hairMap: Record<string, string> = {
      "#2a2a2a": "black hair",
      "#5d4037": "dark brown hair",
      "#8d6e63": "brown hair",
      "#e6c07b": "blonde hair",
      "#d84315": "red hair",
    };
    const hairDesc = hairMap[input.hairColor] || "";
    if (input.hairstyle && input.hairstyle !== "short") {
      parts.push(`${input.hairstyle} ${hairDesc}`);
    } else {
      parts.push(hairDesc);
    }
  }

  return parts.filter(Boolean).join(", ");
}

// --- Story generation ---

export async function generateStory(input: StoryInput): Promise<GeneratedStory> {
  const { config: provider, apiKey } = getProvider();

  const template = getTemplateConfig(input.templateId);
  const theme = template?.theme || "A magical adventure";
  const moral = template?.moral || "Being kind matters";

  const genderLabel =
    input.gender === "boy" ? "niño" : input.gender === "girl" ? "niña" : "niñe";

  let endingInstruction = "End the story in a warm, satisfying way.";
  if (input.endingChoice && template) {
    const endingNarrative = getEndingNarrative(template, input.endingChoice);
    if (endingNarrative) {
      endingInstruction = endingNarrative;
    }
  }

  const decisionsContext = buildDecisionsContext(input);
  const characterVisual = buildCharacterVisualDescription(input);

  const personalDetails: string[] = [];
  if (input.specialTrait) {
    personalDetails.push(`- Special trait: "${input.specialTrait}" — weave this personal detail naturally into the narrative`);
  }
  if (input.favoriteCompanion) {
    personalDetails.push(`- Favorite companion/pet: "${input.favoriteCompanion}" — this real-life companion should appear as a cameo or supporting character`);
  }
  const personalSection = personalDetails.length > 0
    ? `\nPERSONAL DETAILS (very important — these make the story truly unique):\n${personalDetails.join("\n")}`
    : "";

  const modeInstruction = input.creationMode === "juntos"
    ? "This story will be READ TOGETHER by parent and child. Keep sentences short and clear. Use playful language. Include moments where the reader can pause and ask the child questions."
    : "This story is being created as a GIFT from a parent. Include emotional depth and thoughtful callbacks to the child's personal details.";

  const prompt = `You are a world-class children's book author specializing in personalized stories for kids aged 2-12. You write in Spanish (Spain). Your style is warm, whimsical, and age-appropriate. You create vivid scenes that translate well to watercolor-style illustrations.

IMPORTANT RULES:
- Write the entire story in Spanish (Spain)
- Adapt vocabulary and sentence complexity to a ${input.age}-year-old child
- The protagonist is ALWAYS the child described below
- Each scene must be self-contained enough for a full-page illustration
- Image prompts must be in ENGLISH (for the AI image generator)
- Image prompts should describe a children's book illustration in soft watercolor style, with warm pastel colors, whimsical atmosphere, inspired by Oliver Jeffers
- NEVER include text in the image prompts — illustrations should be text-free
- Leave visual space in illustrations for text overlay
- The protagonist in EVERY image prompt must match this EXACT description: "${characterVisual}" — use these exact words every time to ensure visual consistency across all illustrations

CREATION MODE: ${modeInstruction}

Create a personalized children's book story with these details:

PROTAGONIST:
- Name: ${input.childName}
- Gender: ${genderLabel}
- Age: ${input.age} years old
- City: ${input.city || "una ciudad mágica"}
- Interests: ${input.interests.join(", ") || "adventure, imagination"}
${personalSection}

STORY TEMPLATE: "${input.templateTitle}"
- Theme: ${theme}
- Moral: ${moral}
${decisionsContext}

ENDING: ${endingInstruction}

${input.dedication ? `DEDICATION from ${input.senderName || "someone special"}: "${input.dedication}"` : ""}

Generate a story with EXACTLY this structure as a JSON object:
{
  "bookTitle": "The personalized book title in Spanish",
  "dedication": "A beautiful dedication page text in Spanish (incorporate the custom dedication if provided, otherwise create one)",
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "Scene title in Spanish",
      "text": "2-4 sentences of story text in Spanish, appropriate for the child's age",
      "imagePrompt": "Detailed image prompt in ENGLISH describing the scene for a children's book illustration. ALWAYS start with the protagonist description: '${characterVisual}'. Then describe: setting, action, mood, secondary characters. Style: children's book illustration, soft warm colors, whimsical, gentle lighting."
    }
  ],
  "finalMessage": "A closing message in Spanish like: Y así, [name] descubrió que [moral]"
}

Create exactly 12 scenes following this narrative arc:
1. Opening: ${input.childName} in their everyday world (${input.city || "their city"}), establishing personality and routine
2. The spark: something unusual catches their attention — a hint of the adventure to come
3. Crossing the threshold: the magical/adventure world opens up (connected to the story template theme)
4. First encounter: meeting someone or something unexpected (use the chosen encounter if provided)
5. Making an ally: bonding with a companion who will join the journey (use the chosen companion if provided)
6. Exploration: discovering the wonders of this new world, using their interests and skills
7. First test: a small challenge that reveals the protagonist's strengths
8. Deepening bonds: a quiet, emotional moment between the protagonist and their companion
9. The great challenge: the main obstacle appears and things get difficult (use the chosen challenge if provided)
10. The darkest moment: it seems like all is lost — doubt, fear, or setback
11. The breakthrough: finding courage, using everything learned, the moral of the story shines through
12. Homecoming: returning home transformed, carrying the lesson, leading to the chosen ending

Respond ONLY with the JSON object, no markdown formatting, no code blocks.`;

  const { url, init } = provider.buildFetchArgs(prompt, apiKey);

  console.log(`[StoryGen] Using provider: ${provider.name}`);

  const response = await fetch(url, init);

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`${provider.name} error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const content = provider.extractContent(data);

  if (!content) {
    throw new Error(`Empty response from ${provider.name}`);
  }

  // Clean potential markdown code blocks from the response
  const cleaned = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed: GeneratedStory = JSON.parse(cleaned);

  if (!parsed.bookTitle || !parsed.scenes || parsed.scenes.length < 12) {
    throw new Error(`Invalid story structure from ${provider.name}`);
  }

  return parsed;
}
