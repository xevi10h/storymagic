// «La hermana mayor» (concept 4), recast 2026-10-27 for the Spanish audience: Noa (4), her mum and her newborn brother.
// Example book bc6e2dbd (Noa y la llave de flor). No dedication insert: the real one is signed "Tu tía Marta" and here the
// book is mum's gift (never invent a dedication). Run from the repo root: node docs/social/ads/hermana-mayor/build.mjs
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAd, ROOT } from "../_shared/build-ad.mjs";
const DIR = dirname(fileURLToPath(import.meta.url));
const P = `${ROOT}/docs/social/posts/2026-10-05/clips`; // Noa's real pages, animated (already paid)
await buildAd({
  dir: DIR, story: "bc6e2dbd-fd14-4c5d-a9d0-07b10cffdbf2", music: "calm-guitar-1.mp3",
  shots: [
    { src: `${DIR}/clips/a.mp4`, ss: 0.4, t: 3.6 }, // everyone around the baby, Noa alone on the sofa (no dialogue)
    { src: `${DIR}/clips/b.mp4`, ss: 0.6, t: 3.6, audio: true }, // mum: "Este es solo tuyo."
    { src: `${P}/amb-bc6e2dbd-p10-forest-in-8.52.mp4`, ss: 0.6, t: 1.9 }, // real page 10, Noa in the forest
    { src: `${P}/p22.mp4`, ss: 0.5, t: 1.6 }, // real page 22, Noa opening the chest
    { src: `${DIR}/clips/c.mp4`, ss: 0.6, t: 4.3, audio: true }, // Noa to the baby: "Mira. Esta soy yo."
  ],
  line: { html: "En su cuento,<br><em>la protagonista es ella.</em>", focus: 0.5 },
  captions: (t) => [
    [`<div class="pill cap">Desde que llegó su hermano,<br>nadie la mira a ella.</div>`, t.at(0, 0.1), t.end(0)],
    { html: "«Este es solo tuyo.»", shot: 1 },
    { html: "«Mira. Esta soy yo.»", shot: 4 },
  ],
});
