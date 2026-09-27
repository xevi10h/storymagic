/**
 * Renders the watercolor avatar matrix for the "Créalo tú" builder.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/avatar/generate-matrix.mjs --dry-run      # counts + cost estimate
 *   npx tsx --tsconfig tsconfig.json scripts/avatar/generate-matrix.mjs                # full matrix (resumable)
 *   npx tsx --tsconfig tsconfig.json scripts/avatar/generate-matrix.mjs --spike        # small validation set
 *   flags: --gender=girl  --concurrency=8  --budget=25  --quality=medium  --retries=2
 *
 * Asset tree (why every face lines up):
 *   canonical(gender)            ONE generation: front view, medium skin, hair pulled back / buzz,
 *   │                            wide headroom (tall hairstyles), vignetted torso
 *   └─ skin(gender, skin)        edit of the canonical ("change only the skin tone"), REGISTERED
 *      │                          back onto the canonical (pupils → similarity, gradient refinement)
 *      └─ base(g, skin, hc, st)  edit of the skin master ("change only the hair"), registered, then
 *                                the skin master's INNER FACE is composited back pixel-exactly
 *   overlays(gender)             glasses (2 shapes; alpha extracted from an edit of the canonical,
 *                                tinted to 2 colours) + freckles (multiply layer)
 *
 * No API masks: gpt-image masks are guidance only ("the model uses the mask as guidance,
 * but may not follow its exact shape" — developers.openai.com image-generation guide) and
 * in the 2026-09-27 spike 3 of 6 masked edits came back with the masked area painted BLACK.
 * Alignment is enforced here instead (register + composite), never trusted to the model.
 *
 * Resumable: masters (1024 px PNG) live in artifacts/avatar-masters/ (git-ignored) and web
 * assets in public/images/avatar/; anything that exists is skipped. Costs are appended to
 * artifacts/avatar-masters/ledger.jsonl. The full run rewrites src/lib/avatar/avatar-manifest.json.
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
const { SKIN_MAP, HAIR_COLOR_MAP, hairDescription } = await import("../../src/lib/ai/character-description.ts");
const M = await import("../../src/lib/avatar/manifest.ts");

// ── CLI ──────────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);
const DRY = Boolean(args["dry-run"]);
const SPIKE = Boolean(args.spike);
const MODEL = process.env.AVATAR_IMAGE_MODEL ?? "gpt-image-2.5-flare";
const QUALITY = args.quality ?? "medium";
const CONCURRENCY = Number(args.concurrency ?? 8);
const BUDGET = Number(args.budget ?? (SPIKE ? 3 : 25));
const RETRIES = Number(args.retries ?? 2); // re-rolls when a render fails the alignment gate
const ONLY_GENDER = typeof args.gender === "string" ? args.gender : null;

const ROOT = process.cwd();
const MASTERS = join(ROOT, "artifacts/avatar-masters");
const PUBLIC = join(ROOT, SPIKE ? "public/images/avatar/spike" : "public/images/avatar");
const LEDGER = join(MASTERS, "ledger.jsonl");
mkdirSync(join(MASTERS, "raw"), { recursive: true });

/** Measured 2026-09-27, flare/medium 1024²: generation $0.015, edit with 1 ref $0.022–0.023. */
const EST_COST = { generate: 0.015, edit: 0.023 };
const WEB_MAX_BYTES = 60 * 1024;

// ── Prompts ──────────────────────────────────────────────────────────────────

const CANONICAL_SKIN = "medium"; // #d4a574 "warm golden olive-tan skin"

const CANONICAL_PROMPT = {
  girl: "a 6-year-old girl with warm golden olive-tan skin, dark-brown hair pulled tightly back behind her head so the whole forehead and both ears are visible (no fringe, no loose strands), warm chestnut-brown eyes, round rosy cheeks.",
  boy: "a 6-year-old boy with warm golden olive-tan skin, very short buzz-cut dark-brown hair so the whole forehead and both ears are visible, warm chestnut-brown eyes, round rosy cheeks.",
  neutral:
    "a 6-year-old child with warm golden olive-tan skin, short dark-brown hair pulled back from the face so the whole forehead and both ears are visible, warm chestnut-brown eyes, round rosy cheeks.",
};

/** Framing validated in the spike: headroom for afros/buns, torso fading into the paper. */
const CANONICAL_FRAME =
  "Composition like a school ID photo taken from a little further away: the whole head and shoulders plus the upper chest, centred, " +
  "with a wide empty margin of plain paper above the head and on both sides (the head is small, roughly the middle third of the picture). " +
  "Strictly FRONT view: facing the viewer straight on, head perfectly level, eyes looking directly at the viewer, symmetrical face, gentle closed-mouth smile. " +
  "Wearing a plain crew-neck white-and-navy striped t-shirt. Plain flat warm off-white watercolor paper background everywhere, no scenery, no props.";

const genderWord = (g) => (g === "boy" ? "boy" : g === "girl" ? "girl" : "child");

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

async function callImage(kind, label, prompt, ref) {
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
  writeFileSync(join(MASTERS, "raw", `${label.replace(/[^a-z0-9-]+/gi, "_")}-${Date.now()}.png`), r.image);
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
  while (buf.length > WEB_MAX_BYTES && quality > 50) {
    quality -= 6;
    buf = await px.webp(img, { ...opts, quality });
  }
  writeFileSync(file, buf);
  return buf.length;
}

// ── Geometry per gender (derived from the canonical's pupils) ────────────────

async function geometry(gender) {
  const cacheFile = join(MASTERS, `canonical-${gender}.geometry.json`);
  if (existsSync(cacheFile)) return JSON.parse(readFileSync(cacheFile, "utf8"));
  const canon = await canonical(gender);
  const S = px.SIZE;
  const left = px.findPupil(canon, { x0: Math.round(S * 0.3), y0: Math.round(S * 0.32), x1: Math.round(S * 0.49), y1: Math.round(S * 0.62) });
  const right = px.findPupil(canon, { x0: Math.round(S * 0.51), y0: Math.round(S * 0.32), x1: Math.round(S * 0.7), y1: Math.round(S * 0.62) });
  const D = right.x - left.x;
  const eyeY = (left.y + right.y) / 2;
  const cx = (left.x + right.x) / 2;
  const g = {
    left,
    right,
    D,
    eyeY,
    cx,
    /** kept pixel-exact in every base: brows to chin, inside the cheeks */
    innerFace: { cx, cy: eyeY + 0.55 * D, rx: 0.78 * D, ry: 1.0 * D },
    /** registration window: eyes, nose, mouth, jaw */
    faceRoi: { x0: Math.round(cx - 1.0 * D), y0: Math.round(eyeY - 0.5 * D), x1: Math.round(cx + 1.0 * D), y1: Math.round(eyeY + 1.5 * D) },
    /** glasses band (frames + temples to the face edge) */
    eyeBand: { x0: Math.round(cx - 1.1 * D), y0: Math.round(eyeY - 0.45 * D), x1: Math.round(cx + 1.1 * D), y1: Math.round(eyeY + 0.45 * D) },
    /** freckles: nose bridge + upper cheeks */
    cheeks: { cx, cy: eyeY + 0.55 * D, rx: 0.9 * D, ry: 0.35 * D },
  };
  if (D < 90 || D > 260 || Math.abs(left.y - right.y) > 12) throw new Error(`canonical ${gender}: implausible pupils ${JSON.stringify({ left, right })}`);
  writeFileSync(cacheFile, JSON.stringify(g, null, 2));
  return g;
}

/**
 * Registers `child` to the parent face (pupils → similarity → gradient refinement)
 * and returns the warped child. Throws AlignError when the edit moved/reshaped the
 * face beyond what a composite can hide — the caller re-rolls.
 */
class AlignError extends Error {}
function align(parent, parentEyes, child, g, label) {
  const init = px.alignFromPupils(parentEyes, child);
  if (!init) throw new AlignError(`${label}: pupils not found where expected`);
  const t = px.register(parent, child, g.faceRoi, init);
  const moved = Math.hypot(t.dx, t.dy);
  console.log(`[align] ${label}: scale ${t.s.toFixed(3)} shift ${t.dx.toFixed(1)},${t.dy.toFixed(1)} err ${t.err.toFixed(0)} (pupils-only ${t.errInit.toFixed(0)})`);
  if (moved > 40 || Math.abs(1 - t.s) > 0.06) throw new AlignError(`${label}: face moved too far (s ${t.s.toFixed(3)}, ${moved.toFixed(0)} px)`);
  return px.warp(child, t);
}

async function withRetries(label, fn) {
  for (let n = 0; ; n++) {
    try {
      return await fn();
    } catch (err) {
      if (!(err instanceof AlignError) || n >= RETRIES) throw err;
      console.warn(`[retry] ${label}: ${err.message}`);
    }
  }
}

// ── Stages ───────────────────────────────────────────────────────────────────

function canonical(gender) {
  return master(`canonical-${gender}`, async () =>
    px.load(
      await callImage(
        "generate",
        `canonical ${gender}`,
        `Children's picture-book character avatar: ${CANONICAL_PROMPT[gender]} ${CANONICAL_FRAME} ${WATERCOLOR_STYLE}`,
      ),
    ),
  );
}

const canonicalEyes = async (gender) => {
  const g = await geometry(gender);
  return { left: g.left, right: g.right };
};

function skinMaster(gender, skin) {
  if (skin === CANONICAL_SKIN) return canonical(gender);
  return master(`skin/${gender}-${skin}`, () =>
    withRetries(`skin ${gender} ${skin}`, async () => {
      const [canon, g, eyes] = await Promise.all([canonical(gender), geometry(gender), canonicalEyes(gender)]);
      const hex = M.AVATAR_SKIN_TONES.find((s) => s.id === skin).hex;
      const edit = await callImage(
        "edit",
        `skin ${gender} ${skin}`,
        editPrompt(
          `the skin tone: the child now has ${SKIN_MAP[hex]} on the face, ears, neck and chest, with natural watercolor shading and cheek colour that suits this skin tone.`,
          "Keep the hair, the eye colour and the clothes unchanged.",
        ),
        await px.toPng(canon),
      );
      return align(canon, eyes, await px.load(edit), g, `skin ${gender} ${skin}`);
    }),
  );
}

async function renderBase(gender, skin, hairColor, hairstyle) {
  const rel = `${gender}/${skin}/${hairColor}-${hairstyle}.webp`;
  if (existsSync(join(PUBLIC, rel))) return { rel, skipped: true };
  const [parent, g, eyes] = await Promise.all([skinMaster(gender, skin), geometry(gender), canonicalEyes(gender)]);
  const hex = M.AVATAR_HAIR_COLORS.find((h) => h.id === hairColor).hex;
  const hair = hairDescription(hairstyle, HAIR_COLOR_MAP[hex], gender);
  const keep = px.ellipseWeights(px.SIZE, px.SIZE, g.innerFace, 26);
  const final = await withRetries(`base ${rel}`, async () => {
    const edit = await callImage(
      "edit",
      `base ${rel}`,
      editPrompt(
        `the hair: give the ${genderWord(gender)} ${hair}, natural for a 6-year-old, painted with the same loose watercolor washes.`,
        "The hair must not cover the eyes or the eyebrows. Keep the skin tone exactly the same.",
      ),
      await px.toPng(parent),
    );
    const aligned = align(parent, eyes, await px.load(edit), g, `base ${rel}`);
    return px.blend(parent, aligned, keep);
  });
  writeFileSync(join(MASTERS, `base-${rel.replaceAll("/", "_").replace(".webp", ".png")}`), await px.toPng(final));
  const bytes = await writeWeb(rel, final);
  return { rel, bytes };
}

async function renderGlasses(gender, shape) {
  const outs = M.AVATAR_GLASSES_COLOURS.map((c) => `${gender}/overlays/glasses-${shape}-${c.id}.webp`);
  if (outs.every((o) => existsSync(join(PUBLIC, o)))) return { rel: outs.join(","), skipped: true };
  const [canon, g, eyes] = await Promise.all([canonical(gender), geometry(gender), canonicalEyes(gender)]);
  const edited = await master(`overlay/${gender}-glasses-${shape}`, () =>
    withRetries(`glasses ${gender} ${shape}`, async () => {
      const desc =
        shape === "round"
          ? "a pair of children's glasses with round lenses and thin dark charcoal frames, resting naturally on the nose, lenses centred on the eyes"
          : "a pair of children's glasses with softly rounded rectangular lenses and medium-thick dark charcoal frames, resting naturally on the nose, lenses centred on the eyes";
      const edit = await callImage(
        "edit",
        `glasses ${gender} ${shape}`,
        editPrompt(`one thing: add ${desc}. Clear lenses without reflections, the eyes stay fully visible and unchanged behind them.`),
        await px.toPng(canon),
      );
      return align(canon, eyes, await px.load(edit), g, `glasses ${gender} ${shape}`);
    }),
  );
  const overlay = px.keepLargestComponents(px.extractAlphaOverlay(canon, edited, px.rectWeights(px.SIZE, px.SIZE, g.eyeBand, 14)));
  for (const [i, c] of M.AVATAR_GLASSES_COLOURS.entries()) await writeWeb(outs[i], px.tintOverlay(overlay, c.rgb), { alpha: true });
  return { rel: outs.join(",") };
}

async function renderFreckles(gender) {
  const rel = `${gender}/overlays/freckles.webp`;
  if (existsSync(join(PUBLIC, rel))) return { rel, skipped: true };
  const [canon, g, eyes] = await Promise.all([canonical(gender), geometry(gender), canonicalEyes(gender)]);
  const edited = await master(`overlay/${gender}-freckles`, () =>
    withRetries(`freckles ${gender}`, async () => {
      const edit = await callImage(
        "edit",
        `freckles ${gender}`,
        editPrompt("one thing: add a generous sprinkle of small warm-brown freckles across the nose bridge and the upper cheeks, clearly visible, painted as tiny watercolor dots."),
        await px.toPng(canon),
      );
      return align(canon, eyes, await px.load(edit), g, `freckles ${gender}`);
    }),
  );
  const overlay = px.extractMultiplyOverlay(canon, edited, px.ellipseWeights(px.SIZE, px.SIZE, g.cheeks, 20));
  await writeWeb(rel, overlay);
  return { rel };
}

// ── Plan ─────────────────────────────────────────────────────────────────────

function fullPlan() {
  const genders = ONLY_GENDER ? [ONLY_GENDER] : ["boy", "girl", "neutral"];
  const jobs = [];
  for (const gender of genders) {
    for (const shape of M.AVATAR_GLASSES_SHAPES) jobs.push({ kind: "glasses", run: () => renderGlasses(gender, shape) });
    jobs.push({ kind: "freckles", run: () => renderFreckles(gender) });
    for (const skin of M.AVATAR_SKIN_TONES)
      for (const hc of M.AVATAR_HAIR_COLORS)
        for (const st of M.AVATAR_HAIRSTYLES[gender]) jobs.push({ kind: "base", key: `${gender}/${skin.id}/${hc.id}-${st}`, run: () => renderBase(gender, skin.id, hc.id, st) });
  }
  return { genders, skinsPerGender: M.AVATAR_SKIN_TONES.length - 1, jobs };
}

/** Validation set: 2 canonicals, 3 skin masters, 6 bases, 2 glasses, 1 freckles = 14 calls. */
function spikePlan() {
  const b = (g, s, h, st) => ({ kind: "base", key: `${g}/${s}/${h}-${st}`, run: () => renderBase(g, s, h, st) });
  return {
    genders: ["girl", "boy"],
    skinsPerGender: 1.5,
    jobs: [
      b("girl", "medium", "blonde", "pigtails"),
      b("girl", "very-dark", "black", "afro"),
      b("girl", "light", "red", "long"),
      b("girl", "light", "brown", "bob"),
      b("boy", "medium", "brown-dark", "spiky"),
      b("boy", "dark", "black", "curly"),
      { kind: "glasses", run: () => renderGlasses("girl", "round") },
      { kind: "glasses", run: () => renderGlasses("boy", "square") },
      { kind: "freckles", run: () => renderFreckles("girl") },
    ],
  };
}

function estimate({ genders, skinsPerGender, jobs }) {
  const bases = jobs.filter((j) => j.kind === "base");
  const pending = bases.filter((j) => !existsSync(join(PUBLIC, `${j.key}.webp`))).length;
  const skinMasters = Math.round(genders.length * skinsPerGender);
  const overlayCalls = jobs.filter((j) => j.kind !== "base").length;
  const edits = skinMasters + bases.length + overlayCalls;
  const retryFactor = 1.1; // ~10 % re-rolls measured in the spike
  const cost = (genders.length * EST_COST.generate + edits * EST_COST.edit) * retryFactor;
  const minutes = ((genders.length + edits) * retryFactor * 18) / CONCURRENCY / 60; // ~15 s/call + registration
  console.log(
    `[plan] ${genders.join("+")}: ${bases.length} bases (${pending} pending) + ${skinMasters} skin masters + ${genders.length} canonicals + ${overlayCalls} overlay edits` +
      ` ≈ $${cost.toFixed(2)} at ${MODEL}/${QUALITY} (incl. ~10% re-rolls), ~${Math.ceil(minutes)} min at concurrency ${CONCURRENCY}. Budget cap $${BUDGET}.`,
  );
}

async function runPool(jobs) {
  let next = 0;
  let failed = 0;
  let stop = false;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (!stop && next < jobs.length) {
        const job = jobs[next++];
        try {
          const r = await job.run();
          if (!r.skipped) console.log(`[done] ${r.rel}${r.bytes ? ` ${(r.bytes / 1024).toFixed(0)} KB` : ""} · run $${runSpent().toFixed(3)}`);
        } catch (err) {
          failed++;
          console.error(`[fail] ${job.key ?? job.kind}: ${err instanceof Error ? err.message : err}`);
          if (err instanceof BudgetError) stop = true;
        }
      }
    }),
  );
  return { failed };
}

function writeManifest() {
  const bases = [];
  const overlays = [];
  const walk = (dir, rel = "") => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "spike") continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(join(dir, e.name), r);
      else if (e.name.endsWith(".webp")) (r.includes("/overlays/") ? overlays : bases).push(r.replace(/\.webp$/, ""));
    }
  };
  walk(join(ROOT, "public/images/avatar"));
  bases.sort();
  overlays.sort();
  const hash = createHash("sha1");
  for (const r of [...bases, ...overlays]) hash.update(r).update(readFileSync(join(ROOT, "public/images/avatar", `${r}.webp`)));
  const version = hash.digest("hex").slice(0, 8);
  writeFileSync(join(ROOT, "src/lib/avatar/avatar-manifest.json"), JSON.stringify({ version, generatedAt: new Date().toISOString(), bases, overlays }, null, 2) + "\n");
  console.log(`[manifest] ${bases.length} bases, ${overlays.length} overlays → src/lib/avatar/avatar-manifest.json (v ${version})`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

const plan = SPIKE ? spikePlan() : fullPlan();
estimate(plan);
if (DRY) process.exit(0);

const t0 = Date.now();
const { failed } = await runPool(plan.jobs);
console.log(`[total] run $${runSpent().toFixed(3)} · ledger $${spent.toFixed(3)} · ${((Date.now() - t0) / 1000).toFixed(0)} s · ${failed} failed`);
if (!SPIKE) writeManifest();
process.exit(failed ? 1 : 0);
