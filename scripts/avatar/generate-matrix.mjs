/**
 * Renders the watercolor avatar matrix for the "Créalo tú" builder.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/avatar/generate-matrix.mjs --dry-run         # counts + cost estimate
 *   npx tsx --tsconfig tsconfig.json scripts/avatar/generate-matrix.mjs --stage=masters   # canonicals, skins, overlays only
 *   npx tsx --tsconfig tsconfig.json scripts/avatar/generate-matrix.mjs                   # full matrix (resumable)
 *   flags: --gender=girl  --band=small  --concurrency=10  --budget=30  --quality=medium  --retries=2
 *   re-roll one base: delete its .webp under public/images/avatar/ and run again.
 *
 * Asset tree per gender × age band (why every face lines up):
 *   canonical                    ONE generation: front view, medium skin, brown eyes, hair pulled back /
 *   │                            buzz, wide headroom (tall hairstyles), torso fading into the paper
 *   ├─ skin master × 4           edit ("change only the skin tone"), REGISTERED back onto the canonical
 *   │  │                          (pupils → similarity → gradient refinement), face luminance gated
 *   │  │                          against the tone's target (re-roll / closest), then the canonical's
 *   │  │                          iris, lash line and whites pasted back (no lid skin)
 *   │  └─ base × hair × style    edit of the skin master ("change only the hair"), registered, then the
 *   │                             skin master's INNER FACE is composited back pixel-exactly (eyes/nose/
 *   │                             mouth always; the rim only where the edit painted no new hair)
 *   └─ overlays                  glasses (2 shapes, alpha from an edit, tinted to 2 colours), freckles
 *                                (multiply layer), eye colours (alpha recolour of the irises, 5 edits)
 *
 * No API masks: gpt-image masks are guidance only ("the model uses the mask as guidance,
 * but may not follow its exact shape" — developers.openai.com image-generation guide) and
 * in the 2026-09-27 spike 3 of 6 masked edits came back with the masked area painted BLACK.
 * Alignment is enforced here instead (register + composite), never trusted to the model.
 *
 * Resumable: masters (1024 px PNG) live in artifacts/avatar-masters/ (git-ignored) and web
 * assets in public/images/avatar/; anything that exists is skipped. Costs are appended to
 * artifacts/avatar-masters/ledger.jsonl. A full run rewrites src/lib/avatar/avatar-manifest.json.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createHash } from "node:crypto";
import * as px from "./pixels.mjs";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const { generateOpenAIImage } = await import("../../src/lib/ai/openai-image.ts");
const { WATERCOLOR_STYLE } = await import("../../src/lib/ai/style.ts");
const { HAIR_COLOR_MAP, EYE_COLOR_MAP, hairDescription } = await import("../../src/lib/ai/character-description.ts");
const M = await import("../../src/lib/avatar/manifest.ts");

// ── CLI ──────────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);
const DRY = Boolean(args["dry-run"]);
const STAGE = args.stage === "masters" ? "masters" : "all";
const MODEL = process.env.AVATAR_IMAGE_MODEL ?? "gpt-image-2.5-flare";
const QUALITY = args.quality ?? "medium";
const CONCURRENCY = Number(args.concurrency ?? 10);
const BUDGET = Number(args.budget ?? 30);
const RETRIES = Number(args.retries ?? 2); // re-rolls when a render fails a gate
const SKIN_ATTEMPTS = 4;
/** Reuse already-paid raw renders in artifacts/avatar-masters/raw before calling the API (recovery after a code fix). */
const REUSE_RAW = Boolean(args["reuse-raw"]);
const GENDERS = typeof args.gender === "string" ? [args.gender] : ["boy", "girl", "neutral"];
const BANDS = typeof args.band === "string" ? [args.band] : M.AVATAR_AGE_BANDS.map((b) => b.id);

const ROOT = process.cwd();
const MASTERS = join(ROOT, "artifacts/avatar-masters");
const PUBLIC = join(ROOT, "public/images/avatar");
const LEDGER = join(MASTERS, "ledger.jsonl");
mkdirSync(join(MASTERS, "raw"), { recursive: true });

/** Measured 2026-09-27, flare/medium 1024²: generation $0.015, edit with 1 ref $0.022–0.023. */
const EST_COST = { generate: 0.015, edit: 0.023 };
const WEB_MAX_BYTES = 25 * 1024;

// ── Prompts ──────────────────────────────────────────────────────────────────

const CANONICAL_SKIN = "medium"; // #d4a574 "warm golden olive-tan skin"

const renderAge = (band) => M.AVATAR_AGE_BANDS.find((b) => b.id === band).renderAge;
const genderWord = (g) => (g === "boy" ? "boy" : g === "girl" ? "girl" : "child");

function canonicalSubject(gender, band) {
  const age = renderAge(band);
  const hair =
    gender === "boy"
      ? "very short buzz-cut dark-brown hair so the whole forehead and both ears are visible"
      : gender === "girl"
        ? "dark-brown hair pulled tightly back behind her head so the whole forehead and both ears are visible (no fringe, no loose strands)"
        : "short dark-brown hair pulled back from the face so the whole forehead and both ears are visible";
  return `a ${age}-year-old ${genderWord(gender)} with warm golden olive-tan skin, ${hair}, warm chestnut-brown eyes, round rosy cheeks.`;
}

/** Framing validated in the spike: headroom for afros/buns, torso fading into the paper. */
const CANONICAL_FRAME =
  "Composition like a school ID photo taken from a little further away: the whole head and shoulders plus the upper chest, centred, " +
  "with a wide empty margin of plain paper above the head and on both sides (the head is small, roughly the middle third of the picture). " +
  "Strictly FRONT view: facing the viewer straight on, head perfectly level, eyes looking directly at the viewer, symmetrical face, gentle closed-mouth smile. " +
  "Wearing a plain crew-neck white-and-navy striped t-shirt. Plain flat warm off-white watercolor paper background everywhere, no scenery, no props.";

/**
 * Skin edits. The Bible words alone render dark tones far too light (spike: "rich
 * medium-dark brown" came out at the luminance of a light tan), so the avatar prompt
 * anchors each tone and the result is gated on measured face luminance.
 * `delta` = target face luminance relative to the canonical (medium) face.
 */
const SKIN_EDITS = {
  light: { words: "very fair, pale pinkish-ivory skin (the lightest skin tone)", delta: 26, tol: 10 },
  "medium-light": { words: "light warm beige skin, clearly lighter than a golden tan but not pale", delta: 12, tol: 8 },
  dark: { words: "rich medium-dark brown skin, a clear milk-chocolate brown", delta: -55, tol: 16 },
  "very-dark": { words: "deep dark brown skin like dark chocolate, the darkest skin tone, clearly darker than milk-chocolate brown", delta: -95, tol: 18 },
};

function editPrompt(change, keepExtra = "") {
  return (
    `Edit this watercolor portrait. Change ONLY ${change} ` +
    "Keep EVERYTHING else exactly as it is: the same child, the same face, eyes, eyebrows, nose, mouth and expression, the same head size and position, " +
    `the same pose and framing, the same striped t-shirt fading into the paper, the same plain paper background, the same watercolor technique. ${keepExtra}` +
    ` ${WATERCOLOR_STYLE}`
  );
}

// ── Job helpers ──────────────────────────────────────────────────────────────

let spent = 0;
if (existsSync(LEDGER)) for (const l of readFileSync(LEDGER, "utf8").split("\n").filter(Boolean)) spent += JSON.parse(l).costUsd;
const startSpent = spent;
const runSpent = () => spent - startSpent;

class BudgetError extends Error {}
/** A render failed a quality gate — the caller re-rolls. */
class RerollError extends Error {}

const rawSlug = (label) => label.replace(/[^a-z0-9-]+/gi, "_");
const unusedRaws = new Map(); // slug -> [file paths], oldest first
if (REUSE_RAW)
  for (const f of readdirSync(join(MASTERS, "raw")).sort()) {
    const slug = f.replace(/-\d+\.png$/, "");
    if (!unusedRaws.has(slug)) unusedRaws.set(slug, []);
    unusedRaws.get(slug).push(join(MASTERS, "raw", f));
  }

async function callImage(kind, label, prompt, ref) {
  const reuse = unusedRaws.get(rawSlug(label))?.shift();
  if (reuse) {
    console.log(`[reuse] ${label} ← ${reuse.split("/").pop()}`);
    return readFileSync(reuse);
  }
  if (runSpent() + EST_COST[kind] > BUDGET) throw new BudgetError(`Budget $${BUDGET} reached (run spent $${runSpent().toFixed(2)})`);
  const r = await generateOpenAIImage({
    model: MODEL,
    quality: QUALITY,
    size: "1024x1024",
    prompt,
    references: ref ? [{ data: ref, mime: "image/png" }] : [],
    outputFormat: "png",
    label: `avatar ${label}`,
  });
  spent += r.costUsd;
  appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), label, kind, model: MODEL, quality: QUALITY, costUsd: r.costUsd, ms: r.ms }) + "\n");
  writeFileSync(join(MASTERS, "raw", `${rawSlug(label)}-${Date.now()}.png`), r.image);
  return r.image;
}

const inflight = new Map();
/** Memoised, file-backed master: runs `make` once, stores the PNG, returns it as an Img. */
function master(name, make) {
  const file = join(MASTERS, `${name}.png`);
  if (!inflight.has(file)) {
    inflight.set(
      file,
      (async () => {
        if (existsSync(file)) return px.load(file);
        const img = await make();
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, await px.toPng(img));
        return img;
      })(),
    );
  }
  return inflight.get(file);
}

async function writeWeb(rel, img, opts = {}) {
  const file = join(PUBLIC, rel);
  mkdirSync(dirname(file), { recursive: true });
  let quality = opts.quality ?? 80;
  let buf = await px.webp(img, { ...opts, quality });
  while (buf.length > WEB_MAX_BYTES && quality > 40) {
    quality -= 5;
    buf = await px.webp(img, { ...opts, quality });
  }
  if (buf.length > WEB_MAX_BYTES) throw new Error(`${rel}: ${(buf.length / 1024).toFixed(0)} KB > 25 KB even at q${quality}`);
  writeFileSync(file, buf);
  return buf.length;
}

async function withRetries(label, fn, retries = RETRIES) {
  for (let n = 0; ; n++) {
    try {
      return await fn(n);
    } catch (err) {
      if (!(err instanceof RerollError) || n >= retries) throw err;
      console.warn(`[retry] ${label}: ${err.message}`);
    }
  }
}

// ── Geometry per gender × band (derived from the canonical's pupils) ─────────

const lineId = (gender, band) => `${gender}-${band}`;

async function geometry(gender, band) {
  const cacheFile = join(MASTERS, `canonical-${lineId(gender, band)}.geometry.json`);
  if (existsSync(cacheFile)) return JSON.parse(readFileSync(cacheFile, "utf8"));
  const canon = await canonical(gender, band);
  const S = px.SIZE;
  const left = px.findPupil(canon, { x0: Math.round(S * 0.3), y0: Math.round(S * 0.32), x1: Math.round(S * 0.49), y1: Math.round(S * 0.62) });
  const right = px.findPupil(canon, { x0: Math.round(S * 0.51), y0: Math.round(S * 0.32), x1: Math.round(S * 0.7), y1: Math.round(S * 0.62) });
  const D = right.x - left.x;
  if (D < 90 || D > 260 || Math.abs(left.y - right.y) > 12) throw new Error(`canonical ${gender} ${band}: implausible pupils ${JSON.stringify({ left, right })}`);
  const eyeY = (left.y + right.y) / 2;
  const cx = (left.x + right.x) / 2;
  const g = {
    left,
    right,
    D,
    eyeY,
    cx,
    /** eye paste / eye-colour search radius around each pupil */
    eyeR: 0.2 * D,
    /** kept pixel-exact in every base: brows to chin, inside the cheeks */
    innerFace: { cx, cy: eyeY + 0.55 * D, rx: 0.78 * D, ry: 1.0 * D },
    /** registration window: eyes, nose, mouth, jaw */
    faceRoi: { x0: Math.round(cx - 1.0 * D), y0: Math.round(eyeY - 0.5 * D), x1: Math.round(cx + 1.0 * D), y1: Math.round(eyeY + 1.5 * D) },
    /** glasses band (frames + temples to the face edge) */
    eyeBand: { x0: Math.round(cx - 1.08 * D), y0: Math.round(eyeY - 0.45 * D), x1: Math.round(cx + 1.08 * D), y1: Math.round(eyeY + 0.45 * D) },
    /** freckles: nose bridge + upper cheeks */
    cheeks: { cx, cy: eyeY + 0.55 * D, rx: 0.9 * D, ry: 0.35 * D },
    /** luminance probes: forehead + chin (skin gate), neck (hair-edit gate) */
    probes: {
      forehead: { x: cx, y: eyeY - 0.4 * D, r: 0.12 * D },
      chin: { x: cx, y: eyeY + 1.1 * D, r: 0.1 * D },
      neck: { x: cx, y: eyeY + 1.6 * D, r: 0.12 * D },
    },
  };
  g.canonSkinLuma = px.meanLuma(canon, g.probes.forehead.x, g.probes.forehead.y, g.probes.forehead.r);
  writeFileSync(cacheFile, JSON.stringify(g, null, 2));
  return g;
}

const faceLuma = (img, g) => (px.meanLuma(img, g.probes.forehead.x, g.probes.forehead.y, g.probes.forehead.r) + px.meanLuma(img, g.probes.chin.x, g.probes.chin.y, g.probes.chin.r)) / 2;
const neckLuma = (img, g) => px.meanLuma(img, g.probes.neck.x, g.probes.neck.y, g.probes.neck.r);

/**
 * Registers `child` to the canonical face (pupils → similarity → gradient refinement)
 * and returns the warped child. Throws RerollError when the edit moved/reshaped the
 * face beyond what a composite can hide.
 */
function align(parent, g, child, label) {
  // Edits rarely move the face; if the pupils are ambiguous, start from identity
  // and let the gradient refinement (±6 px) do the work.
  const init = px.alignFromPupils({ left: g.left, right: g.right }, child) ?? { s: 1, dx: 0, dy: 0, cx: g.cx, cy: g.eyeY };
  if (!init.childEyes) console.warn(`[align] ${label}: pupils ambiguous, identity start`);
  const t = px.register(parent, child, g.faceRoi, init);
  const moved = Math.hypot(t.dx, t.dy);
  if (moved > 40 || Math.abs(1 - t.s) > 0.06) throw new RerollError(`${label}: face moved too far (s ${t.s.toFixed(3)}, ${moved.toFixed(0)} px)`);
  return px.warp(child, t);
}

// ── Stages ───────────────────────────────────────────────────────────────────

function canonical(gender, band) {
  return master(`canonical-${lineId(gender, band)}`, async () =>
    px.load(
      await callImage(
        "generate",
        `canonical ${gender} ${band}`,
        `Children's picture-book character avatar: ${canonicalSubject(gender, band)} ${CANONICAL_FRAME} ${WATERCOLOR_STYLE}`,
      ),
    ),
  );
}

/** Canonical eye pixels that may be pasted onto any skin (iris, pupil, lashes, whites). */
const eyePasteCache = new Map();
async function eyePaste(gender, band) {
  const key = lineId(gender, band);
  if (!eyePasteCache.has(key)) {
    const [canon, g] = await Promise.all([canonical(gender, band), geometry(gender, band)]);
    eyePasteCache.set(key, px.eyeWeights(canon, g, g.eyeR, g.canonSkinLuma));
  }
  return eyePasteCache.get(key);
}

/** Skin master = registered skin edit + the canonical's eyes, so eye overlays fit every base. */
const skinCache = new Map();
function skinMaster(gender, band, skin) {
  if (skin === CANONICAL_SKIN) return canonical(gender, band);
  const key = `${lineId(gender, band)}-${skin}`;
  if (!skinCache.has(key))
    skinCache.set(
      key,
      (async () => {
        const [canon, aligned, weights] = await Promise.all([canonical(gender, band), skinAligned(gender, band, skin), eyePaste(gender, band)]);
        return px.blend(canon, aligned, weights);
      })(),
    );
  return skinCache.get(key);
}

function skinAligned(gender, band, skin) {
  return master(`skin/${lineId(gender, band)}-${skin}`, async () => {
    const [canon, g] = await Promise.all([canonical(gender, band), geometry(gender, band)]);
    const spec = SKIN_EDITS[skin];
    const target = faceLuma(canon, g) + spec.delta;
    let best = null;
    for (let n = 1; n <= SKIN_ATTEMPTS; n++) {
      const label = `skin ${gender} ${band} ${skin}`;
      const edit = await callImage(
        "edit",
        label,
        editPrompt(
          `the skin tone: the child now has ${spec.words} on the face, ears, neck and chest, with natural watercolor shading and cheek colour that suits this skin tone.`,
          "Keep the hair, the eye colour and the clothes unchanged.",
        ),
        await px.toPng(canon),
      );
      let aligned;
      try {
        aligned = align(canon, g, await px.load(edit), label);
      } catch (err) {
        if (err instanceof RerollError) {
          console.warn(`[retry] ${err.message}`);
          continue;
        }
        throw err;
      }
      const luma = faceLuma(aligned, g);
      const off = Math.abs(luma - target);
      console.log(`[skin] ${label} attempt ${n}: face luma ${luma.toFixed(0)} (target ${target.toFixed(0)} ±${spec.tol})`);
      if (!best || off < best.off) best = { img: aligned, off, luma };
      if (off <= spec.tol) break;
    }
    if (!best || best.off > spec.tol * 2) throw new Error(`skin ${gender} ${band} ${skin}: no attempt near target (best ${best ? best.luma.toFixed(0) : "none"})`);
    if (best.off > spec.tol) console.warn(`[skin] ${gender} ${band} ${skin}: accepting closest attempt (off by ${best.off.toFixed(0)})`);
    return best.img;
  });
}

/** Writes the final (eye-pasted) skin master to artifacts/avatar-masters/review/ for visual QA. */
async function exportSkinMaster(gender, band, skin) {
  const img = await skinMaster(gender, band, skin);
  mkdirSync(join(MASTERS, "review"), { recursive: true });
  writeFileSync(join(MASTERS, "review", `${lineId(gender, band)}-${skin}.png`), await px.toPng(img));
  return { rel: `skin ${gender} ${band} ${skin}` };
}

async function renderBase(gender, band, skin, hairColor, hairstyle) {
  const rel = `${gender}/${band}/${skin}/${hairColor}-${hairstyle}.webp`;
  if (existsSync(join(PUBLIC, rel))) return { rel, skipped: true };
  const [parent, g] = await Promise.all([skinMaster(gender, band, skin), geometry(gender, band)]);
  const hex = M.AVATAR_HAIR_COLORS.find((h) => h.id === hairColor).hex;
  const hair = hairDescription(hairstyle, HAIR_COLOR_MAP[hex], gender);
  const parentNeck = neckLuma(parent, g);
  const final = await withRetries(`base ${rel}`, async () => {
    const edit = await callImage(
      "edit",
      `base ${rel}`,
      editPrompt(
        `the hair: give the ${genderWord(gender)} ${hair}, natural for a ${renderAge(band)}-year-old, painted with the same loose watercolor washes.`,
        "The hair must not cover the eyes or the eyebrows. Keep the skin tone exactly the same.",
      ),
      await px.toPng(parent),
    );
    const aligned = align(parent, g, await px.load(edit), `base ${rel}`);
    const keep = px.faceKeepWeights(parent, aligned, g.innerFace, { cx: g.cx, cy: g.eyeY + 0.42 * g.D, rx: 0.62 * g.D, ry: 0.78 * g.D });
    const out = px.blend(parent, aligned, keep);
    // the face is the parent's; the neck/ears come from the edit — they must still match
    const neck = neckLuma(out, g);
    if (Math.abs(neck - parentNeck) > 28 && !["long", "braids", "afro"].includes(hairstyle)) {
      throw new RerollError(`base ${rel}: neck luma ${neck.toFixed(0)} vs parent ${parentNeck.toFixed(0)} (skin drift)`);
    }
    return out;
  });
  writeFileSync(join(MASTERS, "bases", `${rel.replaceAll("/", "_").replace(".webp", ".png")}`), await px.toPng(final));
  const bytes = await writeWeb(rel, final);
  return { rel, bytes };
}

/** Overlay edit of the canonical, registered back (memoised master). */
function overlayEdit(gender, band, name, change) {
  return master(`overlay/${lineId(gender, band)}-${name}`, async () => {
    const [canon, g] = await Promise.all([canonical(gender, band), geometry(gender, band)]);
    return withRetries(`${name} ${gender} ${band}`, async () =>
      align(canon, g, await px.load(await callImage("edit", `${name} ${gender} ${band}`, editPrompt(change), await px.toPng(canon))), `${name} ${gender} ${band}`),
    );
  });
}

async function renderGlasses(gender, band, shape) {
  const outs = M.AVATAR_GLASSES_COLOURS.map((c) => `${gender}/${band}/overlays/glasses-${shape}-${c.id}.webp`);
  if (outs.every((o) => existsSync(join(PUBLIC, o)))) return { rel: outs.join(","), skipped: true };
  const desc =
    shape === "round"
      ? "a pair of children's glasses with round lenses and thin dark charcoal frames, resting naturally on the nose, lenses centred on the eyes"
      : "a pair of children's glasses with softly rounded rectangular lenses and medium-thick dark charcoal frames, resting naturally on the nose, lenses centred on the eyes";
  const [canon, g, edited] = await Promise.all([
    canonical(gender, band),
    geometry(gender, band),
    overlayEdit(gender, band, `glasses-${shape}`, `one thing: add ${desc}. Clear lenses without reflections, the eyes stay fully visible and unchanged behind them.`),
  ]);
  const overlay = px.keepLargestComponents(px.extractAlphaOverlay(canon, edited, px.rectWeights(px.SIZE, px.SIZE, g.eyeBand, 14)));
  for (const [i, c] of M.AVATAR_GLASSES_COLOURS.entries()) await writeWeb(outs[i], px.tintOverlay(overlay, c.rgb), { alpha: true });
  return { rel: outs.join(",") };
}

async function renderFreckles(gender, band) {
  const rel = `${gender}/${band}/overlays/freckles.webp`;
  if (existsSync(join(PUBLIC, rel))) return { rel, skipped: true };
  const [canon, g, edited] = await Promise.all([
    canonical(gender, band),
    geometry(gender, band),
    overlayEdit(gender, band, "freckles", "one thing: add a generous sprinkle of small warm-brown freckles across the nose bridge and the upper cheeks, clearly visible, painted as tiny watercolor dots."),
  ]);
  await writeWeb(rel, px.extractMultiplyOverlay(canon, edited, px.ellipseWeights(px.SIZE, px.SIZE, g.cheeks, 20)));
  return { rel };
}

async function renderEyes(gender, band, eyeColor) {
  const rel = `${gender}/${band}/overlays/eyes-${eyeColor}.webp`;
  if (existsSync(join(PUBLIC, rel))) return { rel, skipped: true };
  const hex = M.AVATAR_EYE_COLORS.find((e) => e.id === eyeColor).hex;
  const [canon, g, edited] = await Promise.all([
    canonical(gender, band),
    geometry(gender, band),
    overlayEdit(
      gender,
      band,
      `eyes-${eyeColor}`,
      `one thing: the colour of the irises. The child now has ${EYE_COLOR_MAP[hex]}, painted with soft watercolor variation inside the iris (darker rim, lighter towards the pupil). Same pupils, same white highlights, same eye shape and size.`,
    ),
  ]);
  // only the iris/pupil pixels of the canonical (no lids, no whites) may change colour
  const iris = px.eyeWeights(canon, g, g.eyeR, g.canonSkinLuma, { sclera: false });
  await writeWeb(rel, px.extractDiffOverlay(canon, edited, iris), { alpha: true });
  return { rel };
}

// ── Plan ─────────────────────────────────────────────────────────────────────

function plan() {
  const jobs = [];
  for (const band of BANDS)
    for (const gender of GENDERS) {
      for (const shape of M.AVATAR_GLASSES_SHAPES) jobs.push({ kind: "overlay", key: `${gender}/${band} glasses-${shape}`, run: () => renderGlasses(gender, band, shape) });
      jobs.push({ kind: "overlay", key: `${gender}/${band} freckles`, run: () => renderFreckles(gender, band) });
      for (const e of M.AVATAR_EYE_COLORS)
        if (e.id !== M.AVATAR_BASE_EYE_COLOR) jobs.push({ kind: "overlay", key: `${gender}/${band} eyes-${e.id}`, run: () => renderEyes(gender, band, e.id) });
      for (const skin of M.AVATAR_SKIN_TONES)
        if (skin.id !== CANONICAL_SKIN) jobs.push({ kind: "skin", key: `${gender}/${band} skin ${skin.id}`, run: () => exportSkinMaster(gender, band, skin.id) });
      if (STAGE === "all")
        for (const skin of M.AVATAR_SKIN_TONES)
          for (const hc of M.AVATAR_HAIR_COLORS)
            for (const st of M.AVATAR_HAIRSTYLES[gender])
              jobs.push({ kind: "base", key: `${gender}/${band}/${skin.id}/${hc.id}-${st}`, run: () => renderBase(gender, band, skin.id, hc.id, st) });
    }
  return jobs;
}

function estimate(jobs) {
  const lines = BANDS.length * GENDERS.length;
  const bases = jobs.filter((j) => j.kind === "base");
  const pending = bases.filter((j) => !existsSync(join(PUBLIC, `${j.key}.webp`))).length;
  const skins = jobs.filter((j) => j.kind === "skin").length;
  const overlays = jobs.filter((j) => j.kind === "overlay").length;
  const cost = lines * EST_COST.generate + (skins * 1.6 + pending * 1.08 + overlays * 1.05) * EST_COST.edit;
  const minutes = ((lines + skins * 1.6 + pending * 1.08 + overlays) * 16) / CONCURRENCY / 60;
  console.log(
    `[plan] ${GENDERS.join("+")} × ${BANDS.join("+")}: ${bases.length} bases (${pending} pending) + ${skins} skin masters + ${lines} canonicals + ${overlays} overlay edits` +
      ` ≈ $${cost.toFixed(2)} at ${MODEL}/${QUALITY} (incl. expected re-rolls), ~${Math.ceil(minutes)} min at concurrency ${CONCURRENCY}. Budget cap $${BUDGET}.`,
  );
}

async function runPool(jobs) {
  let next = 0;
  const failures = [];
  let stop = false;
  let done = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (!stop && next < jobs.length) {
        const job = jobs[next++];
        try {
          const r = await job.run();
          if (!r.skipped) console.log(`[done ${++done}] ${r.rel}${r.bytes ? ` ${(r.bytes / 1024).toFixed(0)} KB` : ""} · run $${runSpent().toFixed(3)}`);
        } catch (err) {
          failures.push(job.key);
          console.error(`[fail] ${job.key}: ${err instanceof Error ? err.message : err}`);
          if (err instanceof BudgetError) stop = true;
        }
      }
    }),
  );
  return failures;
}

function writeManifest() {
  const bases = [];
  const overlays = [];
  const walk = (dir, rel = "") => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(join(dir, e.name), r);
      else if (e.name.endsWith(".webp")) (r.includes("/overlays/") ? overlays : bases).push(r.replace(/\.webp$/, ""));
    }
  };
  walk(PUBLIC);
  bases.sort();
  overlays.sort();
  const hash = createHash("sha1");
  for (const r of [...bases, ...overlays]) hash.update(r).update(readFileSync(join(PUBLIC, `${r}.webp`)));
  const version = hash.digest("hex").slice(0, 8);
  writeFileSync(join(ROOT, "src/lib/avatar/avatar-manifest.json"), JSON.stringify({ version, generatedAt: new Date().toISOString(), bases, overlays }, null, 2) + "\n");
  console.log(`[manifest] ${bases.length} bases, ${overlays.length} overlays → src/lib/avatar/avatar-manifest.json (v ${version})`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

mkdirSync(join(MASTERS, "bases"), { recursive: true });
const jobs = plan();
estimate(jobs);
if (DRY) process.exit(0);

const t0 = Date.now();
// masters first (skins + overlays), then bases, so a bad master is caught before 900 edits
const failures = [
  ...(await runPool(jobs.filter((j) => j.kind !== "base"))),
  ...(await runPool(jobs.filter((j) => j.kind === "base"))),
];
console.log(`[total] run $${runSpent().toFixed(3)} · ledger $${spent.toFixed(3)} · ${((Date.now() - t0) / 1000).toFixed(0)} s · ${failures.length} failed`);
if (failures.length) console.log(`[failed] ${failures.join(" | ")}`);
writeManifest();
process.exit(failures.length ? 1 : 0);
