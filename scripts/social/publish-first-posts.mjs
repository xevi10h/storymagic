// First organic posts (3 Oct 2026) on Instagram + TikTok + Facebook through Zernio.
// Media: docs/social/2026-10-03-first-posts/ (built by scripts/social/render-first-posts.mjs).
// API: https://zernio.com/api/v1 (OpenAPI v1.210.1, read 2026-10-03). Key: ~/.config/zernio/api_key (never printed).
//
//   node scripts/social/publish-first-posts.mjs                 # --dry-run (default): accounts + health, upload media to
//                                                               #   Zernio temp storage (expires in 7 days, not public on any
//                                                               #   network), validate media + post bodies, TikTok dryRun,
//                                                               #   print the exact request bodies. Creates NO post.
//   node scripts/social/publish-first-posts.mjs --publish       # publish all 3 posts NOW (post 1, then 2, then 3)
//   options: --post=1,3  only these posts · --only=tiktok,facebook  only these platforms
//            --docs  rewrite captions.md + preview.html from the definitions below (no network)
//
// Post order: 1 → 2 → 3, so the Instagram grid row reads (left → right) static · carousel · video.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, extname } from "node:path";

const API = "https://zernio.com/api/v1";
const DIR = `${process.cwd()}/docs/social/2026-10-03-first-posts`;
const CACHE = `${DIR}/.zernio-uploads.json`;
const args = process.argv.slice(2);
const PUBLISH = args.includes("--publish");
const DOCS = args.includes("--docs");
const argList = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1].split(",").map((s) => s.trim());
const ONLY_POSTS = argList("post")?.map(Number);
const ONLY_PLATFORMS = argList("only");

// ── Links ─────────────────────────────────────────────────────────────────────
// Facebook captions carry a clickable UTM link; Instagram points to the bio; TikTok (no bio link
// until it is a Business account with 1k followers) writes meapica.shop in plain text.
const fbLink = (lang, content) =>
  `https://meapica.shop/${lang}?utm_source=facebook&utm_medium=organic_social&utm_campaign=org_q4-26&utm_content=${content}&lang=${lang}`;
const BIO_LINKS = {
  instagram: "https://meapica.shop/es?utm_source=instagram_organic&utm_medium=organic_social&utm_campaign=org_q4-26&utm_content=bio&lang=es",
  tiktok: "https://meapica.shop/es?utm_source=tiktok&utm_medium=organic_social&utm_campaign=org_q4-26&utm_content=bio&lang=es",
};

// ── Posts (single source of truth for the captions.md / preview.html) ─────────
const POSTS = [
  {
    n: 1,
    id: "org_w0sat_es_video",
    title: "ES · Reel / TikTok / FB Reel · «Ella es la protagonista» (21 s)",
    media: [{ file: "post1.mp4", type: "video" }],
    ig: `Un cuento en el que ella es la protagonista: su nombre en la portada, su cara pintada en acuarela en cada página y la aventura que eliges tú.

Antes de pagar ves su portada, su retrato y las primeras páginas pintadas, sin registrarte. Desde 34,90 € IVA incluido, con envío gratis a península y Baleares.

Escena dramatizada. El libro es real: nuestro ejemplo «Noa y la llave de flor».
Crea el suyo: link en la bio.

#cuentospersonalizados #cuentosinfantiles #regalosparaniños #librosinfantiles`,
    fbLink: fbLink("es", "org_fb_w0sat_es_video"),
    tiktok: `Ella es la protagonista de su cuento: su nombre en la portada y su cara pintada en cada página. Escena dramatizada, libro de ejemplo real. Crea el suyo en meapica.shop

#cuentospersonalizados #cuentosinfantiles #regalosparaniños`,
    coverMs: 15000, // Noa's watercolour close-up: the strongest grid / feed cover
    aiVideo: true, // photorealistic dramatised people are generated: platform disclosure (decision flagged to owner)
  },
  {
    n: 2,
    id: "org_w0sat_ca_carousel",
    title: "CA · Carrusel IG / TikTok foto / FB multi-imatge · «Així és un llibre Meapica per dins» (8)",
    media: Array.from({ length: 8 }, (_, i) => ({ file: `post2-slide${i + 1}.png`, type: "image" })),
    alt: [
      "Portada del llibre d'exemple «La Noa i la clau de flor»: la Noa, pèl-roja, amb un cofre al bosc entre esquirols.",
      "Pàgina de títol i dedicatòria: «Per a la Noa, que parla amb els arbres i riu amb els ocells».",
      "Doble pàgina: la Noa jugant a casa amb una galleda groga, i el text «A casa».",
      "Doble pàgina: la Noa entra al Bosc Màgic amb un mussol, i el text «Entre arrels».",
      "Escena a doble pàgina: la Noa i els esquirols jugant entre bolets vermells.",
      "Doble pàgina: la Noa obre el cofre amb el mussol i els esquirols, i el text «Cuidar el bosc».",
      "Retrat a l'aquarel·la de la Noa al final del llibre.",
      "Logo de Meapica, la portada del llibre i el preu: des de 34,90 € IVA inclòs, enviament gratuït. meapica.shop",
    ],
    ig: `Així és per dins el llibre de la Noa, de 4 anys: la portada amb el seu nom, la dedicatòria, les escenes pintades a l'aquarel·la amb el seu text i, al final, el seu retrat. Llisca fins al final.

Exemple real creat a Meapica. Abans de pagar veus la portada, el retrat i les primeres pàgines pintades del llibre del teu fill o la teva filla. Des de 34,90 € IVA inclòs, enviament gratuït a la Península i les Balears.

Crea el seu: enllaç a la bio.

#contesinfantils #contepersonalitzat #llibresencatala #regalsperanens`,
    fbLink: fbLink("ca", "org_fb_w0sat_ca_carousel"),
    tiktokTitle: "Així és un llibre Meapica per dins",
    tiktok: `El llibre d'exemple de la Noa, 4 anys: la portada amb el seu nom, la dedicatòria, les escenes pintades a l'aquarel·la i el seu retrat. Crea el del teu fill o filla a meapica.shop

#contesinfantils #contepersonalitzat #llibresencatala`,
  },
  {
    n: 3,
    id: "org_w0sat_es_static",
    title: "ES · Imagen IG / TikTok foto / FB · «Su nombre, en la portada»",
    media: [{ file: "post3.png", type: "image" }],
    alt: ["Dos cuentos de ejemplo con el nombre en la portada, Noa y Leo. Desde 34,90 € IVA incluido, envío gratis."],
    ig: `Escribe su nombre y aparece en la portada de su cuento. Y su cara, pintada en acuarela, en cada página.

Antes de pagar ves la portada, su retrato y las primeras páginas pintadas, sin registrarte. Tapa blanda 34,90 € IVA incluido · Tapa dura 49,90 € IVA incluido · Envío gratis a península y Baleares.

Ejemplos: los libros de Noa y Leo.
Prueba con su nombre: link en la bio.

#cuentospersonalizados #regalosparaniños #cuentosinfantiles #regalooriginal`,
    fbLink: fbLink("es", "org_fb_w0sat_es_static"),
    tiktokTitle: "Su nombre, en la portada de su cuento",
    tiktok: `Escribe su nombre y aparece en la portada. Y su cara, pintada en acuarela, en cada página. Ejemplos: los libros de Noa y Leo. Prueba con el suyo en meapica.shop

#cuentospersonalizados #regalosparaniños #cuentosinfantiles`,
  },
];

/** Facebook caption = the Instagram one with the bio pointer replaced by the clickable link. */
const fbCaption = (p) =>
  p.ig
    .replace("Crea el suyo: link en la bio.", `Crea el suyo: ${p.fbLink}`)
    .replace("Crea el seu: enllaç a la bio.", `Crea el seu: ${p.fbLink}`)
    .replace("Prueba con su nombre: link en la bio.", `Prueba con su nombre: ${p.fbLink}`);

// ── Request bodies (checked against POST /v1/posts in the OpenAPI spec) ──────
function buildBody(p, accounts, urls) {
  const isVideo = p.media[0].type === "video";
  const mediaItems = p.media.map((m, i) => ({ type: m.type, url: urls[m.file], ...(p.alt?.[i] ? { altText: p.alt[i] } : {}) }));
  const platforms = [];
  if (accounts.instagram) {
    platforms.push({
      platform: "instagram",
      accountId: accounts.instagram._id,
      // 1 video = Reel, 2-10 items = carousel, 1 image = feed post (Zernio infers it; contentType only takes "story").
      platformSpecificData: isVideo ? { shareToFeed: true, thumbOffset: p.coverMs, isAiGenerated: !!p.aiVideo } : {},
    });
  }
  if (accounts.facebook) {
    platforms.push({
      platform: "facebook",
      accountId: accounts.facebook._id,
      customContent: fbCaption(p),
      // Video as a Page Reel (9:16, ≤ 60 s); images as a multi-image feed post (≤ 10).
      platformSpecificData: isVideo ? { contentType: "reel" } : {},
    });
  }
  if (accounts.tiktok) {
    const tt = {
      privacyLevel: "PUBLIC_TO_EVERYONE", // creator-info: the only level for Business-lane videos
      allowComment: true,
      commercialContentType: "brand_organic", // our own brand promoting its product ("Your brand")
      contentPreviewConfirmed: true,
      expressConsentGiven: true,
    };
    if (isVideo) Object.assign(tt, { mediaType: "video", allowDuet: true, allowStitch: true, videoCoverTimestampMs: p.coverMs, videoMadeWithAi: !!p.aiVideo });
    else Object.assign(tt, { mediaType: "photo", photoCoverIndex: 0, description: p.tiktok });
    platforms.push({
      platform: "tiktok",
      accountId: accounts.tiktok._id,
      // Photo posts: content becomes the ≤ 90-char title (hashtags/URLs stripped), the caption goes in description.
      customContent: isVideo ? p.tiktok : p.tiktokTitle,
      platformSpecificData: tt,
    });
  }
  return { content: p.ig, mediaItems, platforms, publishNow: true, timezone: "Europe/Madrid" };
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
const KEY_FILE = `${homedir()}/.config/zernio/api_key`;
let KEY = null;
async function api(method, path, body, extraHeaders = {}) {
  KEY ??= readFileSync(KEY_FILE, "utf8").trim();
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, ...(body ? { "Content-Type": "application/json" } : {}), ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 500) }; }
  return { status: res.status, json };
}
/** Deterministic UUID from a string: re-running --publish never double-posts within Zernio's 24 h window. */
function idemKey(s) {
  const h = createHash("sha1").update(s).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const MIME = { ".mp4": "video/mp4", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

async function uploadAll(files) {
  const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
  const urls = {};
  for (const file of files) {
    const path = `${DIR}/${file}`;
    const { size, mtimeMs } = statSync(path);
    const hit = cache[file];
    // Zernio temp uploads expire after 7 days: reuse for 6 days if the file did not change.
    if (hit && hit.size === size && hit.mtimeMs === mtimeMs && Date.now() - hit.uploadedAt < 6 * 864e5) {
      urls[file] = hit.publicUrl;
      console.log(`  media ${file}: cached ${hit.publicUrl}`);
      continue;
    }
    const contentType = MIME[extname(file).toLowerCase()];
    const pre = await api("POST", "/media/presign", { filename: basename(file), contentType, size });
    if (pre.status !== 200 || !pre.json.uploadUrl) throw new Error(`presign ${file}: HTTP ${pre.status} ${JSON.stringify(pre.json)}`);
    const put = await fetch(pre.json.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: readFileSync(path) });
    if (!put.ok) throw new Error(`upload ${file}: HTTP ${put.status}`);
    urls[file] = pre.json.publicUrl;
    cache[file] = { publicUrl: pre.json.publicUrl, size, mtimeMs, uploadedAt: Date.now() };
    writeFileSync(CACHE, JSON.stringify(cache, null, 2));
    console.log(`  media ${file}: uploaded ${pre.json.publicUrl}`);
  }
  return urls;
}

// ── captions.md + preview.html ────────────────────────────────────────────────
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function writeDocs() {
  const md = [
    "# First posts · Sat 3 Oct 2026 · Instagram @meapica_books · TikTok @meapica_books · Facebook Meapica",
    "",
    "Generated by `node scripts/social/publish-first-posts.mjs --docs` (source of truth: `POSTS` in that script).",
    "Publish order 1 → 2 → 3 (IG grid row reads static · carousel · video).",
    "",
    `- Instagram bio link: \`${BIO_LINKS.instagram}\``,
    `- TikTok bio link (once the bio link is available): \`${BIO_LINKS.tiktok}\``,
    "",
  ];
  for (const p of POSTS) {
    md.push(`## Post ${p.n} · ${p.title}`, "", `Media: ${p.media.map((m) => `\`${m.file}\``).join(", ")}`, "");
    md.push("### Instagram", "", "```text", p.ig, "```", "", "### Facebook", "", "```text", fbCaption(p), "```", "");
    md.push("### TikTok", "");
    if (p.tiktokTitle) md.push(`Title (≤ 90, no hashtags): **${p.tiktokTitle}**`, "");
    md.push("```text", p.tiktok, "```", "");
    if (p.alt) md.push("Alt text:", "", ...p.alt.map((a, i) => `${i + 1}. ${a}`), "");
  }
  writeFileSync(`${DIR}/captions.md`, md.join("\n"));

  const mediaHtml = (p) =>
    p.media[0].type === "video"
      ? `<video src="${p.media[0].file}" controls playsinline muted loop preload="metadata"></video>`
      : `<div class="car">${p.media.map((m, i) => `<img src="${m.file}" alt="${esc(p.alt?.[i] ?? "")}" loading="lazy">`).join("")}</div>`;
  const cap = (label, text, title) =>
    `<div class="cap"><div class="pl">${label}</div>${title ? `<p class="tt">${esc(title)}</p>` : ""}<p>${esc(text)}</p></div>`;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Meapica first posts</title>
<style>
:root{--paper:#FFF8F0;--surface:#fff;--ink:#1b120e;--soft:#4a3b32;--muted:#7a6963;--line:#f3ebe7;--brand:#E86C3A;--brand-text:#b94f1f}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--paper:#1b1512;--surface:#26201c;--ink:#f6efe9;--soft:#e2d6cc;--muted:#b3a59a;--line:#3a312b;--brand-text:#f29a6f}}
:root[data-theme="dark"]{--paper:#1b1512;--surface:#26201c;--ink:#f6efe9;--soft:#e2d6cc;--muted:#b3a59a;--line:#3a312b;--brand-text:#f29a6f}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--soft);font:15px/1.5 system-ui,-apple-system,sans-serif}
main{max-width:1180px;margin:0 auto;padding:32px 16px 64px}h1{color:var(--ink);font-size:26px;margin:0 0 4px}
.meta{color:var(--muted);margin:0 0 28px}section{border-top:1px solid var(--line);padding:28px 0}
h2{color:var(--ink);font-size:19px;margin:0 0 16px}.row{display:grid;grid-template-columns:minmax(0,360px) minmax(0,1fr);gap:24px}
@media (max-width:760px){.row{grid-template-columns:minmax(0,1fr)}}
video{width:100%;max-width:360px;aspect-ratio:9/16;border-radius:12px;background:#000}
.car{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:6px}
.car img{flex:0 0 100%;width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:10px;scroll-snap-align:start;border:1px solid var(--line)}
.caps{display:grid;gap:12px}.cap{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.pl{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--brand-text);margin-bottom:6px}
.cap p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.cap .tt{font-weight:700;color:var(--ink);margin-bottom:6px}
.hint{color:var(--muted);font-size:13px;margin-top:6px}
</style></head><body><main>
<h1>Meapica · primeros posts</h1><p class="meta">Sábado 3 oct 2026 · Instagram + TikTok @meapica_books · Facebook Meapica · orden de publicación 1 → 2 → 3</p>
${POSTS.map((p) => `<section><h2>Post ${p.n} · ${esc(p.title)}</h2><div class="row"><div>${mediaHtml(p)}${p.media.length > 1 ? `<p class="hint">Desliza: ${p.media.length} imágenes</p>` : ""}</div>
<div class="caps">${cap("Instagram", p.ig)}${cap("Facebook", fbCaption(p))}${cap("TikTok", p.tiktok, p.tiktokTitle)}</div></div></section>`).join("\n")}
</main></body></html>`;
  writeFileSync(`${DIR}/preview.html`, html);
  console.log(`wrote ${DIR}/captions.md and preview.html`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
if (DOCS) {
  writeDocs();
  process.exit(0);
}
console.log(PUBLISH ? "MODE: PUBLISH (posts go live now)" : "MODE: dry run (no post is created)");

const acc = await api("GET", "/accounts");
if (acc.status !== 200) throw new Error(`accounts: HTTP ${acc.status}`);
const pick = (platform, match) => acc.json.accounts.find((a) => a.platform === platform && match(a));
const accounts = {
  instagram: pick("instagram", (a) => a.username === "meapica_books"),
  tiktok: pick("tiktok", (a) => a.username === "meapica_books"),
  facebook: pick("facebook", (a) => a.displayName === "Meapica"),
};
let blocked = false;
for (const [platform, a] of Object.entries(accounts)) {
  if (ONLY_PLATFORMS && !ONLY_PLATFORMS.includes(platform)) { delete accounts[platform]; continue; }
  if (!a) { console.log(`  ${platform}: account NOT FOUND`); blocked = true; continue; }
  const h = await api("GET", `/accounts/${a._id}/health`);
  const status = h.json.status ?? `HTTP ${h.status}`;
  console.log(`  ${platform}: ${a._id} @${a.username} (${a.displayName}) health=${status}${status !== "healthy" ? ` ${JSON.stringify(h.json.issues ?? h.json.tokenStatus ?? "")}` : ""}`);
  if (status === "error") blocked = true;
}
if (blocked && PUBLISH) {
  console.error("\nAborted: an account is missing or unhealthy (reconnect it in Zernio, or exclude it with --only=…). Nothing was published.");
  process.exit(1);
}

const posts = POSTS.filter((p) => !ONLY_POSTS || ONLY_POSTS.includes(p.n));
const urls = await uploadAll([...new Set(posts.flatMap((p) => p.media.map((m) => m.file)))]);

if (!PUBLISH) {
  for (const [file, url] of Object.entries(urls)) {
    const v = await api("POST", "/tools/validate/media", { url });
    const limits = Object.entries(v.json.platformLimits ?? {})
      .filter(([k]) => ["instagram", "tiktok", "facebook"].includes(k))
      .map(([k, l]) => `${k}:${l.withinLimit ? "ok" : "TOO BIG"}`).join(" ");
    console.log(`  validate media ${file}: valid=${v.json.valid} ${v.json.contentType ?? ""} ${v.json.sizeFormatted ?? ""} ${limits} ${v.json.error ?? ""}`);
  }
}

for (const p of posts) {
  const body = buildBody(p, accounts, urls);
  console.log(`\n── Post ${p.n} (${p.id}) ── POST ${API}/posts  Idempotency-Key: ${idemKey(`meapica-${p.id}-2026-10-03-${Object.keys(accounts).sort().join("+")}`)}`);
  console.log(JSON.stringify(body, null, 2));
  if (!PUBLISH) {
    const v = await api("POST", "/tools/validate/post", body);
    console.log(`  validate post: HTTP ${v.status} valid=${v.json.valid} ${JSON.stringify(v.json.errors ?? [])} warnings=${JSON.stringify(v.json.warnings ?? [])}`);
    if (body.platforms.some((x) => x.platform === "tiktok")) {
      // dryRun: TikTok-only publishability check; Zernio persists nothing. publishNow is left out on purpose.
      const { publishNow, ...rest } = body;
      const d = await api("POST", "/posts", { ...rest, dryRun: true });
      console.log(`  tiktok dryRun: HTTP ${d.status} ${JSON.stringify(d.json)}`);
      if (d.status === 201 && d.json.post?._id) {
        await api("DELETE", `/posts/${d.json.post._id}`);
        console.log(`  WARNING: dryRun created post ${d.json.post._id}; deleted it.`);
      }
    }
    continue;
  }
  const r = await api("POST", "/posts", body, { "Idempotency-Key": idemKey(`meapica-${p.id}-2026-10-03-${Object.keys(accounts).sort().join("+")}`) });
  const post = r.json.post;
  console.log(`  HTTP ${r.status} status=${post?.status ?? "?"} ${r.status >= 400 ? JSON.stringify(r.json) : ""}`);
  for (const x of post?.platforms ?? []) console.log(`   ${x.platform}: ${x.status} ${x.platformPostUrl ?? ""} ${x.errorMessage ?? ""}`);
}
