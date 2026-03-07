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

// ---- Mouth driven by AGE ----
// Most visible facial parameter — produces clear, dramatic changes per age range.

function getMouthForAge(age: number): string {
  if (age <= 3) return "kawaii";       // tiny cute closed smile
  if (age <= 6) return "openedSmile";  // big happy laugh
  if (age <= 9) return "gapSmile";     // missing tooth — charming for this age
  return "braces";                     // preteen
}

// ---- Interest system ----
// Interests affect: background (all blended), accessory (last selected), ring, floating icons.
//
// DiceBear limitation: only 1 accessory renders at a time.
// Strategy: show the accessory of the LAST selected interest so each toggle = visible swap.
// Background blends ALL selected interest colors for cumulative color shift.

const INTEREST_ACCENT_COLORS: Record<string, string> = {
  space: "e8eaf6",
  animals: "e8f5e9",
  sports: "e3f2fd",
  castles: "f3e5f5",
  dinosaurs: "f1f8e9",
  music: "fff8e1",
};

// Only kid-appropriate accessories (tested against DiceBear big-smile):
// - sleepMask: BROKEN (renders nothing)
// - faceMask: medical mask, hides mouth
// - mustache: adult-looking
const INTEREST_ACCESSORY_MAP: Record<string, string> = {
  animals: "catEars",
  castles: "sailormoonCrown",
  space: "glasses",
  music: "sunglasses",
  dinosaurs: "clownNose",
  // sports: no good accessory available — relies on background + floating icon
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

function blendHexColors(hexColors: string[]): string {
  if (hexColors.length === 0) return "fff3e8";
  if (hexColors.length === 1) return hexColors[0];

  let r = 0, g = 0, b = 0;
  for (const hex of hexColors) {
    r += parseInt(hex.slice(0, 2), 16);
    g += parseInt(hex.slice(2, 4), 16);
    b += parseInt(hex.slice(4, 6), 16);
  }
  const n = hexColors.length;
  const toHex = (v: number) => Math.round(v / n).toString(16).padStart(2, "0");
  return toHex(r) + toHex(g) + toHex(b);
}

function getBackgroundColor(interests: string[]): string {
  const colors = interests
    .map((id) => INTEREST_ACCENT_COLORS[id])
    .filter(Boolean);
  return blendHexColors(colors);
}

// Get the accessory for the LAST selected interest (most recent toggle).
function getLastInterestAccessory(interests: string[]): string | null {
  for (let i = interests.length - 1; i >= 0; i--) {
    const acc = INTEREST_ACCESSORY_MAP[interests[i]];
    if (acc) return acc;
  }
  return null;
}

// ---- URL builder ----

function buildDiceBearUrl(character: CharacterData): string {
  const { skinTone, hairColor, gender, hairstyle, name, age, interests } =
    character;

  const hairMap = DICEBEAR_HAIR[gender] || DICEBEAR_HAIR.boy;
  const hair = hairMap[hairstyle] || Object.values(hairMap)[0];

  // Seed includes everything so any change produces a subtly different face
  const interestKey = interests.length > 0 ? interests.join("-") : "none";
  const seed = `meapica-${name || "hero"}-${gender}-${age}-${hairstyle}-${interestKey}`;

  const bgColor = getBackgroundColor(interests);
  const accessory = getLastInterestAccessory(interests);

  const paramObj: Record<string, string> = {
    seed,
    skinColor: cleanHex(skinTone),
    hairColor: cleanHex(hairColor),
    hair,
    eyes: "cheery",
    mouth: getMouthForAge(age),
    accessoriesProbability: "0",
    size: "512",
    backgroundColor: bgColor,
    radius: "50",
  };

  if (accessory) {
    paramObj.accessories = accessory;
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
