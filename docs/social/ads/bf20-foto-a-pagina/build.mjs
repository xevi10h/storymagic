// Black Friday −20 % cut (13-30 Nov 2026, src/lib/black-friday.ts) of ../foto-a-pagina: same shots, the offer beat and the end card carry the −20 % with the Omnibus prior price. «De foto a cuento» (2026-10-29): a phone photo of the child turns into the book's watercolour portrait (the product's real
// mechanic), then Martín's real pages. No live-action video of people, no voice. Example book 31ada3cf. Run from the repo
// root: node docs/social/ads/bf20-foto-a-pagina/build.mjs
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAd, ROOT } from "../_shared/build-ad.mjs";
const DIR = dirname(fileURLToPath(import.meta.url)).replace(/bf20-([^/]+)$/, "$1"); // clips and people of ../foto-a-pagina
const OUT = dirname(fileURLToPath(import.meta.url));
const P = `${ROOT}/docs/social/posts/2026-10-09/clips`; // Martín's real pages, animated (already paid)
await buildAd({
  dir: OUT, story: "31ada3cf-f98d-40f3-b978-d5f84ee99ef1", music: "calm-piano-1.mp3",
  shots: [
    { src: `${DIR}/clips/photo-to-page-v3.mp4`, ss: 0, t: 5.8 }, // the still phone photo, then paint soaks over it (paint-reveal.py, no AI motion)
    { src: `${P}/p12.mp4`, ss: 0.4, t: 2.2 }, // real page 12
    { src: `${P}/amb-31ada3cf-p22-night-in-6.58.mp4`, ss: 0.6, t: 2.6 }, // real page 22
  ],
  endLine: "Black Friday: desde 27,92&nbsp;€ IVA incluido<br><span style=\"font-size:34px;font-weight:500\">Hasta el 30/11. Antes 34,90&nbsp;€, el precio<br>más bajo de los últimos 30 días</span>",
  line: { html: "Su nombre en la portada.<br><em>Su cara en cada<br>ilustración.</em>", focus: 0.5 },
  captions: (t) => [
    [`<div class="pill cap">Una foto suya…</div>`, t.at(0, 0.1), t.at(0, 3.0)],
    [`<div class="pill cap">…y es el protagonista<br>de su cuento.</div>`, t.at(0, 3.3), t.end(0)],
    [`<div class="pill cap">Tú eliges su aventura.</div>`, t.at(1, 0.05), t.end(1)],
    [`<div class="pill cap">Black Friday:<br><em>−20&nbsp;% en su cuento</em><br>hasta el 30/11</div>`, t.at(2, 0.05), t.end(2)],
  ],
});
