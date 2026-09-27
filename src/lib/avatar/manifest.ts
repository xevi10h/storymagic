// Watercolor avatar matrix — the single source of truth for the "Créalo tú"
// builder's traits and the URLs of their pre-rendered assets.
//
// Layering (all images 512×512 webp, pixel-aligned), bottom to top:
//   1. base     /images/avatar/{gender}/{band}/{skin}/{hairColor}-{hairstyle}.webp
//   2. eyes     /images/avatar/{gender}/{band}/overlays/eyes-{eyeColor}.webp   (alpha; none for "brown")
//   3. freckles /images/avatar/{gender}/{band}/overlays/freckles.webp          (mix-blend-mode: multiply)
//   4. glasses  /images/avatar/{gender}/{band}/overlays/glasses-{shape}-{colour}.webp (alpha)
//
// Every base of a gender × age band keeps the canonical face at the SAME pixels
// (the generator registers each render to its parent, composites the inner face
// back and gives every skin master the canonical irises), which is why one
// overlay per gender × band fits every skin, hair colour and hairstyle.
//
// scripts/avatar/generate-matrix.mjs imports the lists below, so the UI and the
// renderer can never disagree. It writes avatar-manifest.json (what exists).

import type { Gender } from "@/lib/create-store";
import rendered from "./avatar-manifest.json";

export type AvatarGender = Gender;

/** 3–6 → "small", 7–12 → "big" */
export const AVATAR_AGE_BANDS = [
  { id: "small", renderAge: 5, maxAge: 6 },
  { id: "big", renderAge: 9, maxAge: 99 },
] as const;

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

/** Same ids and hexes as EYE_COLORS in create-store.ts. "brown" is painted into the bases. */
export const AVATAR_EYE_COLORS = [
  { id: "brown-dark", hex: "#5d4037" },
  { id: "brown", hex: "#8d6e63" },
  { id: "green", hex: "#558b2f" },
  { id: "blue", hex: "#1976d2" },
  { id: "hazel", hex: "#a0875b" },
  { id: "gray", hex: "#78909c" },
] as const;
export const AVATAR_BASE_EYE_COLOR = "brown";

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

export type AvatarAgeBand = (typeof AVATAR_AGE_BANDS)[number]["id"];
export type AvatarSkinTone = (typeof AVATAR_SKIN_TONES)[number]["id"];
export type AvatarHairColor = (typeof AVATAR_HAIR_COLORS)[number]["id"];
export type AvatarEyeColor = (typeof AVATAR_EYE_COLORS)[number]["id"];
export type AvatarHairstyle = (typeof AVATAR_HAIRSTYLES)[AvatarGender][number];
export type AvatarGlassesShape = (typeof AVATAR_GLASSES_SHAPES)[number];
export type AvatarGlassesColour = (typeof AVATAR_GLASSES_COLOURS)[number]["id"];
/** "none" or "{shape}-{colour}", e.g. "round-dark" */
export type AvatarGlasses = "none" | `${AvatarGlassesShape}-${AvatarGlassesColour}`;

export interface AvatarTraits {
  gender: AvatarGender;
  ageBand: AvatarAgeBand;
  skinTone: AvatarSkinTone;
  hairColor: AvatarHairColor;
  hairstyle: AvatarHairstyle;
  eyeColor: AvatarEyeColor;
  glasses: AvatarGlasses;
  freckles: boolean;
}

type BaseTraits = Pick<AvatarTraits, "gender" | "ageBand" | "skinTone" | "hairColor" | "hairstyle">;

export const AVATAR_GLASSES_OPTIONS: AvatarGlasses[] = [
  "none",
  ...AVATAR_GLASSES_SHAPES.flatMap((s) => AVATAR_GLASSES_COLOURS.map((c) => `${s}-${c.id}` as const)),
];

export function ageBandFor(age: number): AvatarAgeBand {
  return age <= AVATAR_AGE_BANDS[0].maxAge ? "small" : "big";
}

const ROOT = "/images/avatar";

/** Cache-buster: content hash written by the generator whenever assets change. */
export const AVATAR_ASSET_VERSION: string = rendered.version;

const withVersion = (path: string) => `${path}?v=${AVATAR_ASSET_VERSION}`;

export function avatarBaseKey(t: BaseTraits): string {
  return `${t.gender}/${t.ageBand}/${t.skinTone}/${t.hairColor}-${t.hairstyle}`;
}

export function avatarBaseSrc(t: BaseTraits): string {
  return withVersion(`${ROOT}/${avatarBaseKey(t)}.webp`);
}

const overlayDir = (gender: AvatarGender, band: AvatarAgeBand) => `${ROOT}/${gender}/${band}/overlays`;

export function avatarEyesSrc(gender: AvatarGender, band: AvatarAgeBand, eyeColor: AvatarEyeColor): string | null {
  return eyeColor === AVATAR_BASE_EYE_COLOR ? null : withVersion(`${overlayDir(gender, band)}/eyes-${eyeColor}.webp`);
}

export function avatarFrecklesSrc(gender: AvatarGender, band: AvatarAgeBand): string {
  return withVersion(`${overlayDir(gender, band)}/freckles.webp`);
}

export function avatarGlassesSrc(gender: AvatarGender, band: AvatarAgeBand, glasses: Exclude<AvatarGlasses, "none">): string {
  return withVersion(`${overlayDir(gender, band)}/glasses-${glasses}.webp`);
}

export interface AvatarLayer {
  src: string;
  blend: "normal" | "multiply";
  key: "base" | "eyes" | "freckles" | "glasses";
}

/** Every layer URL for a trait set, bottom to top. */
export function avatarLayers(t: AvatarTraits): AvatarLayer[] {
  const layers: AvatarLayer[] = [{ src: avatarBaseSrc(t), blend: "normal", key: "base" }];
  const eyes = avatarEyesSrc(t.gender, t.ageBand, t.eyeColor);
  if (eyes) layers.push({ src: eyes, blend: "normal", key: "eyes" });
  if (t.freckles) layers.push({ src: avatarFrecklesSrc(t.gender, t.ageBand), blend: "multiply", key: "freckles" });
  if (t.glasses !== "none") layers.push({ src: avatarGlassesSrc(t.gender, t.ageBand, t.glasses), blend: "normal", key: "glasses" });
  return layers;
}

/** Every overlay of a gender × band (preloaded once, they are small). */
export function avatarOverlaySrcs(gender: AvatarGender, band: AvatarAgeBand): string[] {
  const out: string[] = [avatarFrecklesSrc(gender, band)];
  for (const e of AVATAR_EYE_COLORS) {
    const src = avatarEyesSrc(gender, band, e.id);
    if (src) out.push(src);
  }
  for (const g of AVATAR_GLASSES_OPTIONS) if (g !== "none") out.push(avatarGlassesSrc(gender, band, g));
  return out;
}

const renderedKeys = new Set<string>(rendered.bases);

/** True when the base for these traits has been rendered (the matrix can be partial during rollout). */
export function isAvatarRendered(t: BaseTraits): boolean {
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
  age: number;
  skinTone: string;
  hairColor: string;
  hairstyle: string;
  eyeColor: string;
  glasses?: AvatarGlasses;
  freckles?: boolean;
}): AvatarTraits {
  const byHex = <T extends { id: string; hex: string }>(list: readonly T[], hex: string): T["id"] | undefined =>
    list.find((x) => x.hex === hex.toLowerCase())?.id;
  return {
    gender: c.gender,
    ageBand: ageBandFor(c.age),
    skinTone: byHex(AVATAR_SKIN_TONES, c.skinTone) ?? "medium",
    hairColor: byHex(AVATAR_HAIR_COLORS, c.hairColor) ?? "brown-dark",
    hairstyle: normaliseHairstyle(c.gender, c.hairstyle),
    eyeColor: byHex(AVATAR_EYE_COLORS, c.eyeColor) ?? AVATAR_BASE_EYE_COLOR,
    glasses: c.glasses && AVATAR_GLASSES_OPTIONS.includes(c.glasses) ? c.glasses : "none",
    freckles: c.freckles ?? false,
  };
}

/**
 * Bases one click away from `t` (every other skin, hair colour, hairstyle and
 * the other age band) — the builder preloads them so the next swap is instant.
 */
export function avatarNeighbours(t: AvatarTraits): AvatarTraits[] {
  const out: AvatarTraits[] = [];
  for (const s of AVATAR_SKIN_TONES) if (s.id !== t.skinTone) out.push({ ...t, skinTone: s.id });
  for (const h of AVATAR_HAIR_COLORS) if (h.id !== t.hairColor) out.push({ ...t, hairColor: h.id });
  for (const st of AVATAR_HAIRSTYLES[t.gender]) if (st !== t.hairstyle) out.push({ ...t, hairstyle: st });
  out.push({ ...t, ageBand: t.ageBand === "small" ? "big" : "small" });
  return out;
}
