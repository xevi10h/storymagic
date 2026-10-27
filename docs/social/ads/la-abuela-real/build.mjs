// «La abuela escribió la primera página», least-AI rebuild (2026-10-27). Seedance 2.5 clips, the grandmother's voice is
// ElevenLabs Rosa (ypIbR1aohyRSdDv25DPr) dubbed with scripts/social/dub-clip.mjs onto clips/seedance25-rosa-*.mp4.
// Run from the repo root: node docs/social/ads/la-abuela-real/build.mjs → cut/video.mp4. Clips live in ./clips, outside DIR, so the
// builder's Kling start-hold clamp does not apply (Seedance moves from frame 0); ss values checked by hand.
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { blurBelow, buildAd, ROOT } from "../_shared/build-ad.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = `${HERE}/cut`;
mkdirSync(DIR, { recursive: true });
const clip = (c) => `${HERE}/clips/seedance25-rosa-${c}.mp4`;
await buildAd({
  dir: DIR, story: "31ada3cf-f98d-40f3-b978-d5f84ee99ef1", music: "calm-guitar-1.mp3",
  shots: [
    { src: clip("a"), ss: 0.6, t: 3.4, audio: true }, // "Ábrelo. La primera página la he escrito yo."
    { src: clip("b"), ss: 0.1, t: 2.34, audio: true, vf: blurBelow(1150) }, // she starts reading the dedication (AI book out of focus)
    { page: 3, mode: "fit", t: 2.5, zoom: [1.0, 1.06], y: 0.5, audioFrom: { src: clip("b"), ss: 2.44 } }, // the real dedication, her voice over it
    { src: `${ROOT}/docs/social/posts/2026-10-09/clips/p12.mp4`, ss: 0.5, t: 1.8 }, // real page 12, animated (already paid)
    { src: clip("c"), ss: 1.9, t: 3.0, audio: true }, // the hug, "¡Ay, mi niño!"
  ],
  line: { html: "Un regalo de los abuelos<br><em>que se queda para siempre.</em>", focus: 0.6 },
  captions: () => [
    { html: "«Ábrelo. La primera página<br>la he escrito yo.»", shot: 0 },
    { html: "«Para Martín, que cuenta<br>estrellas antes de dormir…»", shot: [1, 2] },
    { html: "«¡Ay, mi niño!»", shot: 4 },
  ],
});
