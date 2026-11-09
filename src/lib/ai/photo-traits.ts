// Photo mode, step 2: read the child's traits FROM THE ILLUSTRATED PORTRAIT drawn from the
// photo (never from the photo: it is deleted before this runs). One cheap vision call with a
// strict schema restricted to the builder's own ids, so the Character Bible text (story +
// scene prompts) describes the child the parent sees in the drawing. Gender and age are never
// read: they are what the parent chose on screen 1. SERVER ONLY.

import sharp from "sharp";
import { z } from "zod";
import { callOpenAIStructured } from "./openai-http";
import { EYE_COLOR_MAP, HAIR_COLOR_MAP, SKIN_MAP, glassesDescription, hairDescription } from "./character-description";
import { defaultPhotoTraits, photoTraitOptions, type PhotoTraits } from "@/lib/photo-traits";
import type { Gender } from "@/lib/create-store";
import type { AvatarGlasses } from "@/lib/avatar/manifest";

/** Vision model of the read (gpt-5.4 family, like the QA judge). */
const traitsModel = () => process.env.PHOTO_TRAITS_MODEL?.trim() || "gpt-5.4-mini";
/** Plenty for colours and hairstyle; keeps the call at a few hundred image tokens. */
const READ_EDGE = 768;

const enumOf = (values: readonly string[]) => z.enum(values as [string, ...string[]]);

function traitsSchema(gender: Gender) {
  const o = photoTraitOptions(gender);
  return z.object({
    skinTone: enumOf(o.skinTone),
    hairColor: enumOf(o.hairColor),
    hairstyle: enumOf(o.hairstyle),
    eyeColor: enumOf(o.eyeColor),
    glasses: enumOf(o.glasses),
    freckles: z.boolean(),
  });
}

function optionList(map: Record<string, string>, ids: readonly string[]): string {
  return ids.map((id) => `- ${id}: ${map[id] ?? id}`).join("\n");
}

function prompt(gender: Gender): string {
  const o = photoTraitOptions(gender);
  const genderWord = gender === "boy" ? "boy" : gender === "girl" ? "girl" : "child";
  return [
    `This is a watercolor illustration of a ${genderWord} from a children's picture book. Describe how the child is DRAWN, choosing the closest option for each field.`,
    `skinTone:\n${optionList(SKIN_MAP, o.skinTone)}`,
    `hairColor:\n${optionList(HAIR_COLOR_MAP, o.hairColor)}`,
    `hairstyle:\n${o.hairstyle.map((id) => `- ${id}: ${hairDescription(id, "", gender).replace(/\s+/g, " ").trim()}`).join("\n")}`,
    `eyeColor:\n${optionList(EYE_COLOR_MAP, o.eyeColor)}`,
    `glasses (shape and frame colour; "none" when the child wears no glasses):\n${o.glasses
      .map((id) => `- ${id}: ${glassesDescription(id as AvatarGlasses) ?? "no glasses"}`)
      .join("\n")}`,
    "freckles: true only if freckles are clearly painted on the face.",
  ].join("\n\n");
}

/**
 * Traits read from the drawing. Never throws: when the read fails the builder defaults are
 * returned (`fallback: true`, logged) so the parent still gets the drawing, which remains
 * the face anchor of the whole book.
 */
export async function deriveTraitsFromPortrait(
  drawing: Buffer,
  gender: Gender,
  opts: { label: string },
): Promise<{ traits: PhotoTraits; fallback: boolean; costUsd: number }> {
  try {
    const jpeg = await sharp(drawing).resize(READ_EDGE, READ_EDGE, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    const result = await callOpenAIStructured({
      model: traitsModel(),
      system: "You label children's book illustrations. Answer only from what is visible in the image.",
      user: prompt(gender),
      images: [{ url: `data:image/jpeg;base64,${jpeg.toString("base64")}`, detail: "high" }],
      schemaName: "photo_portrait_traits",
      schema: traitsSchema(gender),
      reasoningEffort: "low",
      timeoutMs: 25_000,
      label: opts.label,
    });
    return { traits: { ...result.data, glasses: result.data.glasses as AvatarGlasses }, fallback: false, costUsd: result.costUsd ?? 0 };
  } catch (err) {
    console.error(`[PhotoTraits] ${opts.label} read failed, builder defaults used: ${err instanceof Error ? err.message : String(err)}`);
    return { traits: defaultPhotoTraits(gender), fallback: true, costUsd: 0 };
  }
}
