// Shared assembler for the parent-and-child ads (generalised from the «¡Soy yo!» pilot):
// 1080×1920, 30 fps, H.264 + AAC. Each ad's build.mjs only describes its shots and captions and calls buildAd().
// Hard cuts between every shot (a dissolve between two live shots doubled faces in the pilot); only the end card dissolves.
// Owner 2026-10-27: no AI line inside the video (it goes in the ad copy). Safe zones: text only between 14 % and 65 % of the height.
//
// Sound (owner 2026-10-27, after watching with sound): every Kling clip brings its own generated ambience and music, so
// concatenating clip audio made the bed jump at every cut. Now only the VOICE comes from the clips (ElevenLabs audio
// isolation of each whole clip, cached in .build/voice/), gated to the spoken lines (±0.4 s), with 50 ms fades at every
// segment edge; one music bed and one
// continuous room tone run uninterrupted under the whole ad, ducked smoothly (1.2 s ramps, -4 dB) while someone speaks.
// Captions of spoken lines are timed from the real speech (ElevenLabs speech-to-text word timestamps of the isolated voice):
// first word to last word + 0.25 s. After the render the final mix is transcribed again and the report
// (.build/report.json, printed) gives caption-vs-word offsets, words cut by a shot edge, frozen clip starts and the bed level across cuts.
// Paid: ElevenLabs isolation + STT (cached per clip, so rebuilds only pay the final-mix check). Free otherwise: ffmpeg, pdftoppm, Playwright.
import { chromium } from "@playwright/test";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

export const ROOT = new URL("../../../../", import.meta.url).pathname.replace(/\/$/, "");
const W = 1080, H = 1920, FPS = 30, XF = 0.4, END_T = 3.2, SR = 44100;
const EDGE = 0.05; // audio fade at every segment edge (no clicks)
const HOLD = 0.4; // seconds of every Kling clip never shown (the frozen start frame)
const ff = (args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
const enc = ["-c:v", "libx264", "-preset", "fast", "-crf", "15", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k"];
const NORM = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},setsar=1`;
// 1994 home-video look (concept 7): low resolution, chroma bleed, grain, washed colours.
export const VHS = "scale=360:640,scale=1080:1920:flags=bilinear,rgbashift=rh=5:bh=-5,eq=saturation=0.78:contrast=0.93:brightness=0.02:gamma=1.05,colorbalance=rs=0.05:bs=-0.04,noise=alls=14:allf=t,gblur=sigma=0.7";
// Soft-focus whatever lies below y px (an AI-drawn book in someone's hands), with a feathered edge so no seam shows.
export const blurBelow = (y, ramp = 160, sigma = 24) => `split[m][o];[o]gblur=sigma=${sigma},format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='clip((Y-${y})*255/${ramp},0,255)'[bl];[m][bl]overlay=0:0,format=yuv420p`;

// ── ElevenLabs (key: ELEVENLABS_API_KEY in the env or .env.local, as scripts/social/render-video.mjs) ──
const elKey = () => {
  const k = process.env.ELEVENLABS_API_KEY ?? (existsSync(`${ROOT}/.env.local`) ? readFileSync(`${ROOT}/.env.local`, "utf8").match(/^ELEVENLABS_API_KEY=(.+)$/m)?.[1] : null);
  if (!k) throw new Error("ELEVENLABS_API_KEY missing (env or .env.local)");
  return k.trim().replace(/^"|"$/g, "");
};
async function elPost(path, field, file, extra = {}) {
  const fd = new FormData();
  fd.append(field, new Blob([readFileSync(file)]), file.split("/").pop());
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  for (let i = 0; i < 3; i++) {
    const res = await fetch(`https://api.elevenlabs.io${path}`, { method: "POST", headers: { "xi-api-key": elKey() }, body: fd });
    if (res.ok) return res;
    const msg = `ElevenLabs ${path}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`;
    if (res.status < 500 && res.status !== 429) throw new Error(msg);
    console.warn(msg, "retrying");
    await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
  }
  throw new Error(`ElevenLabs ${path}: failed 3 times`);
}
const stt = async (file) => (await (await elPost("/v1/speech-to-text", "file", file, { model_id: "scribe_v2", language_code: "spa", timestamps_granularity: "word", tag_audio_events: "false" })).json()).words.filter((w) => w.type === "word");
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, "").replace(/[^a-zñ0-9 ]/g, " ").split(/\s+/).filter(Boolean);
const plain = (html) => html.replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, "").replace(/[«»]/g, "").replace(/\s+/g, " ").trim();

// Whole-clip voice isolation + transcript, cached by file content.
export async function voiceOf(src, TMP) {
  const h = createHash("sha1").update(readFileSync(src)).digest("hex").slice(0, 12);
  const dir = `${TMP}/voice`;
  mkdirSync(dir, { recursive: true });
  const wav = `${dir}/${h}-src.wav`, iso = `${dir}/${h}.mp3`, js = `${dir}/${h}.json`;
  if (!existsSync(iso)) {
    ff(["-i", src, "-vn", "-ac", "1", "-ar", String(SR), "-af", "apad=whole_dur=5", wav]); // the API wants at least 4.6 s
    writeFileSync(iso, Buffer.from(await (await elPost("/v1/audio-isolation", "audio", wav)).arrayBuffer()));
  }
  if (!existsSync(js)) writeFileSync(js, JSON.stringify(await stt(iso)));
  return { iso, words: JSON.parse(readFileSync(js, "utf8")) };
}
// When a clip really starts moving: Kling holds or barely moves the start frame for a few tenths of a second. Per-frame
// difference (mean |ΔY| at 270×480); motion starts at the first frame reaching half the median of 0.5-2.5 s.
function motionStart(src) {
  const out = spawnSync("ffmpeg", ["-v", "info", "-t", "2.5", "-i", src, "-vf", "scale=270:480,tblend=all_mode=difference,signalstats,metadata=mode=print:key=lavfi.signalstats.YAVG", "-an", "-f", "null", "-"], { encoding: "utf8" }).stderr ?? "";
  const ts = [...out.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]));
  const ys = [...out.matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
  const late = ys.filter((_, i) => ts[i] >= 0.5).sort((x, y) => x - y);
  if (!late.length) return 0;
  const half = late[Math.floor(late.length / 2)] / 2;
  const i = ys.findIndex((y) => y >= half);
  return i < 0 ? 0 : ts[i];
}
function pcm(file, from, to) {
  const buf = execFileSync("ffmpeg", ["-v", "error", "-ss", String(Math.max(0, from)), "-t", String(to - from), "-i", file, "-ac", "1", "-ar", "8000", "-f", "f32le", "-"], { maxBuffer: 1 << 26 });
  const a = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  let s = 0;
  for (const v of a) s += v * v;
  return 10 * Math.log10(s / Math.max(1, a.length) + 1e-12);
}

/**
 * cfg = { dir, story (showcase id), music (docs/social/audio file), shots, line: { page, focus, html, t }, captions(t) }
 * shot = { src, ss, t, audio?, audioFrom?: {src, ss}, vf? }  a video clip (audio: keep its VOICE; audioFrom: another clip's voice under it, an L-cut)
 *      | { page, mode: "fit"|"crop", px?, focus?, t, zoom?: [z0, z1], vf? }  a real page of the example PDF, slow push-in
 *      | { img, t, zoom?: [z0, z1], y?, vf? }  a still image already 9:16, slow push-in toward height fraction y
 * captions(t) gets { at(i, dt=0), end(i, dt=0), lineAt, endAt, total } and returns entries:
 *   [html, from, to]            on-screen text (not speech), timed by hand
 *   { html, shot, say?, cls? }  a spoken line said during shot index `shot` (or [i, j]); timed from the words; `say` (default:
 *                               the html's text) is what must be heard; several entries in one shot split its words in order; cls "low" puts it
 *                               under an on-screen caption shown at the same time.
 */
export async function buildAd(cfg) {
  const { dir: DIR, story: STORY } = cfg;
  const TMP = `${DIR}/.build`;
  mkdirSync(TMP, { recursive: true });
  const report = { ad: DIR.split("/").pop(), warnings: [] };
  const warn = (m) => { report.warnings.push(m); console.warn("WARN", m); };
  const pdf = `${TMP}/${STORY}.pdf`;
  if (!existsSync(pdf)) writeFileSync(pdf, Buffer.from(await (await fetch(`https://meapica.es/api/showcase/${STORY}/pdf`)).arrayBuffer()));
  const pagePng = (p) => {
    const f = `${TMP}/p${p}-300.png`;
    if (!existsSync(f)) execFileSync("pdftoppm", ["-r", "300", "-png", "-f", String(p), "-l", String(p), "-singlefile", pdf, f.replace(/\.png$/, "")]);
    return f;
  };

  // ── Overlays (same brand fonts and pills as the pilot) ──
  const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&display=block');
*{margin:0;box-sizing:border-box} html,body{width:${W}px;height:${H}px;overflow:hidden;background:transparent}
body{font-family:Fredoka,sans-serif;position:relative;font-kerning:none}
.pill{position:absolute;left:50%;transform:translateX(-50%);max-width:940px;width:max-content;text-align:center;border-radius:28px;box-shadow:0 10px 30px rgba(27,18,14,.28)}
.cap{top:330px;background:rgba(27,18,14,.86);color:#FFF8F0;font-weight:600;font-size:62px;line-height:1.15;padding:18px 38px}
.cap.low{top:560px}
.line{top:900px;background:#FFF8F0;color:#1b120e;font-weight:700;font-size:68px;line-height:1.14;padding:30px 44px}
.line em{font-style:normal;color:#E86C3A}
.end{position:absolute;inset:0;background:#FFF8F0}
.cover{position:absolute;top:380px;left:50%;transform:translateX(-50%);width:580px;height:580px;border-radius:6px 14px 14px 6px;
  box-shadow:0 30px 60px rgba(27,18,14,.30),0 6px 14px rgba(27,18,14,.18);background:url('file://${pagePng(1)}') center/cover}
.t1{position:absolute;top:995px;left:0;right:0;text-align:center;color:#1b120e;font-weight:700;font-size:58px;line-height:1.12}
.t2{position:absolute;top:1135px;left:0;right:0;text-align:center;color:#1b120e;font-weight:600;font-size:42px}
.web{top:282px;background:#E86C3A;color:#fff;font-weight:600;font-size:40px;padding:10px 32px;border-radius:999px}
`;
  const browser = await chromium.launch();
  const tab = await browser.newPage({ viewport: { width: W, height: H } });
  let ovN = 0;
  async function overlay(body) {
    const name = `ov-${ovN++}`;
    writeFileSync(`${TMP}/${name}.html`, `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}</body></html>`);
    await tab.goto(`file://${TMP}/${name}.html`, { waitUntil: "networkidle" });
    await tab.evaluate(() => document.fonts.ready);
    // Guard the safe zone: every pill must sit between 14 % and 65 % of the height (the end card is exempt: no Reels UI over it).
    const boxes = await tab.$$eval(".pill:not(.web)", (els) => els.map((e) => e.getBoundingClientRect()).map((r) => [r.top, r.bottom]));
    for (const [top, bottom] of boxes) if (top < 0.14 * H || bottom > 0.65 * H) throw new Error(`text out of safe zone (${top}-${bottom}): ${body}`);
    await tab.screenshot({ path: `${TMP}/${name}.png`, omitBackground: true });
    return `${TMP}/${name}.png`;
  }

  // ── Segments: video normalised (1080×1920, 30 fps); voice segments (isolated, edge-faded) kept apart ──
  const seg = [];
  const still = (input, pre, s, out) => {
    const n = Math.round(s.t * FPS);
    const [z0, z1] = s.zoom ?? [1.03, 1.1];
    const y = s.y ?? 0.4;
    ff(["-loop", "1", "-i", input, "-filter_complex",
      `[0:v]${pre},scale=${W * 2}:${H * 2}:flags=lanczos,zoompan=z='${z0}+${(z1 - z0).toFixed(3)}*on/${n}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)*${y}':d=${n}:s=${W}x${H}:fps=${FPS},setsar=1${s.vf ? `,${s.vf},setsar=1` : ""}[v]`,
      "-map", "[v]", "-frames:v", String(n), "-an", ...enc, out]);
  };
  const cropPre = (focus) => `crop=ih*0.91*9/16:ih*0.91:min(max(iw*${focus}-ih*0.91*9/32\\,0)\\,iw-ih*0.91*9/16):0`;
  // A square text page (the dedication): the page at px (1460 default), centre 1080 px kept, on a blurred crop of its own paper.
  const fitPre = (px = 1460) => `split[a][b];[a]crop=iw*0.12:ih*0.12:iw*0.02:ih*0.02,scale=${W}:${H},gblur=sigma=30[bg];[b]scale=${px}:${px},crop=${W}:${px}[fg];[bg][fg]overlay=0:${(H - px) / 2}`;
  const words = []; // absolute word timings of the dialogue track
  let at = 0;
  for (const [i, shot] of cfg.shots.entries()) {
    const out = `${TMP}/seg${i}.mp4`;
    const s = { ...shot };
    if (s.src) {
      // Never open on the Kling start hold: an ad clip starts at least HOLD s in, and not before it really moves.
      if (s.src.startsWith(`${DIR}/clips/`)) {
        const min = Math.max(HOLD, motionStart(s.src));
        if (s.ss < min) { warn(`shot ${i}: ss ${s.ss} moved to ${min.toFixed(2)} (start hold of ${s.src.split("/").pop()})`); s.ss = +min.toFixed(3); }
      }
      const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", s.src], { encoding: "utf8" }));
      if (s.ss + s.t > dur - 0.05) { warn(`shot ${i}: t ${s.t} shortened to ${(dur - 0.05 - s.ss).toFixed(2)} (clip ends)`); s.t = +(dur - 0.05 - s.ss).toFixed(3); }
      ff(["-ss", String(s.ss), "-t", String(s.t), "-i", s.src, "-map", "0:v", "-vf", `${NORM}${s.vf ? `,${s.vf},setsar=1` : ""}`, "-an", "-t", String(s.t), ...enc, out]);
    } else if (s.page) still(pagePng(s.page), s.mode === "fit" ? fitPre(s.px) : cropPre(s.focus ?? 0.5), s, out);
    else still(s.img, NORM, s, out);
    // Voice for this segment: the shot's own clip, or another clip's (L-cut).
    const v = s.src && s.audio ? { src: s.src, ss: s.ss } : s.audioFrom ? { ...s.audioFrom } : null;
    seg.push({ file: out, voice: `${TMP}/voice${i}.wav`, v, t: s.t, at });
    at += s.t;
  }
  // Voice segments: trimmed to the shot, 50 ms fades at every edge, except where the next shot carries on the same take
  // (an L-cut from a live shot into a page insert), which stays one continuous piece of speech.
  const same = (x, y) => x?.v && y?.v && x.v.src === y.v.src && Math.abs(x.v.ss + x.t - y.v.ss) < 0.02;
  for (const [i, sg] of seg.entries()) {
    if (!sg.v) { ff(["-f", "lavfi", "-t", String(sg.t), "-i", `anullsrc=r=${SR}:cl=stereo`, sg.voice]); continue; }
    const { iso, words: cw } = await voiceOf(sg.v.src, TMP);
    const a = sg.v.ss, b = sg.v.ss + sg.t, inP = same(seg[i - 1], sg), inN = same(sg, seg[i + 1]);
    for (const w of cw) {
      if (w.end <= a || w.start >= b) continue;
      const name = sg.v.src.split("/").pop();
      if (w.start < a - 0.02 && !inP) warn(`shot ${i}: its start (${a.toFixed(2)} s of ${name}) cuts into the word "${w.text}" (${w.start}-${w.end})`);
      else if (w.end > b + 0.02 && !inN) warn(`shot ${i}: its end (${b.toFixed(2)} s of ${name}) cuts the word "${w.text}" (${w.start}-${w.end})`);
      if (w.start >= a - 0.02 && w.start < b) words.push({ text: w.text, start: sg.at + w.start - a, end: sg.at + Math.min(w.end, inN ? w.end : b) - a, shot: i });
    }
    const fades = [!inP && `afade=t=in:d=${EDGE}`, !inN && `afade=t=out:st=${(sg.t - EDGE).toFixed(3)}:d=${EDGE}`].filter(Boolean).join(",");
    ff(["-ss", String(a), "-t", String(sg.t), "-i", iso, "-af", `aresample=${SR},aformat=channel_layouts=stereo,apad,atrim=0:${sg.t}${fades ? `,${fades}` : ""}`, "-ar", String(SR), sg.voice]);
  }
  // The closing line over the real hero portrait page, slow push-in, darkened a touch for the text.
  const LINE_T = cfg.line.t ?? 3.2;
  still(pagePng(cfg.line.page ?? 29), cropPre(cfg.line.focus ?? 0.62), { t: LINE_T, zoom: [1.04, 1.12], y: 0.35, vf: "eq=brightness=-0.04" }, `${TMP}/seg-line.mp4`);
  seg.push({ file: `${TMP}/seg-line.mp4`, t: LINE_T });

  const starts = seg.map((_, i) => seg.slice(0, i).reduce((a, s) => a + s.t, 0));
  const lineAt = starts[seg.length - 1];
  const endAt = lineAt + LINE_T - XF;
  const total = endAt + END_T;
  const T = { at: (i, dt = 0) => starts[i] + dt, end: (i, dt = 0) => starts[i] + seg[i].t + dt, lineAt, endAt, total };

  // ── Captions: on-screen text as given; spoken lines from the words ──
  const entries = cfg.captions(T);
  const spoken = entries.filter((e) => !Array.isArray(e));
  const byShot = new Map();
  for (const e of spoken) { const k = JSON.stringify([e.shot].flat()); byShot.set(k, [...(byShot.get(k) ?? []), e]); }
  const OVT = [];
  for (const e of entries) if (Array.isArray(e)) OVT.push(e);
  report.captions = [];
  for (const [k, group] of byShot) {
    const shots = JSON.parse(k);
    let pool = words.filter((w) => shots.includes(w.shot));
    for (const [gi, e] of group.entries()) {
      const say = e.say ?? plain(e.html);
      const n = norm(say).length;
      const take = gi === group.length - 1 ? pool : pool.slice(0, n);
      pool = pool.slice(take.length);
      if (!take.length) { warn(`no speech found for «${say}» in shot ${k}`); continue; }
      const heard = take.map((w) => w.text).join(" ");
      if (norm(heard).join(" ") !== norm(say).join(" ")) warn(`caption «${say}» but the transcript heard «${heard}»`);
      const from = Math.max(0, take[0].start - 0.05), to = Math.min(take[take.length - 1].end + 0.25, lineAt);
      OVT.push([`<div class="pill cap${e.cls ? ` ${e.cls}` : ""}">${e.html}</div>`, from, to]); // 50 ms ahead of the first word
      report.captions.push({ say, heard, from: +from.toFixed(3), to: +to.toFixed(3), lastWord: +take[take.length - 1].end.toFixed(3) });
    }
  }
  const OV = [];
  for (const [html, from, to] of OVT) OV.push([await overlay(html), from, to]);
  OV.push([await overlay(`<div class="pill line">${cfg.line.html}</div>`), lineAt + 0.25, endAt]);
  const endCard = await overlay(`<div class="end"><div class="cover"></div><div class="t1">Su cuento.<br>Con su nombre y su cara.</div><div class="t2">Libro impreso desde 34,90 € IVA incluido</div><div class="pill web">meapica.es</div></div>`);
  await browser.close();
  ff(["-loop", "1", "-i", endCard, "-filter_complex", `color=c=#FFF8F0:s=${W}x${H}:d=${END_T}[bg];[bg][0:v]overlay=0:0:shortest=1,fps=${FPS},format=yuv420p,setsar=1[v]`,
    "-map", "[v]", "-t", String(END_T), "-an", ...enc, `${TMP}/seg-end.mp4`]);

  // ── Sound stems (rendered once, also used by the report) ──
  // Dialogue: the isolated voice segments back to back, levelled with ONE linear gain (two-pass loudnorm, linear=true), so
  // the pauses between lines are not pumped up the way a dynamic loudnorm over a mostly silent track does.
  const voices = seg.filter((s) => s.voice);
  // Only speech: the isolated voice is gated open from 0.4 s before to 0.4 s after each run of words (50 ms ramps), so
  // hums, breaths or anything else the isolation let through outside the lines never reach the mix.
  const runs = [];
  for (const w of [...words].sort((x, y) => x.start - y.start)) {
    if (runs.length && w.start - runs[runs.length - 1][1] < 0.8) runs[runs.length - 1][1] = Math.max(runs[runs.length - 1][1], w.end); else runs.push([w.start, w.end]);
  }
  const speechGate = runs.length ? runs.map(([a, b]) => `clip(min((t-${(a - 0.4).toFixed(3)})/${EDGE},(${(b + 0.4).toFixed(3)}-t)/${EDGE}),0,1)`).reduce((x, y) => `max(${x},${y})`) : "0";
  ff([...voices.flatMap((s) => ["-i", s.voice]), "-filter_complex", `${voices.map((_, i) => `[${i}:a]`).join("")}concat=n=${voices.length}:v=0:a=1,apad=whole_dur=${total.toFixed(3)},atrim=0:${total.toFixed(3)},volume='${speechGate}':eval=frame[a]`, "-map", "[a]", "-ar", String(SR), `${TMP}/stem-dialogue-raw.wav`]);
  const LN = "I=-16:TP=-1.5:LRA=11";
  const meas = spawnSync("ffmpeg", ["-v", "info", "-i", `${TMP}/stem-dialogue-raw.wav`, "-af", `loudnorm=${LN}:print_format=json`, "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const m = JSON.parse(meas.slice(meas.lastIndexOf("{"), meas.lastIndexOf("}") + 1));
  const lin = Number.isFinite(Number(m.input_i)) ? `loudnorm=${LN}:linear=true:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset},aresample=${SR}` : "anull";
  ff(["-i", `${TMP}/stem-dialogue-raw.wav`, "-af", lin, "-ar", String(SR), `${TMP}/stem-dialogue.wav`]);
  // Bed: one music track (levelled so its own phrasing never swings more than a few dB) + one quiet room tone, continuous; -4 dB while someone speaks (1.2 s ramps), out on the end card.
  const talk = [];
  for (const w of words) {
    const a = w.start - 0.15, b = w.end + 0.3;
    if (talk.length && a <= talk[talk.length - 1][1] + 0.7) talk[talk.length - 1][1] = b; else talk.push([a, b]);
  }
  const RAMP = 1.2, DUCK = -4;
  // Gain in dB at t: the deepest of the ducks of every talk interval (each a trapezoid with RAMP-long slopes).
  const duck = talk.map(([a, b]) => `${DUCK}*clip(min((t-${(a - RAMP).toFixed(3)})/${RAMP},(${(b + RAMP).toFixed(3)}-t)/${RAMP}),0,1)`);
  const gain = duck.length ? duck.reduce((x, y) => `min(${x},${y})`) : "0";
  // The music, levelled (dynaudnorm + gentle compression), rendered SEARCH s longer than the ad; then the start offset is
  // chosen so that no cut lands on a phrase change of the song (smallest worst 0.4 s level step across the cuts).
  const SEARCH = 24;
  ff(["-stream_loop", "-1", "-i", `${ROOT}/docs/social/audio/${cfg.music}`, "-filter_complex",
    `[0:a]atrim=0:${(total + SEARCH).toFixed(3)},asetpts=PTS-STARTPTS,aresample=${SR},aformat=channel_layouts=stereo,dynaudnorm=f=150:g=7:m=8:p=0.7,acompressor=threshold=0.08:ratio=3:attack=20:release=800,loudnorm=I=-16:TP=-1.5:LRA=7,aresample=${SR}[m]`,
    "-map", "[m]", "-ar", String(SR), `${TMP}/music-lev.wav`]);
  const mus = (() => { const buf = execFileSync("ffmpeg", ["-v", "error", "-i", `${TMP}/music-lev.wav`, "-ac", "1", "-ar", "8000", "-f", "f32le", "-"], { maxBuffer: 1 << 28 }); return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4); })();
  const lev = (x, y) => { let q = 0; const i0 = Math.round(x * 8000), i1 = Math.round(y * 8000); for (let k = i0; k < i1; k++) q += mus[k] * mus[k]; return 10 * Math.log10(q / Math.max(1, i1 - i0) + 1e-12); };
  const cutTimes = [...starts.slice(1), endAt];
  let off = 0, best = Infinity;
  for (let o = 0; o <= SEARCH - 0.5; o += 0.25) {
    if (lev(o, o + total - 1.4) < -40) continue;
    const worst = Math.max(...cutTimes.map((c) => Math.abs(lev(o + c, o + c + 0.4) - lev(o + c - 0.4, o + c))));
    if (worst < best - 0.3) { best = worst; off = o; }
  }
  report.musicOffset = off;
  ff(["-i", `${TMP}/music-lev.wav`, "-f", "lavfi", "-t", total.toFixed(3), "-i", `anoisesrc=color=brown:amplitude=0.02:r=${SR}`, "-filter_complex",
    `[0:a]atrim=${off}:${(off + total).toFixed(3)},asetpts=PTS-STARTPTS,volume=0.34[m];` +
    `[1:a]lowpass=f=400,highpass=f=60,volume=0.25,aformat=channel_layouts=stereo[r];` +
    `[m][r]amix=inputs=2:duration=first:normalize=0,volume='pow(10,(${gain})/20)':eval=frame,afade=t=in:d=0.6,afade=t=out:st=${(total - 1.4).toFixed(2)}:d=1.4[b]`,
    "-map", "[b]", "-t", total.toFixed(3), "-ar", String(SR), `${TMP}/stem-bed.wav`]);

  // ── Timeline: hard cuts (concat) for every shot and the line, a dissolve into the end card ──
  const inputs = [...seg.flatMap((s) => ["-i", s.file]), "-i", `${TMP}/seg-end.mp4`];
  const E = seg.length;
  let g = seg.map((_, i) => `[${i}:v]settb=AVTB,setpts=PTS-STARTPTS,fps=${FPS}[v${i}]`).join(";");
  g += `;${seg.map((_, i) => `[v${i}]`).join("")}concat=n=${seg.length}:v=1:a=0,fps=${FPS}[cut]`;
  g += `;[${E}:v]settb=AVTB,setpts=PTS-STARTPTS,fps=${FPS}[ve];[cut][ve]xfade=transition=fade:duration=${XF}:offset=${endAt.toFixed(3)}[base]`;
  let last = "base";
  OV.forEach(([file, from, to], j) => {
    inputs.push("-loop", "1", "-t", total.toFixed(3), "-i", file);
    g += `;[${E + 1 + j}:v]format=rgba,fade=t=in:st=${from.toFixed(3)}:d=0.15:alpha=1[o${j}];[${last}][o${j}]overlay=0:0:enable='between(t,${from.toFixed(3)},${to.toFixed(3)})'[w${j}]`;
    last = `w${j}`;
  });
  const di = E + 1 + OV.length;
  inputs.push("-i", `${TMP}/stem-dialogue.wav`, "-i", `${TMP}/stem-bed.wav`);
  g += `;[${di}:a][${di + 1}:a]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.89[aout]`;
  ff([...inputs, "-filter_complex", g, "-map", `[${last}]`, "-map", "[aout]", "-t", total.toFixed(3), "-r", String(FPS),
    "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", String(SR), "-movflags", "+faststart", `${DIR}/video.mp4`]);
  // Contact sheet: one frame every 2 s.
  const cols = Math.ceil(Math.ceil(total / 2) / 2);
  ff(["-i", `${DIR}/video.mp4`, "-vf", `fps=1/2,scale=270:480,tile=${cols}x2:padding=4:color=white`, "-frames:v", "1", `${DIR}/contact-sheet.jpg`]);

  // ── Report ──
  // Bed across every cut. The bed is ONE continuous music track + room tone, so an edit can only change it through the
  // ducking gain: gainStepDb = mean gain 0.25 s after the cut minus 0.25 s before; loudnessStepLU = EBU momentary loudness
  // (400 ms) of the bed just after vs just before the cut (target: within ±3).
  const gainDb = (t) => talk.reduce((m, [a, b]) => Math.min(m, DUCK * Math.min(Math.max(Math.min((t - (a - RAMP)) / RAMP, (b + RAMP - t) / RAMP), 0), 1)), 0);
  const meanGain = (x, y) => { let s = 0; for (let k = 0; k < 25; k++) s += gainDb(x + ((y - x) * (k + 0.5)) / 25); return s / 25; };
  const r128 = spawnSync("ffmpeg", ["-v", "info", "-i", `${TMP}/stem-bed.wav`, "-af", "ebur128=metadata=1,ametadata=mode=print:key=lavfi.r128.M", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 26 }).stderr;
  const mT = [...r128.matchAll(/pts_time:([\d.]+)/g)].map((x) => Number(x[1])), mL = [...r128.matchAll(/r128\.M=(-?[\d.]+|-inf)/g)].map((x) => Number(x[1]));
  const M = (t) => { let k = 0; while (k < mT.length - 1 && mT[k] < t) k++; return mL[k]; }; // momentary loudness = the 400 ms ending at t
  report.bedAcrossCuts = cutTimes.map((c) => ({ cut: +c.toFixed(2), gainStepDb: +(meanGain(c, c + 0.25) - meanGain(c - 0.25, c)).toFixed(2), loudnessStepLU: +(M(c + 0.4) - M(c)).toFixed(2) }));
  report.maxBedGainStepDb = Math.max(0, ...report.bedAcrossCuts.map((x) => Math.abs(x.gainStepDb)));
  report.maxBedLoudnessStepLU = Math.max(0, ...report.bedAcrossCuts.map((x) => Math.abs(x.loudnessStepLU)));
  // What is left of the clips' own ambience in the dialogue stem: RMS away from any word (±0.5 s), in dBFS.
  {
    const gaps = [];
    let t0 = 0;
    for (const w of [...words].sort((x, y) => x.start - y.start)) { if (w.start - 0.5 > t0 + 0.3) gaps.push([t0, w.start - 0.5]); t0 = Math.max(t0, w.end + 0.5); }
    if (lineAt > t0 + 0.3) gaps.push([t0, lineAt]);
    report.dialogueStemNoSpeechDb = gaps.length ? +Math.max(...gaps.map(([x, y]) => pcm(`${TMP}/stem-dialogue.wav`, x, y))).toFixed(1) : null;
  }
  // Caption vs words, independently: transcribe the FINAL mix and compare each spoken caption with the words heard there.
  if (report.captions.length) {
    ff(["-i", `${DIR}/video.mp4`, "-vn", "-ac", "1", "-ar", String(SR), `${TMP}/final-mix.wav`]);
    const fw = await stt(`${TMP}/final-mix.wav`);
    for (const c of report.captions) {
      const lastSaid = c.lastWord;
      const near = fw.filter((w) => w.end > c.from - 0.3 && w.start < lastSaid + 0.3);
      const first = near[0], lastW = near[near.length - 1];
      if (!first) { warn(`final mix: nothing heard under «${c.say}»`); continue; }
      c.finalHeard = near.map((w) => w.text).join(" ");
      c.startOffset = +(c.from - first.start).toFixed(3);
      c.endOffset = +(lastSaid - lastW.end).toFixed(3); // caption shows until lastWord + 0.25 s (never over the line card)
    }
    report.maxCaptionOffset = Math.max(0, ...report.captions.filter((c) => c.startOffset !== undefined).flatMap((c) => [Math.abs(c.startOffset), Math.abs(c.endOffset)]));
  }
  report.total = +total.toFixed(2);
  report.starts = starts.map((s) => +s.toFixed(2));
  writeFileSync(`${TMP}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`built ${DIR}/video.mp4 (${total.toFixed(2)} s)`);
}
