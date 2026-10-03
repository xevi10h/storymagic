// Builds the media of the first organic posts (3 Oct 2026) into docs/social/2026-10-03-first-posts/:
//   post1.mp4            ES story video (copied from the ad, already 9:16 H.264/AAC, price card with VAT)
//   post2-slide{1..8}.png CA carousel "Així és un llibre Meapica per dins" (1080×1350) from the REAL
//                         Noa CA example book: pages rasterised from the public example PDF
//                         (/api/showcase/{id}/pdf, the same pages a customer gets printed)
//   post3.png            ES static "Su nombre, en la portada" (copied, already 1080×1350)
// Run from the repo root (needs pdftoppm from poppler):
//   node scripts/social/render-first-posts.mjs
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";

const ROOT = process.cwd();
const OUT = `${ROOT}/docs/social/2026-10-03-first-posts`;
const TMP = `${OUT}/.build`;
const NOA_CA_ID = "5dfc4f5e-9a42-4ae5-a42b-a821d36c2f01";
const LOGO = `${ROOT}/docs/ads/creatives/assets/logo-brown.png`;
mkdirSync(TMP, { recursive: true });

// ── Post 1 + 3: existing creatives, checked and copied ─────────────────────────
copyFileSync(`${ROOT}/docs/ads/creatives/story/ad-story-es-sound.mp4`, `${OUT}/post1.mp4`);
copyFileSync(`${ROOT}/docs/ads/creatives/static-name-es.png`, `${OUT}/post3.png`);

// ── Post 2: real pages of the Noa CA example book ──────────────────────────────
// PDF page numbers (34 pages: cover, endpaper, 30 inner pages, endpaper, back cover).
const PAGES = { cover: 1, dedication: 3, home: 4, homeText: 5, forest: 10, forestText: 11, playL: 18, playR: 19, care: 22, careText: 23, hero: 29 };
const pdf = `${TMP}/noa-ca.pdf`;
if (!existsSync(pdf)) {
  const res = await fetch(`https://meapica.shop/api/showcase/${NOA_CA_ID}/pdf`);
  if (!res.ok) throw new Error(`example PDF: HTTP ${res.status}`);
  writeFileSync(pdf, Buffer.from(await res.arrayBuffer()));
}
const page = {};
for (const [key, n] of Object.entries(PAGES)) {
  const base = `${TMP}/p${n}`;
  if (!existsSync(`${base}.png`)) execFileSync("pdftoppm", ["-r", "200", "-png", "-f", String(n), "-l", String(n), "-singlefile", pdf, base]);
  // 1575 px square at 200 dpi → 1100 px JPEG keeps the slide crisp at the largest use (~880 px).
  const jpg = `${TMP}/${key}.jpg`;
  await sharp(`${base}.png`).resize(1100, 1100).jpeg({ quality: 90 }).toFile(jpg);
  page[key] = `file://${jpg}`;
}
// The paper-coloured text pages carry their own thin frame; the book needs a page edge on paper bg.

const T = {
  example: "Exemple · El llibre de la Noa, 4 anys",
  slides: [
    { kind: "cover", kicker: "Exemple real", title: "Així és un llibre<br><em>Meapica per dins</em>", sub: "Llisca i passa les pàgines" },
    { kind: "single", img: "dedication", kicker: "La dedicatòria", title: "La primera pàgina<br><em>l'escrius tu</em>", sub: "S'imprimeix tal com l'escrius, amb el seu nom." },
    { kind: "spread", l: "home", r: "homeText", kicker: "Capítol 1", title: "La història comença<br><em>a casa seva</em>", sub: "Cada escena, pintada a l'aquarel·la, amb el seu text al costat." },
    { kind: "spread", l: "forest", r: "forestText", kicker: "Escrit per a la seva edat", title: "Frases curtes<br><em>i lletra gran</em>", sub: "Als 4 anys, així. Als 11, gairebé una novel·la." },
    { kind: "spread", l: "playL", r: "playR", kicker: "Doble pàgina", title: "Algunes escenes<br><em>ocupen tot el llibre obert</em>", sub: "20 × 20 cm per pàgina. Obert, 40 cm de bosc." },
    { kind: "spread", l: "care", r: "careText", kicker: "Tu tries l'aventura", title: "Tu decideixes<br><em>els tres capítols</em>", sub: "Cada tria canvia la història i les pàgines pintades." },
    { kind: "single", img: "hero", kicker: "Al final del llibre", title: "El seu retrat,<br><em>pintat a l'aquarel·la</em>", sub: "Amb el seu nom, l'edat i el seu color preferit." },
    { kind: "cta" },
  ],
  cta: {
    title: "Ara, <em>el seu</em> llibre.",
    lines: ["El seu nom a la portada, la seva cara a cada pàgina i l'aventura que tries tu."],
    preview: "Abans de pagar en veus la portada i les primeres pàgines, sense registrar-te.",
    price: "Des de 34,90 € IVA inclòs · Enviament gratuït",
    url: "meapica.shop",
  },
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700&display=block');
*{margin:0;box-sizing:border-box} html,body{width:1080px;height:1350px;overflow:hidden}
body{background:#FFF8F0;font-family:'Plus Jakarta Sans',sans-serif;color:#4a3b32;position:relative}
.kicker{position:absolute;left:80px;top:84px;font-weight:700;text-transform:uppercase;letter-spacing:3px;color:#b94f1f;font-size:22px}
h1{position:absolute;left:80px;right:80px;top:124px;font-family:Fredoka;font-weight:700;color:#1b120e;font-size:66px;line-height:1.06;letter-spacing:-.5px}
h1 em{font-style:normal;color:#E86C3A}
.sub{position:absolute;left:80px;right:80px;font-size:30px;line-height:1.4;font-weight:500;color:#6b5850}
.foot{position:absolute;left:80px;right:80px;bottom:56px;display:flex;justify-content:space-between;align-items:center;font-size:21px;font-weight:600;color:#7a6963}
.foot .n{font-variant-numeric:tabular-nums}
/* one square page on the table */
.page{position:absolute;background-size:cover;border-radius:3px 10px 10px 3px;box-shadow:-8px 0 0 #eadccb,0 30px 70px rgba(59,42,36,.28),0 4px 12px rgba(59,42,36,.12)}
/* open book: two square pages with a soft gutter */
.spread{position:absolute;left:40px;width:1000px;height:500px;display:flex;border-radius:6px;box-shadow:0 34px 80px rgba(59,42,36,.30),0 4px 12px rgba(59,42,36,.14)}
.spread .l,.spread .r{width:500px;height:500px;background-size:cover}
.spread .l{border-radius:6px 0 0 6px}.spread .r{border-radius:0 6px 6px 0}
.spread::after{content:"";position:absolute;left:470px;top:0;width:60px;height:100%;
  background:linear-gradient(90deg,rgba(0,0,0,0) 0%,rgba(59,42,36,.20) 48%,rgba(255,255,255,.10) 52%,rgba(0,0,0,0) 100%)}
.cover-logo{position:absolute;right:80px;top:70px;height:46px}
.swipe{display:inline-flex;align-items:center;gap:12px}
.swipe b{font-family:Fredoka;font-weight:600;color:#b94f1f;font-size:34px}
/* CTA */
.cta .logo{position:absolute;left:50%;transform:translateX(-50%);top:150px;height:80px}
.cta h1{top:300px;text-align:center;font-size:84px}
.cta .copy{position:absolute;left:110px;right:110px;top:440px;text-align:center;font-size:34px;line-height:1.45;color:#4a3b32;font-weight:500}
.cta .book{position:absolute;left:330px;top:640px;width:420px;height:420px;transform:rotate(-2deg)}
.cta .price{position:absolute;left:0;right:0;top:1120px;text-align:center;font-size:30px;font-weight:600;color:#5D4037}
.cta .url{position:absolute;left:50%;transform:translateX(-50%);top:1190px;font-family:Fredoka;font-weight:600;font-size:44px;color:#b94f1f;
  border:3px solid #E86C3A;background:#fdf1ea;border-radius:999px;padding:10px 46px;white-space:nowrap}
`;

const doc = (body, cls = "") => `<!doctype html><html lang="ca"><head><meta charset="utf-8"><style>${CSS}</style></head><body class="${cls}">${body}</body></html>`;
const total = T.slides.length;
const foot = (i) => `<div class="foot"><span>${T.example}</span><span class="n">${i + 1}/${total}</span></div>`;

function slideHtml(s, i) {
  if (s.kind === "cover") {
    return doc(`<img class="cover-logo" src="file://${LOGO}"><div class="kicker">${s.kicker}</div><h1>${s.title}</h1>
      <div class="page" style="left:150px;top:350px;width:780px;height:780px;transform:rotate(-1.5deg);background-image:url('${page.cover}')"></div>
      <div class="foot"><span>${T.example}</span><span class="swipe"><b>${s.sub} →</b></span></div>`);
  }
  if (s.kind === "single") {
    return doc(`<div class="kicker">${s.kicker}</div><h1>${s.title}</h1>
      <div class="page" style="left:170px;top:340px;width:740px;height:740px;background-image:url('${page[s.img]}')"></div>
      <div class="sub" style="top:1130px;text-align:center">${s.sub}</div>${foot(i)}`);
  }
  if (s.kind === "spread") {
    return doc(`<div class="kicker">${s.kicker}</div><h1>${s.title}</h1>
      <div class="spread" style="top:480px"><div class="l" style="background-image:url('${page[s.l]}')"></div><div class="r" style="background-image:url('${page[s.r]}')"></div></div>
      <div class="sub" style="top:1050px;text-align:center">${s.sub}</div>${foot(i)}`);
  }
  const c = T.cta;
  return doc(`<img class="logo" src="file://${LOGO}"><h1>${c.title}</h1>
    <div class="copy">${c.lines.join("<br>")}<br><b>${c.preview}</b></div>
    <div class="page book" style="background-image:url('${page.cover}')"></div>
    <div class="price">${c.price}</div><div class="url">${c.url}</div>`, "cta");
}

const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
for (const [i, s] of T.slides.entries()) {
  const file = `${TMP}/slide${i + 1}.html`;
  writeFileSync(file, slideHtml(s, i));
  await tab.goto(`file://${file}`, { waitUntil: "networkidle" });
  await tab.evaluate(() => document.fonts.ready);
  const png = await tab.screenshot({ type: "png" });
  // Flatten to sRGB PNG without alpha (Instagram rejects some alpha PNGs in carousels).
  await sharp(png).flatten({ background: "#FFF8F0" }).png({ compressionLevel: 9 }).toFile(`${OUT}/post2-slide${i + 1}.png`);
}
await browser.close();
console.log(`built ${total} slides + post1.mp4 + post3.png in ${OUT}`);
