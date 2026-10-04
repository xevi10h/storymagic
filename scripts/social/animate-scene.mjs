// Animates a real book illustration with an image-to-video model (MiniMax H3 through the Higgsfield API):
// either one scene coming alive, or a continuous transition from one scene to the next (start + end frame).
// Paid: 10 Higgsfield credits per 5 s clip (price list read 2026-10-04). Key: ~/.config/higgsfield/credentials.
//   node scripts/social/animate-scene.mjs <out.mp4> "<prompt>" <start> [<end>]
// <start> / <end>: a 1080×1920 JPEG, or `pdf:<showcase story id>:<page>:<focus x 0-1>` to cut the frame from the
// public example PDF (same 9:16 window render-video.mjs uses, page-number strip removed).
// The prompt describes only the motion; the style guard below is always appended.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { sceneFrame } from "./scene-frame.mjs";

const [outArg, prompt, startArg, endArg] = process.argv.slice(2);
if (!outArg || !prompt || !startArg) throw new Error('usage: node scripts/social/animate-scene.mjs <out.mp4> "<prompt>" <start> [<end>]');
const OUT = resolve(outArg);
const TMP = `${dirname(OUT)}/.build`;
mkdirSync(TMP, { recursive: true });

const STYLE = endArg
  ? "Keep the exact hand-painted watercolour storybook style and the same child (face, hair, clothes) the whole time. One smooth continuous magical transition, no cuts, no text. End exactly on the final illustration."
  : "Preserve the exact hand-painted watercolour storybook style, the paper texture and the child's face and clothes. Gentle, calm motion for a bedtime story. Very slow push-in, one continuous shot, no cuts, no new characters or objects, no text.";

const frame = (spec, name) => sceneFrame(spec, TMP, `${name}-${process.pid}`); // unique: several clips may render at once

const API = "https://api.higgsfield.ai";
const auth = { Authorization: `Key ${readFileSync(`${homedir()}/.config/higgsfield/credentials`, "utf8").trim()}` };
async function upload(file) {
  const res = await fetch(`${API}/files/generate-upload-url`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ content_type: "image/jpeg" }) });
  const { upload_url, public_url } = await res.json();
  if (!upload_url) throw new Error(`upload url: HTTP ${res.status}`);
  const put = await fetch(upload_url, { method: "PUT", headers: { "Content-Type": "image/jpeg", "x-amz-tagging": "retention=temporary" }, body: readFileSync(file) });
  if (!put.ok) throw new Error(`upload: HTTP ${put.status}`);
  return public_url;
}

const body = { prompt: `${prompt} ${STYLE}`, image_url: await upload(await frame(startArg, "start")), duration: 5, aspect_ratio: "9:16" };
if (endArg) body.end_image_url = await upload(await frame(endArg, "end"));
const submit = await (await fetch(`${API}/minimax/h3/image-to-video`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
if (!submit.request_id) throw new Error(`submit failed: ${JSON.stringify(submit).slice(0, 300)}`);
console.log(`submitted ${submit.request_id}`);
for (let i = 0; i < 90; i++) {
  await new Promise((r) => setTimeout(r, 10_000));
  const status = await (await fetch(`${API}/requests/${submit.request_id}/status`, { headers: auth })).json();
  if (status.status === "completed") {
    writeFileSync(OUT, Buffer.from(await (await fetch(status.video.url)).arrayBuffer()));
    console.log(`built ${OUT}`);
    process.exit(0);
  }
  if (["failed", "nsfw", "canceled"].includes(status.status)) throw new Error(`generation ${status.status}: ${JSON.stringify(status).slice(0, 400)}`);
}
throw new Error("timed out after 15 minutes");
