// «Así llega a casa» (slate #6, 2026-10-27): no faces, no dialogue; Seedance 2.5 clips of hands opening the parcel, the
// real cover and real pages as inserts, ElevenLabs sound effects (sfx/). node docs/social/ads/asi-llega/build.mjs → cut/video.mp4.
// Clips live in ./clips, outside DIR (Seedance has no frozen start), ss values checked by hand.
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAd, ROOT } from "../_shared/build-ad.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = `${HERE}/cut`;
mkdirSync(DIR, { recursive: true });
const clip = (c) => `${HERE}/clips/seedance25-${c}.mp4`;
const P = `${ROOT}/docs/social/posts/2026-10-09/clips`; // Martín's real pages, animated (already paid)
await buildAd({
  dir: DIR, story: "31ada3cf-f98d-40f3-b978-d5f84ee99ef1", music: "calm-piano-1.mp3",
  shots: [
    { src: clip("a"), ss: 0.3, t: 3.0 }, // tape off the box
    { src: clip("b"), ss: 0.5, t: 3.0 }, // the book comes out of the tissue paper
    { page: 1, mode: "fit", t: 1.6, zoom: [1.0, 1.05], y: 0.5 }, // the real cover
    { src: `${P}/p12.mp4`, ss: 0.4, t: 1.8 }, // real page 12
    { src: `${P}/amb-31ada3cf-p22-night-in-6.58.mp4`, ss: 0.6, t: 1.7 }, // real page 22
  ],
  line: { html: "Su nombre en la portada.<br><em>Su cara en cada página.</em>", focus: 0.5 },
  // Not «Así llega…»: the box and tissue paper are staged, so the hook makes no claim about the real packaging.
  captions: () => [[`<div class="pill cap">Su cuento,<br>ya en casa</div>`, 0.2, 3.0]],
  sfx: [
    { shot: 0, at: 0.1, file: `${HERE}/sfx/tape.mp3`, vol: 0.55 },
    { shot: 1, at: 0.0, file: `${HERE}/sfx/tissue.mp3`, vol: 0.55 },
    { shot: 2, at: 1.2, file: `${HERE}/sfx/page.mp3`, vol: 0.6 }, // the turn from the cover into the pages
  ],
});
