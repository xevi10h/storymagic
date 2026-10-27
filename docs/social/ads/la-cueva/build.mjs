// «Si decides entrar en la cueva…» (concept 7, gamebook nostalgia), recast 2026-10-27 for the Spanish audience: dad at ten
// in 1994, then today choosing Aitana's (6) pirate story with her. Example book 5f4ace1a (Aitana y la Perla Cantarina).
// Honesty: the choosing happens while creating the book on the web; nothing shows or says that the printed book branches.
// IP: a generic worn paperback, no series named. Run from the repo root: node docs/social/ads/la-cueva/build.mjs
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAd, ROOT, VHS } from "../_shared/build-ad.mjs";
const DIR = dirname(fileURLToPath(import.meta.url));
await buildAd({
  dir: DIR, story: "5f4ace1a-0f90-4e2c-bf72-9f2a15ff84a6", music: "magic-wonder-1.mp3",
  shots: [
    { src: `${DIR}/clips/90s.mp4`, ss: 0.4, t: 2.4, vf: VHS }, // 1994, under the blanket with a torch
    { img: `${DIR}/people/start-page.jpg`, t: 2.3, zoom: [1.3, 1.38], y: 0.78, vf: VHS }, // the whole line in the old paperback (posters out of frame)
    { src: `${DIR}/clips/b.mp4`, ss: 0.4, t: 4.3, audio: true }, // today: "¡El barco! ¡Elige el barco!"
    { src: `${ROOT}/docs/social/posts/2026-10-04/clips/p10.mp4`, ss: 0.5, t: 1.8 }, // real page 10, Aitana on the ship, animated (already paid)
    { src: `${DIR}/clips/c.mp4`, ss: 0.4, t: 4.55, audio: true }, // the printed book arrives: "¡Papá, salgo yo!"
  ],
  line: { html: "Antes elegías tu aventura.<br><em>Ahora ella es<br>la protagonista.</em>", focus: 0.5 },
  captions: (t) => [
    [`<div class="pill cap">Si te acuerdas de esto…</div>`, t.at(0, 0.1), t.end(1)],
    [`<div class="pill cap">…ahora te toca a ti con ella.</div>`, t.at(2, 0.05), t.end(2, -0.05)],
    { html: "«¡El barco! ¡Elige el barco!»", shot: 2, cls: "low" },
    { html: "«¡Papá, salgo yo!»", shot: 4 },
  ],
});
