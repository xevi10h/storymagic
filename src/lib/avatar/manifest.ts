// Watercolor avatar matrix — the single source of truth for the "Créalo tú"
// builder's traits and the URLs of their pre-rendered assets.
//
// Layering (all images 512×512, pixel-aligned):
//   1. base     /images/avatar/{gender}/{skin}/{hairColor}-{hairstyle}.webp
//               full portrait (skin + hair), rendered by scripts/avatar/generate-matrix.mjs
//   2. freckles /images/avatar/{gender}/overlays/freckles.webp  (mix-blend-mode: multiply)
//   3. glasses  /images/avatar/{gender}/overlays/glasses-{shape}-{colour}.webp  (alpha)
//
// Every base keeps the canonical face of its gender at the SAME pixels (the
// generator registers each render to its parent and composites the inner face
// back), which is why a single overlay per gender fits every skin and hairstyle.
//
// scripts/avatar/generate-matrix.mjs imports the lists below, so the UI and the
// renderer can never disagree. It writes avatar-manifest.json (what exists).

import type { Gender } from "@/lib/create-store";
import rendered from "./avatar-manifest.json";

export type AvatarGender = Gender;

/** Same ids and hexes as SKIN_TONES in create-store.ts (the Character Bible keys on the hex). */
export const AVATAR_SKIN_TONES = [
  { id: "light", hex: "#fce4d6" },
  { id: "medium-light", hex: "#eebb99" },
  { id: "medium", hex: "#d4a574" },
  { id: "dark", hex: "#8d5524" },
  { id: "very-dark", hex: "#523218" },
] as const;

/** Same ids and hexes as HAIR_COLORS in create-store.ts. */
export const AVATAR_HAIR_COLORS = [
  { id: "black", hex: "#2a2a2a" },
  { id: "brown-dark", hex: "#5d4037" },
  { id: "brown", hex: "#8d6e63" },
  { id: "blonde", hex: "#e6c07b" },
  { id: "red", hex: "#d84315" },
] as const;

/**
 * Rendered hairstyles per gender (subset of HAIRSTYLES in create-store.ts:
 * boy drops "mohawk", girl drops "bun" — lowest demand, highest render risk).
 */
export const AVATAR_HAIRSTYLES = {
  boy: ["short", "curly", "spiky", "buzz", "medium", "afro"],
  girl: ["long", "curly", "pigtails", "ponytail", "braids", "bob", "afro"],
  neutral: ["medium", "curly", "short", "afro", "bob", "buzz"],
} as const satisfies Record<AvatarGender, readonly string[]>;

export const AVATAR_GLASSES_SHAPES = ["round", "square"] as const;
export const AVATAR_GLASSES_COLOURS = [
  { id: "dark", rgb: [44, 38, 38] },
  { id: "red", rgb: [178, 58, 44] },
] as const;

export type AvatarSkinTone = (typeof AVATAR_SKIN_TONES)[number]["id"];
export type AvatarHairColor = (typeof AVATAR_HAIR_COLORS)[number]["id"];
export type AvatarHairstyle = (typeof AVATAR_HAIRSTYLES)[AvatarGender][number];
export type AvatarGlassesShape = (typeof AVATAR_GLASSES_SHAPES)[number];
export type AvatarGlassesColour = (typeof AVATAR_GLASSES_COLOURS)[number]["id"];
/** "none" or "{shape}-{colour}", e.g. "round-dark" */
export type AvatarGlasses = "none" | `${AvatarGlassesShape}-${AvatarGlassesColour}`;

export interface AvatarTraits {
  gender: AvatarGender;
  skinTone: AvatarSkinTone;
  hairColor: AvatarHairColor;
  hairstyle: AvatarHairstyle;
  glasses: AvatarGlasses;
  freckles: boolean;
}

export const AVATAR_GLASSES_OPTIONS: AvatarGlasses[] = [
  "none",
  ...AVATAR_GLASSES_SHAPES.flatMap((s) => AVATAR_GLASSES_COLOURS.map((c) => `${s}-${c.id}` as const)),
];

const ROOT = "/images/avatar";

/** Cache-buster: bumped by the generator whenever assets are re-rendered. */
export const AVATAR_ASSET_VERSION: string = rendered.version;

const withVersion = (path: string) => `${path}?v=${AVATAR_ASSET_VERSION}`;

export function avatarBaseKey(t: Pick<AvatarTraits, "gender" | "skinTone" | "hairColor" | "hairstyle">): string {
  return `${t.gender}/${t.skinTone}/${t.hairColor}-${t.hairstyle}`;
}

export function avatarBaseSrc(t: Pick<AvatarTraits, "gender" | "skinTone" | "hairColor" | "hairstyle">): string {
  return withVersion(`${ROOT}/${avatarBaseKey(t)}.webp`);
}

export function avatarFrecklesSrc(gender: AvatarGender): string {
  return withVersion(`${ROOT}/${gender}/overlays/freckles.webp`);
}

export function avatarGlassesSrc(gender: AvatarGender, glasses: Exclude<AvatarGlasses, "none">): string {
  return withVersion(`${ROOT}/${gender}/overlays/glasses-${glasses}.webp`);
}

/** Every layer URL for a trait set, bottom to top. */
export function avatarLayers(t: AvatarTraits): { src: string; blend: "normal" | "multiply"; key: string }[] {
  const layers: { src: string; blend: "normal" | "multiply"; key: string }[] = [
    { src: avatarBaseSrc(t), blend: "normal", key: "base" },
  ];
  if (t.freckles) layers.push({ src: avatarFrecklesSrc(t.gender), blend: "multiply", key: "freckles" });
  if (t.glasses !== "none") layers.push({ src: avatarGlassesSrc(t.gender, t.glasses), blend: "normal", key: "glasses" });
  return layers;
}

const renderedKeys = new Set<string>(rendered.bases);

/** True when the base for these traits has been rendered (the matrix can be partial during rollout). */
export function isAvatarRendered(t: Pick<AvatarTraits, "gender" | "skinTone" | "hairColor" | "hairstyle">): boolean {
  return renderedKeys.has(avatarBaseKey(t));
}

/** Hairstyle valid for the gender, falling back to the gender's first style. */
export function normaliseHairstyle(gender: AvatarGender, hairstyle: string): AvatarHairstyle {
  const list: readonly string[] = AVATAR_HAIRSTYLES[gender];
  return (list.includes(hairstyle) ? hairstyle : list[0]) as AvatarHairstyle;
}

/** CharacterData (UI hex values) → AvatarTraits. Unknown values fall back to the defaults. */
export function avatarTraitsFromCharacter(c: {
  gender: AvatarGender;
  skinTone: string;
  hairColor: string;
  hairstyle: string;
  glasses?: AvatarGlasses;
  freckles?: boolean;
}): AvatarTraits {
  const skin = AVATAR_SKIN_TONES.find((s) => s.hex === c.skinTone.toLowerCase())?.id ?? "medium";
  const hair = AVATAR_HAIR_COLORS.find((h) => h.hex === c.hairColor.toLowerCase())?.id ?? "brown-dark";
  return {
    gender: c.gender,
    skinTone: skin,
    hairColor: hair,
    hairstyle: normaliseHairstyle(c.gender, c.hairstyle),
    glasses: c.glasses ?? "none",
    freckles: c.freckles ?? false,
  };
}

/**
 * Traits one click away from `t` (every other skin, hair colour, hairstyle) —
 * the bases the builder preloads so the next swap is instant.
 */
export function avatarNeighbours(t: AvatarTraits): AvatarTraits[] {
  const out: AvatarTraits[] = [];
  for (const s of AVATAR_SKIN_TONES) if (s.id !== t.skinTone) out.push({ ...t, skinTone: s.id });
  for (const h of AVATAR_HAIR_COLORS) if (h.id !== t.hairColor) out.push({ ...t, hairColor: h.id });
  for (const st of AVATAR_HAIRSTYLES[t.gender]) if (st !== t.hairstyle) out.push({ ...t, hairstyle: st });
  return out;
}
