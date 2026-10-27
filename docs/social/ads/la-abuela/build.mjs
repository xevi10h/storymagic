// «La abuela escribió la primera página» (concept 3): grandmother Carmen and Martín (7). Example book 31ada3cf
// (Martín y la luz guardada), whose real dedication is signed "Tus abuelos, Carmen y Josep".
// Run from the repo root: node docs/social/ads/la-abuela/build.mjs. Shared: ../_shared/build-ad.mjs
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { blurBelow, buildAd, ROOT } from "../_shared/build-ad.mjs";
const DIR = dirname(fileURLToPath(import.meta.url));
const BLUR_BOOK = blurBelow(1360); // the AI-drawn book in her hands, out of focus
await buildAd({
  dir: DIR, story: "31ada3cf-f98d-40f3-b978-d5f84ee99ef1", music: "calm-guitar-1.mp3",
  shots: [
    { src: `${DIR}/clips/a.mp4`, ss: 0.2, t: 4.4, audio: true }, // "Ábrelo. La primera página la he escrito yo."
    { src: `${DIR}/clips/b.mp4`, ss: 0.4, t: 2.6, audio: true, vf: BLUR_BOOK }, // she starts reading the dedication, voice breaking
    { page: 3, mode: "fit", t: 2.8, zoom: [1.0, 1.06], y: 0.5, audioFrom: { src: `${DIR}/clips/b.mp4`, ss: 3.0 } }, // the real dedication page, her voice over it
    { src: `${ROOT}/docs/social/posts/2026-10-09/clips/p12.mp4`, ss: 0.5, t: 1.8 }, // real page 12, animated (already paid)
    { src: `${DIR}/clips/c.mp4`, ss: 0, t: 4.9, audio: true }, // the hug, "¡Ay, mi niño!"
  ],
  line: { html: "Un regalo de los abuelos<br><em>que se queda para siempre.</em>", focus: 0.6 },
  captions: (t) => [
    [`<div class="pill cap">«Ábrelo. La primera página<br>la he escrito yo.»</div>`, t.at(0, 0.1), t.end(0)],
    [`<div class="pill cap">«Para Martín, que cuenta<br>estrellas antes de dormir…»</div>`, t.at(1, 0.1), t.end(2)],
    [`<div class="pill cap">«¡Ay, mi niño!»</div>`, t.at(4, 2.5), t.end(4)],
  ],
  riseAt: (t) => t.at(3),
});
