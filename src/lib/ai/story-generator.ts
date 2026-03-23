// Three-phase story generation architecture
//
// PHASE 1 — ARCHITECT (single LLM call):
//   Plans the entire book in one coherent creative vision.
//   Outputs: 12 rich scene briefs (3-5 sentences each), 12 image prompts,
//   cover prompt, titles, dedication, synopsis, final message.
//   Each brief includes: what happens, emotional beat, personal detail integration, hook.
//
// PHASE 2 — EXPANSION (12 parallel LLM calls):
//   Each scene brief gets expanded into full literary prose.
//   The expander receives: protagonist details, interests, moral, theme, narrative tone,
//   surrounding briefs for continuity, age-band craft instructions, and — critically —
//   the pre-generated imagePrompt as an ILLUSTRATION ANCHOR so the text and image
//   describe the same visual moment.
//   All 12 calls run in parallel.
//
// PHASE 3 — EDITORIAL REVIEW (single LLM call, parallel with illustration uploads):
//   Reads the complete manuscript and applies targeted fixes:
//     - Narrative coherence (contradictions, logic gaps, continuity breaks, name changes)
//     - Illustration-text alignment (imagePrompt depicts moment absent from scene text)
//     - Age-appropriateness (vocabulary, implicit vs explicit moral)
//   Returns a JSON diff of only the problem scenes — original story preserved otherwise.
//   Non-fatal: if the review fails, the original story is used unchanged.
//
// Uses native Node.js https to bypass Next.js undici socket drops.

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

function getTemplateTone(templateId: string, age: number): NarrativeTone {
  const base = TEMPLATE_TONES[templateId] || TEMPLATE_TONES.forest;

  // ── Ages 2-4: Override complex tones with age-appropriate equivalents ────
  // The original tones reference adult films and complex narratives. For toddlers,
  // every template needs a completely different emotional register.
  if (age <= 4) {
    const toddlerOverrides: Partial<Record<string, NarrativeTone>> = {
      chef: {
        voice: "Playful, sensory, and joyful",
        craftDirectives: "The kitchen is a wonderland of colours, smells, and funny sounds. Ingredients are little friends who want to help. Everything is simple, warm, and delicious. The cooking is an act of love and fun — mixing, stirring, tasting. Think of a toddler proudly handing a biscuit to a friend. No complexity, no metaphor — just pure sensory delight and the joy of making something for someone you love.",
        emotionalRegister: "joy, sensory delight, pride in making something, love through sharing",
      },
      candy: {
        voice: "Pure wonder and sweetness",
        craftDirectives: "The candy world is a dream made real — everything is beautiful, colourful, and slightly ridiculous in the best way. A river of chocolate, a path made of biscuits, trees that grow lollipops. No darkness, no greed, no complexity. Just the pure childlike joy of impossible sweets and the happiness of sharing them. Think of a toddler's face when they see a birthday cake — that is the entire emotional register of this book.",
        emotionalRegister: "wonder, delight, sweetness, the pure joy of sharing something beautiful",
      },
      space: {
        voice: "Wonder and magical simplicity",
        craftDirectives: "Space is big and sparkly and full of friendly surprises. Stars twinkle and wave. Planets are round and colourful like giant balls. Aliens are funny and kind and want to play. The universe is not vast and lonely — it is cosy and full of new friends waiting to meet our protagonist. Think of a child's drawing of space: bright, simple, and full of joy.",
        emotionalRegister: "wonder, friendliness, the joy of exploring somewhere new, warmth",
      },
      forest: {
        voice: "Warm, gentle, and full of friendly creatures",
        craftDirectives: "The forest is a safe and magical place full of curious animals and soft mossy hiding spots. Every creature is kind and wants to help. The trees are friendly giants. The sounds are funny — hoots and rustles and splashes. The forest feels like a hug. No fear, no darkness — just the warm wonder of nature and the animals who live in it.",
        emotionalRegister: "warmth, gentle wonder, belonging, the joy of animal friends",
      },
      dinosaurs: {
        voice: "Big, exciting, and surprisingly gentle",
        craftDirectives: "Dinosaurs are enormous and amazing, but our protagonist is not afraid — they are FASCINATED. The dinosaurs are curious, a little clumsy, and very friendly. They make big sounds and leave big footprints. The wonder is in the SIZE — everything is enormous — but the feelings are small and warm. Think of a toddler delightedly roaring like a dinosaur.",
        emotionalRegister: "excitement, awe at size, gentle bravery, the joy of making a giant friend",
      },
      safari: {
        voice: "Warm, reverent, and wonderstruck",
        craftDirectives: "The animals are magnificent and kind. Lions have sleepy eyes. Elephants walk slowly and let you touch their trunks. Giraffes eat leaves from the very top of trees. Everything is big and gentle and real. The wonder is in the animals themselves — their sounds, their movements, their size. Keep it simple: see the animal, feel the wonder, share the moment.",
        emotionalRegister: "wonder, gentleness, the joy of being close to something magnificent",
      },
      superhero: {
        voice: "Exciting, funny, and warmly encouraging",
        craftDirectives: "Being a superhero at age 3 means running fast, jumping high, and helping friends when they fall. Powers are simple and fun — maybe flying, maybe being super-strong, maybe just being VERY good at giving hugs. The adventure is playful and the stakes are small. Think of children playing in capes in a garden. Pure physical delight and the pride of helping someone.",
        emotionalRegister: "excitement, pride, the joy of helping, playful bravery",
      },
      pirates: {
        voice: "Adventurous, silly, and full of treasure",
        craftDirectives: "Pirates say ARRRR and sail on blue waves and look for treasure with big old maps. Everything about pirates is funny and exciting to a toddler: the hats, the swords (that we never use to hurt anyone), the big ship going up and down on the waves, the TREASURE CHEST full of shiny things. Keep it physical and playful — the adventure is in the silliness, the movement, the discovery.",
        emotionalRegister: "silly excitement, the joy of treasure, the fun of adventure, friendship on the ship",
      },
      castle: {
        voice: "Magical, warm, and full of friendly surprises",
        craftDirectives: "The castle is a magical place full of winding staircases and secret doors and rooms that go on forever. There are friendly dragons who breathe colourful smoke, not fire. Knights in shiny armour who love to dance. Princesses who know how to fix things. The mystery is always gentle and the surprises are always warm. Think of a toddler discovering a new room — that sense of excited possibility.",
        emotionalRegister: "magical wonder, gentle mystery, the joy of discovery, warm fantasy",
      },
      inventor: {
        voice: "Playful, creative, and joyfully experimental",
        craftDirectives: "Inventing for a toddler means banging things together to see what happens, putting the square peg in the round hole (it doesn't fit but it's funny), and pressing every single button. The workshop is full of funny gadgets that make silly sounds. The inventions do unexpected things. Everything is safe and colourful. The message is simple: trying things is FUN, and mistakes are funny, not bad.",
        emotionalRegister: "playful curiosity, the joy of making things, delight in silly surprises",
      },
    };
    return toddlerOverrides[templateId] || {
      voice: "Warm, playful, and full of wonder",
      craftDirectives: "Keep everything simple, physical, and joyful. The world is big and friendly. The protagonist is curious and brave in small, sweet ways. Every moment should feel like a gift. Think of the warmest, most delightful picture book you have ever read — that is the tone.",
      emotionalRegister: "warmth, wonder, joy, safety, love",
    };
  }

  // ── Ages 5-6: Simplify complex references, keep the spirit ───────────────
  if (age <= 6) {
    const earlyReaderOverrides: Partial<Record<string, NarrativeTone>> = {
      chef: {
        voice: "Warm, sensory, and joyfully creative",
        craftDirectives: "The kitchen is a magical place where making food is an act of love. Ingredients have personalities. The cooking process is full of funny moments (the flour cloud, the wobbly tower of pancakes). But underneath the fun is a warm truth: when we make something for someone we love, the food tastes better. Keep it physical and sensory — every dish should make the reader's mouth water.",
        emotionalRegister: "comfort, creative joy, the pleasure of making something, love through food",
      },
      candy: {
        voice: "Playful, whimsical, and generously sweet",
        craftDirectives: "The candy world is full of impossible wonders: chocolate rivers, lollipop forests, clouds made of candyfloss. But the real sweetness comes from sharing. Each amazing thing the protagonist discovers is better when shared with a friend. Keep the tone light and fun — pure imagination — with a warm current of generosity running underneath everything.",
        emotionalRegister: "delight, wonder, generosity, the joy of sharing something magical",
      },
    };
    return earlyReaderOverrides[templateId] || base;
  }

  // ── Ages 7+: Use the full, original tone directives ───────────────────────
  return base;
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
      wordsPerScene: "40-60",
      narrativeVoice: [
        "VOICE: Warm, joyful narrator who is right there beside the child — like a beloved parent reading at bedtime.",
        "Write in close 3rd person with occasional direct invitations to the child: 'And do you know what happened next?' or 'Can you guess what she found?'",
        "The narrator is gentle, enthusiastic, and always reassuring. This child should feel safe, seen, and delighted at every page turn.",
        "Write with rhythm and musical sound — sentences should beg to be read aloud. Short, bouncy, predictable patterns.",
      ].join("\n"),
      textStyle: [
        "Write for a very young child aged 2-4. 3-5 sentences per scene, MAXIMUM 40-60 words.",
        "",
        "SENTENCE LENGTH: Maximum 6-7 words per sentence. Hard limit. Never longer.",
        "CORRECT: 'Marc ran to the big tree.'",
        "CORRECT: 'She hugged the puppy tight.'",
        "WRONG: 'Marc ran as fast as he could all the way to the big tree at the edge of the garden.'",
        "",
        "VOCABULARY — only words a 2-4 year old already knows and uses:",
        "✓ USE: run, jump, big, small, red, blue, happy, sad, scared, hungry, friend, home, tree, sun, dog, cat, mum, dad, play, eat, sleep, find, see, hear, touch, love, hug, cry, laugh, help, warm, soft, loud, shiny, funny, fast",
        "✗ NEVER USE: mysterious, incredible, breathtaking, ancient, magnificent, realised, extraordinary, peculiar, extraordinary, venture, peculiar, solitude, melancholy, anxiety, treacherous, contemplated, or ANY word a 3-year-old cannot say aloud",
        "",
        `RHYTHM AND REPETITION: Use onomatopoeia (${localeConfig.onomatopoeia}), repetition, and musical patterns throughout. Repeat key phrases across different scenes like a refrain — toddlers love and need repetition; it builds confidence and delight.`,
        "GOOD RHYTHM: 'Stomp, stomp, stomp. Marc stamped his feet. Stomp, stomp, stomp!'",
        "",
        "SENSES: Every scene must include one concrete sensory detail — something the child can hear, touch, smell, or see. Never abstract. Always physical and immediate.",
        "",
        "EMOTION: State exactly ONE clear emotion per scene, and name it directly and simply.",
        "CORRECT: 'Marc was SO happy.' or 'Sofia felt scared.' or 'He was very proud.'",
        "Do NOT leave emotions implicit for this age — toddlers need explicit emotional labels to develop their vocabulary.",
        "",
        "WONDER INVITATIONS — NOT cliffhangers: End each scene with gentle, warm anticipation. Never anxiety, never fear, never unresolved danger.",
        "✓ CORRECT: 'And then... something wonderful was waiting!' or 'What do you think was inside?'",
        "✗ WRONG: 'Something moved in the dark.' or 'He didn't know what was coming.'",
        "",
        "MORAL — MUST BE EXPLICIT: For ages 2-4, the lesson MUST be stated simply and warmly at the end. Young children at this developmental stage CANNOT infer implicit morals. The final scene or narrator must say it clearly: 'And Marc learned that sharing makes everyone happy.' Simple, direct, warm — never a lecture, just a gentle truth.",
        "",
        "CIRCULAR STRUCTURE — ESSENTIAL: The story MUST start and end at home or in a safe, familiar place. This circular structure is psychologically essential for toddlers. The adventure happens in the middle, but the child always returns safely home. Never end on the adventure — always on safety and warmth.",
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
      wordsPerScene: "80-110",
      narrativeVoice: [
        "VOICE: Warm, playful 3rd person narrator — close to the child but with a clear storytelling voice.",
        "The narrator is enthusiastic and encouraging, like a favourite teacher reading aloud with real feeling.",
        "Short dialogues — one or two lines at a time. Characters speak the way real 5-6 year olds do: direct, simple, expressive.",
        "Occasional gentle asides to the reader ('And guess what happened next?') — these create shared excitement between the reader and the child.",
      ].join("\n"),
      textStyle: [
        "Write for a child aged 5-6. 4-6 sentences per scene, 80-110 words.",
        "",
        "SENTENCE LENGTH: Maximum 10-12 words per sentence. One clear idea per sentence.",
        "CORRECT: 'She opened the box and found something amazing.'",
        "CORRECT: 'Marc looked at his friend. He knew what to do.'",
        "WRONG: 'She opened the old wooden box that her grandmother had given her and inside there was something she had never seen before in her entire life.'",
        "",
        "VOCABULARY: Use everyday words a 5-6 year old knows confidently. You may introduce ONE new word per scene — but immediately reveal its meaning through the action or context around it.",
        "✓ ALLOWED stretch words: brave, gentle, curious, excited, worried, magical, surprising, friendship, challenge, careful, helpful, proud, discover, adventure",
        "✗ NEVER USE: melancholy, treacherous, extraordinary, magnificent, solitude, anxiety, contemplated, peculiar, shrieked, bewildered — if a 6-year-old reader cannot sound it out and understand it, do not use it",
        "",
        `RHYTHM: Use onomatopoeia (${localeConfig.onomatopoeia}), repetition, and playful patterns. A repeated phrase or refrain across scenes creates comfort and delight for this age group.`,
        "",
        "CAUSE AND EFFECT: Every scene must show clear cause → consequence logic. Something happens, and BECAUSE of it, something else follows. Children aged 5-6 are developing causal reasoning and it deeply satisfies them when stories reflect this.",
        "GOOD: 'Marc shared his biscuit. Now he had a new friend.'",
        "GOOD: 'She practised every day. That's why she was ready.'",
        "",
        "PACING: Start each scene with something happening — action first, description second. Never open with 'It was a sunny day.'",
        "",
        "SENSES: Every scene includes one concrete sensory detail the child can hear, touch, smell, or see.",
        "",
        "EMOTION: Name feelings clearly (excited, worried, brave, proud) AND show them through physical reactions: 'Sofia felt worried. Her hands shook a little.'",
        "",
        "HOOKS: End every scene with a small surprise, discovery, or warm question that creates anticipation. The tone is wonder, not fear.",
        "",
        "MORAL: The lesson lives in what the protagonist DOES and CHOOSES. However, at the end of the story, it is appropriate for the narrator or a character to gently name the lesson in simple words: 'And that day, Mia learned that asking for help is brave.' Children aged 5-6 benefit from both experiencing AND hearing the lesson stated.",
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
      wordsPerScene: "120-160",
      narrativeVoice: [
        "VOICE: Engaging 3rd person limited — we are inside the protagonist's head, following their thoughts and feelings moment to moment.",
        "The narrator has personality: witty, warm, occasionally conspiratorial ('But what Marc didn't know yet was...').",
        "INNER MONOLOGUE: Show the protagonist's thoughts directly and briefly. 'His stomach dropped. Could he really do this?' — these flashes of interiority make the reader feel they ARE the protagonist.",
        "DIALOGUE: Short, natural exchanges — the way real 7-9 year olds actually talk. Characters say too little, interrupt, hesitate. No speeches.",
        "Occasional asides to the reader are welcome — used sparingly, they create intimacy ('And THAT, dear reader, is when things got really interesting.').",
      ].join("\n"),
      textStyle: [
        "Write for a child aged 7-9. 6-9 sentences per scene, 120-160 words.",
        "",
        "OPENING: Start every scene mid-action or mid-emotion. Never with flat description ('It was a bright morning'). Pull the reader in from the very first word.",
        "",
        "INNER WORLD: At least once per scene, show the protagonist's thoughts or emotions through their body — a racing heart, sweaty palms, a grin they can't hold back, a stomach that tightens. This is what makes the reader feel they are living the story, not watching it.",
        "",
        "TENSION: Build genuine, child-safe suspense — a strange sound with no explanation, a problem with no obvious solution, a misunderstanding with a friend. Let the tension breathe for 2-3 sentences before resolving. Do NOT rush to comfort — the brief discomfort is developmentally appropriate and emotionally satisfying when it resolves.",
        "",
        "HUMOR: At least one moment per scene that earns a real smile — a funny observation, a small physical comedy, an unexpected reaction from a character. Earned and natural, never forced.",
        "",
        "SENSES: Engage at least two different senses per scene. Not just visual — what does this place smell like? What does the ground feel like? What unexpected sound does the protagonist notice? Precise sensory detail makes fiction feel real.",
        "",
        "VOCABULARY: Stretch the reader just beyond their comfort zone with one or two vivid, precise words whose meaning is clear from context. This is how children grow their language. 'The cave smelled of damp stone and something sweet he couldn't name.'",
        "",
        "HOOKS: Every scene ends with a small cliffhanger, an unanswered question, or an emotional beat that makes it genuinely difficult to put the book down.",
        "",
        "MORAL — SHOW NEVER TELL: The lesson lives entirely in the protagonist's CHOICES and their consequences. Never have a character state the moral. Never summarize it. Trust the 8-year-old reader to feel and absorb it through the story.",
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
    wordsPerScene: "250-350",
    narrativeVoice: [
      "VOICE: Literary 3rd person limited. The reader lives completely inside the protagonist's head.",
      "Inner monologue is your most powerful tool — let us hear their doubts, contradictions, private hopes, and small triumphs. The protagonist thinks in full, complex sentences.",
      "The narrator never intrudes. No 'dear reader' asides. The prose IS the character's perception of the world — filtered through their age, their fears, their specific way of seeing.",
      "Dialogue reveals character through subtext: what people say and what they mean are often different. Silence, pauses, and unfinished sentences carry as much weight as the words.",
    ].join("\n"),
    textStyle: [
      "Write for a child aged 10-12. 12-18 rich sentences per scene, 250-350 words.",
      "",
      "OPENING: Every scene starts in medias res — mid-action, mid-thought, or mid-emotion. Never 'It was a sunny day.' Never with flat scene-setting. Immerse immediately.",
      "",
      "IDENTITY AND INTERIORITY: This age group is navigating who they are. The protagonist should actively question themselves, doubt their choices, contradict themselves, and grow through the story — not just move through it. Include moments where the protagonist wonders if they're good enough, brave enough, or doing the right thing. This resonates deeply with 10-12 year old readers.",
      "",
      "REAL STAKES AND GENUINE DARKNESS: The protagonist can fail, feel afraid, feel alone, feel misunderstood. Do not rush to comfort. Let discomfort sit for several sentences before beginning to resolve — this emotional honesty is what makes books memorable at this age. The resolution must be EARNED, not given.",
      "",
      "PROSE CRAFT: Every metaphor and sensory detail must earn its place. One precise image beats three vague ones. Favour the specific over the general.",
      "GOOD: 'The cave smelled like wet iron and old secrets.'",
      "GOOD: 'Her hands were steady but her thoughts were not.'",
      "BAD: 'It was a beautiful and mysterious place that felt both strange and exciting.'",
      "",
      "DIALOGUE WITH SUBTEXT: Meaningful exchanges that reveal relationship dynamics. Characters talk around things, interrupt each other, say the opposite of what they feel. What is NOT said is often more powerful than what is said.",
      "",
      "HUMOR: Subtle wit, dry irony, and unexpected observations. This age group appreciates intelligence in humor. Never slapstick, never forced.",
      "",
      "CALLBACKS: Plant a small specific detail in the first three scenes that becomes meaningful or even crucial in scenes 9-12. This creates the satisfying feeling of a 'real' book.",
      "",
      "MORAL — NEVER STATE IT: The lesson must never be stated, explained, summarized, or hinted at through any character's speech — not even a wise mentor. The moral emerges purely from the protagonist's arc: from who they were in Scene 1 vs. who they choose to be in Scene 11. Trust the 11-year-old reader completely. They are intelligent and will feel it without being told.",
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
  /** Language-specific grammar rules injected into every prompt (e.g. personal articles in Catalan) */
  grammarNotes?: string;
  /** Sentence length adjustment for Romance languages (more function words than English) */
  sentenceLengthAdjustment?: string;
}

const LOCALE_CONFIGS: Record<string, LocaleConfig> = {
  es: {
    language: "Spanish (Spain)",
    genderLabels: { boy: "niño", girl: "niña", neutral: "niñe" },
    onomatopoeia: "¡SPLASH! ¡BUM! ¡FIUUU!",
    sentenceLengthAdjustment: "SENTENCE LENGTH ADJUSTMENT: Spanish uses more function words (articles, prepositions, pronouns) than English. When the word-count target says '10-12 words', apply '12-15 words' for Spanish. When it says '6-7 words', apply '8-10 words'. NEVER exceed 16 words in a single sentence for young children. Split compound sentences using periods instead of commas.",
  },
  ca: {
    language: "Catalan",
    genderLabels: { boy: "nen", girl: "nena", neutral: "infant" },
    onomatopoeia: "SPLASH! BUM! FIUUU!",
    grammarNotes: `CATALAN GRAMMAR — PERSONAL ARTICLE (mandatory, no exceptions):
- Masculine names: ALWAYS write "en [Name]" → "en Pau", "en Marc", "en Jordi"
- Feminine names: ALWAYS write "la [Name]" → "la Maria", "la Laia"
- Names starting with a vowel: ALWAYS write "l'[Name]" → "l'Anna", "l'Artur", "l'Irene"
- NEVER write a bare name without its personal article: ✗ "Pau va córrer" → ✓ "En Pau va córrer"
- The article is also required after conjunctions: "i en Pau", "però la Maria", "quan l'Anna"`,
    sentenceLengthAdjustment: "SENTENCE LENGTH ADJUSTMENT: Catalan uses more function words (articles, prepositions, pronouns) than English. When the word-count target says '10-12 words', apply '12-15 words' for Catalan. When it says '6-7 words', apply '8-10 words'. NEVER exceed 16 words in a single sentence for young children. Split compound sentences using periods instead of commas.",
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
    sentenceLengthAdjustment: "SENTENCE LENGTH ADJUSTMENT: French uses more function words (articles, prepositions, pronouns) than English. When the word-count target says '10-12 words', apply '12-15 words' for French. When it says '6-7 words', apply '8-10 words'. NEVER exceed 16 words in a single sentence for young children. Split compound sentences using periods instead of commas.",
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
/** Model for the editorial review — reads the full manuscript and applies targeted fixes.
 *  Shares the expansion model by default; can be overridden to a stronger model if needed. */
const REVIEW_MODEL = process.env.OPENAI_REVIEW_MODEL || EXPANSION_MODEL;

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
    temperature: 0.8,
    messages: [
      {
        role: "system",
        content: "You are a world-class children's book author and editor with deep expertise in child development psychology, linguistics, and age-appropriate storytelling. You write with the precision of a published author and the warmth of a gifted parent. Your prose is always calibrated exactly to the cognitive, emotional, and linguistic development stage of the target child — never above it, never below it. You have written hundreds of acclaimed children's books across all age groups.",
      },
      { role: "user", content: prompt },
    ],
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

  // ── Ages 2-4: Circular structure (8 scenes + 4 bridges) ─────────────────
  // Children this age need safety and closure. The adventure MUST begin and end at home.
  if (ageConfig.bridgeCount === 4) {
    return `
NARRATIVE STRUCTURE — 8 scenes + 4 bridges (CIRCULAR — starts and ends at home):

BLOCK 1 — "HOME AND WHO I AM"
  Slot 1 [scene]: ${name} at home in ${city}. Show personality through play and routine — what they love, how they move, what makes them laugh.
  Slot 2 [scene]: ${name} notices something surprising nearby. Pure curiosity and wonder. No danger.
  Slot 3 [bridge]: A simple warm transition — something magical beckons. "And then... something wonderful appeared!"

BLOCK 2 — "THE MAGICAL DISCOVERY"
  Slot 4 [scene]: A new magical place or friendly creature appears. Complete wonder. Everything is safe and beautiful.
  Slot 5 [scene]: ${name} meets a kind friend or finds a special object. Joy, warmth, connection.
  Slot 6 [bridge]: A small, gentle problem appears. Never scary — just a little puzzle. "Oh! Something needed help."

BLOCK 3 — "HELPING AND TRYING"
  Slot 7 [scene]: ${name} tries to help or solve the puzzle. First try doesn't quite work — but that's okay! They keep going.
  Slot 8 [scene]: ${name} tries again with kindness, sharing, or a new idea. It works! Everyone is happy.
  Slot 9 [bridge]: Warm celebration. Everything is right. "Hooray! They did it!"

BLOCK 4 — "HOME AGAIN, HAPPY"
  Slot 10 [scene]: Celebration together. The moral is stated warmly and simply by the narrator or a character.
  Slot 11 [scene]: ${name} returns home. The safe, familiar place feels even more wonderful now.
  Slot 12 [bridge]: The warmest, softest closing line. The child should feel completely safe and loved.

CRITICAL RULE FOR TODDLERS: Slots 3, 6, 9, 12 are bridges — each is ONE simple, playful sentence (max 15 words). No atmosphere. No complexity. Just warmth and forward motion.`;
  }

  // ── Ages 5-6: Cause-effect structure (9 scenes + 3 bridges) ─────────────
  // Children this age understand causality and love seeing it play out clearly.
  if (ageConfig.bridgeCount === 3) {
    return `
NARRATIVE STRUCTURE — 9 scenes + 3 bridges (CAUSE-EFFECT — want → try → problem → solve → celebrate):

BLOCK 1 — "MY WORLD"
  Slot 1 [scene]: ${name} in ${city}. Show their personality, what they love, what makes them them.
  Slot 2 [scene]: A wish or goal sparks in ${name}'s heart. They want something or want to help someone. Clear motivation.
  Slot 3 [bridge]: The adventure begins — a door opens, a path appears, something new is just around the corner.

BLOCK 2 — "THE ADVENTURE BEGINS"
  Slot 4 [scene]: ${name} steps into the new world or begins the quest. Excitement, wonder, a little nervousness.
  Slot 5 [scene]: A new friend or ally appears. They team up. Show WHY they make a good team.

BLOCK 3 — "THE PROBLEM"
  Slot 6 [scene]: A clear problem arises — because of something specific (cause → effect). Something doesn't work. Show the consequence immediately.
  Slot 7 [scene]: First attempt to fix it. Partial progress, but something is still wrong. ${name} feels a little worried.
  Slot 8 [scene]: A quiet moment — ${name} thinks, feels, perhaps misses home a little. Then a small idea sparks.
  Slot 9 [bridge]: Something shifts. Hope arrives. "Wait... what if...?"

BLOCK 4 — "THE SOLUTION AND HOME"
  Slot 10 [scene]: ${name} tries the new approach — with friends, with kindness, with the right choice. It works! Show the positive consequence clearly.
  Slot 11 [scene]: Celebration and gratitude. The lesson is gently named by the narrator or a character in simple words.
  Slot 12 [scene]: ${name} returns home, happy and changed. Warm circular closure — back where we started, but better.`;
  }

  // ── Ages 7-9: Simplified hero's journey (10 scenes + 2 bridges) ──────────
  if (ageConfig.bridgeCount === 2) {
    return `
NARRATIVE STRUCTURE — 10 scenes + 2 bridges (HERO'S JOURNEY — simplified):

BLOCK 1 — "MY WORLD"
  Slot 1 [scene]: ${name} in ${city}. Personality through routine and inner world. Plant a small detail that will matter later.
  Slot 2 [scene]: First hint of adventure — something is different today. Curiosity mixed with a little fear.
  Slot 3 [bridge]: The threshold between the ordinary world and the adventure. One atmospheric sentence of transition.

BLOCK 2 — "THE CALL"
  Slot 4 [scene]: The adventure world opens fully. The rules here are different. ${name} must adapt.
  Slot 5 [scene]: Meeting the key ally or companion. They bond through a shared moment — not through a speech.

BLOCK 3 — "THE JOURNEY"
  Slot 6 [scene]: The wonders and strangeness of the new world. ${name}'s interests become real tools here.
  Slot 7 [scene]: A first real test. ${name} discovers a hidden strength — or a hidden weakness.
  Slot 8 [scene]: A quiet, intimate moment. Deepening bonds. Calm before the storm. ${name} reflects on who they are.
  Slot 9 [bridge]: The calm shatters. Something is coming. One sentence of dread or urgency.

BLOCK 4 — "THE CHALLENGE"
  Slot 10 [scene]: The great challenge arrives. Real stakes. ${name} is not ready — or thinks they aren't.
  Slot 11 [scene]: Breakthrough. ${name} finds courage, makes the right choice, uses what they've learned. The moral lives here — in the action, never stated.

BLOCK 5 — "COMING HOME"
  Slot 12 [scene]: Returning home transformed. The small detail planted in Slot 1 now matters in a new way. Who ${name} is now is different from who they were at the start.`;
  }

  // ── Ages 10-12: Full hero's journey (12 scenes, no bridges) ─────────────
  return `
NARRATIVE STRUCTURE — 12 scenes, no bridges (FULL HERO'S JOURNEY — literary depth):

BLOCK 1 — "THE ORDINARY WORLD"
  Slot 1 [scene]: ${name} in ${city}. Personality, routine, inner world. Plant a SPECIFIC small detail that will become significant in Scenes 9-11.
  Slot 2 [scene]: A crack in the ordinary. Something is wrong, different, or impossible to ignore. The world shifts slightly.

BLOCK 2 — "THE CALL AND CROSSING"
  Slot 3 [scene]: Entering the unknown. The choice to step forward — despite fear, despite doubt. This moment should cost ${name} something small.
  Slot 4 [scene]: First unexpected encounter. Everything ${name} assumed is challenged.
  Slot 5 [scene]: Meeting the key ally. Bonding through vulnerability, not through convenience. What they share or confess matters.

BLOCK 3 — "THE ROAD OF TRIALS"
  Slot 6 [scene]: The new world's wonders and rules. ${name}'s interests and traits appear in unexpected, meaningful ways.
  Slot 7 [scene]: A test that reveals a hidden strength — or exposes a flaw ${name} didn't know they had.
  Slot 8 [scene]: A quiet, intimate moment. The calm before the storm. A conversation, a memory, a moment of doubt. Stakes become personal.

BLOCK 4 — "THE ORDEAL"
  Slot 9 [scene]: The main obstacle. Real stakes. Something could genuinely go wrong. Callback to the detail from Slot 1.
  Slot 10 [scene]: The darkest moment. ${name} doubts, fears, considers giving up. Do not rush past this — it must breathe.
  Slot 11 [scene]: Breakthrough. Not through luck or rescue — through a choice ${name} makes that costs them something real. This is where the moral lives. Never state it.

BLOCK 5 — "THE RETURN"
  Slot 12 [scene]: Coming home transformed. The Slot 1 detail now carries new meaning. The reader understands what changed — not because it was explained, but because they felt it happen.`;
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
  if (input.favoriteCompanion) personalDetails.push(`- Favorite companion: "${input.favoriteCompanion}"`);
  if (input.favoriteFood) personalDetails.push(`- Favorite food: "${input.favoriteFood}"`);
  if (input.futureDream) personalDetails.push(`- Future dream: "${input.futureDream}"`);
  const personalSection = personalDetails.length > 0
    ? `\nPERSONAL DETAILS:\n${personalDetails.join("\n")}`
    : "";

  const tone = getTemplateTone(input.templateId, input.age);

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
      "The child should feel recognised through the story's warmth and the world it creates around them — NOT through cramming their favourite things into every page.",
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

HOW TO USE PERSONAL DETAILS (CRITICAL — read carefully):

GOLDEN RULE: Personal details make the child feel recognised. They are NOT mandatory plot devices.
DISTRIBUTE them across the ENTIRE book. Each detail should appear in 1-2 scenes maximum, never more.
NEVER cram multiple personal details into the same sentence or paragraph.
${input.age <= 6 ? `For age ${input.age}: use AT MOST 1 personal detail per scene. Many scenes should have ZERO.` : `For age ${input.age}: use AT MOST 2 personal details per scene. Several scenes should have ZERO.`}

- INTERESTS: These colour the child's PERSONALITY — they are part of who the child is. A child who loves music might hum when nervous or tap a rhythm on a table. A child who loves animals might notice a bird others miss. Do NOT turn interests into literal problem-solving tools or magic powers.
- FAVORITE COMPANION: If provided, it is the child's real pet or friend. It may appear in real-world scenes (home, opening, closing). It does NOT need to join the fantasy adventure — the STORY COMPANION from decisions fills that role. If you DO include the personal companion in the adventure, describe what it IS (cat, dog, hamster, etc.) every time — never just the name.
- FAVORITE FOOD: Only mention if a scene naturally involves eating, cooking, or comfort. If no scene calls for food, SKIP IT. Never force food into a scene where nobody is eating.
- FUTURE DREAM: Treat as background character colour — a passing thought, a comparison, a simile. If the dream aligns with the story theme (e.g., "chef" dream in a chef story), weave it naturally. If it CONFLICTS with the theme (e.g., "firefighter" dream in a pirates story), use it as a fleeting reference at most: "This adventure felt even braver than putting out fires."
- SPECIAL TRAIT: Can shine in a key moment, but does not need to be a literal superpower. A child who is "very patient" simply waits when others rush. A child who "loves to laugh" lightens a tense moment.

═══════════════════════════════════════════════════
STORY FRAMEWORK
═══════════════════════════════════════════════════

TEMPLATE: "${input.templateTitle}" | Theme: ${theme}
MORAL: "${moral}"

GEOGRAPHIC COHERENCE (CRITICAL — the parent will notice errors):
- The child lives in ${input.city || "their city"}. Opening scenes (Slots 1-2) are set THERE. Describe the REAL city faithfully — its streets, its feel, its weather.
- The fantasy world (${theme}) is a SEPARATE realm. The child ENTERS it through an explicit magical transition (a portal, a dream, a magic object, a wish, a book that pulls them in). NEVER imply the child physically traveled across the globe.
- NEVER describe elements of the fantasy world in real-world scenes. No ocean waves in an inland city. No jungle sounds in a European bedroom. No snow in a Mediterranean summer. The real world is REAL until the transition happens.
- After the transition, the fantasy world has its own geography and rules. The child's city does NOT exist there.
- In the final scene(s), the child returns home to their REAL city. The magic stays behind.

FORESHADOWING RULE:
- Foreshadowing must use CONCRETE objects and actions, never forced metaphors or similes.
  ✗ WRONG: "The spoon tapped the bowl like a sea shanty" (forced theme connection in a real-world scene)
  ✗ WRONG: "The wind smelled of adventure" (vague, means nothing)
  ✓ CORRECT: "Pau found an old rolled-up paper behind the bookshelf" (concrete object that creates curiosity)
  ✓ CORRECT: "Something glinted at the bottom of the toy box — something that hadn't been there yesterday" (concrete discovery)
- Foreshadowing creates CURIOSITY. It does NOT pre-announce the theme.

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
${input.favoriteCompanion ? `\nCOMPANION CLARITY: The story decisions above may include a STORY COMPANION (a character the child meets during the adventure — an alien, a fox, a robot, etc.). The child also has a PERSONAL COMPANION: "${input.favoriteCompanion}". These are DIFFERENT characters. The personal companion belongs to the child's real world. The story companion belongs to the fantasy world. Do NOT merge them. Do NOT have the personal companion replace the story companion.` : ""}

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
- Plant a small CONCRETE detail in Scenes 1-3 that becomes CRUCIAL in Scenes 9-11. This must be a physical object, a specific action, or a real observation — NOT a vague feeling or theme echo.
- Repeat a motif (a phrase, an object, a gesture) at least twice — the repetition creates the feeling of a 'real' story.

COHERENCE & LOGIC (the parent reads this book — they WILL notice errors):
- Every reference must make sense. If the character picks up an object, say WHERE it came from. If there is water, say WHICH water (a fountain, a river, a glass). Never leave the reader asking "wait, why is there X here?"
- Cause and effect must be airtight. If a character hears a sound, the source must exist in the scene. If something is described (blue water, a strange melody), the reader must understand what it is within the same scene.
- The story happens to a REAL CHILD in a REAL CITY. Everything before the magical transition must be physically plausible in that city. Everything after must be consistent within the fantasy world's own rules.
- NEVER describe the child doing two unrelated things simultaneously to cram in personal details. One action per moment.

EMOTIONAL ARC:
- The protagonist must CHANGE. Who they are at the end is different from who they were at the beginning.
- Include at least one QUIET MOMENT — a pause from the adventure where the protagonist reflects, connects with a companion, or misses home.
- For ages 8-12: include a genuine moment of DOUBT or DARKNESS before the resolution. Don't make everything easy.

═══════════════════════════════════════════════════
LANGUAGE AND VOCABULARY — AGE ${input.age}
═══════════════════════════════════════════════════
${localeConfig.grammarNotes ? `\n${localeConfig.grammarNotes}\n` : ""}
${localeConfig.sentenceLengthAdjustment ? `\n${localeConfig.sentenceLengthAdjustment}\n` : ""}
${input.age <= 4 ? `TODDLER VOCABULARY RULES (CRITICAL — non-negotiable):
- Every sentence in the briefs must reflect toddler-appropriate language. The expanding writer will follow your vocabulary choices.
- MAXIMUM sentence length in scene briefs: 6-7 words.
- USE ONLY: simple, concrete, everyday words. Anything a 2-4 year old says out loud.
- NEVER use in ANY brief, title, or text: mysterious, extraordinary, magnificent, realised, peculiar, melancholy, venture, solitude, anxious, treacherous, contemplated, ancient, incredible, breathtaking, or any abstract concept.
- Name emotions explicitly and simply: "happy", "scared", "proud", "safe", "sad", "excited". Never leave them implicit.
- CIRCULAR ENDING MANDATORY: The final scene must return ${input.childName} home. This is not optional.
- BRIDGES for this age: Each bridge must be ONE warm, playful sentence of max 15 words. No atmosphere. Just warmth and forward motion. Example: "And then, just around the corner, something magical was waiting!"` : ""}
${input.age >= 5 && input.age <= 6 ? `EARLY READER VOCABULARY RULES:
- MAXIMUM sentence length in scene briefs: 10-12 words.
- Vocabulary must be familiar to a 5-6 year old reader. You may include one new word per scene if its meaning is immediately clear from context.
- NEVER use: melancholy, treacherous, extraordinary, magnificent, solitude, anxiety, contemplated, bewildered, or any word a 6-year-old cannot read independently.
- CAUSE AND EFFECT: Every scene brief must show a clear cause → consequence. This age group is mastering causal reasoning.
- MORAL AT THE END: In the final scene brief, include a note that the narrator or character will gently name the lesson in simple words.` : ""}
${input.age >= 7 && input.age <= 9 ? `CONFIDENT READER VOCABULARY RULES:
- Sentence length is flexible, but prioritise punchy, active sentences. Mix short and medium.
- You may include vivid, precise words that stretch the reader slightly — as long as meaning is clear from context.
- INNER MONOLOGUE: Every scene brief should note one moment where we are inside ${input.childName}'s thoughts.
- MORAL: Never named. Never summarised. Lives in the protagonist's choices only.` : ""}
${input.age >= 10 ? `PRE-TEEN VOCABULARY RULES:
- Full literary vocabulary permitted. Metaphor, subtext, irony all encouraged.
- Scene briefs should be rich and complex — the expanding writer needs dense context.
- IDENTITY EXPLORATION: Every scene brief should note something about the protagonist's inner conflict or self-questioning.
- MORAL: Strictly implicit. Emerges from arc only. No character may name it.` : ""}

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
${input.favoriteCompanion ? `\nCOMPANION IN IMAGES: When the personal companion "${input.favoriteCompanion}" appears in a scene, you MUST describe it clearly in the imagePrompt with its SPECIES and APPEARANCE (e.g., "a small orange tabby cat", "a golden retriever puppy", "a brown hamster"). NEVER use just the companion's name — the image generator does not know what "${input.favoriteCompanion}" looks like. If the companion's species is unclear from the name, describe it as a small friendly pet.` : ""}

KEY VISUAL MOMENT (the most important rule for imagePrompts):
Each imagePrompt must capture THE SINGLE CLIMACTIC ACTION or PEAK EMOTIONAL MOMENT of that specific scene — not the setup, not the aftermath, but the moment ITSELF.

✗ WRONG (before the action): "Marc standing near a bridge looking nervous"
✗ WRONG (after the action): "Marc and his friend celebrating on the other side"
✓ CORRECT (the moment itself): "Marc leaping across a broken rope bridge over a rushing river, arms outstretched, teeth clenched with effort, spray rising below"

The scene brief and the imagePrompt MUST share this exact moment as their core anchor.
The imagePrompt will be given to the scene writer — they will use it to know WHICH PRECISE VISUAL MOMENT to describe in the prose.
Both the illustration and the expanded text must depict THE SAME INSTANT.

SPECIFICITY is mandatory. Name the exact object, exact action, exact emotion:
✗ VAGUE: "Marc in the forest"
✓ SPECIFIC: "Marc kneeling down to pick up a small glowing golden key half-buried in autumn leaves, his eyes wide, a warm golden shaft of light falling through oak branches above him"

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
${input.age <= 4
  ? '- "bridge": brief = 1 SIMPLE, WARM, PLAYFUL transition sentence (max 15 words). NOT atmospheric prose. Just gentle forward motion. This IS the final text. Example: "And then, just around the corner, something wonderful was waiting!" or "Hooray! They did it together!"'
  : input.age <= 6
  ? '- "bridge": brief = 1 short, warm transition sentence (max 20 words). Conversational and forward-moving. This IS the final text. It should feel like a storyteller leaning in: "But wait — something was about to change everything..."'
  : '- "bridge": brief = 1 atmospheric sentence (max 25 words) — this IS the final text, no expansion needed. Rich with mood and tension appropriate to the moment in the story.'
}

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
      "imagePrompt": "ENGLISH. START with THE KEY MOMENT: [exact verb] + [exact object/creature being interacted with] + [exact location detail]. Example: 'Marc kneeling to lift a glowing golden key from autumn leaves, warm shaft of light through oak branches.' Then: ${characterVisual} in [exact pose that matches this specific action — never generic]. Camera: [angle chosen to maximise emotional impact of THIS moment]. End with: ${ageConfig.illustrationPromptStyle}. CRITICAL: This exact moment MUST also appear in the scene brief as the core action."
    },
    {
      "sceneNumber": 3,
      "type": "bridge",
      "brief": "One atmospheric sentence in ${lang} (max 25 words). This IS the final text.",
      "title": "Short evocative title",
      "imagePrompt": "ENGLISH. Atmospheric transition: [specific mood + specific environment detail that matches this bridge's narrative moment]. ${characterVisual} small or silhouetted in the scene. Camera: [angle that conveys transition/movement]. ${ageConfig.illustrationPromptStyle}"
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
  const tone = getTemplateTone(input.templateId, input.age);

  // Build personal context — listed for reference ONLY, not as a checklist
  const personalLines: string[] = [];
  if (input.interests.length > 0) personalLines.push(`Interests: ${input.interests.join(", ")}`);
  if (input.specialTrait) personalLines.push(`Special trait: "${input.specialTrait}"`);
  if (input.favoriteCompanion) personalLines.push(`Favorite companion: "${input.favoriteCompanion}"`);
  if (input.favoriteFood) personalLines.push(`Favorite food: "${input.favoriteFood}"`);
  if (input.futureDream) personalLines.push(`Future dream: "${input.futureDream}"`);
  const personalContext = personalLines.length > 0
    ? `\nPERSONAL DETAILS (context only — do NOT force any of these into this scene unless the brief specifically references them):\n${personalLines.join("\n")}`
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
    : "MODE: Gift. Emotional depth — this story is a love letter. The child should feel recognised through the story's warmth and specificity, not through a checklist of their favourite things.";

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

═══════ ILLUSTRATION ANCHOR (CRITICAL — read before writing) ═══════
The illustration for this scene has already been generated and depicts this exact moment:
"${scene.imagePrompt}"

Your prose MUST align with this image. Rules:
- This illustrated moment must be PRESENT and RECOGNISABLE in your narrative — same action, same setting, same emotional state.
- This moment should be the VISUAL PEAK of your scene: build toward it, or expand outward from it.
- Do NOT contradict the image: do not introduce objects, locations, or character actions that conflict with what is depicted.
- When the child looks at the illustration and reads the text, they must feel they are looking at the SAME scene.
- You are not constrained to only describe the image — you can add context, emotion, and story — but the illustrated moment must anchor your prose.

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
- COHERENCE: Every object, sound, smell, and reference must have a clear physical source in the scene. If you mention water, say WHICH water. If you mention a sound, say WHERE it comes from. The parent reads this aloud — they will notice nonsensical references.
- PERSONAL DETAILS: Only include if the brief mentions them. Do NOT add personal details (food, dream, companion, interests) that the brief does not reference. The architect already distributed them across the book.
- NO FORCED METAPHORS: Never write similes that link the real world to the fantasy theme before the transition happens. Never describe mundane objects with adventure-themed comparisons unless it's clearly the child's imagination at work.
${localeConfig.grammarNotes ? `\n${localeConfig.grammarNotes}` : ""}
${localeConfig.sentenceLengthAdjustment ? `\n${localeConfig.sentenceLengthAdjustment}` : ""}

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

// ── PHASE 3: Editorial review ─────────────────────────────────────────────────

interface StoryFix {
  sceneNumber: number;
  issue: string;
  fixedText?: string;
  fixedImagePrompt?: string;
}

/**
 * Phase 3: Editorial review — reads the complete manuscript and applies targeted fixes.
 *
 * A single LLM call over all 12 scene texts checks for:
 *   1. Narrative coherence: contradictions, logic gaps, character name changes,
 *      setting inconsistencies, emotional arc breaks, missing personal details
 *   2. Illustration-text mismatch: imagePrompt depicts action absent from the text
 *   3. Age-appropriateness: vocabulary, implicit vs explicit moral
 *
 * Returns ONLY a JSON diff of problem scenes — original story preserved otherwise.
 * Designed to run IN PARALLEL with illustration uploads → zero added latency.
 * Non-fatal: if the review call fails, the original story is returned unchanged.
 */
export async function reviewAndRefineStory(
  story: GeneratedStory,
  input: StoryInput,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _ageConfig: AgeConfig,
): Promise<GeneratedStory> {
  const localeConfig = getLocaleConfig(input.locale);
  const lang = localeConfig.language;
  const template = getTemplateConfig(input.templateId);
  const moral = template?.moral || "Being kind matters";

  // Build the full manuscript for the editor — one block per scene
  const manuscript = story.scenes
    .map((scene) => {
      const type = scene.type === "bridge" ? "BRIDGE" : "SCENE";
      return [
        `[${type} ${scene.sceneNumber}: "${scene.title}"]`,
        `TEXT: ${scene.text}`,
        `IMAGE PROMPT: ${scene.imagePrompt}`,
      ].join("\n");
    })
    .join("\n\n---\n\n");

  const prompt = `You are a senior children's book editor with 20 years of experience. Read this complete manuscript and return ONLY scenes with genuine problems — most scenes should be fine.

BOOK: "${story.bookTitle}"
PROTAGONIST: ${input.childName}, ${input.age} years old, from ${input.city || "their city"}
MORAL: "${moral}"
LANGUAGE: ${lang}

═══════════════════
COMPLETE MANUSCRIPT
═══════════════════

${manuscript}

═══════════════════
YOUR TASK
═══════════════════

Read all ${story.scenes.length} scenes carefully. Flag ONLY scenes with these genuine problems:

1. COHERENCE — always fix if found:
   - A character knows something they were never told (information leak between scenes)
   - An object, place, or character is used before being introduced in the story
   - A character's name changes between scenes (e.g. "Luna" → "Lena")
   - The setting contradicts itself (story set in ${input.city || "their city"}, scene mentions geographic features that don't exist there — e.g., ocean in an inland city, mountains in a coastal plain)
   - GEOGRAPHIC ERROR: Real-world scenes (before the magical transition) describe elements that don't belong in ${input.city || "their city"} — waves, jungle, snow, desert, etc. The real city must be accurate.
   - An emotional event in one scene is completely ignored in the next (reset without cause)
   - The story's ending does not reflect the moral arc established in the middle scenes
   - A sound, smell, or object is mentioned without a clear physical source ("blue water" with no river/sea/fountain; "a melody" with no instrument or singer)
   - Multiple personal details (food, dream, companion, interests) are crammed into the same sentence or paragraph — they should be spread across separate scenes
   - A forced metaphor connects the real world to the fantasy theme before the transition (e.g., "the spoon sounded like a sea shanty" in a kitchen scene before the pirate adventure begins)

2. ILLUSTRATION MISMATCH — update imagePrompt only (do not change text):
   - The IMAGE PROMPT describes an action, object, or location completely absent from the TEXT
   - The IMAGE PROMPT shows the character doing something that directly contradicts the text

3. AGE-APPROPRIATENESS — fix only if significantly off:
   - Vocabulary far outside the expected range for age ${input.age}
   ${input.age >= 7 ? `- A character explicitly states the moral ("the lesson is..." / "I learned that...") — for age ${input.age} the moral must be implicit, shown through action only` : ""}
   ${input.age <= 4 ? "- The story does not end with the protagonist back at home (circular structure is mandatory for this age)" : ""}
${localeConfig.grammarNotes ? `\n4. GRAMMAR — fix every instance found:\n${localeConfig.grammarNotes}` : ""}
${localeConfig.sentenceLengthAdjustment ? `\n5. SENTENCE LENGTH — split any sentence exceeding 16 words into two shorter ones:\n${localeConfig.sentenceLengthAdjustment}` : ""}

DO NOT FLAG:
- Good scenes (be very conservative — the bar is genuine narrative damage)
- Minor stylistic preferences or wording choices
- Scenes that focus on a different moment than the image, as long as the image moment appears somewhere in the text

Return a JSON array. If the story is coherent, return [].
Each element is a scene that needs changing:
{
  "sceneNumber": number,
  "issue": "One sentence: the specific problem",
  "fixedText": "Complete replacement text in ${lang} — same length, same tone, same age-appropriate vocabulary. Include ONLY if the TEXT needs to change.",
  "fixedImagePrompt": "Corrected image prompt in English. Include ONLY if the IMAGE PROMPT needs to change."
}

ONLY the JSON array. No markdown. No explanation.`;

  try {
    const raw = await callLLM(prompt, REVIEW_MODEL, { json: true, timeoutMs: 90_000 });
    const fixes = parseJsonResponse<StoryFix[]>(raw, "editorial-review");

    if (!Array.isArray(fixes) || fixes.length === 0) {
      console.log("[StoryGen] Editorial review: story is coherent — no fixes needed");
      return story;
    }

    // Validate fixes: only apply for known scene numbers with actual non-empty content
    const validSceneNumbers = new Set(story.scenes.map((s) => s.sceneNumber));
    const validFixes = fixes.filter(
      (f) =>
        typeof f.sceneNumber === "number" &&
        validSceneNumbers.has(f.sceneNumber) &&
        (f.fixedText?.trim() || f.fixedImagePrompt?.trim()),
    );

    if (validFixes.length === 0) {
      console.log("[StoryGen] Editorial review: suggested fixes were invalid — keeping original story");
      return story;
    }

    console.log(
      `[StoryGen] Editorial review: applying ${validFixes.length} fix(es) to scenes [${validFixes.map((f) => f.sceneNumber).join(", ")}]`,
    );
    for (const fix of validFixes) {
      console.log(`  Scene ${fix.sceneNumber}: ${fix.issue}`);
    }

    const refinedScenes = story.scenes.map((scene) => {
      const fix = validFixes.find((f) => f.sceneNumber === scene.sceneNumber);
      if (!fix) return scene;
      return {
        ...scene,
        ...(fix.fixedText?.trim() ? { text: fix.fixedText.trim() } : {}),
        ...(fix.fixedImagePrompt?.trim() ? { imagePrompt: fix.fixedImagePrompt.trim() } : {}),
      };
    });

    return { ...story, scenes: refinedScenes };
  } catch (err) {
    // Non-fatal: editorial review is a quality enhancement, not a hard requirement.
    // If it fails for any reason, the original story is used unchanged.
    console.warn(
      "[StoryGen] Editorial review failed (non-fatal) — using original story:",
      err instanceof Error ? err.message : err,
    );
    return story;
  }
}
