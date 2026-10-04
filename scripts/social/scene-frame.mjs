// A 1080×1920 frame of a book scene: a given image, or `pdf:<showcase story id>:<page>:<focus x 0-1>`, the 9:16
// window render-video.mjs shows, cut from the public example PDF with the page-number strip removed.
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export async function sceneFrame(spec, tmp, name) {
  if (!spec.startsWith("pdf:")) return resolve(spec);
  const [, id, page, focus] = spec.split(":");
  const pdf = `${tmp}/${id}.pdf`;
  if (!existsSync(pdf)) {
    const res = await fetch(`https://meapica.shop/api/showcase/${id}/pdf`);
    if (!res.ok) throw new Error(`example PDF ${id}: HTTP ${res.status}`);
    writeFileSync(pdf, Buffer.from(await res.arrayBuffer()));
  }
  const base = `${tmp}/${id}-p${page}`;
  if (!existsSync(`${base}.png`)) execFileSync("pdftoppm", ["-r", "200", "-png", "-f", page, "-l", page, "-singlefile", pdf, base]);
  const meta = await sharp(`${base}.png`).metadata();
  const height = Math.round(meta.height * 0.91); // drops the page-number badge
  const width = Math.round((height * 9) / 16);
  const left = Math.round(Math.min(Math.max(Number(focus ?? 0.5) * meta.width - width / 2, 0), meta.width - width));
  const out = `${tmp}/${name}.jpg`;
  await sharp(`${base}.png`).extract({ left, top: 0, width, height }).resize(1080, 1920).jpeg({ quality: 92 }).toFile(out);
  return out;
}
