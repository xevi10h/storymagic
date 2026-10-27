// Shared fal call for the ad start frames (from docs/social/ads/soy-yo/start-frames.mjs). Each ad's start-frames.mjs
// defines its SCENES and calls run(SCENES). Run from the ad folder:  node start-frames.mjs a [b c]
// Nano Banana Pro edit ($0.15 an image) keeps reference faces and the real cover; NUM=1 halves the cost (default 2).
// Output: people/<PREFIX|start>-<name><1|2>.jpg; the chosen one is copied to people/start-<name>.jpg by hand.
import { existsSync, readFileSync } from "node:fs";
import sharp from "sharp";
const key = readFileSync("/Users/xavierhuixtrenco/Desktop/Casmar/kids-book/.env.local", "utf8").match(/^FAL_KEY=(.+)$/m)[1].trim().replace(/^"|"$/g, "");
const uri = (f) => `data:image/jpeg;base64,${readFileSync(f).toString("base64")}`;
export const REAL = "Real human people photographed with a phone: natural human proportions, normal-sized eyes, real skin with pores and slight unevenness, natural dry lips, not dolls, not CGI, not a 3D animation character, not airbrushed. Every hand has five fingers.";
export async function run(SCENES, names = process.argv.slice(2)) {
  const num = Number(process.env.NUM ?? 2);
  await Promise.all(names.map(async (name) => {
    const s = SCENES[name];
    if (!s) throw new Error(`unknown scene ${name}`);
    for (const r of s.refs) if (!existsSync(r)) throw new Error(`missing ${r}`);
    const res = await fetch("https://fal.run/fal-ai/nano-banana-pro/edit", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Key ${key}` },
      body: JSON.stringify({ prompt: s.prompt, image_urls: s.refs.map(uri), output_format: "jpeg", num_images: num, aspect_ratio: "9:16", resolution: "2K" }) });
    const j = await res.json();
    if (!res.ok || !j.images?.[0]?.url) return console.log(name, "FAILED", res.status, JSON.stringify(j).slice(0, 300));
    for (const [i, im] of j.images.entries()) await sharp(Buffer.from(await (await fetch(im.url)).arrayBuffer())).resize(1080, 1920, { fit: "cover" }).jpeg({ quality: 92 }).toFile(`people/${process.env.PREFIX ?? "start"}-${name}${"12"[i]}.jpg`);
    console.log(name, "ok", j.images.length, "images");
  }));
}
