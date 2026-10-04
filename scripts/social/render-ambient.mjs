// Free motion for a still book scene (HyperFrames, no generation model): the character is cut out with a local
// model and drifts over the background at a different speed, the background shimmers, and light and particles
// float over it. Nothing in the drawing itself moves: use animate-scene.mjs (paid) for that.
//   node scripts/social/render-ambient.mjs <out.mp4> <scene> <preset> [seconds] [in|out]
// in (default): starts on the plain illustration and drifts closer, so it follows another clip of the same scene
// without a jump. out: ends on the plain illustration, for the beat right before a transition that starts from it.
// <scene>: a 1080×1920 image or `pdf:<showcase story id>:<page>:<focus x 0-1>`. Presets: forest, sea, night, day.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { sceneFrame } from "./scene-frame.mjs";

const PRESETS = {
  forest: { particle: "255, 226, 120", core: "#fff7c8", count: 30, size: [3, 8], rise: [-90, -40], sway: 12, ray: "255, 244, 200", rayAlpha: 0.22 },
  sea: { particle: "255, 255, 255", core: "#ffffff", count: 36, size: [2, 6], rise: [-60, -20], sway: 20, ray: "220, 245, 255", rayAlpha: 0.18 },
  night: { particle: "190, 215, 255", core: "#eef4ff", count: 22, size: [2, 5], rise: [-50, -15], sway: 6, ray: "180, 205, 255", rayAlpha: 0.12 },
  day: { particle: "255, 240, 205", core: "#fffaf0", count: 18, size: [2, 5], rise: [-50, -15], sway: 6, ray: "255, 244, 210", rayAlpha: 0.16 },
};
const [outArg, scene, presetName = "day", secondsArg = "7", mode = "in"] = process.argv.slice(2);
const P = PRESETS[presetName];
if (!outArg || !scene || !P) throw new Error(`usage: node scripts/social/render-ambient.mjs <out.mp4> <scene> <${Object.keys(PRESETS).join("|")}> [seconds]`);
const OUT = resolve(outArg);
const SECONDS = Number(secondsArg);
const ROOT = process.cwd();
const TMP = `${dirname(OUT)}/.build`;
const PROJECT = `${TMP}/ambient-${process.pid}`;
mkdirSync(`${PROJECT}/assets`, { recursive: true });

copyFileSync(await sceneFrame(scene, TMP, `ambient-${process.pid}`), `${PROJECT}/assets/bg.jpg`);
execFileSync("npx", ["--yes", "hyperframes", "remove-background", `${PROJECT}/assets/bg.jpg`, "-o", `${PROJECT}/assets/fg.png`], { stdio: "ignore" });
for (const f of ["hyperframes.json", "meta.json", "package.json"]) copyFileSync(`${ROOT}/videos/outro-libro/${f}`, `${PROJECT}/${f}`);

// Seeded pseudo-random: the same scene always renders the same clip.
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647, (seed - 1) / 2147483646);
const between = ([a, b]) => a + rnd() * (b - a);
const flies = Array.from({ length: P.count }, () => {
  const d = 1.8 + rnd() * 2.4;
  return { x: Math.round(rnd() * 1080), y: Math.round(160 + rnd() * 1500), r: +between(P.size).toFixed(1), dx: Math.round(-40 + rnd() * 80), dy: Math.round(between(P.rise)), d: +d.toFixed(2), at: +(rnd() * Math.max(0.1, SECONDS - d)).toFixed(2) };
});

writeFileSync(`${PROJECT}/index.html`, `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #1b120e; }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; }
      #scene { position: absolute; inset: 0; overflow: hidden; }
      .layer { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      #rays { position: absolute; inset: -10%; mix-blend-mode: screen; opacity: 0;
        background: linear-gradient(115deg, rgba(${P.ray}, 0) 30%, rgba(${P.ray}, ${P.rayAlpha}) 46%, rgba(${P.ray}, 0) 60%); }
      .fly { position: absolute; border-radius: 50%; opacity: 0;
        background: radial-gradient(circle, ${P.core} 0%, rgba(${P.particle}, 0.9) 35%, rgba(${P.particle}, 0) 70%); }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-width="1080" data-height="1920" data-duration="${SECONDS}">
      <section id="scene" class="clip" data-start="0" data-duration="${SECONDS}" data-track-index="0">
        <svg width="0" height="0" style="position:absolute"><defs>
          <filter id="sway" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence id="sway-noise" type="fractalNoise" baseFrequency="0.006 0.012" numOctaves="2" seed="4" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="${P.sway}" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs></svg>
        <img id="bg" class="layer" src="assets/bg.jpg" alt="" style="filter:url(#sway)" />
        <div id="rays"></div>
        <img id="fg" class="layer" src="assets/fg.png" alt="" />
${flies.map((f, i) => `        <div id="fly${i}" class="fly" style="left:${f.x}px;top:${f.y}px;width:${f.r * 6}px;height:${f.r * 6}px"></div>`).join("\n")}
      </section>
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      const D = ${SECONDS};
      // Depth: the background drifts one way, the cut-out character a little more the other way.
      const still = { scale: 1, x: 0, y: 0 };
      const near = { bg: { scale: 1.07, x: -12, y: 0 }, fg: { scale: 1.1, x: 12, y: -8 } };
      const ease = "sine.inOut";
      ${mode === "out"
        ? `tl.fromTo("#bg", { ...near.bg }, { ...still, duration: D, ease }, 0);
      tl.fromTo("#fg", { ...near.fg }, { ...still, duration: D, ease }, 0);`
        : `tl.fromTo("#bg", { ...still }, { ...near.bg, duration: D, ease }, 0);
      tl.fromTo("#fg", { ...still }, { ...near.fg, duration: D, ease }, 0);`}
      tl.fromTo("#sway-noise", { attr: { baseFrequency: "0.006 0.012" } }, { attr: { baseFrequency: "0.009 0.016" }, duration: D, ease: "sine.inOut" }, 0);
      tl.fromTo("#rays", { opacity: 0, xPercent: -18 }, { opacity: 1, xPercent: 18, duration: D, ease: "sine.inOut" }, 0);
      const flies = ${JSON.stringify(flies)};
      flies.forEach((f, i) => {
        tl.fromTo("#fly" + i, { opacity: 0, x: 0, y: 0 }, { opacity: 0.95, x: f.dx / 2, y: f.dy / 2, duration: f.d / 2, ease: "sine.out" }, f.at);
        tl.to("#fly" + i, { opacity: 0, x: f.dx, y: f.dy, duration: f.d / 2, ease: "sine.in" }, f.at + f.d / 2);
      });
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
`);
execFileSync("npx", ["--yes", "hyperframes", "render", ".", "-q", "high", "-o", OUT], { cwd: PROJECT, stdio: "ignore", env: { ...process.env, PRODUCER_BROWSER_GPU_MODE: "hardware" } });
rmSync(PROJECT, { recursive: true });
console.log(`built ${OUT}`);
