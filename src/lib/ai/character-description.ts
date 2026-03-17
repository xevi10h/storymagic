// Character visual description builder for AI image prompts.
//
// SINGLE source of truth for how the protagonist looks across ALL images.
//
// ═══════════════════════════════════════════════════════════════════
// LAYERED PROMPT ARCHITECTURE
// ═══════════════════════════════════════════════════════════════════
//
// Every prompt is built from 5 layers, always in this order:
//
// LAYER 1 — PHYSICAL IDENTITY (always included, immutable)
//   Skin tone, hair color+style, eye color, gender, age.
//   These are the hex-mapped constants that NEVER change.
//
// LAYER 2 — OUTFIT (priority: dream > interest > age-default)
//   Only ONE outfit per prompt. Clear priority prevents conflicts.
//
// LAYER 3 — PROPS & ENVIRONMENT (additive, max 2 items)
//   Small objects from interests or companion. Never background themes.
//
// LAYER 4 — EXPRESSION & MOOD
//   Default warm smile, optionally modified by special trait.
//
// LAYER 5 — COLOR PROTECTION (always last, acts as override)
//   Explicit "skin must be X, hair must be Y" instruction.
//
// LAYER 6 — RECRAFT CONTROLS (API-level, not in prompt text)
//   Passes actual RGB color values to Recraft's `controls.colors` parameter.
//   This is MORE reliable than text descriptions because the AI model
//   receives direct color guidance alongside the prompt.
//
// ═══════════════════════════════════════════════════════════════════

/** Recraft controls for color guidance and artistic parameters. */
export interface RecraftControls {
  colors?: { rgb: [number, number, number] }[];
  background_color?: { rgb: [number, number, number] };
  artistic_level?: number;
  no_text?: boolean;
}

export interface CharacterDescriptionInput {
  gender: "boy" | "girl" | "neutral";
  age: number;
  skinTone?: string;
  hairColor?: string;
  eyeColor?: string;
  hairstyle?: string;
  childName: string;
  interests?: string[];
}

export interface PortraitPersonalityInput {
  interests?: string[];
  specialTrait?: string;
  favoriteCompanion?: string;
  favoriteFood?: string;
  futureDream?: string;
  city?: string;
}

// ═══════════════════════════════════════════════════════════════════
// LAYER 1 — PHYSICAL IDENTITY MAPS
// ═══════════════════════════════════════════════════════════════════
// Each hex color from the UI maps to ONE unambiguous natural-language description.
// These descriptions use real-world analogues for maximum Recraft accuracy.

const SKIN_MAP: Record<string, string> = {
  "#fce4d6": "very fair pale pinkish-white skin, typical of Nordic countries like Finland or Russia",
  "#eebb99": "light warm beige skin, typical of Central European countries like Germany or France",
  "#d4a574": "warm golden olive-tan skin, typical of Mediterranean countries like Spain or Italy",
  "#c68642": "warm golden olive-tan skin, typical of Mediterranean countries like Spain or Italy", // legacy fallback
  "#8d5524": "rich dark brown skin, typical of countries like Morocco, Brazil or Peru",
  "#523218": "deep very dark brown skin, typical of West African countries like Senegal or Gambia",
};

const HAIR_COLOR_MAP: Record<string, string> = {
  "#2a2a2a": "jet black",
  "#5d4037": "dark brown",
  "#8d6e63": "chestnut brown",
  "#e6c07b": "golden blonde",
  "#d84315": "bright red",
};

const EYE_COLOR_MAP: Record<string, string> = {
  "#5d4037": "very dark brown, almost black",
  "#8d6e63": "warm chestnut brown",
  "#558b2f": "vivid bright green",
  "#1976d2": "clear bright blue",
  "#a0875b": "warm amber-hazel",
  "#78909c": "soft blue-gray",
};

const HAIRSTYLE_MAP: Record<string, string> = {
  short: "short",
  curly: "curly",
  spiky: "spiky",
  buzz: "very short buzz-cut",
  long: "long flowing",
  pigtails: "in two pigtails",
  bob: "bob-cut",
  medium: "medium-length",
  afro: "voluminous afro",
  mohawk: "bold mohawk",
  ponytail: "in a ponytail",
  braids: "in braids",
  bun: "in a bun",
};

// ═══════════════════════════════════════════════════════════════════
// LAYER 2 — OUTFIT MAPS
// ═══════════════════════════════════════════════════════════════════
// Priority: dream outfit > interest outfit > age-default outfit.
// Only ONE source provides the outfit — no conflicts.

const AGE_DEFAULT_OUTFIT: Record<string, string> = {
  toddler: "wearing a colorful striped t-shirt and soft pants",
  child: "wearing a bright hoodie and jeans",
  preteen: "wearing a casual jacket over a simple t-shirt",
};

/** Dream → specific themed outfit. No background elements — only clothing/props. */
const DREAM_OUTFIT_MAP: Record<string, string> = {
  astronaut: "wearing a cute astronaut-themed t-shirt or jumpsuit",
  doctor: "wearing a small white lab coat with a stethoscope",
  chef: "wearing a chef's hat and apron",
  teacher: "holding a book with a studious look",
  artist: "wearing a colorful beret and paint-splashed apron",
  athlete: "wearing sporty athletic gear",
  musician: "holding a musical instrument",
  scientist: "wearing safety goggles on forehead and a lab coat",
  firefighter: "wearing a small red firefighter helmet",
  pilot: "wearing aviator goggles on forehead",
  vet: "wearing a small lab coat, holding a plush animal",
  dancer: "in a ballet or dance outfit",
};

/** Interest → outfit (used only when no dream provides one). */
const INTEREST_OUTFIT_MAP: Record<string, string> = {
  sports: "wearing a sporty t-shirt and shorts",
  music: "wearing a casual outfit with headphones around neck",
  space: "wearing a space-themed t-shirt",
  animals: "wearing a nature-themed outfit",
  castles: "wearing a medieval-inspired tunic",
  dinosaurs: "wearing a dinosaur-print t-shirt",
};

// ═══════════════════════════════════════════════════════════════════
// LAYER 3 — PROPS MAP
// ═══════════════════════════════════════════════════════════════════
// Small objects that appear near the character. Max 2 in any prompt.
// NEVER background themes (no "stars", "cosmic", "galaxy").

const INTEREST_PROP_MAP: Record<string, string> = {
  sports: "with a ball nearby",
  music: "with a small musical instrument nearby",
  animals: "with a gentle caring expression",
  space: "with a small rocket toy nearby",
  castles: "with a small toy castle nearby",
  dinosaurs: "with a small toy dinosaur nearby",
};

// ═══════════════════════════════════════════════════════════════════
// LAYER 5 — GENDER COLOR DIRECTIVES (backgrounds only)
// ═══════════════════════════════════════════════════════════════════

const GENDER_COLOR_DIRECTIVES: Record<string, string> = {
  girl: "BACKGROUND and ENVIRONMENT color palette: soft warm pinks, rose, coral, peach tones. Apply ONLY to backgrounds, sky, and environment — never to the character's skin or hair.",
  boy: "BACKGROUND and ENVIRONMENT color palette: soft warm blues, sky blue, teal accents. Apply ONLY to backgrounds, sky, and environment — never to the character's skin or hair.",
};

// ═══════════════════════════════════════════════════════════════════
// BUILDER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/** Resolves Layer 1 — physical identity string (no clothing, no expression). */
function buildPhysicalIdentity(input: CharacterDescriptionInput): string {
  const parts: string[] = [];

  const genderWord = input.gender === "boy" ? "boy" : input.gender === "girl" ? "girl" : "child";
  parts.push(`A ${input.age}-year-old ${genderWord}`);

  if (input.skinTone) {
    const skin = SKIN_MAP[input.skinTone];
    if (skin) parts.push(`with ${skin}`);
  }

  if (input.hairColor) {
    const color = HAIR_COLOR_MAP[input.hairColor] || "";
    const style = input.hairstyle ? (HAIRSTYLE_MAP[input.hairstyle] || input.hairstyle) : "short";
    parts.push(`${style} ${color} hair`);
  }

  return parts.join(", ");
}

/** Resolves Layer 2 — outfit with clear priority: dream > interest > age default. */
function resolveOutfit(input: CharacterDescriptionInput, personality?: PortraitPersonalityInput): string {
  // Priority 1: Dream outfit
  if (personality?.futureDream) {
    const dreamKey = personality.futureDream.toLowerCase();
    const match = DREAM_OUTFIT_MAP[dreamKey]
      || Object.entries(DREAM_OUTFIT_MAP).find(([k]) => dreamKey.includes(k))?.[1];
    if (match) return match;
    return `dressed as if dreaming of becoming a ${personality.futureDream}`;
  }

  // Priority 2: Primary interest outfit
  if (personality?.interests?.length) {
    const firstInterest = personality.interests[0];
    if (INTEREST_OUTFIT_MAP[firstInterest]) return INTEREST_OUTFIT_MAP[firstInterest];
  }

  // Priority 3: Age-appropriate default
  if (input.age <= 4) return AGE_DEFAULT_OUTFIT.toddler;
  if (input.age <= 7) return AGE_DEFAULT_OUTFIT.child;
  return AGE_DEFAULT_OUTFIT.preteen;
}

/** Resolves Layer 3 — props (max 2). Skips interests already used for outfit. */
function resolveProps(personality?: PortraitPersonalityInput, outfitFromDream?: boolean): string[] {
  if (!personality) return [];
  const props: string[] = [];

  // Interest props — if dream provided outfit, all interests can provide props.
  // If interest provided outfit, skip that interest's prop to avoid redundancy.
  if (personality.interests?.length) {
    const outfitInterest = !outfitFromDream ? personality.interests[0] : null;
    for (const interest of personality.interests) {
      if (interest === outfitInterest) continue; // Skip — already used for outfit
      if (INTEREST_PROP_MAP[interest]) {
        props.push(INTEREST_PROP_MAP[interest]);
        if (props.length >= 2) break;
      }
    }
  }

  // Companion — add if we have room
  if (props.length < 2 && personality.favoriteCompanion) {
    props.push(`with a small ${personality.favoriteCompanion} companion nearby`);
  }

  return props.slice(0, 2);
}

/** Resolves Layer 4 — expression. */
function resolveExpression(input: CharacterDescriptionInput, personality?: PortraitPersonalityInput): string {
  if (input.eyeColor) {
    const eyes = EYE_COLOR_MAP[input.eyeColor];
    if (eyes) {
      const expression = personality?.specialTrait
        ? `with ${eyes} eyes, radiating a sense of ${personality.specialTrait}`
        : `with ${eyes} eyes and a warm friendly smile`;
      return expression;
    }
  }
  return personality?.specialTrait
    ? `with bright round eyes, radiating a sense of ${personality.specialTrait}`
    : "with bright round eyes and a warm friendly smile";
}

// ═══════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════

/**
 * Builds the FULL character reference for book illustrations.
 * Includes: physical identity + age-default outfit + expression + realism anchor.
 * Used across all book scenes for visual consistency.
 */
export function buildCharacterReference(input: CharacterDescriptionInput): string {
  const identity = buildPhysicalIdentity(input);
  const outfit = resolveOutfit(input); // No personality → always age-default
  const expression = resolveExpression(input);

  return `${identity}, ${outfit}, ${expression}, natural realistic human skin and hair colors`;
}

/**
 * Builds the portrait-specific prompt section.
 * Includes: physical identity + personality-driven outfit + props + expression.
 * NO realism anchor (that's added separately via buildColorAnchor).
 */
export function buildPortraitCharacterReference(
  input: CharacterDescriptionInput,
  personality?: PortraitPersonalityInput,
): string {
  const identity = buildPhysicalIdentity(input);
  const hasDreamOutfit = !!personality?.futureDream;
  const outfit = resolveOutfit(input, personality);
  const props = resolveProps(personality, hasDreamOutfit);
  const expression = resolveExpression(input, personality);

  const parts = [identity, outfit, ...props, expression];
  return parts.filter(Boolean).join(", ");
}

/**
 * Builds explicit color-anchoring instruction for Recraft.
 * Placed LAST in prompts — acts as final override to protect skin/hair colors.
 */
export function buildColorAnchor(input: CharacterDescriptionInput): string {
  const anchors: string[] = [];

  if (input.skinTone) {
    const skin = SKIN_MAP[input.skinTone];
    if (skin) anchors.push(`skin must be ${skin}`);
  }

  if (input.hairColor) {
    const color = HAIR_COLOR_MAP[input.hairColor];
    if (color) anchors.push(`hair must be ${color}`);
  }

  if (input.eyeColor) {
    const eyes = EYE_COLOR_MAP[input.eyeColor];
    if (eyes) anchors.push(`eyes must be ${eyes}`);
  }

  if (anchors.length === 0) return "";

  return `IMPORTANT: Character's ${anchors.join(", ")}. Natural human colors only — no purple, blue, green or gray tints on skin or hair.`;
}

/**
 * Returns gender-based background color directive.
 * Applied ONLY to backgrounds — explicitly states "never to skin or hair".
 */
export function getGenderColorDirective(gender?: string): string {
  if (!gender) return "";
  return GENDER_COLOR_DIRECTIVES[gender] ?? "";
}

/**
 * Short version for LLM text generation (story-generator.ts).
 * Gives the LLM physical context without being a full image prompt.
 */
export function buildCharacterVisualDescription(input: CharacterDescriptionInput): string {
  const parts: string[] = [];

  const genderWord = input.gender === "boy" ? "boy" : input.gender === "girl" ? "girl" : "child";
  parts.push(`${genderWord}, ${input.age} years old`);

  if (input.skinTone) {
    const skin = SKIN_MAP[input.skinTone];
    if (skin) parts.push(skin);
  }

  if (input.hairColor) {
    const color = HAIR_COLOR_MAP[input.hairColor] || "";
    const style = input.hairstyle ? (HAIRSTYLE_MAP[input.hairstyle] || input.hairstyle) : "short";
    parts.push(`${style} ${color} hair`);
  }

  if (input.eyeColor) {
    const eyes = EYE_COLOR_MAP[input.eyeColor];
    if (eyes) parts.push(`${eyes} eyes`);
  }

  return parts.filter(Boolean).join(", ");
}

// ═══════════════════════════════════════════════════════════════════
// LAYER 6 — RECRAFT CONTROLS BUILDER
// ═══════════════════════════════════════════════════════════════════
// Converts character hex colors to Recraft's `controls` API parameter.
// These RGB values are passed directly to the model — much more reliable
// than text descriptions for ensuring correct skin/hair/eye colors.

/** Converts a hex color string (e.g. "#c68642") to an RGB tuple. */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

/** Gender-based background colors (soft, not overpowering). */
const GENDER_BG_COLORS: Record<string, [number, number, number]> = {
  boy: [220, 235, 250],    // Soft warm blue
  girl: [250, 228, 225],   // Soft warm pink
};

/**
 * Builds Recraft API `controls` from character data.
 *
 * - `colors`: skin + hair + eye as RGB values → guides the model's palette
 * - `background_color`: gender-based soft background
 * - `artistic_level`: age-based (4 for toddlers = whimsical, 2 for older = refined)
 * - `no_text`: always true
 */
export function buildRecraftControls(
  input: CharacterDescriptionInput,
  options?: { isPortrait?: boolean },
): RecraftControls {
  const controls: RecraftControls = {
    no_text: true,
  };

  // Color palette: skin tone is the DOMINANT color (listed first = highest weight),
  // then hair, then eyes. This guides Recraft to respect these specific colors.
  const colors: { rgb: [number, number, number] }[] = [];
  if (input.skinTone) colors.push({ rgb: hexToRgb(input.skinTone) });
  if (input.hairColor) colors.push({ rgb: hexToRgb(input.hairColor) });
  if (input.eyeColor) colors.push({ rgb: hexToRgb(input.eyeColor) });
  if (colors.length > 0) controls.colors = colors;

  // Background color: gender-based soft tint
  const bgColor = GENDER_BG_COLORS[input.gender];
  if (bgColor) controls.background_color = { rgb: bgColor };

  // Artistic level: consistent per age band
  // Lower = more restrained/predictable, higher = more creative
  if (options?.isPortrait) {
    // Portraits: moderate artistic level for clean, consistent character shots
    controls.artistic_level = input.age <= 4 ? 4 : input.age <= 6 ? 3 : input.age <= 9 ? 3 : 2;
  } else {
    // Book illustrations: slightly more creative for scene richness
    controls.artistic_level = input.age <= 4 ? 5 : input.age <= 6 ? 4 : input.age <= 9 ? 4 : 3;
  }

  return controls;
}
