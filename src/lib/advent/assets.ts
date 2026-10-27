// Server-only: images for the Advent PDFs and emails.
//
// @react-pdf embeds only PNG/JPEG and Outlook desktop does not render webp, so the door
// art (720×480 webp under /public/images/path) is converted to JPEG with sharp. Files are
// read from /public when present (local, self-hosted); on Vercel /public is not in the
// function bundle, so they are downloaded from our own site URL (never a request-derived
// host), the same rule as src/lib/tools/avatar-png.ts. Small in-memory cache per instance.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSiteUrl } from "@/lib/email/send";
import { avatarPortraitPng } from "@/lib/tools/avatar-png";
import { avatarTraitsFromCharacter, isAvatarRendered, type AvatarTraits } from "@/lib/avatar/manifest";
import type { ToolAvatar } from "@/lib/tools/schema";
import { ADVENT_DOORS } from "./stories";

const ART_PATH_RE = /^\/images\/path\/[a-z]+\/[a-z0-9-]+\.webp$/;

async function loadPublicFile(publicPath: string): Promise<Buffer> {
  if (!ART_PATH_RE.test(publicPath)) throw new Error("advent asset path rejected");
  try {
    return await readFile(path.join(process.cwd(), "public", publicPath));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  const res = await fetch(`${getSiteUrl()}${publicPath}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`advent asset ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const jpegCache = new Map<number, Buffer>();

/** The door's illustration as JPEG bytes (cached per instance). */
export async function doorArtJpeg(door: number): Promise<Buffer> {
  const hit = jpegCache.get(door);
  if (hit) return hit;
  const content = ADVENT_DOORS[door - 1];
  if (!content) throw new Error("unknown door");
  const sharp = (await import("sharp")).default;
  const jpeg = await sharp(await loadPublicFile(content.art))
    .flatten({ background: "#FFF8F0" })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();
  jpegCache.set(door, jpeg);
  return jpeg;
}

export async function doorArtDataUri(door: number): Promise<string> {
  return `data:image/jpeg;base64,${(await doorArtJpeg(door)).toString("base64")}`;
}

/** The fields of a `characters` row the portrait is rebuilt from (UI hex values). */
export interface CharacterLook {
  gender: string;
  age: number;
  skin_tone: string;
  hair_color: string;
  hairstyle: string | null;
  eye_color: string | null;
  glasses: string | null;
  freckles: boolean | null;
}

/**
 * Watercolour portrait traits of a saved character (the avatar matrix, never the stored
 * avatar_url, which can be a private-bucket path). Null when the matrix lacks the base.
 */
export function characterTraits(c: CharacterLook): AvatarTraits | null {
  const gender = c.gender === "boy" || c.gender === "girl" ? c.gender : "neutral";
  const traits = avatarTraitsFromCharacter({
    gender,
    age: c.age,
    skinTone: c.skin_tone ?? "",
    hairColor: c.hair_color ?? "",
    hairstyle: c.hairstyle ?? "",
    eyeColor: c.eye_color ?? "",
    glasses: (c.glasses ?? "none") as AvatarTraits["glasses"],
    freckles: c.freckles === true,
  });
  return isAvatarRendered(traits) ? traits : null;
}

/** Round PNG data URI of the portrait (base eye colour, like the printables). */
export function portraitPng(traits: AvatarTraits): Promise<string> {
  const avatar: ToolAvatar = {
    gender: traits.gender,
    ageBand: traits.ageBand,
    skinTone: traits.skinTone,
    hairColor: traits.hairColor,
    hairstyle: traits.hairstyle,
    glasses: traits.glasses,
    freckles: traits.freckles,
  };
  return avatarPortraitPng(avatar);
}
