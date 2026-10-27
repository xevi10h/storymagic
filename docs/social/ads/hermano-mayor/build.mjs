// «El hermano mayor» (concept 4): mum, Leo (5) and the newborn Julia. Example book 159f5965 (Leo y el valle que rugía),
// whose real dedication is signed "Mamá, papá y la pequeña Julia". Run from the repo root: node docs/social/ads/hermano-mayor/build.mjs
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAd, ROOT } from "../_shared/build-ad.mjs";
const DIR = dirname(fileURLToPath(import.meta.url));
await buildAd({
  dir: DIR, story: "159f5965-7601-478d-8590-cda0d8253d62", music: "calm-guitar-1.mp3",
  shots: [
    { src: `${DIR}/clips/a.mp4`, ss: 0, t: 4.0, audio: true }, // everyone around the baby, Leo alone on the sofa
    { src: `${DIR}/clips/b.mp4`, ss: 0.5, t: 4.4, audio: true }, // mum: "Este es solo tuyo."
    { page: 3, mode: "fit", t: 2.8, zoom: [1.0, 1.06], y: 0.5 }, // the real dedication page
    { src: `${ROOT}/docs/social/posts/2026-10-06/clips/p20.mp4`, ss: 0.2, t: 1.8 }, // real page 20, animated (already paid)
    { src: `${DIR}/clips/c.mp4`, ss: 0, t: 4.2, audio: true }, // "Mira, Julia. Este soy yo."
  ],
  line: { html: "En su cuento,<br><em>el protagonista es él.</em>", focus: 0.62 },
  captions: (t) => [
    [`<div class="pill cap">Desde que llegó su hermana,<br>nadie le mira a él.</div>`, t.at(0, 0.1), t.end(0)],
    [`<div class="pill cap">«Este es solo tuyo.»</div>`, t.at(1, 0.2), t.end(1)],
    [`<div class="pill cap">«Mira, Julia. Este soy yo.»</div>`, t.at(4, 0.1), t.end(4)],
  ],
  riseAt: (t) => t.at(2),
});
