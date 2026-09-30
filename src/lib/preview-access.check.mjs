// Runnable check for the paywall redaction (no deps, no test runner):
//   node --experimental-strip-types src/lib/preview-access.check.mjs
import assert from "node:assert/strict";
import {
  FREE_PREVIEW_SCENES,
  PAID_ORDER_STATUSES,
  freeImageRefs,
  freeSceneNumbers,
  redactGeneratedStory,
  redactPreviewProgress,
  redactStoryForViewer,
} from "./preview-access.ts";

const SECRET = "SECRET-LOCKED";
const scenes = Array.from({ length: 12 }, (_, i) => ({
  sceneNumber: i + 1,
  title: `Chapter ${i + 1}`,
  text: i < 3 ? `free text ${i + 1}` : `${SECRET} text ${i + 1}`,
  imagePrompt: `${SECRET} prompt ${i + 1}`,
  type: i === 5 ? "bridge" : "scene",
}));
const generated = {
  bookTitle: "La gran aventura de Lucía",
  titleOptions: ["La gran aventura de Lucía", "Lucía y el faro"],
  coverImagePrompt: `${SECRET} cover prompt`,
  scenes,
  dedication: "Para ti, Lucía",
  dedicationSource: "parent",
  finalMessage: `${SECRET} final message`,
  synopsis: "Lucía descubre un faro mágico.",
  bookPlan: { beats: [`${SECRET} plan`] },
  imagePlan: { shots: [`${SECRET} shot`] },
  imageAssets: { childSheet: `${SECRET}-sheet.png` },
  illustrationProvider: "openai",
};
const ref = (n) => `abc12345-0000-4000-8000-000000000001/scene-${n}.png`;
const illustrations = [
  ...scenes.map((s) => ({ scene_number: s.sceneNumber, image_url: ref(s.sceneNumber), status: "ready", prompt_used: `${SECRET} used ${s.sceneNumber}` })),
  // secondaries (scene + 12): one free (13 → scene 1), one locked (16 → scene 4)
  { scene_number: 13, image_url: ref(13), status: "ready", prompt_used: `${SECRET} used 13` },
  { scene_number: 16, image_url: ref(16), status: "ready", prompt_used: `${SECRET} used 16` },
];
const row = {
  id: "abc12345-0000-4000-8000-000000000001",
  status: "ready",
  title: "La gran aventura de Lucía",
  cover_image_url: "abc12345-0000-4000-8000-000000000001/cover.png",
  character_portrait_url: "portraits/u1/p.png",
  generated_text: generated,
  story_illustrations: illustrations,
  preview_progress: {
    coverUrl: "abc12345-0000-4000-8000-000000000001/cover.png",
    scenes: [1, 2, 3, 4].map((index) => ({ index, url: ref(index) })),
    total: 3,
  },
};
const snapshot = JSON.stringify(row);

assert.equal(FREE_PREVIEW_SCENES, 3);
assert.deepEqual([...PAID_ORDER_STATUSES], ["paid", "producing", "shipped", "delivered"]);
assert.deepEqual([...freeSceneNumbers(scenes)].sort((a, b) => a - b), [1, 2, 3, 13, 14, 15]);
assert.equal(freeSceneNumbers(null).size, 0);

// ── Purchased: the row as stored (same object, nothing removed) ────────────────
assert.equal(redactStoryForViewer(row, true), row);

// ── Unpaid: free preview only ──────────────────────────────────────────────────
const red = redactStoryForViewer(row, false);
assert.equal(JSON.stringify(row), snapshot, "input must not be mutated");

// No locked text, prompt, plan or locked image ref anywhere in the response
const out = JSON.stringify(red);
assert.ok(!out.includes(SECRET), `locked content leaked: ${out.match(new RegExp(`${SECRET}[^"]*`))?.[0]}`);
for (const n of [4, 5, 6, 7, 8, 9, 10, 11, 12, 16]) assert.ok(!out.includes(ref(n)), `locked image ${n} leaked`);

// Page model preserved: same scene count, numbering, types and every chapter title
const g = red.generated_text;
assert.equal(g.scenes.length, 12);
assert.deepEqual(g.scenes.map((s) => s.sceneNumber), scenes.map((s) => s.sceneNumber));
assert.deepEqual(g.scenes.map((s) => s.type), scenes.map((s) => s.type));
assert.deepEqual(g.scenes.map((s) => s.title), scenes.map((s) => s.title));
assert.deepEqual(g.scenes.slice(0, 3).map((s) => s.text), ["free text 1", "free text 2", "free text 3"]);
assert.ok(g.scenes.slice(3).every((s) => s.text === "" && s.imagePrompt === ""));
assert.ok(g.scenes.every((s) => s.imagePrompt === ""));
// What the preview UI needs is kept
assert.equal(g.bookTitle, generated.bookTitle);
assert.deepEqual(g.titleOptions, generated.titleOptions);
assert.equal(g.synopsis, generated.synopsis);
assert.equal(g.dedication, generated.dedication);
assert.equal(g.dedicationSource, "parent");
assert.equal(g.finalMessage, "");
assert.deepEqual(g.imagePlan, {}, "imagePlan presence kept (outdated-preview check), contents dropped");
assert.equal(g.bookPlan, undefined);
assert.equal(g.imageAssets, undefined);
assert.equal(redactGeneratedStory({ scenes: [] }).imagePlan, undefined, "no plan stays no plan (outdated preview)");
assert.equal(redactGeneratedStory(null), null);

// Illustrations: same rows, free ones keep their image, locked ones lose it; no prompts
assert.equal(red.story_illustrations.length, illustrations.length);
assert.deepEqual(red.story_illustrations.map((i) => i.scene_number), illustrations.map((i) => i.scene_number));
for (const ill of red.story_illustrations) {
  assert.equal(ill.prompt_used, null);
  const free = [1, 2, 3, 13].includes(ill.scene_number);
  assert.equal(ill.image_url, free ? ref(ill.scene_number) : null, `scene ${ill.scene_number}`);
}
// Cover / portrait untouched (part of the preview)
assert.equal(red.cover_image_url, row.cover_image_url);
assert.equal(red.character_portrait_url, row.character_portrait_url);

// Preview progress: cover + free scenes only
assert.deepEqual(red.preview_progress.scenes.map((s) => s.index), [1, 2, 3]);
assert.equal(red.preview_progress.coverUrl, row.preview_progress.coverUrl);
assert.equal(redactPreviewProgress(null), null);

// Signable refs for an unpaid story (POST /api/illustrations/sign)
const allowed = freeImageRefs(row);
assert.ok(allowed.has(row.cover_image_url));
for (const n of [1, 2, 3, 13]) assert.ok(allowed.has(ref(n)), `free ref ${n}`);
for (const n of [4, 5, 12, 16]) assert.ok(!allowed.has(ref(n)), `locked ref ${n} must not be signable`);

// Legacy / partial rows do not throw
assert.deepEqual(redactStoryForViewer({ id: "x" }, false), { id: "x" });
assert.equal(redactStoryForViewer({ generated_text: null }, false).generated_text, null);

console.log("preview-access.check: all assertions passed");
