// Renders a short vertical video (1080×1920, 30 fps, H.264 + AAC) for Reels / TikTok / Shorts from real
// book art: full-screen stills that move from the first frame, a narrator (always the same voice), captions
// burned in for sound-off viewing and a music bed. No logo or brand card until the last beat.
// Run from the repo root (needs ffmpeg + pdftoppm; ELEVENLABS_API_KEY in the env or .env.local for narration):
//   node scripts/social/render-video.mjs docs/social/posts/2026-10-05/video.json
//   add --storyboard to get storyboard.jpg next to it instead: the first frame of every beat with its title and its
//   whole line, in seconds and without narration or encoding. Look at it before paying for a full render.
// video.json (next to the output): { lang, out, music?: <file in docs/social/audio>, beats: [{
//     img: { pdf: <showcase story id>, page: <n> | [<left>, <right>] } | { file: <repo path> }
//          | { video: <clip next to this file>, full?: true, fit?: true } (an animated scene or a free ambient clip; `full` plays a
//            scene-to-scene transition to its last frame even when the line is shorter),
//     say?: narration (the beat lasts as long as the audio) | seconds: fixed length,
//     title?: text pinned at the top for the whole beat (the hook), titleTop?: px from the top when a face is there,
//     pan?: [x0, x1] (0-1, slides the 9:16 window across the art) | zoom?: [from, to] + focus?: [x, y],
//     ambient?: forest | sea | night | day (free layered motion for this still, see render-ambient.mjs),
//     ambientMode?: "out" (end on the plain page, for the beat before a transition clip),
//     brand?: true (shows meapica.shop: last beat only) }],
//   ambient?: preset applied to every still beat of the video,
//   web?: true (a small meapica.shop label from the third beat on), outroSay?: line the narrator says over the outro,
//   outro?: true (appends the animated logo, docs/social/brand/outro.mp4, rendered from the HyperFrames project videos/outro-libro; use it instead of
//     `brand` on narrated videos, not on short loops) }
//   outro: "short" appends the 3.2 s corporate closing instead (docs/social/brand/closing-short-<lang>.mp4): every short reel ends with it.
// Safe zones: text stays out of the top 220 px and the bottom 420 px (platform UI).
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// The Meapica narrator: one voice for every video, in Spanish and Catalan ("María Díaz" in the ElevenLabs library).
const VOICE_ID = "TVZcExm6tc18D9qo57y7";
const VOICE_MODEL = "eleven_v4";

const configPath = resolve(process.argv[2] ?? "");
if (!existsSync(configPath)) throw new Error("usage: node scripts/social/render-video.mjs <video.json>");
const T = JSON.parse(readFileSync(configPath, "utf8"));
const STORYBOARD = process.argv.includes("--storyboard");
const ROOT = process.cwd();
const OUT = dirname(configPath);
const TMP = `${OUT}/.build`;
const TTS_CACHE = `${ROOT}/docs/social/.tts-cache`;
const AUDIO = `${ROOT}/docs/social/audio`;
const FPS = 30;
const W = 1080, H = 1920;
mkdirSync(TMP, { recursive: true });
mkdirSync(TTS_CACHE, { recursive: true });

const ff = (args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
const probe = (file) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString());

// ── Art: any source → a PNG SRC_H px tall (one page, or two pages side by side) ───────────────────────
// Book pages carry their page number in a small badge near the bottom edge: the bottom 9 % is cut off so it
// can never show in a video.
const SRC_H = 2730;
async function pdfPage(id, n) {
  const pdf = `${TMP}/${id}.pdf`;
  if (!existsSync(pdf)) {
    const res = await fetch(`https://meapica.shop/api/showcase/${id}/pdf`);
    if (!res.ok) throw new Error(`example PDF ${id}: HTTP ${res.status}`);
    writeFileSync(pdf, Buffer.from(await res.arrayBuffer()));
  }
  const base = `${TMP}/${id}-p${n}`;
  if (!existsSync(`${base}.png`)) execFileSync("pdftoppm", ["-r", "200", "-png", "-f", String(n), "-l", String(n), "-singlefile", pdf, base]);
  return `${base}.png`;
}
async function art(img, key) {
  const out = `${TMP}/${key}-art.png`;
  const sources = img.file ? [`${ROOT}/${img.file}`] : await Promise.all([img.page].flat().map((n) => pdfPage(img.pdf, n)));
  const tiles = await Promise.all(sources.map((s) => sharp(s).resize(3000, 3000, { fit: "cover" }).extract({ left: 0, top: 0, width: 3000, height: SRC_H }).toBuffer()));
  await sharp({ create: { width: 3000 * tiles.length, height: SRC_H, channels: 3, background: "#fff" } })
    .composite(tiles.map((input, i) => ({ input, left: i * 3000, top: 0 })))
    .png()
    .toFile(out);
  return { file: out, width: 3000 * tiles.length };
}

// ── Narration with character timings (cached: the same line never costs twice) ─────────────────────────
function apiKey() {
  const key = process.env.ELEVENLABS_API_KEY ?? readFileSync(`${ROOT}/.env.local`, "utf8").match(/^ELEVENLABS_API_KEY=(.+)$/m)?.[1];
  if (!key) throw new Error("ELEVENLABS_API_KEY missing (env or .env.local)");
  return key.trim().replace(/^["']|["']$/g, "");
}
async function narrate(text) {
  const id = createHash("sha1").update(`${VOICE_ID}|${VOICE_MODEL}|${T.lang}|${text}`).digest("hex").slice(0, 16);
  const mp3 = `${TTS_CACHE}/${id}.mp3`;
  const json = `${TTS_CACHE}/${id}.json`;
  if (!existsSync(mp3) || !existsSync(json)) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": apiKey(), "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: VOICE_MODEL, language_code: T.lang }),
    });
    if (!res.ok) throw new Error(`ElevenLabs: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    writeFileSync(mp3, Buffer.from(data.audio_base64, "base64"));
    writeFileSync(json, JSON.stringify(data.alignment));
  }
  return { mp3, alignment: JSON.parse(readFileSync(json, "utf8")), duration: probe(mp3) };
}

/** Caption chunks (a few words each, cut at punctuation) with the second each one starts being spoken. */
function captionChunks(alignment) {
  const { characters: ch, character_start_times_seconds: starts } = alignment;
  const words = [];
  let word = "", start = 0;
  for (let i = 0; i <= ch.length; i++) {
    if (i === ch.length || /\s/.test(ch[i])) {
      if (word) words.push({ word, start });
      word = "";
    } else {
      if (!word) start = starts[i];
      word += ch[i];
    }
  }
  const chunks = [];
  let cur = null;
  for (const w of words) {
    if (cur && (cur.words.length >= 4 || cur.text.length + w.word.length > 24 || /[.,;:!?…»]$/.test(cur.text))) {
      chunks.push(cur);
      cur = null;
    }
    if (!cur) cur = { text: w.word, start: w.start, words: [w.word] };
    else { cur.text += ` ${w.word}`; cur.words.push(w.word); }
  }
  if (cur) chunks.push(cur);
  return chunks.map(({ text, start }) => ({ text, start }));
}

// ── Text overlays (transparent PNGs, brand fonts) ─────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&display=block');
*{margin:0;box-sizing:border-box} html,body{width:${W}px;height:${H}px;overflow:hidden;background:transparent}
body{font-family:Fredoka,sans-serif;position:relative}
.pill{position:absolute;left:50%;transform:translateX(-50%);max-width:940px;width:max-content;text-align:center;border-radius:28px;
  box-shadow:0 10px 30px rgba(27,18,14,.28)}
.title{top:250px;background:#FFF8F0;color:#1b120e;font-weight:700;font-size:70px;line-height:1.1;padding:24px 40px}
.title em{font-style:normal;color:#E86C3A}
.cap{top:1280px;background:rgba(27,18,14,.86);color:#FFF8F0;font-weight:600;font-size:64px;line-height:1.15;padding:18px 36px}
.web{top:236px;background:#FFF8F0;color:#b94f1f;font-weight:600;font-size:40px;padding:10px 30px;border-radius:999px}
.brand{top:1100px;background:#E86C3A;color:#fff;font-weight:600;font-size:64px;padding:18px 48px;border-radius:999px}
`;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: W, height: H } });
async function overlay(name, body) {
  writeFileSync(`${TMP}/${name}.html`, `<!doctype html><html lang="${T.lang}"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}</body></html>`);
  await tab.goto(`file://${TMP}/${name}.html`, { waitUntil: "networkidle" });
  await tab.evaluate(() => document.fonts.ready);
  await tab.screenshot({ path: `${TMP}/${name}.png`, omitBackground: true });
  return `${TMP}/${name}.png`;
}

// ── Beats ─────────────────────────────────────────────────────────────────────────────────────────────
const XF = 0.35; // dissolve between beats, in seconds
const parts = [];
const lengths = [];
let narrated = false;
for (const [i, b] of T.beats.entries()) {
  if (STORYBOARD) {
    const still = `${TMP}/sb-still${i}.png`;
    if (b.img.video) ff(["-i", resolve(OUT, b.img.video), "-frames:v", "1", "-vf", `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`, still]);
    else {
      const src = await art(b.img, `b${i}`);
      const cropW = Math.round((SRC_H * W) / H / 2) * 2;
      const x0 = Math.round(Math.min(Math.max((b.focus ?? [0.5])[0] * src.width - cropW / 2, 0), src.width - cropW));
      ff(["-i", src.file, "-frames:v", "1", "-vf", `crop=${cropW}:${SRC_H}:${x0}:0,scale=${W}:${H}`, still]);
    }
    const text = await overlay(`sb-text${i}`, `${b.title ? `<div class="pill title"${b.titleTop ? ` style="top:${b.titleTop}px"` : ""}>${b.title}</div>` : ""}${b.say ? `<div class="pill cap">${esc(b.say)}</div>` : ""}`);
    ff(["-i", still, "-i", text, "-filter_complex", "overlay", "-frames:v", "1", `${TMP}/sb${String(i).padStart(2, "0")}.png`]);
    continue;
  }
  const voice = b.say ? await narrate(b.say) : null;
  narrated ||= !!voice;
  // A moving clip (animate-scene.mjs or render-ambient.mjs, path relative to this video.json) or a still to zoom on.
  let clip = b.img.video ? resolve(OUT, b.img.video) : null;
  let fit = !!b.img.fit;
  let seconds = voice ? Math.round((voice.duration + 0.35) * FPS) / FPS : b.seconds;
  // A transition between two scenes must play to its last frame, even when the line spoken over it is shorter.
  if (clip && b.img.full) seconds = Math.max(seconds, Math.floor(probe(clip) * FPS) / FPS - XF);
  const frames = Math.round(seconds * FPS);
  const shown = seconds + XF; // each beat keeps running under the dissolve into the next one
  // `ambient` (per beat, or for the whole video): a still page gets free layered motion instead of a plain zoom.
  // The clip is rendered once and kept in clips/ next to the video.
  const ambient = b.ambient ?? T.ambient;
  if (!clip && ambient && b.img.pdf && !Array.isArray(b.img.page)) {
    const mode = b.ambientMode ?? "in";
    clip = `${OUT}/clips/amb-${b.img.pdf.slice(0, 8)}-p${b.img.page}-${ambient}-${mode}-${shown.toFixed(2)}.mp4`;
    if (!existsSync(clip)) {
      mkdirSync(`${OUT}/clips`, { recursive: true });
      execFileSync("node", [`${ROOT}/scripts/social/render-ambient.mjs`, clip, `pdf:${b.img.pdf}:${b.img.page}:${(b.focus ?? [0.5])[0]}`, ambient, shown.toFixed(2), mode], { stdio: "inherit" });
    }
    fit = true;
  }
  const src = clip ? null : await art(b.img, `b${i}`);
  const cropW = Math.round((SRC_H * W) / H / 2) * 2; // the 9:16 window on the source

  let motion;
  if (clip) {
    // Slowed down only when the narration outlasts the clip; otherwise it is simply cut at the end of the line.
    // `fit` stretches or squeezes the clip to the beat exactly (an ambient clip that must end on its last frame).
    const slow = fit ? shown / probe(clip) : Math.max(1, (shown + 0.05) / probe(clip));
    // Blended frames keep a slowed clip from stuttering.
    const smooth = slow > 1.02 ? `minterpolate=fps=${FPS}:mi_mode=blend,` : "";
    motion = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setpts=${slow.toFixed(4)}*PTS,${smooth}fps=${FPS},tpad=stop_mode=clone:stop_duration=1`;
  } else if (b.pan) {
    const [p0, p1] = b.pan;
    motion = `crop=${cropW}:${SRC_H}:'(iw-${cropW})*(${p0}+(${p1 - p0})*t/${shown})':0,scale=${W}:${H},fps=${FPS}`;
  } else {
    const [z0, z1] = b.zoom ?? [1, 1.08];
    const [fx, fy] = b.focus ?? [0.5, 0.5];
    const x0 = Math.round(Math.min(Math.max(fx * src.width - cropW / 2, 0), src.width - cropW));
    // zoompan places its window on whole pixels, which makes a slow zoom tremble. Zooming on a 4x oversampled
    // frame makes each step a quarter of an output pixel: smooth to the eye.
    motion = `crop=${cropW}:${SRC_H}:${x0}:0,scale=${W * 4}:${H * 4}:flags=lanczos,zoompan=z='${z0}+(${z1 - z0})*on/${frames}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)*${fy}':d=${Math.round(shown * FPS)}:s=${W}x${H}:fps=${FPS}`;
  }

  // Overlays: [file, from, to] in seconds within the beat.
  const layers = [];
  if (b.title) layers.push([await overlay(`b${i}-title`, `<div class="pill title"${b.titleTop ? ` style="top:${b.titleTop}px"` : ""}>${b.title}</div>`), 0, shown]);
  // Most viewers leave long before the outro: the address sits on screen from the third beat on.
  if (T.web && i >= 2 && !b.title && !b.brand) layers.push([await overlay("web", `<div class="pill web">meapica.shop</div>`), 0, shown]);
  if (b.brand) layers.push([await overlay(`b${i}-brand`, `<div class="pill brand">meapica.shop</div>`), 0, shown]);
  if (voice) {
    const chunks = captionChunks(voice.alignment);
    for (const [j, c] of chunks.entries()) {
      layers.push([await overlay(`b${i}-cap${j}`, `<div class="pill cap">${esc(c.text)}</div>`), j === 0 ? 0 : c.start, chunks[j + 1]?.start ?? Math.min(shown, voice.duration + 0.4)]); // the last caption leaves with the voice
    }
  }

  const inputs = clip ? ["-i", clip] : [...(b.pan ? ["-loop", "1", "-t", String(shown)] : []), "-i", src.file];
  for (const [file] of layers) inputs.push("-i", file);
  inputs.push(...(voice ? ["-i", voice.mp3] : ["-f", "lavfi", "-t", String(shown), "-i", "anullsrc=r=44100:cl=stereo"]));
  let chain = `[0:v]${motion}[v0]`;
  layers.forEach(([, from, to], j) => {
    chain += `;[v${j}][${j + 1}:v]overlay=0:0:enable='between(t,${from.toFixed(3)},${to.toFixed(3)})'[v${j + 1}]`;
  });
  const audioIn = layers.length + 1;
  chain += `;[${audioIn}:a]aresample=44100,aformat=channel_layouts=stereo,apad[a]`;
  ff([...inputs, "-filter_complex", chain, "-map", `[v${layers.length}]`, "-map", "[a]", "-frames:v", String(Math.round(shown * FPS)), "-t", String(shown),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", String(FPS), "-preset", "fast", "-crf", "16", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", `${TMP}/b${i}.mp4`]);
  parts.push(`${TMP}/b${i}.mp4`);
  lengths.push(seconds);
}

if (STORYBOARD) {
  await browser.close();
  ff(["-i", `${TMP}/sb%02d.png`, "-vf", `scale=360:-1,tile=${T.beats.length}x1`, "-frames:v", "1", "-update", "1", `${OUT}/storyboard.jpg`]);
  console.log(`storyboard: ${OUT}/storyboard.jpg (${T.beats.length} beats)`);
  process.exit(0);
}
await browser.close();
// outro: "short" = the compact corporate closing for short reels (logo, tagline, button, address; videos/closing-short).
const OUTRO = T.outro === "short" ? `${ROOT}/docs/social/brand/closing-short-${T.lang}.mp4` : `${ROOT}/docs/social/brand/outro.mp4`;
const outroLength = T.outro ? probe(OUTRO) : 0;
if (T.outro) parts.push(OUTRO);

// Assembly: every beat dissolves into the next (and the last one into the outro) while the sound runs straight
// through, so narration and captions stay in sync. One final encode.
const starts = lengths.map((_, i) => lengths.slice(0, i).reduce((sum, n) => sum + n, 0));
const spoken = lengths.reduce((sum, n) => sum + n, 0);
if (T.outro) starts.push(spoken);
const total = T.outro ? spoken + outroLength : spoken + XF;
const inputs = parts.flatMap((p) => ["-i", p]);
let voiceLabel = "voice";
let graph = parts.map((_, i) => `[${i}:v]settb=AVTB,fps=${FPS},format=yuv420p[s${i}]`).join(";");
let last = "s0";
for (let i = 1; i < parts.length; i++) {
  graph += `;[${last}][s${i}]xfade=transition=fade:duration=${XF}:offset=${starts[i].toFixed(3)}[x${i}]`;
  last = `x${i}`;
}
graph += ";" + parts.map((_, i) => `[${i}:a]${i < lengths.length ? `atrim=0:${lengths[i].toFixed(3)},` : ""}asetpts=PTS-STARTPTS,aresample=44100,aformat=channel_layouts=stereo[a${i}]`).join(";");
graph += `;${parts.map((_, i) => `[a${i}]`).join("")}concat=n=${parts.length}:v=0:a=1[voice]`;
if (T.outro && T.outroSay) {
  // The narrator says where to make one, over the logo.
  const line = await narrate(T.outroSay);
  inputs.push("-i", line.mp3);
  graph += `;[${inputs.filter((x) => x === "-i").length - 1}:a]aresample=44100,aformat=channel_layouts=stereo,adelay=${Math.round((spoken + 0.3) * 1000)}:all=1[say];[voice][say]amix=inputs=2:duration=first:normalize=0[voiced]`;
  voiceLabel = "voiced";
}
if (T.music) {
  // Music sits under the narrator, or carries the video when nobody speaks. Library tracks differ in loudness,
  // so the bed is normalised first. It is gone before the outro: the logo has its own sting.
  const vol = narrated ? 0.16 : 0.6;
  const musicEnd = total - outroLength;
  inputs.push("-stream_loop", "-1", "-i", `${AUDIO}/${T.music}`);
  graph += `;[${inputs.filter((x) => x === "-i").length - 1}:a]aresample=44100,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100,volume=${vol},afade=t=in:d=0.4,afade=t=out:st=${(musicEnd - 1).toFixed(2)}:d=1[m];[${voiceLabel}][m]amix=inputs=2:duration=first:normalize=0[a]`;
}
ff([...inputs, "-filter_complex", graph, "-map", `[${last}]`, "-map", T.music ? "[a]" : `[${voiceLabel}]`, "-t", total.toFixed(3),
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", String(FPS), "-preset", "slow", "-crf", "25", "-c:a", "aac", "-b:a", "160k", "-ar", "44100",
  "-movflags", "+faststart", `${OUT}/${T.out}`]);
console.log(`built ${OUT}/${T.out} (${total.toFixed(1)} s)`);
