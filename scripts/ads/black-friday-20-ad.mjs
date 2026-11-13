// Black Friday −20 % (13-30 Nov 2026, src/lib/black-friday.ts): one ad in the live Pack Reyes v2 consolidated ad set,
// the hook-b «foto a cuento» creative re-cut with the −20 % offer beat and end card (docs/social/ads/bf20-foto-a-pagina).
// Created through Zernio (our Meta app is in development mode: Graph-created ads get flagged 1885183).
// Run from the repo root: node scripts/ads/black-friday-20-ad.mjs [--dry]   → prints the ad ids; creates it PAUSED.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { uploadMedia } from "../social/zernio.mjs";

const ZKEY = readFileSync(`${homedir()}/.config/zernio/api_key`, "utf8").trim();
const DIR = "docs/ads/creatives/promos/black-friday-20";
const NAME = "mpc_meta_black-friday-20_es_q4-26_ad_hook-b_foto-a-cuento";
const link = new URL("https://meapica.es/es");
for (const [k, v] of Object.entries({ utm_source: "meta", utm_medium: "paid", utm_campaign: "black-friday-20_q4-26", utm_content: NAME })) link.searchParams.set(k, v);

const body = [
  "Una foto suya… y es el protagonista de su cuento.",
  "Black Friday: −20 % en su cuento personalizado hasta el 30 de noviembre. Tapa blanda a 27,92 € y tapa dura a 39,92 €, IVA incluido y envío gratis a península y Baleares. Precios más bajos de los últimos 30 días: 34,90 € y 49,90 €.",
  "Su nombre en la portada y su cara en cada ilustración. Tú eliges su aventura y ves la portada antes de pagar.",
  "Foto y escenas recreadas con IA a partir de nuestro libro de ejemplo.",
].join("\n\n");

const dry = process.argv.includes("--dry");
const [u916, u45] = dry ? ["<9x16>", "<4x5>"] : [await uploadMedia(`${DIR}/black-friday-20-hook-b-9x16.mp4`), await uploadMedia(`${DIR}/black-friday-20-hook-b-4x5.mp4`)];
const req = {
  accountId: "6abe75171e59dae1ae8b2be1", adAccountId: "act_2479938985822992", adSetId: "120252499122780661",
  name: NAME, adName: NAME, headline: "Black Friday: −20 % en su cuento", description: "Hasta el 30/11 · IVA incluido",
  body, callToAction: "SHOP_NOW", linkUrl: link.toString(), adStatus: "PAUSED", status: "PAUSED",
  tracking: { pixelId: "1830635711690297" }, aiDisclosure: "OPT_IN", multiAdvertiser: "OPT_OUT",
  placementAssets: {
    defaultVideoUrl: u916,
    rules: [{ videoUrl: u45, placements: { publisherPlatforms: ["facebook", "instagram"], facebookPositions: ["feed", "profile_feed"], instagramPositions: ["stream", "profile_feed"] } }],
  },
};
if (dry) { console.log(JSON.stringify(req, null, 1)); process.exit(0); }
const res = await fetch("https://zernio.com/api/v1/ads/create", { method: "POST", headers: { Authorization: `Bearer ${ZKEY}`, "Content-Type": "application/json" }, body: JSON.stringify(req) });
const out = await res.json();
const ad = out.ad ?? out.data ?? out;
console.log(res.status, JSON.stringify({ zernio: ad._id ?? ad.id, meta: ad.platformAdId ?? ad.platformId ?? ad.adId, status: ad.status, error: out.error }));
