/**
 * Contact sheets for visual QA of the avatar matrix (sharp only, no API calls).
 *
 *   node scripts/avatar/contact-sheet.mjs <out.png> <cell> <file>[+overlay[:multiply],...] ...
 *   node scripts/avatar/contact-sheet.mjs <out.png> <cell> --sample=40 [--seed=1]   random bases + random overlays
 *   node scripts/avatar/contact-sheet.mjs <out.png> <cell> --skins=girl/small/brown-dark-long  one combo, every skin
 *   env: COLS (default 4 / 8 for samples), CROP=x,y,w,h (fractions of the cell, zooms into the face)
 */
import sharp from "sharp";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const [out, cellArg, ...rest] = process.argv.slice(2);
const cell = Number(cellArg);
const ROOT = "public/images/avatar";

function listBases() {
  const found = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory() && e.name !== "overlays") walk(p);
      else if (e.name.endsWith(".webp") && !dir.endsWith("overlays")) found.push(p);
    }
  };
  walk(ROOT);
  return found.sort();
}

let seed = Number((rest.find((a) => a.startsWith("--seed=")) ?? "--seed=1").split("=")[1]);
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

let files = rest.filter((a) => !a.startsWith("--"));
const sampleArg = rest.find((a) => a.startsWith("--sample="));
const skinsArg = rest.find((a) => a.startsWith("--skins="));
if (sampleArg) {
  const all = listBases();
  const n = Number(sampleArg.split("=")[1]);
  const picked = new Set();
  while (picked.size < Math.min(n, all.length)) picked.add(all[Math.floor(rand() * all.length)]);
  files = [...picked].map((f) => {
    const [gender, band] = f.slice(ROOT.length + 1).split("/");
    const ov = join(ROOT, gender, band, "overlays");
    const layers = [];
    const eyes = ["", "", "eyes-blue", "eyes-green", "eyes-gray", "eyes-hazel", "eyes-brown-dark"][Math.floor(rand() * 7)];
    if (eyes) layers.push(join(ov, `${eyes}.webp`));
    if (rand() < 0.3) layers.push(`${join(ov, "freckles.webp")}:multiply`);
    const glasses = ["", "", "", "glasses-round-dark", "glasses-round-red", "glasses-square-dark", "glasses-square-red"][Math.floor(rand() * 7)];
    if (glasses) layers.push(join(ov, `${glasses}.webp`));
    return layers.length ? `${f}+${layers.join(",")}` : f;
  });
}
if (skinsArg) {
  // one row per combo: --skins=girl/small/brown-dark-long,boy/big/black-curly
  files = skinsArg
    .split("=")[1]
    .split(",")
    .flatMap((entry) => {
      const [gender, band, combo] = entry.split("/");
      return ["light", "medium-light", "medium", "dark", "very-dark"].map((s) => join(ROOT, gender, band, s, `${combo}.webp`));
    })
    .filter(existsSync);
}

const cols = Math.min(files.length, Number(process.env.COLS ?? (sampleArg ? 8 : 4)));
const rows = Math.ceil(files.length / cols);
const composites = [];
for (const [i, f] of files.entries()) {
  const [path, overlaySpec] = f.split("+");
  const layers = [];
  for (const o of (overlaySpec ?? "").split(",").filter(Boolean)) {
    const [op, blend] = o.split(":");
    layers.push({ input: await sharp(op).resize(cell, cell).toBuffer(), blend: blend ?? "over" });
  }
  let buf = await sharp(path).resize(cell, cell).composite(layers).png().toBuffer();
  if (process.env.CROP) {
    const [cx, cy, cw, ch] = process.env.CROP.split(",").map(Number);
    buf = await sharp(buf)
      .extract({ left: Math.round(cx * cell), top: Math.round(cy * cell), width: Math.round(cw * cell), height: Math.round(ch * cell) })
      .resize(cell, cell)
      .png()
      .toBuffer();
  }
  const x = (i % cols) * cell;
  const y = Math.floor(i / cols) * (cell + 22);
  composites.push({ input: buf, left: x, top: y + 22 });
  const label = path
    .replace(`${ROOT}/`, "")
    .replace(/\.(webp|png)$/, "")
    .concat(overlaySpec ? ` +${overlaySpec.split(",").map((o) => o.split("/").pop().replace(/\.webp.*/, "")).join("+")}` : "")
    .slice(0, Math.floor(cell / 6.5))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;");
  composites.push({ input: Buffer.from(`<svg width="${cell}" height="22"><text x="4" y="16" font-size="11" font-family="Helvetica">${label}</text></svg>`), left: x, top: y });
}
await sharp({ create: { width: cols * cell, height: rows * (cell + 22), channels: 3, background: "#fff" } }).composite(composites).png().toFile(out);
console.log(out);
