// Character Bible — the SINGLE source of truth for how the child looks.
//
// The parent's choices (gender, age, skin, hair colour + style, eyes, favourite
// colour, optional glasses/freckles) map to ONE canonical English description.
// That exact string (byte-identical) is used for the avatar portrait, the
// character sheet, every scene and the cover, and it is frozen into the story's
// image plan at preview time, so the final book renders the same child the
// parent approved.
//
// Rules (audit 2026-09-27, identity drift):
//   - gender comes from the `gender` field only — never inferred from the name;
//   - the child's name is never a visual cue (it is not part of the description);
//   - ONE outfit for avatar, sheet and scenes (no dream/interest costume in some
//     images and an age default in others);
//   - no "typical of <country>" ethnicity strings, no pink/blue-by-gender palettes.

export interface CharacterDescriptionInput {
  gender: "boy" | "girl" | "neutral";
  age: number;
  skinTone?: string;
  hairColor?: string;
  eyeColor?: string;
  hairstyle?: string;
  /** Favourite colour (hex from the UI) — colours the outfit's jacket */
  favoriteColor?: string;
  glasses?: boolean;
  freckles?: boolean;
  /** Not used visually. Accepted so story inputs can be passed straight in. */
  childName?: string;
}

export interface CharacterBible {
  version: 1;
  gender: "boy" | "girl" | "neutral";
  age: number;
  /** "girl" | "boy" | "child" */
  genderWord: string;
  /** Body, face and hair only */
  identity: string;
  /** The one canonical outfit */
  outfit: string;
  /** identity + outfit — THE string used verbatim in every image prompt */
  description: string;
  // No photo field on purpose: the Bible is persisted in stories.generated_text,
  // and the child's photo must never outlive the avatar (deleted ≤ 24 h). The
  // photo only feeds the portrait / early child sheet (src/lib/privacy/child-photo.ts).
}

// ── Maps (UI hex → words) ───────────────────────────────────────────────────

const SKIN_MAP: Record<string, string> = {
  "#fce4d6": "very fair, pale pinkish skin",
  "#eebb99": "light warm beige skin",
  "#d4a574": "warm golden olive-tan skin",
  "#c68642": "warm golden olive-tan skin", // legacy value
  "#8d5524": "rich medium-dark brown skin",
  "#523218": "deep dark brown skin",
};

const HAIR_COLOR_MAP: Record<string, string> = {
  "#2a2a2a": "jet-black",
  "#5d4037": "dark-brown",
  "#8d6e63": "chestnut-brown",
  "#e6c07b": "golden-blonde",
  "#d84315": "bright copper-red",
};

const EYE_COLOR_MAP: Record<string, string> = {
  "#5d4037": "very dark brown, almost black eyes",
  "#8d6e63": "warm chestnut-brown eyes",
  "#558b2f": "bright green eyes",
  "#1976d2": "clear blue eyes",
  "#a0875b": "warm amber-hazel eyes",
  "#78909c": "soft blue-grey eyes",
};

/** Favourite colour → the jacket colour (gender-neutral, the child's own choice). */
const OUTFIT_COLOR_MAP: Record<string, string> = {
  "#e53935": "tomato-red",
  "#1e88e5": "cornflower-blue",
  "#43a047": "leaf-green",
  "#8e24aa": "plum-purple",
  "#fb8c00": "tangerine-orange",
  "#fdd835": "mustard-yellow",
  "#ec407a": "raspberry-pink",
  "#00acc1": "teal",
};
const DEFAULT_OUTFIT_COLOR = "mustard-yellow";

function hairDescription(style: string | undefined, color: string, gender: CharacterDescriptionInput["gender"]): string {
  switch (style) {
    case "curly":
      return gender === "boy"
        ? `short springy ${color} curls`
        : gender === "girl"
          ? `shoulder-length springy ${color} curls`
          : `chin-length springy ${color} curls`;
    case "spiky":
      return `short spiky ${color} hair`;
    case "buzz":
      return `very short buzz-cut ${color} hair`;
    case "medium":
      return `medium-length straight ${color} hair covering the ears`;
    case "afro":
      return `a rounded, voluminous ${color} afro`;
    case "mohawk":
      return `a short ${color} mohawk with the sides cut very short`;
    case "long":
      return `long straight ${color} hair falling past the shoulders`;
    case "pigtails":
      return `${color} hair in two pigtails tied with small bands`;
    case "ponytail":
      return `${color} hair pulled back in a high ponytail`;
    case "braids":
      return `${color} hair in two long braids`;
    case "bob":
      return `a chin-length ${color} bob with a straight fringe`;
    case "bun":
      return `${color} hair gathered in a round top bun`;
    case "short":
    default:
      return `short, neatly cut ${color} hair`;
  }
}

function outfitFor(age: number, favoriteColor: string | undefined): string {
  const color = (favoriteColor && OUTFIT_COLOR_MAP[favoriteColor.toLowerCase()]) || DEFAULT_OUTFIT_COLOR;
  const bottoms = age <= 4 ? "soft navy dungarees" : age <= 7 ? "navy trousers" : "dark-blue jeans";
  return `a plain ${color} hooded jacket worn open over a white-and-navy striped t-shirt, ${bottoms} and white canvas sneakers`;
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Builds the immutable Character Bible. Deterministic: same input → same bytes. */
export function buildCharacterBible(input: CharacterDescriptionInput): CharacterBible {
  const genderWord = input.gender === "boy" ? "boy" : input.gender === "girl" ? "girl" : "child";
  const possessive = input.gender === "boy" ? "his" : input.gender === "girl" ? "her" : "their";
  const age = Math.max(1, Math.min(12, Math.round(input.age)));

  const traits: string[] = [];
  const skin = input.skinTone ? SKIN_MAP[input.skinTone.toLowerCase()] : undefined;
  traits.push(skin ?? "warm light skin");
  const hairColor = (input.hairColor && HAIR_COLOR_MAP[input.hairColor.toLowerCase()]) || "dark-brown";
  traits.push(hairDescription(input.hairstyle, hairColor, input.gender));
  traits.push((input.eyeColor && EYE_COLOR_MAP[input.eyeColor.toLowerCase()]) || "warm brown eyes");
  if (input.glasses) traits.push("round glasses with thin dark frames");
  traits.push("round rosy cheeks");
  if (input.freckles) traits.push(`a sprinkle of freckles across ${possessive} nose`);

  const last = traits.pop() as string;
  const identity = `a ${age}-year-old ${genderWord} with ${traits.join(", ")} and ${last}`;
  const outfit = outfitFor(age, input.favoriteColor);
  return {
    version: 1,
    gender: input.gender,
    age,
    genderWord,
    identity,
    outfit,
    description: `${identity}; wearing ${outfit}`,
  };
}

/**
 * The canonical description, for the story LLM (architect imagePrompts).
 * Same bytes as the image prompts — one descriptor everywhere.
 */
export function buildCharacterVisualDescription(input: CharacterDescriptionInput): string {
  return buildCharacterBible(input).description;
}

/**
 * @deprecated Gendered pink/blue palettes were removed from image prompts
 * (audit 2026-09-27). Kept only because story-generator.ts still calls it;
 * returns "" so no palette directive is added.
 */
export function getGenderColorDirective(gender?: string): string {
  void gender;
  return "";
}
