// Shared assembler for the parent-and-child ads (generalised from docs/social/ads/soy-yo/build.mjs, the approved pilot):
// 1080×1920, 30 fps, H.264 + AAC. Each ad's build.mjs only describes its shots and captions and calls buildAd().
// Hard cuts between every shot (a dissolve between two live shots doubled faces in the pilot); only the end card dissolves.
// The dialogue is the Kling clips' own lip-synced audio; a soft music bed under it rises when nobody speaks.
// Free: ffmpeg, pdftoppm and Playwright only. Owner 2026-10-27: no AI line inside the video (it goes in the ad copy).
// Safe zones: text only between 14 % (269 px) and 65 % (1248 px) of the height.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

export const ROOT = new URL("../../../../", import.meta.url).pathname.replace(/\/$/, "");
const W = 1080, H = 1920, FPS = 30, XF = 0.4, END_T = 3.2;
const ff = (args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
const enc = ["-c:v", "libx264", "-preset", "fast", "-crf", "15", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k"];
const NORM = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},setsar=1`;
// 1994 home-video look (concept 7): low resolution, chroma bleed, grain, washed colours.
// Soft-focus whatever lies below y px (an AI-drawn book in someone's hands), with a feathered edge so no seam shows.
export const blurBelow = (y, ramp = 160, sigma = 24) => `split[m][o];[o]gblur=sigma=${sigma},format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='clip((Y-${y})*255/${ramp},0,255)'[bl];[m][bl]overlay=0:0,format=yuv420p`;
export const VHS = "scale=360:640,scale=1080:1920:flags=bilinear,rgbashift=rh=5:bh=-5,eq=saturation=0.78:contrast=0.93:brightness=0.02:gamma=1.05,colorbalance=rs=0.05:bs=-0.04,noise=alls=14:allf=t,gblur=sigma=0.7";

/**
 * cfg = { dir, story (showcase id), music (docs/social/audio file), shots, line: { page, focus, html }, captions(t), riseAt(t) }
 * shot = { src, ss, t, audio?, audioFrom?: {src, ss}, vf? }  a video clip (audio: keep its sound; audioFrom: another clip's sound under it, an L-cut)
 *      | { page, mode: "fit"|"crop", px? (fit: page size, 1460 default; smaller for a long title), focus?, t, zoom?: [z0, z1], vf? }  a real page of the example PDF, slow push-in
 *      | { img, t, zoom?: [z0, z1], y?, vf? }  a still image already 9:16, slow push-in toward height fraction y
 * captions(t) gets { at(i, dt=0), end(i, dt=0), lineAt, endAt, total } and returns [html, from, to][]; shot index
 * shots.length is the line segment.
 */
export async function buildAd(cfg) {
  const { dir: DIR, story: STORY } = cfg;
  const TMP = `${DIR}/.build`;
  mkdirSync(TMP, { recursive: true });
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

  // ── Segments, normalised (1080×1920, 30 fps, stereo 44.1 kHz) ──
  const seg = [];
  const silence = (t) => ["-f", "lavfi", "-t", String(t), "-i", "anullsrc=r=44100:cl=stereo"];
  const AF = ["-af", "aresample=44100,aformat=channel_layouts=stereo,apad"];
  const still = (input, pre, s, out) => {
    const n = Math.round(s.t * FPS);
    const [z0, z1] = s.zoom ?? [1.03, 1.1];
    const y = s.y ?? 0.4;
    ff(["-loop", "1", "-i", input, ...silence(s.t), "-filter_complex",
      `[0:v]${pre},scale=${W * 2}:${H * 2}:flags=lanczos,zoompan=z='${z0}+${(z1 - z0).toFixed(3)}*on/${n}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)*${y}':d=${n}:s=${W}x${H}:fps=${FPS},setsar=1${s.vf ? `,${s.vf},setsar=1` : ""}[v]`,
      "-map", "[v]", "-map", "1:a", "-frames:v", String(n), "-t", String(s.t), ...enc, out]);
  };
  const cropPre = (focus) => `crop=ih*0.91*9/16:ih*0.91:min(max(iw*${focus}-ih*0.91*9/32\\,0)\\,iw-ih*0.91*9/16):0`;
  // A square text page (the dedication): the page at 1460 px, centre 1080 px kept (the text block is about 60 % of the page
  // width, so it stays whole and readable), on a blurred crop of the page's own paper above and below.
  const fitPre = (px = 1460) => `split[a][b];[a]crop=iw*0.12:ih*0.12:iw*0.02:ih*0.02,scale=${W}:${H},gblur=sigma=30[bg];[b]scale=${px}:${px},crop=${W}:${px}[fg];[bg][fg]overlay=0:${(H - px) / 2}`;
  for (const [i, s] of cfg.shots.entries()) {
    const out = `${TMP}/seg${i}.mp4`;
    if (s.src) {
      const a = s.audio ? ["-ss", String(s.ss), "-i", s.src] : s.audioFrom ? ["-ss", String(s.audioFrom.ss), "-i", s.audioFrom.src] : silence(s.t);
      ff(["-ss", String(s.ss), "-t", String(s.t), "-i", s.src, ...a, "-map", "0:v", "-map", "1:a", "-vf", `${NORM}${s.vf ? `,${s.vf},setsar=1` : ""}`, ...AF, "-t", String(s.t), ...enc, out]);
    } else if (s.page) still(pagePng(s.page), s.mode === "fit" ? fitPre(s.px) : cropPre(s.focus ?? 0.5), s, out);
    else still(s.img, NORM, s, out);
    seg.push({ file: out, t: s.t });
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

  const OV = [];
  for (const [html, from, to] of cfg.captions(T)) OV.push([await overlay(html), from, to]);
  OV.push([await overlay(`<div class="pill line">${cfg.line.html}</div>`), lineAt + 0.25, endAt]);
  const endCard = await overlay(`<div class="end"><div class="cover"></div><div class="t1">Su cuento.<br>Con su nombre y su cara.</div><div class="t2">Libro impreso desde 34,90 € IVA incluido</div><div class="pill web">meapica.es</div></div>`);
  await browser.close();
  ff(["-loop", "1", "-i", endCard, ...silence(END_T), "-filter_complex", `color=c=#FFF8F0:s=${W}x${H}:d=${END_T}[bg];[bg][0:v]overlay=0:0:shortest=1,fps=${FPS},format=yuv420p,setsar=1[v]`,
    "-map", "[v]", "-map", "1:a", "-t", String(END_T), ...enc, `${TMP}/seg-end.mp4`]);

  // ── Timeline: hard cuts (concat) for every shot and the line, a dissolve into the end card ──
  const inputs = [...seg.flatMap((s) => ["-i", s.file]), "-i", `${TMP}/seg-end.mp4`];
  const E = seg.length;
  let g = seg.map((_, i) => `[${i}:v]settb=AVTB,setpts=PTS-STARTPTS,fps=${FPS}[v${i}]`).join(";");
  g += `;${seg.map((_, i) => `[v${i}]`).join("")}concat=n=${seg.length}:v=1:a=0,fps=${FPS}[cut]`;
  g += `;[${E}:v]settb=AVTB,setpts=PTS-STARTPTS,fps=${FPS}[ve];[cut][ve]xfade=transition=fade:duration=${XF}:offset=${endAt.toFixed(3)}[base]`;
  OV.forEach(() => inputs.push("-loop", "1", "-t", total.toFixed(3), "-i", "OVERLAY"));
  let k = E + 1, last = "base";
  OV.forEach(([file, from, to], j) => {
    inputs[inputs.indexOf("OVERLAY")] = file;
    g += `;[${k + j}:v]format=rgba,fade=t=in:st=${from.toFixed(3)}:d=0.2:alpha=1[o${j}];[${last}][o${j}]overlay=0:0:enable='between(t,${from.toFixed(3)},${to.toFixed(3)})'[w${j}]`;
    last = `w${j}`;
  });
  // Sound: the clips' own audio, levelled, then the music bed: low under the dialogue, up when nobody speaks, out on the end card.
  g += `;${seg.map((_, i) => `[${i}:a]asetpts=PTS-STARTPTS[a${i}]`).join(";")};${seg.map((_, i) => `[a${i}]`).join("")}concat=n=${seg.length}:v=0:a=1,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100,apad=whole_dur=${total.toFixed(3)}[dlg]`;
  inputs.push("-stream_loop", "-1", "-i", `${ROOT}/docs/social/audio/${cfg.music}`);
  const mi = E + 1 + OV.length;
  const rise = cfg.riseAt(T);
  g += `;[${mi}:a]atrim=0:${total.toFixed(3)},asetpts=PTS-STARTPTS,aresample=44100,aformat=channel_layouts=stereo,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100,volume='0.13+0.37*min(max((t-${(rise - 0.5).toFixed(2)})/1.5,0),1)':eval=frame,afade=t=in:d=0.6,afade=t=out:st=${(total - 1.4).toFixed(2)}:d=1.4[mus]`;
  g += `;[dlg][mus]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.89[aout]`;
  ff([...inputs, "-filter_complex", g, "-map", `[${last}]`, "-map", "[aout]", "-t", total.toFixed(3), "-r", String(FPS),
    "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-movflags", "+faststart", `${DIR}/video.mp4`]);
  // Contact sheet: one frame every 2 s.
  const cols = Math.ceil(Math.ceil(total / 2) / 2);
  ff(["-i", `${DIR}/video.mp4`, "-vf", `fps=1/2,scale=270:480,tile=${cols}x2:padding=4:color=white`, "-frames:v", "1", `${DIR}/contact-sheet.jpg`]);
  console.log(`built ${DIR}/video.mp4 (${total.toFixed(2)} s); shots start at ${starts.map((s) => s.toFixed(2)).join(", ")}; end card ${endAt.toFixed(2)}`);
}
