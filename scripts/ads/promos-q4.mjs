// Q4 2026 promotions on Meta: one ABO campaign per promotion, two ad sets (hook A / hook B) with the same
// audience, placements, optimisation and 5 €/day each, scheduled to the promotion window (Europe/Madrid).
// Everything is created PAUSED. Plan and ids: docs/ads/promotions-q4-2026.md.
//   node scripts/ads/promos-q4.mjs structure   → campaigns + ad sets through Graph (idempotent by name)
//   node scripts/ads/promos-q4.mjs ads         → the two ads per promotion through Zernio (attach shape, PAUSED)
//   node scripts/ads/promos-q4.mjs verify      → reads every object back from Graph
// Token: ~/.config/meapica/meta_token (Graph v26). Zernio key: ~/.config/zernio/api_key.
// Ads go through Zernio because our Meta app is in development mode (Graph refuses creatives, subcode 1885183).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { uploadMedia as zUpload } from "../social/zernio.mjs";

const G = "https://graph.facebook.com/v26.0";
const ACT = "act_2479938985822992";
const TOKEN = readFileSync(`${homedir()}/.config/meapica/meta_token`, "utf8").trim();
const ZKEY = readFileSync(`${homedir()}/.config/zernio/api_key`, "utf8").trim();
const Z = "https://zernio.com/api/v1";
const PIXEL = "1830635711690297"; // "Meapica web"
const REF_ADSET = "120252257133430661"; // targeting copied byte for byte from the live warm-up ad set
const STATE = new URL("../../docs/ads/promotions-q4-2026.ids.json", import.meta.url).pathname;
const CREATIVES = "docs/ads/creatives/promos";

// Shared copy: only `hook` differs between A and B. Primary text = hook + "\n\n" + body.
export const PROMOS = [
  {
    slug: "pack-reyes",
    start: null, // = creation time; PAUSED until the owner switches it on after the Pack Reyes deploy
    end: "2026-11-22T23:59:00+0100",
    link: "https://meapica.es/es",
    headline: "El 2.º cuento a 19,90 € IVA incluido",
    description: "Ves su libro antes de pagar",
    cta: "SHOP_NOW",
    body:
      "Por cada libro impreso que pidas hasta el 22 de diciembre, te llevas un código para un segundo cuento en tapa blanda a 19,90 € IVA incluido, para otro niño o con otra aventura. Válido hasta el 6 de enero.\n\nSu nombre en la portada y su cara en cada ilustración. Ves la portada antes de pagar. Tapa blanda desde 34,90 € IVA incluido, envío gratis a península y Baleares.\n\nEscenas recreadas con nuestros libros de ejemplo.",
    hooks: {
      a: { name: "familia", text: "Un cuento para cada niño de la familia." },
      b: { name: "precio", text: "El segundo cuento, a 19,90 € IVA incluido." },
    },
  },
  {
    slug: "black-friday",
    start: "2026-11-23T00:00:00+0100",
    end: "2026-11-30T23:59:00+0100",
    link: "https://meapica.es/es",
    headline: "Black Friday: 2.º a 19,90 € IVA incluido",
    description: "Ves su libro antes de pagar",
    cta: "SHOP_NOW",
    body: null, // = pack-reyes body (same offer)
    hooks: {
      a: { name: "precio", text: "Nuestro Black Friday: el segundo cuento, a 19,90 € IVA incluido." },
      b: { name: "familia", text: "Este Black Friday, un cuento para cada niño de la familia." },
    },
  },
  {
    slug: "paje-real",
    start: "2026-12-01T00:00:00+0100",
    end: "2026-12-22T23:59:00+0100",
    link: "https://meapica.es/es/create?template=reyes",
    headline: "Paje Real por una noche",
    description: "Historia de Reyes, solo hasta el 6 de enero",
    cta: "SHOP_NOW",
    body:
      "«Paje Real por una noche»: la noche del 5 de enero, los Reyes Magos necesitan ayuda para repartir los regalos antes del amanecer. El Paje Real lleva su nombre y su cara en cada ilustración, y tú eliges su aventura.\n\nUna historia exclusiva de Reyes: se puede pedir solo hasta el 6 de enero. Para tenerlo impreso en Reyes, pídelo hasta el 22 de diciembre. Tapa blanda desde 34,90 € IVA incluido, envío gratis. Ves la portada antes de pagar.\n\nIlustraciones de un libro de ejemplo.",
    hooks: {
      a: { name: "reyes-ayuda", text: "Esta Noche de Reyes, los Reyes Magos necesitan un Paje Real." },
      b: { name: "su-nombre", text: "Este año, el Paje Real de los Reyes Magos lleva su nombre." },
    },
  },
  {
    slug: "ultima-llamada",
    start: "2026-12-15T00:00:00+0100",
    end: "2026-12-22T23:59:00+0100",
    link: "https://meapica.es/es/christmas-delivery",
    headline: "Para Reyes, pídelo hasta el 22/12",
    description: "Después, solo en PDF",
    cta: "SHOP_NOW",
    body:
      "Un cuento con su nombre en la portada y su cara en cada ilustración, impreso y con envío gratis a península y Baleares. Tú eliges su aventura y ves la portada antes de pagar.\n\nTapa blanda desde 34,90 € IVA incluido. Para que llegue a Reyes, el 22 de diciembre es el último día para pedir el libro impreso.\n\nEscenas recreadas con nuestros libros de ejemplo.",
    hooks: {
      a: { name: "fecha", text: "Para que el libro impreso llegue a Reyes, el último día es el 22 de diciembre." },
      b: { name: "6-enero", text: "Imagina su cara cuando lo abra el 6 de enero y vea su nombre en la portada." },
    },
  },
  {
    slug: "pdf-regalo",
    start: "2026-12-23T00:00:00+0100",
    end: "2027-01-05T23:59:00+0100",
    link: "https://meapica.es/es/christmas-delivery",
    headline: "Su cuento en PDF, a tiempo para Reyes",
    description: "PDF 9,90 € IVA incluido",
    cta: "SHOP_NOW",
    body:
      "El libro impreso ya no llega a Reyes, pero su cuento en PDF sí: te llega por correo tras el pago, normalmente en menos de una hora. Su nombre en la portada y su cara en cada ilustración. 9,90 € IVA incluido.\n\n¿Lo prefieres en papel? La tarjeta regalo te llega al momento por email, lista para imprimir y dejar con los regalos, y la familia crea el cuento después: tapa blanda 34,90 € IVA incluido, envío incluido.\n\nEscenas recreadas con nuestros libros de ejemplo.",
    hooks: {
      a: { name: "tarde", text: "¿Llegas tarde a Reyes? Su cuento todavía llega a tiempo." },
      b: { name: "una-hora", text: "Un regalo de Reyes con su nombre, que normalmente llega por correo en menos de una hora." },
    },
  },
];
PROMOS[1].body = PROMOS[0].body;

const names = (p) => ({
  campaign: `mpc_meta_${p.slug}_es_q4-26`,
  adset: (v) => `mpc_meta_${p.slug}_es_q4-26_as_hook-${v}_broad-25-55`,
  ad: (v) => `mpc_meta_${p.slug}_es_q4-26_ad_hook-${v}_${p.hooks[v].name}`,
});
export const landing = (p, v) => {
  const u = new URL(p.link);
  for (const [k, val] of Object.entries({ utm_source: "meta", utm_medium: "paid", utm_campaign: `${p.slug}_q4-26`, utm_content: names(p).ad(v) })) u.searchParams.set(k, val);
  return u.toString();
};

async function graph(path, params = {}, method = "GET") {
  const body = new URLSearchParams({ access_token: TOKEN });
  for (const [k, v] of Object.entries(params)) body.set(k, typeof v === "string" ? v : JSON.stringify(v));
  const res = method === "GET" ? await fetch(`${G}/${path}?${body}`) : await fetch(`${G}/${path}`, { method, body });
  const json = await res.json();
  if (json.error) throw new Error(`${method} ${path}: ${JSON.stringify(json.error)}`);
  return json;
}
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
const save = () => writeFileSync(STATE, JSON.stringify(state, null, 2) + "\n");

async function structure() {
  const ref = await graph(REF_ADSET, { fields: "targeting" });
  const existing = (await graph(`${ACT}/campaigns`, { fields: "id,name", limit: "200" })).data;
  for (const p of PROMOS) {
    const n = names(p);
    const s = (state[p.slug] ??= {});
    s.campaign ??= existing.find((c) => c.name === n.campaign)?.id;
    if (!s.campaign) {
      s.campaign = (await graph(`${ACT}/campaigns`, {
        name: n.campaign, objective: "OUTCOME_TRAFFIC", status: "PAUSED", buying_type: "AUCTION",
        special_ad_categories: [], is_adset_budget_sharing_enabled: false,
      }, "POST")).id;
      save();
      console.log("campaign", n.campaign, s.campaign);
    }
    const sets = (await graph(`${s.campaign}/adsets`, { fields: "id,name" })).data;
    for (const v of ["a", "b"]) {
      const key = `adset_${v}`;
      s[key] ??= sets.find((x) => x.name === n.adset(v))?.id;
      if (s[key]) continue;
      const params = {
        name: n.adset(v), campaign_id: s.campaign, status: "PAUSED", daily_budget: "500",
        billing_event: "IMPRESSIONS", optimization_goal: "LANDING_PAGE_VIEWS", bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        destination_type: "WEBSITE", targeting: ref.targeting, end_time: p.end,
        dsa_beneficiary: "Meapica", dsa_payor: "Meapica",
      };
      if (p.start) params.start_time = p.start;
      s[key] = (await graph(`${ACT}/adsets`, params, "POST")).id;
      save();
      console.log("adset", n.adset(v), s[key]);
    }
  }
}

async function zernio(path, init = {}) {
  const res = await fetch(`${Z}${path}`, { ...init, headers: { Authorization: `Bearer ${ZKEY}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`Zernio ${path}: HTTP ${res.status} ${text.slice(0, 1500)}`);
  return json;
}
// Zernio's presigned upload (scripts/social/zernio.mjs); upload-direct answers 413 above a few MB.
async function uploadMedia(file) {
  const url = await zUpload(file);
  if (!url) throw new Error(`upload ${file}: no url`);
  return url;
}

async function ads() {
  const meta = { _id: "6abe75171e59dae1ae8b2be1" }; // Zernio "metaads" account (Meapica business)
  const only = process.argv[3];
  for (const p of PROMOS) {
    if (only && p.slug !== only) continue;
    const n = names(p);
    const s = state[p.slug];
    for (const v of ["a", "b"]) {
      if (s[`ad_${v}`]) continue;
      const dir = `${CREATIVES}/${p.slug}`;
      const f916 = `${dir}/${p.slug}-hook-${v}-9x16.mp4`, f45 = `${dir}/${p.slug}-hook-${v}-4x5.mp4`;
      if (!existsSync(f916)) { console.log("skip (no video yet)", f916); continue; }
      const u916 = (s[`url916_${v}`] ??= await uploadMedia(f916)); save();
      const u45 = existsSync(f45) ? (s[`url45_${v}`] ??= await uploadMedia(f45)) : null; save();
      const req = {
        accountId: meta._id ?? meta.id, adAccountId: ACT, name: n.ad(v), adName: n.ad(v), adSetId: s[`adset_${v}`],
        headline: p.headline, body: `${p.hooks[v].text}\n\n${p.body}`, description: p.description,
        callToAction: p.cta, linkUrl: landing(p, v), adStatus: "PAUSED", status: "PAUSED",
        tracking: { pixelId: PIXEL }, aiDisclosure: "OPT_IN", multiAdvertiser: "OPT_OUT",
      };
      if (u45) req.placementAssets = placementAssets(u916, u45);
      else req.video = { url: u916 };
      if (process.argv.includes("--dry")) { console.log(JSON.stringify(req, null, 1)); continue; }
      const out = await zernio("/ads/create", { method: "POST", body: JSON.stringify(req) });
      const ad = out.ad ?? out.data ?? out;
      s[`ad_${v}`] = ad.platformAdId ?? ad.platformId ?? ad.adId;
      s[`zernio_ad_${v}`] = ad._id ?? ad.id;
      s[`raw_${v}`] = JSON.stringify(out).slice(0, 600);
      save();
      console.log("ad", n.ad(v), s[`ad_${v}`]);
    }
  }
}
// 9:16 is the catch-all (Stories, Reels and everything vertical); the feeds get the 4:5 cut.
function placementAssets(u916, u45) {
  return {
    defaultVideoUrl: u916,
    rules: [{
      videoUrl: u45,
      placements: { publisherPlatforms: ["facebook", "instagram"], facebookPositions: ["feed", "profile_feed"], instagramPositions: ["stream", "explore", "explore_home", "profile_feed"] },
    }],
  };
}

async function verify() {
  for (const p of PROMOS) {
    const s = state[p.slug] ?? {};
    const c = await graph(s.campaign, { fields: "name,status,effective_status,objective,daily_budget,is_adset_budget_sharing_enabled,special_ad_categories" });
    console.log(JSON.stringify(c));
    for (const v of ["a", "b"]) {
      const a = await graph(s[`adset_${v}`], { fields: "name,status,effective_status,daily_budget,optimization_goal,start_time,end_time,targeting" });
      const { targeting, ...rest } = a;
      console.log(" ", JSON.stringify(rest), "targeting-hash", JSON.stringify(targeting).length);
      if (s[`ad_${v}`]) {
        const ad = await graph(s[`ad_${v}`], { fields: "name,status,effective_status,adset_id,tracking_specs,creative{object_story_spec,asset_feed_spec,url_tags}" });
        console.log("   ", JSON.stringify(ad).slice(0, 900));
      }
    }
  }
}

const cmd = process.argv[2];
if (cmd === "structure") await structure();
else if (cmd === "ads") await ads();
else if (cmd === "verify") await verify();
else if (cmd) throw new Error(`unknown command ${cmd}`);
