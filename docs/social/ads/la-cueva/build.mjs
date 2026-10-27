// «Si decides entrar en la cueva…» (concept 7, gamebook nostalgia): dad at 10 in 1994, then today choosing Lucía's (9) story
// with her. Example book 461c6578 (Lucía y el sueño perdido). Honesty: the choosing happens while creating the book on the web;
// nothing shows or says that the printed book branches. IP: a generic worn paperback, no series named.
// Run from the repo root: node docs/social/ads/la-cueva/build.mjs. Shared: ../_shared/build-ad.mjs
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAd, ROOT, VHS } from "../_shared/build-ad.mjs";
const DIR = dirname(fileURLToPath(import.meta.url));
await buildAd({
  dir: DIR, story: "461c6578-404b-4362-8dff-afcae81f6141", music: "magic-wonder-1.mp3",
  shots: [
    { src: `${DIR}/clips/90s.mp4`, ss: 0, t: 2.6, vf: VHS }, // 1994, under the blanket with a torch
    { img: `${DIR}/people/start-page.jpg`, t: 2.3, zoom: [1.6, 1.75], y: 0.75, vf: VHS }, // the line in the old paperback (no posters in frame)
    { src: `${DIR}/clips/b.mp4`, ss: 0, t: 4.6, audio: true }, // today: "¡El dragón! ¡Elige el dragón, papá!"
    { src: `${ROOT}/docs/social/posts/2026-10-08/clips/p12.mp4`, ss: 0.5, t: 1.8 }, // real page 12, the dragon, animated (already paid)
    { src: `${DIR}/clips/c.mp4`, ss: 0, t: 4.7, audio: true }, // the printed book arrives: "¡Papá, salgo yo!"
  ],
  line: { html: "Antes elegías tu aventura.<br><em>Ahora ella es<br>la protagonista.</em>", focus: 0.6 },
  captions: (t) => [
    [`<div class="pill cap">Si te acuerdas de esto…</div>`, t.at(0, 0.1), t.end(1)],
    [`<div class="pill cap">…ahora te toca a ti con ella.</div>`, t.at(2, 0.1), t.at(2, 2.0)],
    [`<div class="pill cap">«¡El dragón! ¡Elige el dragón!»</div>`, t.at(2, 2.0), t.end(2)],
    [`<div class="pill cap">«¡Papá, salgo yo!»</div>`, t.at(4, 1.8), t.end(4)],
  ],
  riseAt: (t) => t.at(3),
});
