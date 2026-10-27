// Replaces the voice of a generated clip with an ElevenLabs line, timed to where the clip's own actor says it, so the
// mouth the video model drew still matches (owner 2026-10-27: voices always ElevenLabs). The clip must already speak the
// same words (Seedance / Kling with AUDIO=on and the line quoted in the prompt). Video is copied untouched.
//   node scripts/social/dub-clip.mjs <in.mp4> <out.mp4> <voiceId> "<line>" ["<delivery tag>"]
// Paid: TAKES ElevenLabs TTS takes + one speech-to-text per take and one for the clip. Needs ffmpeg and ELEVENLABS_API_KEY (env or .env.local).
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const [src, out, voice, line, tag = ""] = process.argv.slice(2);
if (!src || !out || !voice || !line) throw new Error('usage: dub-clip.mjs <in.mp4> <out.mp4> <voiceId> "<line>" ["<tag>"]');
const ROOT = new URL("../../", import.meta.url).pathname;
const key = (process.env.ELEVENLABS_API_KEY ?? (existsSync(`${ROOT}.env.local`) ? readFileSync(`${ROOT}.env.local`, "utf8").match(/^ELEVENLABS_API_KEY=(.+)$/m)?.[1] : ""))?.trim().replace(/^"|"$/g, "");
if (!key) throw new Error("ELEVENLABS_API_KEY missing");
const ff = (args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args]);
const T = mkdtempSync(`${tmpdir()}/dub-`);

async function words(file) {
  const fd = new FormData();
  fd.append("file", new Blob([readFileSync(file)]), "a.wav");
  for (const [k, v] of Object.entries({ model_id: "scribe_v2", language_code: "spa", timestamps_granularity: "word", tag_audio_events: "false" })) fd.append(k, v);
  const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": key }, body: fd });
  if (!r.ok) throw new Error(`stt HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).words.filter((w) => w.type === "word");
}
const span = (ws) => [ws[0].start, ws[ws.length - 1].end];

ff(["-i", src, "-vn", "-ac", "1", "-ar", "44100", `${T}/orig.wav`]);
const ow = await words(`${T}/orig.wav`);
if (!ow.length) throw new Error(`no speech in ${src}`);
const [o0, o1] = span(ow);

// TAKES TTS takes (default 4): keep those whose transcript is the line, then the one whose pace is closest to the actor's,
// so the stretch below stays small (a 0.77 stretch or a 1.27 squeeze is audible).
const norm = (x) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zñ0-9 ]/g, " ").split(/\s+/).filter(Boolean).join(" ");
const takes = [];
for (let i = 0; i < Number(process.env.TAKES ?? 4); i++) {
  const tts = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ text: `${tag} ${line}`.trim(), model_id: "eleven_v4", language_code: "es" }) });
  if (!tts.ok) throw new Error(`tts HTTP ${tts.status} ${(await tts.text()).slice(0, 200)}`);
  const file = `${T}/tts${i}.mp3`;
  writeFileSync(file, Buffer.from(await tts.arrayBuffer()));
  const tw = await words(file);
  if (!tw.length) continue;
  const [a, b] = span(tw);
  const ok = norm(tw.map((w) => w.text).join(" ")) === norm(line);
  takes.push({ file, a, b, ok, heard: tw.map((w) => w.text).join(" "), tempo: (b - a) / (o1 - o0) });
}
const pool = takes.filter((t) => t.ok);
if (!pool.length) throw new Error(`no take says «${line}»: ${takes.map((t) => `«${t.heard}»`).join(", ")}`);
const best = pool.sort((x, y) => Math.abs(Math.log(x.tempo)) - Math.abs(Math.log(y.tempo)))[0];
const [t0, t1] = [best.a, best.b];
// Stretch the spoken part to the actor's span (atempo stays natural within ±25 %), then place it on the actor's first word.
const tempo = best.tempo;
if (tempo < 0.75 || tempo > 1.33) console.warn(`tempo ${tempo.toFixed(2)}: the TTS line is far from the actor's timing, re-take it`);
const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src], { encoding: "utf8" }));
ff(["-ss", String(t0), "-t", String(t1 - t0 + 0.15), "-i", best.file, "-af", `atempo=${Math.min(2, Math.max(0.5, tempo)).toFixed(4)},adelay=${Math.round(o0 * 1000)},apad=whole_dur=${dur}`, "-ar", "44100", "-ac", "1", `${T}/voice.wav`]);
ff(["-i", src, "-i", `${T}/voice.wav`, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", out]);
console.log(`dubbed ${out}: actor ${o0.toFixed(2)}-${o1.toFixed(2)} s «${ow.map((w) => w.text).join(" ")}», tempo ${tempo.toFixed(2)} (best of ${pool.length}/${takes.length} clean takes: ${takes.map((t) => t.tempo.toFixed(2) + (t.ok ? "" : "✗")).join(" ")})`);
