// «¿Lo reconoces?» (slate #7, 2026-10-27): a phone photo of Martín turns into his own illustration (page 29), then the
// real cover and real pages. Mum off camera (ElevenLabs Carolina, sfx/mum.mp3, no lips to match). Seedance 2.5 morph.
// node docs/social/ads/lo-reconoces/build.mjs → cut/video.mp4. Clips live in ./clips, outside DIR.
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAd, ROOT } from "../_shared/build-ad.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = `${HERE}/cut`;
mkdirSync(DIR, { recursive: true });
const P = `${ROOT}/docs/social/posts/2026-10-09/clips`; // Martín's real pages, animated (already paid)
await buildAd({
  dir: DIR, story: "31ada3cf-f98d-40f3-b978-d5f84ee99ef1", music: "calm-piano-1.mp3",
  shots: [
    { src: `${HERE}/clips/seedance25-morph.mp4`, ss: 0, t: 5.0 }, // photo → his illustration
    { page: 1, mode: "fit", t: 1.6, zoom: [1.0, 1.05], y: 0.5 }, // the real cover
    { src: `${P}/p12.mp4`, ss: 0.4, t: 1.8 }, // real page 12
    { src: `${P}/amb-31ada3cf-p22-night-in-6.58.mp4`, ss: 0.6, t: 1.7 }, // real page 22
  ],
  line: { html: "Su cara, convertida<br><em>en la de su cuento.</em>", focus: 0.5 },
  captions: () => [
    [`<div class="pill cap">Mira. ¿Lo reconoces?</div>`, 0.45, 2.5], // timed to sfx/mum.mp3 words (0.18-1.92 s) + 0.3 s offset
    [`<div class="pill cap">Es él.<br>En su propio cuento.</div>`, 2.9, 4.85], // off before the cover (its title sits there)
  ],
  sfx: [{ shot: 0, at: 0.3, file: `${HERE}/sfx/mum.mp3`, vol: 1.0 }],
});
