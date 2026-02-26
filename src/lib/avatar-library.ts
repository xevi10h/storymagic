/**
 * Avatar image library for character creation.
 *
 * Uses DiceBear "big-smile" style — warm, playful, kid-friendly avatars
 * with expressive faces and fun accessories.
 *
 * CURRENT LIMITATIONS (DiceBear free tier):
 * - Big-smile has only 1 face shape. The seed changes minor positioning
 *   but cannot produce fundamentally different faces per age.
 * - Only 1 accessory renders at a time (seed picks from pool).
 *
 * PLANNED: Replace with Flux Schnell-generated watercolor illustrations
 * that produce truly different faces per age. Static overrides (below)
 * take priority when available — this is the migration path.
 */

import type { CharacterData, Gender } from "./create-store";

// ---- Static image overrides ----
// When Flux-generated illustrations are available, add them here.
// They take priority over DiceBear when a match is found.

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

// ---- DiceBear "big-smile" hair mapping ----

const DICEBEAR_HAIR: Record<string, Record<string, string>> = {
  boy: {
    short: "shortHair",
    curly: "curlyShortHair",
    spiky: "mohawk",
    buzz: "shavedHead",
  },
  girl: {
    long: "straightHair",
    curly: "curlyBob",
    pigtails: "braids",
    bob: "wavyBob",
  },
  neutral: {
    medium: "froBun",
    curly: "curlyBob",
    short: "bowlCutHair",
  },
};

// ---- Interest system ----
// Interests change background color and add an accessory from the pool.
// DiceBear picks ONE accessory based on the seed — different name/age
// combos will surface different accessories from the pool.

const INTEREST_ACCENT_COLORS: Record<string, string> = {
  space: "e8eaf6",
  animals: "e8f5e9",
  sports: "e3f2fd",
  castles: "f3e5f5",
  dinosaurs: "f1f8e9",
  music: "fff8e1",
};

const INTEREST_ACCESSORY_MAP: Record<string, string> = {
  animals: "catEars",
  castles: "sailormoonCrown",
  space: "glasses",
  music: "sunglasses",
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

export const DEFAULT_RING = {
  from: "from-create-primary",
  via: "via-amber-400",
  to: "to-create-primary",
};

function getBackgroundColor(interests: string[]): string {
  if (interests.length === 0) return "fff3e8";
  return INTEREST_ACCENT_COLORS[interests[0]] || "fff3e8";
}

function getInterestAccessories(interests: string[]): string[] {
  return interests
    .map((id) => INTEREST_ACCESSORY_MAP[id])
    .filter(Boolean);
}

// ---- URL builder ----

function buildDiceBearUrl(character: CharacterData): string {
  const { skinTone, hairColor, gender, hairstyle, name, age, interests } =
    character;

  const hairMap = DICEBEAR_HAIR[gender] || DICEBEAR_HAIR.boy;
  const hair = hairMap[hairstyle] || Object.values(hairMap)[0];

  // Age in seed for whatever face variation big-smile can produce
  const seed = `storymagic-${name || "hero"}-${gender}-${age}`;

  const bgColor = getBackgroundColor(interests);
  const accessoryPool = getInterestAccessories(interests);

  const paramObj: Record<string, string> = {
    seed,
    skinColor: cleanHex(skinTone),
    hairColor: cleanHex(hairColor),
    hair,
    eyes: "cheery",
    mouth: "openedSmile",
    accessoriesProbability: "0",
    size: "512",
    backgroundColor: bgColor,
    radius: "50",
  };

  if (accessoryPool.length > 0) {
    paramObj.accessories = accessoryPool.join(",");
    paramObj.accessoriesProbability = "100";
  }

  const params = new URLSearchParams(paramObj);
  return `https://api.dicebear.com/9.x/big-smile/svg?${params.toString()}`;
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
