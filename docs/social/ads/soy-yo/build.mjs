// «¡Soy yo!» (docs/social/ad-concepts-2026-10.md, concept 1), recast 2026-10-27 for the Spanish audience: Martín (7) and his
// dad, example book 31ada3cf (Martín y la luz guardada). Same structure as the approved Leo pilot.
// Run from the repo root: node docs/social/ads/soy-yo/build.mjs (writes video.mp4 + contact-sheet.jpg). Shared: ../_shared/build-ad.mjs
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { blurBelow, buildAd, ROOT } from "../_shared/build-ad.mjs";
const DIR = dirname(fileURLToPath(import.meta.url));
const P = `${ROOT}/docs/social/posts/2026-10-09/clips`; // Martín's real pages, animated (already paid)
await buildAd({
  dir: DIR, story: "31ada3cf-f98d-40f3-b978-d5f84ee99ef1", music: "calm-piano-1.mp3",
  shots: [
    { src: `${DIR}/clips/a.mp4`, ss: 1.2, t: 3.79, audio: true }, // he stares at the cover, gasps: "Papá… ¡ese soy yo!"
    { src: `${P}/p12.mp4`, ss: 0.4, t: 1.8 }, // real page 12, Martín and the crystal
    { src: `${DIR}/clips/b.mp4`, ss: 1.4, t: 3.0, audio: true, vf: blurBelow(1500) }, // "¡Y aquí también!" (the AI-drawn pages out of focus)
    { src: `${P}/amb-31ada3cf-p22-night-in-6.58.mp4`, ss: 0.6, t: 1.7 }, // real page 22, Martín raising the jar
    { src: `${DIR}/clips/c.mp4`, ss: 0.5, t: 5.0 }, // dad looking at him, not at the book
  ],
  line: { html: "Hay regalos que se abren.<br><em>Y regalos en los que<br>se encuentran.</em>", focus: 0.5 },
  captions: () => [
    { html: "Papá… ¡ese soy yo!", shot: 0 },
    { html: "¡Y aquí también!", shot: 2 },
  ],
});
