#!/usr/bin/env node
/**
 * Illustration-engine benchmark for meapica.
 *
 * Feeds the SAME character reference + the SAME scene prompts to every engine,
 * so the only variable is the image model. Measures latency + cost, saves every
 * image side by side, and scores each engine's set with a single Gemini 2.5 Flash
 * judge (same judge for everyone → fair cross-engine comparison).
 *
 * Engines (arms):
 *   - recraft        Recraft V3 (current production) — custom style_id from the reference portrait
 *   - flux2-pro      FLUX.2 [pro]  (BFL, input_image reference)
 *   - flux2-flex     FLUX.2 [flex] (BFL, input_image reference)
 *   - nano-pro       Nano Banana Pro   (Gemini 3 Pro Image, multi-image reference)
 *   - nano-flash     Nano Banana Flash (Gemini 3.1 Flash Image, multi-image reference)
 *
 * Usage:
 *   node scripts/benchmark-illustrations.mjs                  # all arms with keys present
 *   node scripts/benchmark-illustrations.mjs --arms=recraft,flux2-pro
 *   node scripts/benchmark-illustrations.mjs --ref=path/to/portrait.png   # provide reference
 *
 * Keys read from .env.local: RECRAFT_API_TOKEN, BFL_API_KEY, GEMINI_API_KEY
 * Output: artifacts/benchmark/{reference.png, <arm>/scene-N.png, results.json, REPORT.md, contact-sheet.html}
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
let OUT = path.join(ROOT, "artifacts", "benchmark");

// ── env loader (standalone node — Next won't load .env.local for us) ─────────
function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    }
  }
}
loadEnv();

const RECRAFT_TOKEN = process.env.RECRAFT_API_TOKEN || "";
const BFL_KEY = process.env.BFL_API_KEY || "";
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";

// Model ids (overridable)
const NANO_PRO_MODEL = process.env.NANO_PRO_MODEL || "gemini-3-pro-image-preview";
const NANO_FLASH_MODEL = process.env.NANO_FLASH_MODEL || "gemini-3.1-flash-image";
const JUDGE_MODEL = process.env.BENCH_JUDGE_MODEL || "gemini-2.5-flash";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// ── per-image cost ($) — matches the cost table; BFL real cost captured live ─
const COST = {
  recraft: 0.04,
  "flux2-pro": 0.03,
  "flux2-flex": 0.01,
  "nano-pro": 0.134, // 2K
  "nano-flash": 0.067, // 1K
};

// ── fixture: one demanding test book (space adventure) ───────────────────────
const CHARACTER_REF =
  "A 6-year-old girl named Lucía, fair pinkish-white skin, shoulder-length wavy chestnut-brown hair, " +
  "large warm hazel eyes, small friendly smile, wearing a white astronaut suit with a soft teal trim and a small red star patch.";

const STYLE =
  "Children's book watercolor illustration, soft warm palette, gentle brushstrokes, slightly whimsical proportions, " +
  "Studio Ghibli meets Beatrix Potter, clean lines with soft watercolor fill, no text, no frame.";

// Reinforced watercolor look — pushes hard away from digital/vector/3D toward
// authentic hand-painted traditional watercolor (selected with --watercolor).
const WATERCOLOR_STYLE =
  "Traditional hand-painted children's book watercolor illustration. Loose wet-on-wet watercolor washes with soft bleeding edges, " +
  "visible cold-press watercolor paper grain and texture, granulating pigment, gentle gouache highlights, delicate ink linework. " +
  "Muted warm storybook palette, Studio Ghibli meets Beatrix Potter meets Quentin Blake. " +
  "Painterly and analog, NOT digital, NOT vector, NOT 3D render, NOT glossy, NOT airbrushed. No text, no frame, no border.";

let ACTIVE_STYLE = STYLE;

// representative layouts: single-char, multi-char, panoramic spread, full-body action
const SCENES = [
  {
    n: 1,
    label: "immersive-single",
    aspect: "1:1",
    recraftSize: "1024x1024",
    fluxW: 1024,
    fluxH: 1024,
    prompt:
      "floating weightless inside a cozy spaceship cockpit, looking out a round window at planet Earth glowing blue below, soft cabin light",
  },
  {
    n: 2,
    label: "multi-character",
    aspect: "1:1",
    recraftSize: "1024x1024",
    fluxW: 1024,
    fluxH: 1024,
    prompt:
      "sharing a picnic on a soft purple alien meadow with a small round friendly green alien creature with big eyes, both laughing, two tiny moons in the sky",
  },
  {
    n: 3,
    label: "panoramic-spread",
    aspect: "16:9",
    recraftSize: "1820x1024",
    fluxW: 1440,
    fluxH: 1024,
    prompt:
      "walking across a wide alien desert of pale pink dunes under a sky with two moons and a ringed planet on the horizon, full wide landscape",
  },
  {
    n: 4,
    label: "full-action",
    aspect: "3:4",
    recraftSize: "1024x1365",
    fluxW: 1024,
    fluxH: 1408,
    prompt:
      "full body, planting a small red flag on a rocky moon surface, arms raised in triumph, stars and the Milky Way behind her",
  },
];

const buildPrompt = (scene) => `${CHARACTER_REF} ${scene.prompt}. ${ACTIVE_STYLE}`;

// ── helpers ──────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now();
const ensureDir = (d) => fs.mkdirSync(d, { recursive: true });

async function downloadToFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return buf;
}
const fileToBase64 = (p) => fs.readFileSync(p).toString("base64");

// ── Recraft V3 ────────────────────────────────────────────────────────────────
async function recraftCreateStyle(refPath) {
  const form = new FormData();
  form.append("style", "digital_illustration");
  form.append("file", new Blob([fs.readFileSync(refPath)], { type: "image/png" }), "ref.png");
  const res = await fetch("https://external.api.recraft.ai/v1/styles", {
    method: "POST",
    headers: { Authorization: `Bearer ${RECRAFT_TOKEN}` },
    body: form,
  });
  if (!res.ok) throw new Error(`recraft style ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return j.id;
}

async function recraftGenerate(scene, styleId, dest) {
  const body = {
    prompt: buildPrompt(scene),
    model: "recraftv3",
    size: scene.recraftSize,
    n: 1,
    response_format: "url",
    style_id: styleId,
    controls: { no_text: true },
  };
  const res = await fetch("https://external.api.recraft.ai/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RECRAFT_TOKEN}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`recraft gen ${res.status}: ${await res.text()}`);
  const j = await res.json();
  await downloadToFile(j.data[0].url, dest);
}

// ── FLUX.2 (BFL) — async polling, input_image reference ───────────────────────
async function fluxGenerate(model, scene, refB64, dest) {
  const endpoints = [`https://api.bfl.ai/v1/${model}`, `https://api.bfl.ai/v1/${model}-preview`];
  let submit, lastErr;
  for (const ep of endpoints) {
    const res = await fetch(ep, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-key": BFL_KEY },
      body: JSON.stringify({
        prompt: buildPrompt(scene),
        input_image: refB64,
        width: scene.fluxW,
        height: scene.fluxH,
        output_format: "png",
        safety_tolerance: 4,
      }),
    });
    if (res.ok) { submit = await res.json(); break; }
    lastErr = `${res.status} ${await res.text()}`;
    if (res.status !== 404) break;
  }
  if (!submit) throw new Error(`flux submit failed: ${lastErr}`);
  const pollUrl = submit.polling_url;
  let cost = submit.cost ?? null;
  for (let i = 0; i < 90; i++) {
    await sleep(2000);
    const pr = await fetch(pollUrl, { headers: { "x-key": BFL_KEY } });
    const pj = await pr.json();
    if (pj.cost != null) cost = pj.cost;
    if (pj.status === "Ready") {
      await downloadToFile(pj.result.sample, dest);
      return cost;
    }
    if (pj.status === "Error" || pj.status === "Failed")
      throw new Error(`flux ${pj.status}: ${JSON.stringify(pj.result || pj)}`);
  }
  throw new Error("flux poll timeout");
}

// ── Gemini image (Nano Banana Pro / Flash) ────────────────────────────────────
async function geminiGenerate(model, scene, refB64, imageSize, dest) {
  const body = {
    contents: [
      {
        parts: [
          { text: buildPrompt(scene) },
          { inlineData: { mimeType: "image/png", data: refB64 } },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: scene.aspect, imageSize },
    },
  };
  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`gemini ${model} ${res.status}: ${await res.text()}`);
  const j = await res.json();
  const parts = j.candidates?.[0]?.content?.parts || [];
  const img = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
  if (!img) throw new Error(`gemini ${model}: no image in response: ${JSON.stringify(j).slice(0, 400)}`);
  const b64 = img.inlineData?.data || img.inline_data?.data;
  fs.writeFileSync(dest, Buffer.from(b64, "base64"));
}

// ── Gemini 2.5 Flash judge (same judge for every arm) ─────────────────────────
async function judgeArm(refB64, sceneFiles) {
  const specs = SCENES.map((s) => `Scene ${s.n} (${s.label}): ${s.prompt}`).join("\n");
  const prompt =
    `You are an expert children's book art director. The FIRST image is the CHARACTER REFERENCE portrait of the protagonist.\n` +
    `CHARACTER: ${CHARACTER_REF}\n\nThe next ${sceneFiles.length} images are scene illustrations, in scene order.\n` +
    `SCENE SPECS:\n${specs}\n\n` +
    `For each scene rate 1-10:\n` +
    `- consistency: does the child match the reference portrait (face, hair, eyes, skin, outfit)?\n` +
    `- coherence: does the image match the scene description?\n` +
    `- quality: watercolor children's-book look, full-bleed, no text/watermark, good composition?\n` +
    `Output ONLY JSON: {"verdicts":[{"scene":1,"consistency":8,"coherence":9,"quality":8,"notes":"..."}]}`;

  const parts = [{ text: prompt }, { inlineData: { mimeType: "image/png", data: refB64 } }];
  for (const f of sceneFiles) parts.push({ inlineData: { mimeType: "image/png", data: fileToBase64(f) } });

  let res, lastTxt;
  for (let attempt = 0; attempt < 4; attempt++) {
    res = await fetch(`${GEMINI_BASE}/${JUDGE_MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ["TEXT"], temperature: 0 } }),
    });
    if (res.ok) break;
    lastTxt = await res.text();
    if (res.status === 503 || res.status === 429) { await sleep(5000 * (attempt + 1)); continue; } // transient overload
    break;
  }
  if (!res.ok) throw new Error(`judge ${res.status}: ${lastTxt}`);
  const j = await res.json();
  const text = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`judge: no JSON: ${text.slice(0, 300)}`);
  return JSON.parse(m[0]).verdicts;
}

// ── runner ────────────────────────────────────────────────────────────────────
const ARM_KEYS = {
  recraft: () => !!RECRAFT_TOKEN,
  "flux2-pro": () => !!BFL_KEY,
  "flux2-flex": () => !!BFL_KEY,
  "nano-pro": () => !!GEMINI_KEY,
  "nano-flash": () => !!GEMINI_KEY,
};

// Returns { cost, raw } — cost = published per-image price used for accounting;
// raw = provider-reported value (BFL returns CREDITS, 1 credit ≈ $0.01; unit ambiguous so not used for totals).
async function genScene(arm, scene, ctx, dest) {
  if (arm === "recraft") { await recraftGenerate(scene, ctx.styleId, dest); return { cost: COST.recraft, raw: null }; }
  if (arm === "flux2-pro") { const raw = await fluxGenerate("flux-2-pro", scene, ctx.refB64, dest); return { cost: COST["flux2-pro"], raw }; }
  if (arm === "flux2-flex") { const raw = await fluxGenerate("flux-2-flex", scene, ctx.refB64, dest); return { cost: COST["flux2-flex"], raw }; }
  if (arm === "nano-pro") { await geminiGenerate(NANO_PRO_MODEL, scene, ctx.refB64, "2K", dest); return { cost: COST["nano-pro"], raw: null }; }
  if (arm === "nano-flash") { await geminiGenerate(NANO_FLASH_MODEL, scene, ctx.refB64, "1K", dest); return { cost: COST["nano-flash"], raw: null }; }
  throw new Error(`unknown arm ${arm}`);
}

async function main() {
  const argOut = (process.argv.find((a) => a.startsWith("--out=")) || "").split("=")[1];
  if (argOut) OUT = path.resolve(ROOT, argOut);
  if (process.argv.includes("--watercolor")) { ACTIVE_STYLE = WATERCOLOR_STYLE; console.log("• style: reinforced WATERCOLOR"); }
  ensureDir(OUT);
  const argArms = (process.argv.find((a) => a.startsWith("--arms=")) || "").split("=")[1];
  const argRef = (process.argv.find((a) => a.startsWith("--ref=")) || "").split("=")[1];

  let arms = argArms ? argArms.split(",").map((s) => s.trim()) : Object.keys(ARM_KEYS);
  const skipped = arms.filter((a) => !ARM_KEYS[a]?.());
  arms = arms.filter((a) => ARM_KEYS[a]?.());
  if (skipped.length) console.log(`⚠️  skipping (missing key): ${skipped.join(", ")}`);
  if (!arms.length) { console.error("No runnable arms — set RECRAFT_API_TOKEN / BFL_API_KEY / GEMINI_API_KEY."); process.exit(1); }
  console.log(`▶ arms: ${arms.join(", ")}`);

  // 1) canonical reference portrait — provided or generated once via Recraft
  const refPath = path.join(OUT, "reference.png");
  if (argRef) {
    fs.copyFileSync(path.resolve(argRef), refPath);
    console.log(`✓ reference: copied ${argRef}`);
  } else if (!fs.existsSync(refPath)) {
    if (!RECRAFT_TOKEN) { console.error("No reference image and no RECRAFT_API_TOKEN to generate one. Pass --ref=portrait.png"); process.exit(1); }
    console.log("• generating canonical reference portrait via Recraft…");
    const portraitScene = { recraftSize: "1024x1024", prompt: "front-facing portrait, chest up, plain pastel background, friendly smile" };
    const body = {
      prompt: `${CHARACTER_REF} ${portraitScene.prompt}. ${STYLE}`,
      model: "recraftv3", size: "1024x1024", n: 1, response_format: "url",
      style: "digital_illustration", substyle: "hand_drawn", controls: { no_text: true },
    };
    const res = await fetch("https://external.api.recraft.ai/v1/images/generations", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${RECRAFT_TOKEN}` }, body: JSON.stringify(body),
    });
    if (!res.ok) { console.error(`reference gen failed ${res.status}: ${await res.text()}`); process.exit(1); }
    await downloadToFile((await res.json()).data[0].url, refPath);
    console.log("✓ reference saved");
  } else {
    console.log("✓ reference: reusing existing artifacts/benchmark/reference.png");
  }
  const refB64 = fileToBase64(refPath);

  // 2) Recraft needs a style_id derived from the reference portrait
  const ctx = { refB64, styleId: null };
  if (arms.includes("recraft")) {
    try { ctx.styleId = await recraftCreateStyle(refPath); console.log(`✓ recraft style_id: ${ctx.styleId}`); }
    catch (e) { console.error(`recraft style creation failed: ${e.message}`); }
  }

  // 3) generate every scene for every arm (merge into any prior run's results)
  const ALL_ORDER = ["recraft", "flux2-pro", "flux2-flex", "nano-pro", "nano-flash"];
  const resultsPath = path.join(OUT, "results.json");
  const results = fs.existsSync(resultsPath) ? JSON.parse(fs.readFileSync(resultsPath, "utf8")).results || {} : {};
  for (const arm of arms) {
    ensureDir(path.join(OUT, arm));
    results[arm] = { scenes: [], totalCost: 0, totalMs: 0, errors: [] };
    for (const scene of SCENES) {
      const dest = path.join(OUT, arm, `scene-${scene.n}.png`);
      const t0 = now();
      try {
        const { cost, raw } = await genScene(arm, scene, ctx, dest);
        const ms = now() - t0;
        results[arm].scenes.push({ scene: scene.n, label: scene.label, ms, cost, raw, ok: true });
        results[arm].totalCost += cost;
        results[arm].totalMs += ms;
        console.log(`  ${arm} scene ${scene.n} ✓ ${(ms / 1000).toFixed(1)}s $${cost.toFixed(3)}${raw != null ? ` (bfl raw ${raw})` : ""}`);
      } catch (e) {
        results[arm].scenes.push({ scene: scene.n, label: scene.label, ok: false, error: e.message });
        results[arm].errors.push(`scene ${scene.n}: ${e.message}`);
        console.log(`  ${arm} scene ${scene.n} ✗ ${e.message}`);
      }
    }
  }

  // 4) judge every arm that has images (same Gemini judge for all → fair)
  if (GEMINI_KEY) {
    for (const arm of ALL_ORDER) {
      if (!results[arm]) continue;
      const files = SCENES.map((s) => path.join(OUT, arm, `scene-${s.n}.png`)).filter((f) => fs.existsSync(f));
      if (!files.length) continue;
      try {
        const verdicts = await judgeArm(refB64, files);
        results[arm].judge = verdicts;
        const avg = (k) => (verdicts.reduce((a, v) => a + (v[k] || 0), 0) / verdicts.length).toFixed(1);
        results[arm].judgeAvg = { consistency: avg("consistency"), coherence: avg("coherence"), quality: avg("quality") };
        console.log(`  ⚖ ${arm}: consistency ${results[arm].judgeAvg.consistency} coherence ${results[arm].judgeAvg.coherence} quality ${results[arm].judgeAvg.quality}`);
      } catch (e) { console.log(`  ⚖ ${arm} judge failed: ${e.message}`); results[arm].judgeError = e.message; }
    }
  } else {
    console.log("⚠️  no GEMINI_API_KEY → skipping automated judge (images still saved for human review)");
  }

  // 5) write results.json, REPORT.md, contact-sheet.html
  const reportArms = ALL_ORDER.filter((a) => results[a]);
  fs.writeFileSync(resultsPath, JSON.stringify({ character: CHARACTER_REF, scenes: SCENES.map((s) => ({ n: s.n, label: s.label })), results }, null, 2));

  let md = `# Illustration engine benchmark — meapica\n\nSame character + same prompts + same Gemini 2.5 Flash judge across all engines.\n\n## Per-book projection (13 images: 1 cover + 12 scenes)\n\n| Engine | $/img (measured) | $/book ×13 | avg s/img | consistency | coherence | quality |\n|---|---|---|---|---|---|---|\n`;
  for (const arm of reportArms) {
    const r = results[arm];
    const ok = r.scenes.filter((s) => s.ok);
    const perImg = ok.length ? r.totalCost / ok.length : COST[arm];
    const perS = ok.length ? r.totalMs / ok.length / 1000 : 0;
    const j = r.judgeAvg || {};
    md += `| ${arm} | $${perImg.toFixed(3)} | $${(perImg * 13).toFixed(2)} | ${perS.toFixed(1)}s | ${j.consistency || "-"} | ${j.coherence || "-"} | ${j.quality || "-"} |\n`;
  }
  md += `\n_Budget target: ~€1.50 (~$1.62) total AI/book including text (~$0.14) + judge. Image budget ≈ $1.45._\n\n## Errors\n`;
  for (const arm of reportArms) if (results[arm].errors?.length) md += `- **${arm}**: ${results[arm].errors.join("; ")}\n`;
  md += `\nSee \`contact-sheet.html\` for side-by-side visual comparison.\n`;
  fs.writeFileSync(path.join(OUT, "REPORT.md"), md);

  // contact sheet
  let html = `<!doctype html><meta charset=utf8><title>meapica illustration benchmark</title>
<style>body{font-family:system-ui;margin:24px;background:#faf8f5}h1{font-size:20px}table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:6px;vertical-align:top;text-align:center}img{width:220px;height:auto;border-radius:6px;display:block}.ref{width:140px}small{color:#666}</style>
<h1>meapica — illustration engine benchmark</h1>
<p>Reference portrait: <img class=ref src="reference.png"></p>
<p><b>Character:</b> ${CHARACTER_REF}</p><table><tr><th>Scene</th>`;
  for (const arm of reportArms) {
    const j = results[arm].judgeAvg || {};
    html += `<th>${arm}<br><small>cons ${j.consistency || "-"} / coh ${j.coherence || "-"} / qual ${j.quality || "-"}</small></th>`;
  }
  html += `</tr>`;
  for (const s of SCENES) {
    html += `<tr><td><b>${s.n}</b><br><small>${s.label}</small></td>`;
    for (const arm of reportArms) {
      const sc = results[arm].scenes.find((x) => x.scene === s.n);
      const cell = sc?.ok ? `<img src="${arm}/scene-${s.n}.png"><small>${(sc.ms / 1000).toFixed(1)}s · $${sc.cost.toFixed(3)}</small>` : `<small style=color:#c00>✗ ${sc?.error || "n/a"}</small>`;
      html += `<td>${cell}</td>`;
    }
    html += `</tr>`;
  }
  html += `</table>`;
  fs.writeFileSync(path.join(OUT, "contact-sheet.html"), html);

  console.log(`\n✅ done → ${OUT}\n   open artifacts/benchmark/contact-sheet.html and REPORT.md`);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
