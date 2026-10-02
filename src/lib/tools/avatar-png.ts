// Server-only: the chosen watercolour portrait as a round PNG for the printables.
//
// Same layers as WatercolorAvatar (base + freckles multiply + glasses), composited
// with sharp because @react-pdf only embeds PNG/JPEG. Paths come from the avatar
// manifest for validated trait ids, never from the request. Files are read from
// /public when present (local, self-hosted); on Vercel /public is not in the
// function bundle, so they are downloaded from the site URL (same rule as
// loadAvatarReference in src/lib/ai/book-images.ts — never a request-derived host).

import { readFile } from "node:fs/promises";
import path from "node:path";
import { avatarLayers, type AvatarTraits } from "@/lib/avatar/manifest";
import { getSiteUrl } from "@/lib/email/send";
import type { ToolAvatar } from "./schema";

/** WatercolorAvatar's default framing: 1.35× around (50 %, 47 %) of the 512 px portrait. */
const SOURCE_PX = 512;
const ZOOM = 1.35;
const ORIGIN_Y = 0.47;

async function loadAsset(src: string): Promise<Buffer> {
  const assetPath = src.split("?")[0];
  if (!/^\/images\/avatar\/[a-z0-9/-]+\.webp$/.test(assetPath)) throw new Error("avatar asset path rejected");
  try {
    return await readFile(path.join(process.cwd(), "public", assetPath));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  const res = await fetch(`${getSiteUrl()}${src}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`avatar asset ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const cache = new Map<string, string>();
const CACHE_MAX = 64;

/** Round PNG data URI of the portrait (head and shoulders, ~380 px). */
export async function avatarPortraitPng(avatar: ToolAvatar): Promise<string> {
  // The tools do not offer eye colour (too small to read in print): base eyes.
  const traits: AvatarTraits = { ...avatar, eyeColor: "brown" } as AvatarTraits;
  const layers = avatarLayers(traits);
  const key = layers.map((l) => l.src).join("|");
  const hit = cache.get(key);
  if (hit) return hit;

  const sharp = (await import("sharp")).default;
  const [base, ...overlays] = await Promise.all(layers.map((l) => loadAsset(l.src)));

  const composed = await sharp(base)
    .composite(overlays.map((input, i) => ({ input, blend: layers[i + 1].blend === "multiply" ? "multiply" : "over" })))
    .png()
    .toBuffer();

  const crop = Math.round(SOURCE_PX / ZOOM);
  const left = Math.round(SOURCE_PX / 2 - crop / 2);
  const top = Math.round(SOURCE_PX * ORIGIN_Y - crop * ORIGIN_Y);
  const r = crop / 2;
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${crop}" height="${crop}"><circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/></svg>`);

  const png = await sharp(composed)
    .extract({ left, top, width: crop, height: crop })
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();

  const uri = `data:image/png;base64,${png.toString("base64")}`;
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, uri);
  return uri;
}
