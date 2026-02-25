// Multi-provider LLM for story generation (plain fetch, no SDK)
// Reference: https://github.com/cheahjs/free-llm-api-resources
//
// Supported providers (auto-detected from env vars, checked in order):
//   GROQ_API_KEY    → Groq (Llama 3.3 70B)    — 1,000 RPD, fastest inference
//   CEREBRAS_API_KEY → Cerebras (Llama 3.3 70B) — 14,400 RPD, most generous
//   GEMINI_API_KEY  → Google AI Studio          — 20 RPD, best quality but very limited

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
  templateId: string;
  templateTitle: string;
  creationMode: "solo" | "juntos";
  decisions: Record<string, unknown>;
  dedication?: string;
  senderName?: string;
  endingChoice?: "banquet" | "stars";
}

// --- Provider abstraction ---

interface ProviderConfig {
  name: string;
  buildFetchArgs: (prompt: string, apiKey: string) => { url: string; init: RequestInit };
  extractContent: (data: Record<string, unknown>) => string | undefined;
}

const PROVIDERS: Record<string, ProviderConfig> = {
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
    "No LLM API key configured. Set one of: GROQ_API_KEY (recommended), CEREBRAS_API_KEY, or GEMINI_API_KEY in .env.local\n" +
      "Get a free key at: https://console.groq.com (Groq) or https://cloud.cerebras.ai (Cerebras)"
  );
}

// --- Story generation ---

const TEMPLATE_THEMES: Record<string, { theme: string; moral: string }> = {
  space: {
    theme: "Space travel, exploring unknown planets, making alien friends",
    moral: "Curiosity takes you far",
  },
  forest: {
    theme: "Enchanted forest, fantastic animals, ancient trees with secrets",
    moral: "Taking care of our world matters",
  },
  superhero: {
    theme: "Discovering hidden superpowers, saving the city with courage",
    moral: "True power is kindness",
  },
  pirates: {
    theme: "Pirate adventure on the high seas, treasure hunting with a fun crew",
    moral: "The best treasures are friends",
  },
  chef: {
    theme: "Magical kitchen where ingredients come alive, cooking with imagination",
    moral: "Creating with your hands is magic",
  },
};

export async function generateStory(input: StoryInput): Promise<GeneratedStory> {
  const { config: provider, apiKey } = getProvider();

  const template = TEMPLATE_THEMES[input.templateId] ?? TEMPLATE_THEMES.forest;

  const genderLabel =
    input.gender === "boy" ? "niño" : input.gender === "girl" ? "niña" : "niñe";

  const endingInstruction =
    input.endingChoice === "banquet"
      ? "The story ends with a big celebration feast where all characters gather to eat, dance, and celebrate."
      : input.endingChoice === "stars"
        ? "The story ends peacefully under a starry sky, reflecting on lessons learned."
        : "End the story in a warm, satisfying way.";

  const decisionsContext =
    Object.keys(input.decisions).length > 0
      ? `\nStory customization choices made by the reader: ${JSON.stringify(input.decisions)}`
      : "";

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

Create a personalized children's book story with these details:

PROTAGONIST:
- Name: ${input.childName}
- Gender: ${genderLabel}
- Age: ${input.age} years old
- City: ${input.city || "una ciudad mágica"}
- Interests: ${input.interests.join(", ") || "adventure, imagination"}

STORY TEMPLATE: "${input.templateTitle}"
- Theme: ${template.theme}
- Moral: ${template.moral}
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
      "imagePrompt": "Detailed image prompt in ENGLISH describing the scene for a watercolor children's book illustration. Include: the child character (${input.gender}, ${input.age} years old), setting, action, mood. Style: soft watercolor, warm pastels, whimsical, Oliver Jeffers inspired."
    }
  ],
  "finalMessage": "A closing message in Spanish like: Y así, [name] descubrió que [moral]"
}

Create exactly 8 scenes following this narrative arc:
1. Introduction: ${input.childName} in their real environment
2. Inciting event: something magical happens
3. Adventure begins: discovering something new
4. First challenge: using their interests/skills
5. Encounter: meeting a friend character
6. Greater challenge: a more complicated situation
7. Climax: resolving everything with bravery
8. Resolution: returning home with lessons learned

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

  // Validate structure
  if (!parsed.bookTitle || !parsed.scenes || parsed.scenes.length < 8) {
    throw new Error(`Invalid story structure from ${provider.name}`);
  }

  return parsed;
}
