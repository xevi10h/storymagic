// Assembles the "¡Soy yo!" ad (docs/social/ad-concepts-2026-10.md, concept 1): 1080×1920, 30 fps, H.264 + AAC.
// The dialogue is the clips' own lip-synced audio (Kling 3.0 Pro, scripts/social/animate-scene.mjs), so this does not
// go through render-video.mjs (which replaces clip audio with the narrator). Free: only ffmpeg, pdftoppm and Playwright.
// Run from the repo root:  node docs/social/ads/soy-yo/build.mjs   (then contact-sheet.jpg is written next to video.mp4)
// Safe zones: no text in the top 14 % (269 px) or the bottom 35 % (from 1248 px).
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = `${DIR}/../../../..`;
const TMP = `${DIR}/.build`;
const STORY = "159f5965-7601-478d-8590-cda0d8253d62"; // "Leo y el valle que rugía", public example book
const W = 1080, H = 1920, FPS = 30, XF = 0.4;
mkdirSync(TMP, { recursive: true });
const ff = (args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });

// Real pages of the example PDF (never drawn by a model).
const pdf = `${TMP}/${STORY}.pdf`;
if (!existsSync(pdf)) writeFileSync(pdf, Buffer.from(await (await fetch(`https://meapica.es/api/showcase/${STORY}/pdf`)).arrayBuffer()));
for (const p of [1, 29]) if (!existsSync(`${TMP}/p${p}-300.png`)) execFileSync("pdftoppm", ["-r", "300", "-png", "-f", String(p), "-l", String(p), "-singlefile", pdf, `${TMP}/p${p}-300`]);

// Shots: [source, from, length, keep its audio]
const SHOTS = [
  { src: `${DIR}/clips/a.mp4`, ss: 0.7, t: 4.34, audio: true }, // gasp + "Papá… ¡ese soy yo!"
  { src: `${ROOT}/docs/social/posts/2026-10-06/clips/p20.mp4`, ss: 0.2, t: 1.8 }, // real page 20, animated (already paid)
  { src: `${DIR}/clips/b.mp4`, ss: 1.0, t: 3.4, audio: true }, // "¡Y aquí también!"
  { src: `${ROOT}/docs/social/posts/2026-10-06/clips/p12.mp4`, ss: 2.4, t: 1.7 }, // real page 12, animated (already paid)
  { src: `${DIR}/clips/c.mp4`, ss: 0, t: 6.0 }, // dad looking at him
];
const LINE_T = 3.4, END_T = 3.2;

// ── Overlays (same brand fonts and pills as render-video.mjs) ──────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&display=block');
*{margin:0;box-sizing:border-box} html,body{width:${W}px;height:${H}px;overflow:hidden;background:transparent}
body{font-family:Fredoka,sans-serif;position:relative;font-kerning:none}
.pill{position:absolute;left:50%;transform:translateX(-50%);max-width:940px;width:max-content;text-align:center;border-radius:28px;box-shadow:0 10px 30px rgba(27,18,14,.28)}
.cap{top:330px;background:rgba(27,18,14,.86);color:#FFF8F0;font-weight:600;font-size:66px;line-height:1.15;padding:18px 38px}
.label{position:absolute;top:276px;left:0;right:0;text-align:center;color:rgba(255,248,240,.92);font-weight:500;font-size:28px;text-shadow:0 1px 6px rgba(0,0,0,.7)}
.line{top:960px;background:#FFF8F0;color:#1b120e;font-weight:700;font-size:68px;line-height:1.14;padding:30px 44px}
.line em{font-style:normal;color:#E86C3A}
.end{position:absolute;inset:0;background:#FFF8F0}
.cover{position:absolute;top:380px;left:50%;transform:translateX(-50%);width:580px;height:580px;border-radius:6px 14px 14px 6px;
  box-shadow:0 30px 60px rgba(27,18,14,.30),0 6px 14px rgba(27,18,14,.18);background:url('file://${TMP}/p1-300.png') center/cover}
.t1{position:absolute;top:995px;left:0;right:0;text-align:center;color:#1b120e;font-weight:700;font-size:58px;line-height:1.12}
.t2{position:absolute;top:1135px;left:0;right:0;text-align:center;color:#1b120e;font-weight:600;font-size:42px}
.t2 b{font-weight:600;color:#1b120e}
.web{top:282px;background:#E86C3A;color:#fff;font-weight:600;font-size:40px;padding:10px 32px;border-radius:999px}
.end .label{top:1205px;font-size:26px;color:rgba(27,18,14,.55);text-shadow:none}
`;
const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: W, height: H } });
async function overlay(name, body) {
  writeFileSync(`${TMP}/${name}.html`, `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}</body></html>`);
  await tab.goto(`file://${TMP}/${name}.html`, { waitUntil: "networkidle" });
  await tab.evaluate(() => document.fonts.ready);
  await tab.screenshot({ path: `${TMP}/${name}.png`, omitBackground: true });
  return `${TMP}/${name}.png`;
}
// Owner 2026-10-27: no AI line inside the video; the AI disclosure goes in the ad copy instead.
const capA = await overlay("ov-cap-a", `<div class="pill cap">Papá… ¡ese soy yo!</div>`);
const capB = await overlay("ov-cap-b", `<div class="pill cap">¡Y aquí también!</div>`);
const line = await overlay("ov-line", `<div class="pill line">Hay regalos que se abren.<br><em>Y regalos en los que<br>se encuentran.</em></div>`);
const endCard = await overlay("ov-end", `<div class="end"><div class="cover"></div><div class="t1">Su cuento.<br>Con su nombre y su cara.</div><div class="t2">Libro impreso desde 34,90 € IVA incluido</div><div class="pill web">meapica.es</div></div>`);
await browser.close();

// ── Segments, normalised (1080×1920, 30 fps, stereo 44.1 kHz) ─────────────────────────────────────────
const seg = [];
for (const [i, s] of SHOTS.entries()) {
  const out = `${TMP}/seg${i}.mp4`;
  const aIn = s.audio ? ["-ss", String(s.ss), "-t", String(s.t), "-i", s.src] : ["-f", "lavfi", "-t", String(s.t), "-i", "anullsrc=r=44100:cl=stereo"];
  ff(["-ss", String(s.ss), "-t", String(s.t), "-i", s.src, ...aIn, "-map", "0:v", "-map", "1:a",
    "-vf", `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},setsar=1`,
    "-af", "aresample=44100,aformat=channel_layouts=stereo", "-t", String(s.t),
    "-c:v", "libx264", "-preset", "fast", "-crf", "15", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", out]);
  seg.push({ file: out, t: s.t });
}
// The line over the real hero page 29 (Leo's painted portrait), slow push-in, darkened a touch for the text.
{
  const n = Math.round((LINE_T + XF) * FPS);
  ff(["-loop", "1", "-i", `${TMP}/p29-300.png`, "-f", "lavfi", "-t", String(LINE_T + XF), "-i", "anullsrc=r=44100:cl=stereo",
    "-vf", `crop=ih*0.91*9/16:ih*0.91:min(max(iw*0.62-ih*0.91*9/32\\,0)\\,iw-ih*0.91*9/16):0,scale=${W * 2}:${H * 2}:flags=lanczos,zoompan=z='1.04+0.08*on/${n}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)*0.35':d=${n}:s=${W}x${H}:fps=${FPS},eq=brightness=-0.04,setsar=1`,
    "-frames:v", String(n), "-t", String(LINE_T + XF), "-c:v", "libx264", "-preset", "fast", "-crf", "15", "-pix_fmt", "yuv420p", "-c:a", "aac", `${TMP}/seg-line.mp4`]);
  seg.push({ file: `${TMP}/seg-line.mp4`, t: LINE_T + XF });
}
ff(["-loop", "1", "-i", endCard, "-f", "lavfi", "-t", String(END_T), "-i", "anullsrc=r=44100:cl=stereo", "-filter_complex", `color=c=#FFF8F0:s=${W}x${H}:d=${END_T}[bg];[bg][0:v]overlay=0:0:shortest=1,fps=${FPS},format=yuv420p,setsar=1[v]`,
  "-map", "[v]", "-map", "1:a", "-t", String(END_T), "-c:v", "libx264", "-preset", "fast", "-crf", "15", "-c:a", "aac", `${TMP}/seg-end.mp4`]);
seg.push({ file: `${TMP}/seg-end.mp4`, t: END_T });

// ── Timeline: hard cuts between the phone shots and inserts (home footage), a cut into the line (a dissolve doubled the dad and the portrait), a dissolve into the end card ──
const live = seg.slice(0, SHOTS.length);
const liveLen = live.reduce((a, s) => a + s.t, 0);
const lineAt = liveLen - XF; // the line dissolves in over the end of the dad shot
const endAt = lineAt + LINE_T;
const total = endAt + END_T;
const starts = live.map((_, i) => live.slice(0, i).reduce((a, s) => a + s.t, 0));
const inputs = seg.flatMap((s) => ["-i", s.file]);
let g = live.map((_, i) => `[${i}:v]settb=AVTB,setpts=PTS-STARTPTS,fps=${FPS}[v${i}]`).join(";");
g += `;${live.map((_, i) => `[v${i}]`).join("")}concat=n=${live.length}:v=1:a=0,fps=${FPS}[live]`;
g += `;[${live.length}:v]settb=AVTB,setpts=PTS-STARTPTS,fps=${FPS}[vl];[${live.length + 1}:v]settb=AVTB,setpts=PTS-STARTPTS,fps=${FPS}[ve]`;
g += `;[live][vl]xfade=transition=fade:duration=${(1 / FPS).toFixed(3)}:offset=${lineAt.toFixed(3)}[x1];[x1][ve]xfade=transition=fade:duration=${XF}:offset=${(endAt - XF).toFixed(3)}[base]`;
// Overlays: [png, from, to]
const OV = [
  [capA, 0, starts[1]],
  [capB, starts[2], starts[3]],
  [line, lineAt + 0.25, endAt],
];
OV.forEach(([file], j) => inputs.push("-loop", "1", "-t", total.toFixed(3), "-i", file));
let last = "base";
OV.forEach(([, from, to], j) => {
  const k = seg.length + j;
  g += `;[${k}:v]format=rgba,fade=t=in:st=${from.toFixed(3)}:d=0.2:alpha=1[o${j}];[${last}][o${j}]overlay=0:0:enable='between(t,${from.toFixed(3)},${to.toFixed(3)})'[w${j}]`;
  last = `w${j}`;
});
// Sound: the dialogue clips' own audio, levelled, then a soft piano bed that rises once nobody speaks and fades on the end card.
g += `;${live.map((_, i) => `[${i}:a]asetpts=PTS-STARTPTS[a${i}]`).join(";")};${live.map((_, i) => `[a${i}]`).join("")}concat=n=${live.length}:v=0:a=1,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100,apad=whole_dur=${total.toFixed(3)}[dlg]`;
inputs.push("-stream_loop", "-1", "-i", `${ROOT}/docs/social/audio/calm-piano-1.mp3`);
const mi = seg.length + OV.length;
const rise = starts[4];
g += `;[${mi}:a]atrim=0:${total.toFixed(3)},asetpts=PTS-STARTPTS,aresample=44100,aformat=channel_layouts=stereo,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100,volume='0.13+0.37*min(max((t-${(rise - 0.5).toFixed(2)})/1.5,0),1)':eval=frame,afade=t=in:d=0.6,afade=t=out:st=${(total - 1.4).toFixed(2)}:d=1.4[mus]`;
g += `;[dlg][mus]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.89[aout]`;
ff([...inputs, "-filter_complex", g, "-map", `[${last}]`, "-map", "[aout]", "-t", total.toFixed(3), "-r", String(FPS),
  "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-movflags", "+faststart", `${DIR}/video.mp4`]);
// Contact sheet: one frame every 2 s.
ff(["-i", `${DIR}/video.mp4`, "-vf", "fps=1/2,scale=270:480,tile=6x2:padding=4:color=white", "-frames:v", "1", `${DIR}/contact-sheet.jpg`]);
console.log(`built ${DIR}/video.mp4 (${total.toFixed(2)} s); shots start at ${starts.map((s) => s.toFixed(2)).join(", ")}; line ${lineAt.toFixed(2)}; end card ${endAt.toFixed(2)}`);
