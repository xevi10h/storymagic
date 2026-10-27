// Shared start-frame call for the ads. Each ad's start-frames.mjs defines its SCENES and calls run(SCENES).
// Run from the ad folder:  node start-frames.mjs a [b c]
// Qwen Image 3 edit on the Higgsfield API (owner 2026-10-27: Higgsfield, not fal); up to three references, keeps faces and
// the real cover. NUM images per scene (default 2), each its own request. Key: ~/.config/higgsfield/credentials.
// Output: people/<PREFIX|start>-<name><1|2>.jpg; the chosen one is copied to people/start-<name>.jpg by hand.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import sharp from "sharp";
const API = "https://api.higgsfield.ai";
const auth = { Authorization: `Key ${readFileSync(`${homedir()}/.config/higgsfield/credentials`, "utf8").trim()}` };
export const REAL = "Real human people photographed with a phone: natural human proportions, normal-sized eyes, real skin with pores and slight unevenness, natural dry lips, not dolls, not CGI, not a 3D animation character, not airbrushed. Every hand has five fingers.";

async function upload(file) {
  const r = await (await fetch(`${API}/files/generate-upload-url`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ content_type: "image/jpeg" }) })).json();
  const put = await fetch(r.upload_url, { method: "PUT", headers: { "Content-Type": "image/jpeg", "x-amz-tagging": "retention=temporary" }, body: await sharp(file).jpeg().toBuffer() });
  if (!put.ok) throw new Error(`upload ${file}: HTTP ${put.status}`);
  return r.public_url;
}
async function edit(prompt, urls) {
  const s = await (await fetch(`${API}/alibaba/qwen-image-3/edit`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ prompt, image_urls: urls, aspect_ratio: "9:16" }) })).json();
  if (!s.request_id) throw new Error(`submit: ${JSON.stringify(s).slice(0, 300)}`);
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const st = await (await fetch(`${API}/requests/${s.request_id}/status`, { headers: auth })).json();
    if (st.status === "completed") return st.images?.[0]?.url ?? st.image?.url;
    if (["failed", "nsfw", "canceled"].includes(st.status)) throw new Error(`${st.status}: ${JSON.stringify(st).slice(0, 300)}`);
  }
  throw new Error("timed out");
}

export async function run(SCENES, names = process.argv.slice(2)) {
  const num = Number(process.env.NUM ?? 2);
  await Promise.all(names.map(async (name) => {
    const s = SCENES[name];
    if (!s) throw new Error(`unknown scene ${name}`);
    if (s.refs.length > 3) throw new Error(`${name}: at most three references`);
    for (const r of s.refs) if (!existsSync(r)) throw new Error(`missing ${r}`);
    const urls = await Promise.all(s.refs.map(upload));
    await Promise.all([...Array(num).keys()].map(async (i) => {
      const url = await edit(s.prompt, urls);
      await sharp(Buffer.from(await (await fetch(url)).arrayBuffer())).resize(1080, 1920, { fit: "cover" }).jpeg({ quality: 92 }).toFile(`people/${process.env.PREFIX ?? "start"}-${name}${i + 1}.jpg`);
    }));
    console.log(name, "ok", num, "images");
  }));
}
