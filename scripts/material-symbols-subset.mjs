#!/usr/bin/env node
/**
 * Material Symbols Outlined, self-hosted as a subset of only the icons the app uses.
 *
 * The full variable font is ~1.1 MB and was the biggest cost of the mobile LCP
 * (render-blocking Google stylesheet + a VeryHigh-priority 1.1 MB download).
 * The subset (~90 KB) is loaded by next/font/local in src/app/_components/RootDocument.tsx.
 *
 *   node scripts/material-symbols-subset.mjs           regenerate src/fonts/* (needs network)
 *   node scripts/material-symbols-subset.mjs --check   exit 1 if src/ uses an icon missing from the subset
 *
 * Run it (without --check) whenever you add a new icon name: a glyph missing from
 * the subset renders as its ligature text ("arrow_forward") instead of the icon.
 *
 * Candidates = every snake_case string literal or JSX text in src/**\/*.ts(x) that
 * is a real Material Symbols name (dynamic icons come from code constants, so their
 * literals are caught too). Over-inclusion only costs a few bytes.
 * Axes: wght 100..700 only (the app never sets FILL/GRAD/opsz; font-weight maps to wght).
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const FONT_DIR = path.join(ROOT, "src/fonts");
const LIST_FILE = path.join(FONT_DIR, "material-symbols-icons.txt");
const FONT_FILE = path.join(FONT_DIR, "material-symbols-outlined.woff2");
const CODEPOINTS_URL =
  "https://raw.githubusercontent.com/google/material-design-icons/master/variablefont/MaterialSymbolsOutlined%5BFILL%2CGRAD%2Copsz%2Cwght%5D.codepoints";
// A modern browser UA, so the CSS API answers with woff2.
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

function sourceFiles(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      if (f !== "messages" && f !== "fonts") sourceFiles(p, out);
    } else if (/\.(tsx?|mjs)$/.test(f)) out.push(p);
  }
  return out;
}

function candidateTokens() {
  const tokens = new Set();
  const re = /["'`]([a-z0-9_]{2,40})["'`]|>\s*([a-z0-9_]{2,40})\s*</g;
  for (const file of sourceFiles(path.join(ROOT, "src"))) {
    const src = fs.readFileSync(file, "utf8");
    for (let m; (m = re.exec(src)); ) tokens.add(m[1] || m[2]);
  }
  return tokens;
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

async function main() {
  const check = process.argv.includes("--check");
  const tokens = candidateTokens();

  if (check) {
    // Offline: every token that is a known icon (from the last generation's
    // codepoints snapshot) must be in the subset.
    const known = new Set(fs.readFileSync(path.join(FONT_DIR, "material-symbols-codepoints.txt"), "utf8").split("\n").filter(Boolean));
    const subset = new Set(fs.readFileSync(LIST_FILE, "utf8").split(",").map((s) => s.trim()).filter(Boolean));
    const missing = [...tokens].filter((t) => known.has(t) && !subset.has(t)).sort();
    if (missing.length) {
      console.error(`Icons used but missing from the font subset: ${missing.join(", ")}\nRun: node scripts/material-symbols-subset.mjs`);
      process.exit(1);
    }
    console.log(`OK: ${subset.size} icons in the subset cover every icon used in src/.`);
    return;
  }

  const codepoints = (await fetchText(CODEPOINTS_URL)).split("\n").map((l) => l.split(" ")[0]).filter(Boolean);
  const known = new Set(codepoints);
  const names = [...tokens].filter((t) => known.has(t)).sort();
  const css = await fetchText(
    `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@100..700&icon_names=${names.join(",")}&display=block`,
  );
  const fontUrl = css.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/)?.[1];
  if (!fontUrl) throw new Error(`No font URL in the CSS response:\n${css}`);
  const font = Buffer.from(await (await fetch(fontUrl, { headers: { "User-Agent": UA } })).arrayBuffer());

  fs.mkdirSync(FONT_DIR, { recursive: true });
  fs.writeFileSync(FONT_FILE, font);
  fs.writeFileSync(LIST_FILE, `${names.join(",")}\n`);
  fs.writeFileSync(path.join(FONT_DIR, "material-symbols-codepoints.txt"), `${[...known].sort().join("\n")}\n`);
  console.log(`Wrote ${path.relative(ROOT, FONT_FILE)} (${(font.length / 1024).toFixed(1)} KB, ${names.length} icons).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
