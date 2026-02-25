/**
 * Avatar image library for character creation.
 *
 * Uses DiceBear "adventurer" style as the dynamic engine.
 * Every visual trait (skin, hair color, hairstyle, age, interests)
 * is mapped to explicit DiceBear parameters so the avatar visibly
 * responds to each selection.
 *
 * Static watercolor images can be added to AVATAR_OVERRIDES — they
 * take priority when a match is found, letting us progressively replace
 * DiceBear with Flux-generated illustrations.
 */

import type { CharacterData, Gender } from "./create-store";

// ---- Static image overrides ----

interface AvatarOverride {
  gender: Gender;
  skinToneGroup?: "light" | "medium" | "dark";
  hairstyle?: string;
  url: string;
}

const AVATAR_OVERRIDES: AvatarOverride[] = [];

// ---- Helpers ----

function getSkinToneGroup(hex: string): "light" | "medium" | "dark" {
  const lightTones = ["#fce4d6", "#eebb99"];
  const darkTones = ["#8d5524", "#523218"];
  if (lightTones.includes(hex.toLowerCase())) return "light";
  if (darkTones.includes(hex.toLowerCase())) return "dark";
  return "medium";
}

function cleanHex(hex: string): string {
  return hex.replace("#", "");
}

// ---- DiceBear hair mapping ----

const DICEBEAR_HAIR: Record<string, Record<string, string>> = {
  boy: {
    short: "short01",
    curly: "short14",
    spiky: "short05",
    buzz: "short19",
  },
  girl: {
    long: "long01",
    curly: "long15",
    pigtails: "long09",
    bob: "long02",
  },
  neutral: {
    medium: "short16",
    curly: "long15",
    short: "short01",
  },
};

// ---- Age system ----
// 4 distinct age groups. Each group changes the SEED (different base face)
// AND the facial features (eyes, mouth, eyebrows, blush).

type AgeGroup = "baby" | "small" | "kid" | "preteen";

function getAgeGroup(age: number): AgeGroup {
  if (age <= 3) return "baby";
  if (age <= 6) return "small";
  if (age <= 9) return "kid";
  return "preteen";
}

// Each age year maps to a unique set of features for visible changes
// on every slider tick. Variant numbers are spread out for maximum
// visual difference between adjacent ages.
function getAgeFeatures(age: number) {
  const featuresByAge: Record<
    number,
    { eyes: string; eyebrows: string; mouth: string }
  > = {
    1: { eyes: "variant01", eyebrows: "variant01", mouth: "variant01" },
    2: { eyes: "variant02", eyebrows: "variant01", mouth: "variant03" },
    3: { eyes: "variant01", eyebrows: "variant02", mouth: "variant05" },
    4: { eyes: "variant04", eyebrows: "variant03", mouth: "variant02" },
    5: { eyes: "variant05", eyebrows: "variant04", mouth: "variant07" },
    6: { eyes: "variant06", eyebrows: "variant05", mouth: "variant04" },
    7: { eyes: "variant08", eyebrows: "variant07", mouth: "variant10" },
    8: { eyes: "variant10", eyebrows: "variant08", mouth: "variant12" },
    9: { eyes: "variant12", eyebrows: "variant09", mouth: "variant08" },
    10: { eyes: "variant14", eyebrows: "variant10", mouth: "variant15" },
    11: { eyes: "variant16", eyebrows: "variant12", mouth: "variant18" },
    12: { eyes: "variant18", eyebrows: "variant13", mouth: "variant20" },
  };

  const clamped = Math.max(1, Math.min(12, age));
  return featuresByAge[clamped];
}

function getBlushProbability(age: number): string {
  if (age <= 3) return "100";
  if (age <= 6) return "80";
  if (age <= 9) return "40";
  return "10";
}

// ---- Interest system ----
// Interests affect the avatar background color and can add features.

const INTEREST_ACCENT_COLORS: Record<string, string> = {
  space: "e8eaf6", // soft indigo
  animals: "e8f5e9", // soft green
  sports: "e3f2fd", // soft blue
  castles: "f3e5f5", // soft purple
  dinosaurs: "f1f8e9", // light lime
  music: "fff8e1", // soft amber
};

// For UI: gradient ring colors based on primary interest
export const INTEREST_RING_COLORS: Record<
  string,
  { from: string; via: string; to: string }
> = {
  space: {
    from: "from-indigo-400",
    via: "via-purple-400",
    to: "to-indigo-500",
  },
  animals: {
    from: "from-emerald-400",
    via: "via-green-300",
    to: "to-teal-400",
  },
  sports: { from: "from-blue-400", via: "via-sky-300", to: "to-cyan-400" },
  castles: {
    from: "from-purple-400",
    via: "via-fuchsia-300",
    to: "to-purple-500",
  },
  dinosaurs: {
    from: "from-lime-400",
    via: "via-emerald-300",
    to: "to-green-500",
  },
  music: {
    from: "from-amber-400",
    via: "via-orange-300",
    to: "to-yellow-400",
  },
};

// Default ring when no interests are selected
export const DEFAULT_RING = {
  from: "from-create-primary",
  via: "via-amber-400",
  to: "to-create-primary",
};

function getBackgroundColor(interests: string[]): string {
  if (interests.length === 0) return "fff3e8";
  // Blend toward the first interest's theme
  return INTEREST_ACCENT_COLORS[interests[0]] || "fff3e8";
}

// Some interests can subtly affect DiceBear features
function getInterestFeatures(interests: string[]): Record<string, string> {
  const features: Record<string, string> = {};

  if (interests.includes("sports")) {
    // Freckles = active/outdoorsy kid
    features.features = "freckles,blush";
  }
  if (interests.includes("space") || interests.includes("castles")) {
    // Glasses = studious/imaginative
    features.glassesProbability = "80";
    features.glasses = "variant01";
  }

  return features;
}

// ---- URL builder ----

function buildDiceBearUrl(character: CharacterData): string {
  const { skinTone, hairColor, gender, hairstyle, name, age, interests } =
    character;

  const hairMap = DICEBEAR_HAIR[gender] || DICEBEAR_HAIR.boy;
  const hair = hairMap[hairstyle] || Object.values(hairMap)[0];

  // Seed includes age group so the base face changes visibly across age brackets
  const ageGroup = getAgeGroup(age);
  const seed = `storymagic-${name || "hero"}-${gender}-${ageGroup}`;

  const ageFeatures = getAgeFeatures(age);
  const bgColor = getBackgroundColor(interests);
  const interestFeatures = getInterestFeatures(interests);

  // Base params
  const paramObj: Record<string, string> = {
    seed,
    skinColor: cleanHex(skinTone),
    hairColor: cleanHex(hairColor),
    hair,
    eyes: ageFeatures.eyes,
    eyebrows: ageFeatures.eyebrows,
    mouth: ageFeatures.mouth,
    features: "blush",
    featuresProbability: getBlushProbability(age),
    glassesProbability: "0",
    earringsProbability: "0",
    size: "512",
    backgroundColor: bgColor,
    radius: "50",
  };

  // Interest-based overrides
  Object.assign(paramObj, interestFeatures);

  const params = new URLSearchParams(paramObj);
  return `https://api.dicebear.com/9.x/adventurer/svg?${params.toString()}`;
}

// ---- Public API ----

export function getAvatarUrl(character: CharacterData): string {
  const group = getSkinToneGroup(character.skinTone);

  let bestScore = 0;
  let bestUrl = "";

  for (const entry of AVATAR_OVERRIDES) {
    if (entry.gender !== character.gender) continue;
    let score = 1;
    if (entry.skinToneGroup && entry.skinToneGroup === group) score++;
    if (entry.hairstyle && entry.hairstyle === character.hairstyle) score++;
    if (score > bestScore) {
      bestScore = score;
      bestUrl = entry.url;
    }
  }

  if (bestUrl) return bestUrl;

  return buildDiceBearUrl(character);
}
