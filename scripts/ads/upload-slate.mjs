// Uploads the least-AI slate ads (docs/social/ad-concepts-2026-10.md › Ten-ad slate) to the Meta warm-up ad set through
// Zernio, PAUSED, with Meta's AI disclosure on. Same shape as the live warm-up ads (docs/stack.md › First Meta campaign).
//   node scripts/ads/upload-slate.mjs [--dry]     idempotent: ids saved in docs/ads/slate-2026-10.ids.json
// Ads stay PAUSED: switching one on is the owner's call.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { uploadMedia } from "../social/zernio.mjs";

const ROOT = new URL("../../", import.meta.url).pathname;
const ACT = "act_2479938985822992";
const ADSET = "120252257133430661"; // warm-up ad set mpc_meta_reyes_es_q4-26_as_broad-25-55
const META = "6abe75171e59dae1ae8b2be1"; // Zernio "metaads" account (Meapica business)
const PIXEL = "1830635711690297";
const ZKEY = readFileSync(`${homedir()}/.config/zernio/api_key`, "utf8").trim();
const STATE = `${ROOT}docs/ads/slate-2026-10.ids.json`;
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
const save = () => writeFileSync(STATE, `${JSON.stringify(state, null, 2)}\n`);

const TAIL = "Ves la portada antes de pagar. Libro impreso desde 34,90 € IVA incluido, envío incluido. Escena recreada con IA.";
const ADS = [
  { slug: "soy-yo-real", file: "docs/social/ads/soy-yo-real/seedance25-leo/video.mp4",
    body: `«Papá… ¡ese soy yo!» Un cuento impreso con su nombre en la portada y su cara en cada ilustración. ${TAIL}` },
  { slug: "la-abuela", file: "docs/social/ads/la-abuela-real/cut/video.mp4",
    body: `«Ábrelo. La primera página la he escrito yo.» Un regalo de los abuelos que se queda para siempre: su nombre en la portada, su cara en cada ilustración y vuestra dedicatoria en la primera página. ${TAIL}` },
  { slug: "ya-en-casa", file: "docs/social/ads/asi-llega/cut/video.mp4",
    body: `Su cuento, ya en casa. Su nombre en la portada y su cara en cada página. ${TAIL}` },
  { slug: "lo-reconoces", file: "docs/social/ads/lo-reconoces/cut/video.mp4",
    body: `¿Lo reconoces? Subes una foto y su cara pasa a ser la del protagonista de su cuento. ${TAIL}` },
];

for (const a of ADS) {
  const s = (state[a.slug] ??= {});
  if (s.ad) { console.log("= exists", a.slug, s.ad); continue; }
  const file = `${ROOT}${a.file}`;
  const thumb = `${tmpdir()}/${a.slug}-thumb.jpg`;
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", "1.0", "-i", file, "-frames:v", "1", "-q:v", "3", thumb]);
  s.video ??= await uploadMedia(file); save();
  s.thumb ??= await uploadMedia(thumb); save();
  const name = `mpc_meta_reyes_es_q4-26_ad_2026-10-27_${a.slug}`;
  const req = {
    accountId: META, adAccountId: ACT, name, adName: name, adSetId: ADSET,
    headline: "Su cuento, con su nombre y su cara", body: a.body, callToAction: "LEARN_MORE",
    linkUrl: `https://meapica.es/es?utm_source=meta&utm_medium=paid&utm_campaign=reyes_q4-26&utm_content=2026-10-27-${a.slug}`,
    adStatus: "PAUSED", status: "PAUSED", tracking: { pixelId: PIXEL }, aiDisclosure: "OPT_IN", multiAdvertiser: "OPT_OUT",
    video: { url: s.video, thumbnailUrl: s.thumb },
  };
  if (process.argv.includes("--dry")) { console.log(JSON.stringify(req, null, 1)); continue; }
  const res = await fetch("https://zernio.com/api/v1/ads/create", { method: "POST", headers: { Authorization: `Bearer ${ZKEY}`, "Content-Type": "application/json" }, body: JSON.stringify(req) });
  const text = await res.text();
  if (!res.ok) { console.log("✗", a.slug, res.status, text.slice(0, 800)); continue; }
  const out = JSON.parse(text), ad = out.ad ?? out.data ?? out;
  s.ad = ad.platformAdId ?? ad.platformId ?? ad.adId;
  s.zernio = ad._id ?? ad.id;
  save();
  console.log("✓", a.slug, s.ad);
}
