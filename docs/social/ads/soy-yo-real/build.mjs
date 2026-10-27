// «¡Soy yo!» least-AI pilot cut, one per model, for the owner's A/B: same start frames, cuts and captions, only the clip model
// differs. MODEL=seedance25|kling3 [VOICE=leo] node docs/social/ads/soy-yo-real/build.mjs → <MODEL>[-<VOICE>]/video.mp4.
// Clips live in ./clips (outside DIR), so the builder's start-hold clamp does not apply: every ss was checked by hand (Seedance has no frozen start; Kling's are ≥ 0.4).
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { blurBelow, buildAd, ROOT } from "../_shared/build-ad.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const M = process.env.MODEL ?? "seedance25";
// VOICE=leo: the boy's lines are ElevenLabs (Leo), dubbed onto the clips with scripts/social/dub-clip.mjs (clips/<M>-<VOICE>-a|b.mp4).
const V = process.env.VOICE;
const DIR = `${HERE}/${M}${V ? `-${V}` : ""}`;
mkdirSync(DIR, { recursive: true });
const clip = (c) => `${HERE}/clips/${M}${V && c !== "c" ? `-${V}` : ""}-${c}.mp4`;
const P = `${ROOT}/docs/social/posts/2026-10-09/clips`; // Martín's real pages, animated (already paid)
const COVER_BLUR = blurBelow(1150); // the model redraws the cover art as it moves: keep it soft, the real cover follows
// Speech per model, from the clip transcripts: [ss, t] of shot a and shot b.
const T = { seedance25: { a: [2.0, 2.9], b: [0.1, 2.2] }, kling3: { a: [0.9, 3.6], b: [1.6, 2.75] } }[M];
await buildAd({
  dir: DIR, story: "31ada3cf-f98d-40f3-b978-d5f84ee99ef1", music: "calm-piano-1.mp3",
  shots: [
    { src: clip("a"), ss: T.a[0], t: T.a[1], audio: true, vf: COVER_BLUR }, // "Papá… ¡ese soy yo!"
    { page: 1, mode: "fit", t: 1.6, zoom: [1.0, 1.05], y: 0.5 }, // the real cover (no line over it: a caption would cover the title)
    { src: clip("b"), ss: T.b[0], t: T.b[1], audio: true, vf: blurBelow(1350) }, // "¡Y aquí también!", he taps the page (AI-drawn pages out of focus)
    { src: `${P}/p12.mp4`, ss: 0.4, t: 1.8 }, // real page 12, Martín and the crystal
    { src: clip("c"), ss: 0.5, t: 4.0, vf: M === "seedance25" ? blurBelow(1300) : undefined }, // dad looking at him (Seedance drew a stray book bottom right)
  ],
  line: { html: "Hay regalos que se abren.<br><em>Y regalos en los que<br>se encuentran.</em>", focus: 0.5 },
  captions: () => [
    { html: "Papá… ¡ese soy yo!", shot: 0 },
    { html: "¡Y aquí también!", shot: 2 },
  ],
});
