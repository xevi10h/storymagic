// Renders Pinterest-native pins (1000×1500 JPG, 2:3) from REAL example books: pages are rasterised from the
// public example PDF (/api/showcase/{id}/pdf), the letter pins capture the live free tool. Run from the repo root
// (needs pdftoppm from poppler):
//   node scripts/social/render-pins.mjs docs/social/pinterest/2026-10-19/pins.json
// pins.json: { utm, books: { key: showcaseId }, pins: [{ id, lang, path, layout, book?, spread?, grid?, kicker,
//   headline (may hold <em>), facts[], dates?, price?, title, description, alt, board }] }
// Layouts: cover | dedication | spread | portrait | grid | dates | letter. Writes <id>.jpg + pins.md next to pins.json.
// PDF pages (34): 1 cover, 3 title + dedication, 4-28 story, 29 portrait.
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const configPath = resolve(process.argv[2] ?? "");
if (!existsSync(configPath)) throw new Error("usage: node scripts/social/render-pins.mjs <pins.json>");
const T = JSON.parse(readFileSync(configPath, "utf8"));
const OUT = dirname(configPath);
const TMP = `${OUT}/.build`;
const LOGO = `${process.cwd()}/public/images/meapica-logo.png`;
mkdirSync(TMP, { recursive: true });

const link = (p) => `https://meapica.es${p.path}?${T.utm.replace("{id}", p.id)}`;

/** file:// URL of page n of a book, rasterised once at 150 dpi (1181 px square). */
async function pageUrl(bookKey, n) {
  const id = T.books[bookKey];
  const pdf = `${TMP}/${id}.pdf`;
  if (!existsSync(pdf)) {
    const res = await fetch(`https://meapica.es/api/showcase/${id}/pdf`);
    if (!res.ok) throw new Error(`example PDF ${bookKey}: HTTP ${res.status}`);
    writeFileSync(pdf, Buffer.from(await res.arrayBuffer()));
  }
  const base = `${TMP}/${id}-p${n}`;
  if (!existsSync(`${base}.png`)) execFileSync("pdftoppm", ["-r", "150", "-png", "-f", String(n), "-l", String(n), "-singlefile", pdf, base]);
  return `file://${base}.png`;
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700&display=block');
*{margin:0;box-sizing:border-box} html,body{width:1000px;height:1500px;overflow:hidden}
body{background:#FFF8F0;font-family:'Plus Jakarta Sans',sans-serif;color:#4a3b32;position:relative}
.kicker{position:absolute;left:72px;right:72px;top:78px;font-weight:700;text-transform:uppercase;letter-spacing:3px;color:#b94f1f;font-size:24px}
h1{position:absolute;left:72px;right:72px;top:122px;font-family:Fredoka;font-weight:700;color:#1b120e;font-size:74px;line-height:1.04;letter-spacing:-.5px}
h1 em{font-style:normal;color:#E86C3A}
.page{position:absolute;background-size:cover;background-position:center;border-radius:3px 10px 10px 3px;
  box-shadow:-9px 0 0 #eadccb,0 30px 70px rgba(59,42,36,.28),0 4px 12px rgba(59,42,36,.12)}
.spread{position:absolute;left:50px;width:900px;height:450px;display:flex;border-radius:6px;box-shadow:0 34px 80px rgba(59,42,36,.30),0 4px 12px rgba(59,42,36,.14)}
.spread div{width:450px;height:450px;background-size:cover}
.spread::after{content:"";position:absolute;left:420px;top:0;width:60px;height:100%;
  background:linear-gradient(90deg,rgba(0,0,0,0) 0%,rgba(59,42,36,.20) 48%,rgba(255,255,255,.10) 52%,rgba(0,0,0,0) 100%)}
.facts{position:absolute;left:72px;right:72px;list-style:none;font-size:29px;line-height:1.3;font-weight:600;color:#4a3b32}
.facts li{padding-left:40px;position:relative;margin-bottom:12px}
.facts li::before{content:"";position:absolute;left:4px;top:11px;width:14px;height:14px;border-radius:50%;background:#E86C3A}
.bar{position:absolute;left:0;right:0;bottom:0;height:150px;background:#3b2a24;color:#FFF8F0;display:flex;flex-direction:column;justify-content:center;padding:0 72px}
.bar .price{font-size:27px;font-weight:600;opacity:.92}
.bar .row{display:flex;justify-content:space-between;align-items:center;margin-top:10px}
.bar .url{font-family:Fredoka;font-weight:600;font-size:40px;color:#ffb48f}
.bar img{height:44px;filter:brightness(0) invert(1);opacity:.95}
.date{position:absolute;left:72px;right:72px;height:150px;border-radius:18px;background:#fff;border:3px solid #f1dfcf;display:flex;align-items:center;padding:0 36px;gap:32px}
.date b{font-family:Fredoka;font-weight:700;font-size:44px;color:#E86C3A;min-width:290px}
.date span{font-size:30px;font-weight:600;color:#3b2a24;line-height:1.25}
.letter{position:absolute;left:250px;top:420px;width:500px;border-radius:8px;transform:rotate(-2deg);box-shadow:0 30px 70px rgba(59,42,36,.28),0 4px 12px rgba(59,42,36,.12)}
`;
const doc = (lang, body) => `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}</body></html>`;
const head = (p) => `<div class="kicker">${p.kicker}</div><h1>${p.headline}</h1>`;
const facts = (p, top) => (p.facts?.length ? `<ul class="facts" style="top:${top}px">${p.facts.map((f) => `<li>${f}</li>`).join("")}</ul>` : "");
const bar = (p) => `<div class="bar">${p.price ? `<div class="price">${p.price}</div>` : `<div class="price">${p.lang === "ca" ? "Gratis, sense registre" : "Gratis, sin registro"}</div>`}<div class="row"><span class="url">meapica.es</span><img src="file://${LOGO}"></div></div>`;
const page = (url, l, t, s, rot = 0) => `<div class="page" style="left:${l}px;top:${t}px;width:${s}px;height:${s}px;transform:rotate(${rot}deg);background-image:url('${url}')"></div>`;

const letterShots = {};
async function letterShot(browser, lang) {
  if (letterShots[lang]) return letterShots[lang];
  const tab = await browser.newPage({ viewport: { width: 1280, height: 1400 }, deviceScaleFactor: 2.5 });
  await tab.goto(`https://meapica.es/${lang}/tools/letter-to-the-three-kings`, { waitUntil: "networkidle" });
  await tab.locator("input[type=text]").first().fill(lang === "ca" ? "Júlia" : "Lucía");
  await tab.waitForTimeout(800);
  // The live preview card: the smallest block holding the letter greeting and the A4 caption sits just above it.
  const card = tab.locator(lang === "ca" ? "text=Estimats Reis" : "text=Queridos Reyes Magos").first()
    .locator("xpath=ancestor::*[contains(@class,'shadow') or contains(@class,'border')][1]");
  const file = `${TMP}/letter-${lang}.png`;
  await card.screenshot({ path: file });
  await tab.close();
  return (letterShots[lang] = `file://${file}`);
}

async function pinHtml(p, browser) {
  const L = p.layout;
  if (L === "cover") return head(p) + page(await pageUrl(p.book, 1), 150, 400, 700, -1.5) + facts(p, 1140) + bar(p);
  // Dedication on top so its text reads in full; the cover peeks out behind it.
  if (L === "dedication") return head(p) + page(await pageUrl(p.book, 1), 60, 480, 480, -4) + page(await pageUrl(p.book, 3), 430, 430, 510, 2) + facts(p, 1080) + bar(p);
  if (L === "spread") {
    const [a, b] = p.spread;
    return head(p) + `<div class="spread" style="top:470px"><div style="background-image:url('${await pageUrl(p.book, a)}')"></div><div style="background-image:url('${await pageUrl(p.book, b)}')"></div></div>`
      + page(await pageUrl(p.book, 1), 690, 820, 230, 4) + facts(p, 1120) + bar(p);
  }
  if (L === "portrait") return head(p) + page(await pageUrl(p.book, 29), 400, 410, 520, 2.5) + page(await pageUrl(p.book, 1), 80, 500, 480, -3) + facts(p, 1080) + bar(p);
  if (L === "grid") {
    const pos = [[72, 430, 420, -2], [508, 420, 420, 2], [60, 870, 280, -3], [360, 880, 280, 1.5], [660, 870, 280, -1]];
    let html = head(p);
    for (const [i, k] of p.grid.entries()) html += page(await pageUrl(k, 1), ...pos[i]);
    return html + facts(p, 1200) + bar(p);
  }
  if (L === "dates") {
    let html = head(p) + page(await pageUrl(p.book, 1), 640, 90, 290, 4);
    p.dates.forEach(([k, v], i) => (html += `<div class="date" style="top:${450 + i * 190}px"><b>${k}</b><span>${v}</span></div>`));
    return html.replace("<h1>", '<h1 style="right:400px">') + facts(p, 1050) + bar(p);
  }
  if (L === "letter") return head(p) + `<img class="letter" src="${await letterShot(browser, p.lang)}">` + facts(p, 1160) + bar(p);
  throw new Error(`unknown layout ${L}`);
}

const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1000, height: 1500 } });
const only = process.argv[3];
for (const p of T.pins.filter((x) => !only || x.id === only)) {
  const file = `${TMP}/${p.id}.html`;
  writeFileSync(file, doc(p.lang, await pinHtml(p, browser)));
  await tab.goto(`file://${file}`, { waitUntil: "networkidle" });
  await tab.evaluate(() => document.fonts.ready);
  await sharp(await tab.screenshot({ type: "png" })).flatten({ background: "#FFF8F0" }).jpeg({ quality: 88, mozjpeg: true }).toFile(`${OUT}/${p.id}.jpg`);
  console.log(`${p.id}.jpg`);
}
await browser.close();

// Human-readable sheet for review and for scheduling by hand or through Zernio.
const md = [`# Pinterest pins ${T.date ?? ""} (not scheduled)`, "", T.note ?? "", ""];
for (const p of T.pins) md.push(`## ${p.id}`, "", `![${p.alt}](${p.id}.jpg)`, "", `- **Board:** ${p.board}`, `- **Title:** ${p.title}`, `- **Link:** ${link(p)}`, `- **Alt:** ${p.alt}`, "", p.description, "");
writeFileSync(`${OUT}/pins.md`, md.join("\n"));
