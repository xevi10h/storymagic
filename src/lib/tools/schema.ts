// Input of the free Reyes printables (POST /api/tools/pdf). Shared by the forms
// (client) and the route (server), so both validate the same way.
//
// The portrait is never a URL: only trait ids from the avatar manifest, and the
// server rebuilds the file paths itself (src/lib/tools/avatar-png.ts).

import { z } from "zod";
import {
  AVATAR_AGE_BANDS,
  AVATAR_GLASSES_OPTIONS,
  AVATAR_HAIR_COLORS,
  AVATAR_HAIRSTYLES,
  AVATAR_SKIN_TONES,
  isAvatarRendered,
  type AvatarTraits,
} from "@/lib/avatar/manifest";
import { TOOL_LOCALES } from "./registry";
import { ACHIEVEMENT_IDS, CHALLENGE_IDS } from "./reply-templates";
import { TOOL_AGE_MAX, TOOL_AGE_MIN, TOOL_CUSTOM_MAX, TOOL_MAX_ACHIEVEMENTS, TOOL_NAME_MAX, TOOL_NAME_PATTERN, TOOL_PS_MAX } from "./limits";


const ids = <T extends { id: string }>(list: readonly T[]) => list.map((x) => x.id) as [T["id"], ...T["id"][]];
const allHairstyles = [...new Set(Object.values(AVATAR_HAIRSTYLES).flat())] as [string, ...string[]];

/** Plain text: no control characters, collapsed whitespace, NFC (accents, ç, l·l, ñ). */
const text = (max: number) =>
  z
    .string()
    .transform((s) => s.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim())
    .pipe(z.string().max(max));

export const avatarSchema = z
  .object({
    gender: z.enum(["boy", "girl", "neutral"]),
    ageBand: z.enum(ids(AVATAR_AGE_BANDS)),
    skinTone: z.enum(ids(AVATAR_SKIN_TONES)),
    hairColor: z.enum(ids(AVATAR_HAIR_COLORS)),
    hairstyle: z.enum(allHairstyles),
    glasses: z.enum(AVATAR_GLASSES_OPTIONS as [string, ...string[]]),
    freckles: z.boolean(),
  })
  // Only bases that exist in the pre-rendered matrix (hairstyle valid for the gender).
  .refine((a) => (AVATAR_HAIRSTYLES[a.gender] as readonly string[]).includes(a.hairstyle) && isAvatarRendered(a as Omit<AvatarTraits, "eyeColor">), {
    message: "unknown_avatar",
  });

/** Avatar traits as validated (ids checked against the manifest by the refine above). */
export type ToolAvatar = z.infer<typeof avatarSchema>;

const base = {
  locale: z.enum(TOOL_LOCALES),
  name: text(TOOL_NAME_MAX).pipe(z.string().min(1).regex(TOOL_NAME_PATTERN)),
  avatar: avatarSchema,
};

export const letterInputSchema = z.object({
  tool: z.literal("letter"),
  ...base,
  /** null = the child writes it by hand. */
  age: z.number().int().min(TOOL_AGE_MIN).max(TOOL_AGE_MAX).nullable(),
  /** write = lines for children who write; draw = boxes for the youngest. */
  layout: z.enum(["write", "draw"]),
});

export const replyInputSchema = z.object({
  tool: z.literal("reply"),
  ...base,
  achievements: z.array(z.enum(ACHIEVEMENT_IDS)).max(TOOL_MAX_ACHIEVEMENTS),
  customAchievement: text(TOOL_CUSTOM_MAX),
  challenge: z.enum(CHALLENGE_IDS).nullable(),
  /** When the child reads it: the night before (5 Jan) or with the gifts (6 Jan morning). */
  moment: z.enum(["before", "morning"]),
  postscript: text(TOOL_PS_MAX),
  /** Which template variant of each section (the "Otra versión" button). */
  variant: z.number().int().min(0).max(999),
});

export const toolInputSchema = z.discriminatedUnion("tool", [letterInputSchema, replyInputSchema]);

export type LetterInput = z.infer<typeof letterInputSchema>;
export type ReplyInput = z.infer<typeof replyInputSchema>;
export type ToolInput = z.infer<typeof toolInputSchema>;
