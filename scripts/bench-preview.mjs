/**
 * Streaming-preview benchmark — runs the REAL preview path once against the
 * real OpenAI APIs for one test character and prints per-stage timings:
 *
 *   [prep]      child sheet via renderChildSheet (what POST /api/characters/prepare
 *               does while the parent is still on the world/adventure screens)
 *   [generate]  t=0 = POST /api/stories/{id}/generate: PreviewSession + streamed
 *               Book Plan (generateArchitect onProgress) → companion sheet →
 *               cover + scenes as their shots stream in → reconcile with the
 *               final plan (PreviewSession.finish, no DB save)
 *
 * No database or storage writes: images are saved to artifacts/bench-preview/<ts>/
 * (gitignored). Needs OPENAI_API_KEY (read from .env.local, searched upwards).
 * Budget guard: aborts when estimated spend passes $1.50.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/bench-preview.mjs [--no-prep] [--no-avatar]
 *
 *   --no-prep     render the child sheet inside the generate phase (in parallel
 *                 with the Book Plan) instead of reusing a prepared one
 *   --no-avatar   skip the avatar portrait (sheet anchored on the Bible text only)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";

// ── env (.env.local, nearest upwards: worktrees share the main checkout's) ──
let dir = process.cwd();
for (;;) {
  const f = join(dir, ".env.local");
  if (existsSync(f)) {
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    break;
  }
  const up = dirname(dir);
  if (up === dir) throw new Error(".env.local not found");
  dir = up;
}
process.env.MOCK_MODE = "false"; // .env.local enables mock mode for the dev server

const args = process.argv.slice(2);
const usePrep = !args.includes("--no-prep");
const useAvatar = !args.includes("--no-avatar");
const BUDGET_USD = 1.5;

const { generateArchitect } = await import("../src/lib/ai/story-generator.ts");
const { startPreviewSession } = await import("../src/lib/ai/preview-book.ts");
const { renderChildSheet, renderPortrait, buildCharacterBible } = await import("../src/lib/ai/book-images.ts");
const { getStoryTree } = await import("../src/lib/story-trees/index.ts");
const { getTemplateConfig } = await import("../src/lib/create-store.ts");

// ── test character (same as scripts/generate-test-book.mts "martina") ────────
function treePath(templateId, picks) {
  const tree = getStoryTree(templateId);
  const path = [];
  let nodeId = tree.root;
  for (const pick of picks) {
    if (!nodeId || nodeId === tree.ending) break;
    const node = tree.nodes[nodeId];
    const opt = node.options[pick % node.options.length];
    path.push({ nodeId, optionId: opt.id });
    nodeId = opt.next;
  }
  return path;
}

const input = {
  childName: "Martina",
  gender: "girl",
  age: 5,
  city: "Girona",
  interests: ["animals"],
  favoriteColor: "#fdd835",
  favoriteCompanion: "un zorrito llamado Pip",
  hairColor: "#5d4037",
  eyeColor: "#8d6e63",
  skinTone: "#d4a574",
  hairstyle: "curly",
  templateId: "forest",
  templateTitle: "El Bosque Mágico",
  creationMode: "solo",
  decisions: { treePath: treePath("forest", [0, 1, 0]) },
  endingChoice: getTemplateConfig("forest")?.endings[0]?.id,
  dedication: "Para Martina, que siempre encuentra el camino.",
  senderName: "Mamá",
  locale: "es",
};

const out = resolve(process.cwd(), "artifacts/bench-preview", new Date().toISOString().replace(/[:.]/g, "-"));
mkdirSync(out, { recursive: true });
let spend = 0;
const addSpend = (usd, what) => {
  spend += usd ?? 0;
  if (spend > BUDGET_USD) {
    console.error(`BUDGET EXCEEDED ($${spend.toFixed(3)} > $${BUDGET_USD}) after ${what} — aborting`);
    process.exit(2);
  }
};
const save = async (name, image, mime) => {
  const file = join(out, `${name}.${mime === "image/png" ? "png" : "jpg"}`);
  writeFileSync(file, image);
  return `file://${file}`;
};
const s = (ms) => `${(ms / 1000).toFixed(1)}s`;

const bible = buildCharacterBible(input, null);

// ── Phase 0: avatar (the portrait the parent approved on screen 2) ───────────
let avatar = null;
if (useAvatar) {
  const t = Date.now();
  const r = await renderPortrait(bible, null, { label: "bench portrait" });
  addSpend(r.costUsd, "portrait");
  avatar = { data: r.image, mime: r.mime };
  await save("avatar", r.image, r.mime);
  console.log(`[avatar] ${s(Date.now() - t)} $${r.costUsd.toFixed(3)}`);
}

// ── Phase 1: prep (POST /api/characters/prepare, off the critical path) ──────
let prepared = null;
let prepMs = null;
if (usePrep) {
  const t = Date.now();
  const r = await renderChildSheet(bible, "preview", { avatar, photo: null }, { label: "bench prep" });
  prepMs = Date.now() - t;
  addSpend(r.costUsd, "child sheet (prep)");
  const url = await save("sheet-child-prepared", r.image, r.mime);
  prepared = { ref: { data: r.image, mime: r.mime }, url };
  console.log(`[prep] child sheet ${s(prepMs)} $${r.costUsd.toFixed(3)}`);
}

// ── Phase 2: generate (t=0 = the parent taps "Crear su libro") ───────────────
const marks = {};
const mark = (k) => {
  if (marks[k] === undefined) marks[k] = Date.now() - t0;
};
const events = [];
const t0 = Date.now();
const session = startPreviewSession({
  storyId: "bench",
  input,
  avatarUrl: null,
  anchors: { avatar, photo: null },
  preparedChildSheet: prepared ? async () => prepared : undefined,
  upload: save,
  onProgress: (p) => {
    if (p.coverUrl) mark("coverVisible");
    if (p.scenes.some((x) => x.index === 1)) mark("scene1Visible");
    if (p.scenes.length >= p.total) mark("allScenesVisible");
  },
  onEvent: (e) => {
    events.push(e);
    if (e.costUsd) addSpend(e.costUsd, e.type);
  },
});
const architect = await generateArchitect(input, {
  onProgress: (p) => {
    if (p.cast.length >= 0) mark("planCast");
    if (p.cover) mark("planCover");
    if (p.scenes.length >= 1) mark("planScene1");
    session.onPlanProgress(p);
  },
});
mark("planDone");
addSpend(architect.planReport?.costUsd ?? 0, "book plan");
const result = await session.finish(architect);
mark("done");

// ── Report ───────────────────────────────────────────────────────────────────
const at = (type, match = "") => events.find((e) => e.type === type && e.detail.includes(match))?.at;
const rows = [
  ["child sheet ready", at("child-sheet")],
  ["Book Plan: cast complete", marks.planCast],
  ["Book Plan: cover shot", marks.planCover],
  ["Book Plan: scene 1 shot", marks.planScene1],
  ["companion sheet ready", at("companion-sheet")],
  ["TIME TO COVER (visible)", marks.coverVisible],
  ["TIME TO SCENE 1 (visible)", marks.scene1Visible],
  [`all ${result.progress.total} preview scenes visible`, marks.allScenesVisible],
  ["Book Plan done (incl. repairs)", marks.planDone],
  ["TOTAL (preview saved)", marks.done],
];
console.log(`\n=== bench-preview (${usePrep ? "with prep" : "no prep"}, ${useAvatar ? "avatar" : "no avatar"}) — images in ${out}`);
if (prepMs !== null) console.log(`prep (before t=0, off the critical path): child sheet ${s(prepMs)}`);
for (const [label, ms] of rows) console.log(`${label.padEnd(34)} ${ms === undefined ? "—" : s(ms)}`);
console.log(`cast: [${architect.plan?.cast.map((c) => c.id).join(", ")}], cover cast: [${architect.plan?.cover.castIds.join(", ")}]`);
console.log(`superseded renders: ${events.filter((e) => e.detail.includes("superseded")).length}`);
console.log(`book plan: ${s(architect.planReport?.totalMs ?? 0)} $${(architect.planReport?.costUsd ?? 0).toFixed(3)} · images $${result.costUsd.toFixed(3)} · total spend $${spend.toFixed(3)}`);
writeFileSync(join(out, "timings.json"), JSON.stringify({ usePrep, useAvatar, prepMs, marks, events, spend, result: { ...result, progress: result.progress } }, null, 2));
