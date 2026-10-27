// «Doce años después» (concept 5): Aitana at 18 finds her worn book and hugs her mum. Example book 5f4ace1a
// (Aitana y la Perla Cantarina), real dedication signed "Mamá y papá". Run from the repo root: node docs/social/ads/doce-anos-despues/build.mjs
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAd, ROOT } from "../_shared/build-ad.mjs";
const DIR = dirname(fileURLToPath(import.meta.url));
await buildAd({
  dir: DIR, story: "5f4ace1a-0f90-4e2c-bf72-9f2a15ff84a6", music: "calm-piano-1.mp3",
  shots: [
    { src: `${DIR}/clips/a.mp4`, ss: 0, t: 4.6, audio: true }, // she finds the worn book on the shelf
    { src: `${ROOT}/docs/social/posts/2026-10-04/clips/p26.mp4`, ss: 0.5, t: 1.5 }, // real page 26 between two shots of her in the same framing (no jump cut)
    { src: `${DIR}/clips/b.mp4`, ss: 0.3, t: 4.7, audio: true }, // "Mamá y papá…", wipes an eye
    { page: 3, mode: "fit", px: 1240, t: 2.8, zoom: [1.0, 1.06], y: 0.5 }, // the real dedication page
    { src: `${ROOT}/docs/social/posts/2026-10-04/clips/p04.mp4`, ss: 0.4, t: 1.6 }, // real page 4, animated (already paid)
    { src: `${DIR}/clips/c.mp4`, ss: 0.2, t: 4.7, audio: true }, // the hug in the kitchen, "¿Y esto, cariño?"
  ],
  line: { html: "Hoy es un cuento.<br><em>Mañana, un recuerdo.</em>", focus: 0.6 },
  captions: (t) => [
    [`<div class="pill cap">Lo encontró 12 años después.</div>`, t.at(0, 0.1), t.end(0)],
    { html: "«Mamá y papá…»", shot: 2 },
    { html: "«¿Y esto, cariño?»", shot: 5 },
  ],
});
