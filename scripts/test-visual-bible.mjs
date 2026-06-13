#!/usr/bin/env node
/**
 * Smoke test for the FLUX.2 "visual bible" multi-reference capability.
 *
 * Mirrors the exact request shape used by src/lib/ai/flux2.ts. Generates frozen
 * reference sheets for protagonist + companion + location, then renders a scene
 * with ALL THREE fed as input_image_1..3 — to confirm FLUX.2 honours multiple
 * references and keeps the WHOLE world (not just the protagonist) consistent.
 *
 * Usage: node scripts/test-visual-bible.mjs   (uses BFL_API_KEY from .env.local)
 * Output: artifacts/visual-bible/{sheet-*,scene-multi}.png + contact-sheet.html
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "artifacts", "visual-bible");
fs.mkdirSync(OUT, { recursive: true });

for (const f of [".env.local", ".env"]) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
const KEY = process.env.BFL_API_KEY;
const MODEL = process.env.FLUX2_MODEL || "flux-2-flex";
if (!KEY) { console.error("No BFL_API_KEY"); process.exit(1); }

const WATERCOLOR =
  " Traditional hand-painted children's book watercolor illustration: loose wet-on-wet washes, visible cold-press paper grain, " +
  "delicate ink linework, muted warm palette. NOT digital, NOT vector, NOT 3D, NOT a photograph. No text, no border.";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function flux2(prompt, { inputImages = [], width = 1024, height = 1024 } = {}) {
  const body = { prompt, width, height, output_format: "png", safety_tolerance: 4 };
  inputImages.filter(Boolean).slice(0, 8).forEach((b64, i) => { body[i === 0 ? "input_image" : `input_image_${i + 1}`] = b64; });
  let submit, lastErr;
  for (const ep of [`https://api.bfl.ai/v1/${MODEL}`, `https://api.bfl.ai/v1/${MODEL}-preview`]) {
    const r = await fetch(ep, { method: "POST", headers: { "Content-Type": "application/json", "x-key": KEY }, body: JSON.stringify(body) });
    if (r.ok) { submit = await r.json(); break; }
    lastErr = `${r.status} ${await r.text()}`; if (r.status !== 404) break;
  }
  if (!submit) throw new Error(`submit failed: ${lastErr}`);
  for (let i = 0; i < 90; i++) {
    await sleep(2000);
    const pj = await (await fetch(submit.polling_url, { headers: { "x-key": KEY } })).json();
    if (pj.status === "Ready") return Buffer.from(await (await fetch(pj.result.sample)).arrayBuffer());
    if (["Error", "Failed", "Request Moderated"].includes(pj.status)) throw new Error(`gen ${pj.status}`);
  }
  throw new Error("poll timeout");
}
const b64 = (buf) => buf.toString("base64");
const save = (name, buf) => { fs.writeFileSync(path.join(OUT, name), buf); console.log(`  ✓ ${name} (${(buf.length / 1024).toFixed(0)}KB)`); };

const PROT = "A 6-year-old girl named Lucía, fair skin, wavy chestnut-brown hair, hazel eyes, white astronaut suit with teal trim and a red star patch.";

async function main() {
  console.log(`▶ visual-bible smoke test (${MODEL})`);

  // Protagonist sheet anchored to the existing benchmark avatar (if present)
  const avatarPath = path.join(ROOT, "artifacts/benchmark/reference.png");
  const avatar = fs.existsSync(avatarPath) ? [b64(fs.readFileSync(avatarPath))] : [];

  console.log("• generating reference sheets…");
  const protSheet = await flux2(`Character design reference sheet of ${PROT} Front view, full body, plain white background.${WATERCOLOR}`, { inputImages: avatar });
  save("sheet-protagonist.png", protSheet);
  const alienSheet = await flux2(`Character design reference sheet of a small round friendly alien with apple-green skin, three big dark eyes, tiny antennae, stubby arms. Plain white background.${WATERCOLOR}`);
  save("sheet-alien.png", alienSheet);
  const locSheet = await flux2(`Establishing shot of a cozy round spaceship cockpit interior: cream walls, a large round window, wooden control panels with glowing dials, soft teal accents. Empty, no characters.${WATERCOLOR}`, { width: 1408, height: 1024 });
  save("sheet-location.png", locSheet);

  // Multi-reference scene: all three refs fed together
  console.log("• generating multi-ref scene (3 references)…");
  const scene = await flux2(
    `${PROT} She sits cross-legged sharing cookies with the small round green three-eyed alien, both laughing, inside the cozy round spaceship cockpit with its big round window showing stars and wooden control panels.${WATERCOLOR}`,
    { inputImages: [b64(protSheet), b64(alienSheet), b64(locSheet)] },
  );
  save("scene-multi.png", scene);

  const html = `<!doctype html><meta charset=utf8><title>visual bible test</title>
<style>body{font-family:system-ui;margin:24px;background:#faf8f5}img{height:200px;border-radius:8px;margin:6px;vertical-align:top}h2{font-size:15px}</style>
<h1>FLUX.2 visual-bible multi-reference test (${MODEL})</h1>
<h2>Reference sheets (frozen)</h2>
<img src=sheet-protagonist.png><img src=sheet-alien.png><img src=sheet-location.png>
<h2>Scene generated from all 3 references → does the alien + cockpit match their sheets?</h2>
<img src=scene-multi.png style=height:360px>`;
  fs.writeFileSync(path.join(OUT, "contact-sheet.html"), html);
  console.log(`✅ done → ${OUT}/contact-sheet.html`);
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
