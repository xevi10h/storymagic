// «Unos años más» (docs/social/ad-concepts-2026-10.md, concept 2): mum and Noa (4) at bedtime. Example book bc6e2dbd (Noa y la llave de flor).
// Run from the repo root: node docs/social/ads/unos-anos-mas/build.mjs  (writes video.mp4 + contact-sheet.jpg here). Shared: ../_shared/build-ad.mjs
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAd, ROOT } from "../_shared/build-ad.mjs";
const DIR = dirname(fileURLToPath(import.meta.url));
const P = `${ROOT}/docs/social/posts/2026-10-05/clips`; // Noa's real pages, animated (already paid)
await buildAd({
  dir: DIR, story: "bc6e2dbd-fd14-4c5d-a9d0-07b10cffdbf2", music: "calm-piano-1.mp3",
  shots: [
    { src: `${DIR}/clips/a.mp4`, ss: 0.3, t: 3.9, audio: true }, // mum to the camera: "Un día dejará de pedirme que le lea."
    { src: `${P}/p04.mp4`, ss: 0.4, t: 1.8 }, // real page 4
    { src: `${DIR}/clips/b.mp4`, ss: 0.9, t: 2.9, audio: true }, // Noa whispers "Noa… soy yo."
    { src: `${P}/p26.mp4`, ss: 0.5, t: 2.0 }, // real page 26, Noa in bed
    { src: `${DIR}/clips/c.mp4`, ss: 0, t: 6.0, vf: "eq=brightness=-0.07:gamma=0.82:enable='gte(t,4.9)'" }, // asleep with the book; the lamp goes off
  ],
  line: { html: "Que esta noche<br><em>sea su cuento.</em>", focus: 0.62 },
  captions: (t) => [
    [`<div class="pill cap">«Un día dejará de pedirme<br>que le lea.»</div>`, t.at(0, 0.1), t.end(0)],
    [`<div class="pill cap">«Noa… soy yo.»</div>`, t.at(2, 0.2), t.end(2)],
  ],
  riseAt: (t) => t.at(3),
});
