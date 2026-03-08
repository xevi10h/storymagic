// Character visual description builder for AI image prompts.
//
// This is the SINGLE source of truth for how the protagonist looks.
// The exact same description is prepended to EVERY image prompt (portrait,
// cover, scenes, secondary illustrations) to maximize visual consistency.

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

// --- Lookup maps ---

const SKIN_MAP: Record<string, string> = {
  "#fce4d6": "light peachy skin",
  "#eebb99": "warm medium-light skin",
  "#c68642": "warm medium-brown skin",
  "#8d5524": "rich dark brown skin",
  "#523218": "deep dark skin",
};

const HAIR_COLOR_MAP: Record<string, string> = {
  "#2a2a2a": "jet black",
  "#5d4037": "dark brown",
  "#8d6e63": "chestnut brown",
  "#e6c07b": "golden blonde",
  "#d84315": "bright red",
};

const EYE_COLOR_MAP: Record<string, string> = {
  "#5d4037": "dark brown",
  "#8d6e63": "warm brown",
  "#558b2f": "bright green",
  "#1976d2": "clear blue",
  "#a0875b": "hazel",
  "#78909c": "soft gray",
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
};

/**
 * Builds a rich, consistent character description for ALL image prompts.
 *
 * Format: "A 6-year-old boy with warm medium-light skin, curly dark brown hair,
 * wearing a colorful t-shirt and comfortable pants, with bright round eyes
 * and a warm smile"
 *
 * This text is prepended to every Recraft prompt so the protagonist
 * looks identical across all pages of the book.
 */
export function buildCharacterReference(input: CharacterDescriptionInput): string {
  const parts: string[] = [];

  // Core identity
  const genderWord = input.gender === "boy" ? "boy" : input.gender === "girl" ? "girl" : "child";
  parts.push(`A ${input.age}-year-old ${genderWord}`);

  // Skin tone
  if (input.skinTone) {
    const skin = SKIN_MAP[input.skinTone];
    if (skin) parts.push(`with ${skin}`);
  }

  // Hair: style + color combined
  if (input.hairColor) {
    const color = HAIR_COLOR_MAP[input.hairColor] || "";
    const style = input.hairstyle ? (HAIRSTYLE_MAP[input.hairstyle] || input.hairstyle) : "short";
    parts.push(`${style} ${color} hair`);
  }

  // Consistent clothing by age (same across all scenes)
  if (input.age <= 4) {
    parts.push("wearing a colorful striped t-shirt and soft pants");
  } else if (input.age <= 7) {
    parts.push("wearing a bright hoodie and jeans");
  } else {
    parts.push("wearing a casual jacket over a simple t-shirt");
  }

  // Eye color + expression anchor
  if (input.eyeColor) {
    const eyes = EYE_COLOR_MAP[input.eyeColor] || "";
    if (eyes) {
      parts.push(`with ${eyes} eyes and a warm friendly smile`);
    } else {
      parts.push("with bright round eyes and a warm friendly smile");
    }
  } else {
    parts.push("with bright round eyes and a warm friendly smile");
  }

  return parts.filter(Boolean).join(", ");
}

/**
 * Builds a shorter version for LLM text generation prompts.
 * Used in story-generator.ts to give the LLM physical context.
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
