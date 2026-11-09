// Photo mode: the look of the child as read FROM THE ILLUSTRATED PORTRAIT drawn from the
// parent's photo (POST /api/characters/photo-portrait), never from the photo itself.
// These traits only feed the Character Bible text (story + scene prompts); the drawing is
// the face anchor of the sheets and the book. Pure: safe on client and server.

import { AVATAR_GLASSES_OPTIONS, AVATAR_HAIRSTYLES, type AvatarGlasses } from "@/lib/avatar/manifest";
import { EYE_COLORS, HAIR_COLORS, INITIAL_STATE, SKIN_TONES, type Gender } from "@/lib/create-store";

export interface PhotoTraits {
  skinTone: string;
  hairColor: string;
  eyeColor: string;
  hairstyle: string;
  glasses: AvatarGlasses;
  freckles: boolean;
}

/** The ids the derivation may answer with (same swatches/hairstyles as "Créalo tú"). */
export function photoTraitOptions(gender: Gender) {
  return {
    skinTone: SKIN_TONES.map((o) => o.color),
    hairColor: HAIR_COLORS.map((o) => o.color),
    eyeColor: EYE_COLORS.map((o) => o.color),
    hairstyle: [...AVATAR_HAIRSTYLES[gender]] as string[],
    glasses: AVATAR_GLASSES_OPTIONS,
  };
}

/** Used when the derivation fails: the builder's own defaults (the drawing still anchors the face). */
export function defaultPhotoTraits(gender: Gender): PhotoTraits {
  const c = INITIAL_STATE.character;
  return {
    skinTone: c.skinTone,
    hairColor: c.hairColor,
    eyeColor: c.eyeColor,
    hairstyle: AVATAR_HAIRSTYLES[gender][0],
    glasses: "none",
    freckles: false,
  };
}

/** Validates traits coming from the network or a persisted draft. */
export function parsePhotoTraits(value: unknown, gender: Gender): PhotoTraits | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const o = photoTraitOptions(gender);
  const pick = (k: "skinTone" | "hairColor" | "eyeColor" | "hairstyle", list: readonly string[]) =>
    typeof v[k] === "string" && list.includes(v[k] as string) ? (v[k] as string) : null;
  const skinTone = pick("skinTone", o.skinTone);
  const hairColor = pick("hairColor", o.hairColor);
  const eyeColor = pick("eyeColor", o.eyeColor);
  const hairstyle = pick("hairstyle", o.hairstyle);
  const glasses = AVATAR_GLASSES_OPTIONS.includes(v.glasses as AvatarGlasses) ? (v.glasses as AvatarGlasses) : null;
  if (!skinTone || !hairColor || !eyeColor || !hairstyle || !glasses || typeof v.freckles !== "boolean") return null;
  return { skinTone, hairColor, eyeColor, hairstyle, glasses, freckles: v.freckles };
}
