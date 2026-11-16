// Runnable check for the preview page slice (toPreviewPages + withTeaserEnd):
//   npx tsx --tsconfig tsconfig.json src/lib/preview-pages.check.mts
// The share view runs PAID books through the same slice, so the art is locked by
// scene position, never by "illustration ready".
import assert from "node:assert/strict";
import type { BookPage } from "../components/book-viewer/types";
import { toPreviewPages } from "./book-pages";
import { withTeaserEnd } from "./preview-teaser";

const art = (n: number) => `story/scene-${n}.png`;
const scene = (n: number) => ({ sceneNumber: n, type: "scene" as const, title: `Chapter ${n}`, text: `Text ${n}`, imagePrompt: "" });
const print = (kind: string, n: number, extra: Record<string, unknown> = {}) => ({ kind, sceneNumber: n, pageNumber: 0, ...extra }) as never;
const scenePage = (n: number, kind: string, imageUrl: string | null, extra: Record<string, unknown> = {}): BookPage => ({
  type: "scene",
  scene: scene(n),
  imageUrl,
  locked: false,
  print: print(kind, n, extra),
});

// A fully illustrated (paid) book: every scene ready, panoramas at 3 and 8, a secondary at 5.
const pages: BookPage[] = [
  { type: "cover", title: "T", characterName: "Lucía", templateId: "space", imageUrl: "story/cover.png", cover: {} as never },
  { type: "endpaper", templateId: "space", offset: "left" },
  { type: "title_dedication", title: "T", print: {} as never, characterName: "Lucía", kicker: "", quotes: ["«", "»"] },
];
for (let n = 1; n <= 12; n++) {
  if (n === 3 || n === 8) {
    pages.push(scenePage(n, "spread", art(n), { half: "left" }), scenePage(n, "spread", art(n), { half: "right" }));
  } else if (n === 5) {
    pages.push(scenePage(n, "illustration", art(n)), scenePage(n, "illustration-text", art(n + 12)));
  } else {
    pages.push(scenePage(n, "illustration", art(n)), scenePage(n, "text", null));
  }
}
pages.push(
  { type: "final", print: {} as never, kicker: "", end: "Fin" },
  { type: "colophon", text: "c" },
  { type: "back", title: "T", characterName: "Lucía", synopsis: "s", coverImageUrl: art(12), templateId: "space", storyId: "x", cover: {} as never },
);

const preview = toPreviewPages(pages);
const scenes = preview.filter((p): p is Extract<BookPage, { type: "scene" }> => p.type === "scene");
assert.equal(preview.length, 3 + 24, "header + 24 scene pages");
assert.equal(preview[preview.length - 1].type, "scene", "nothing after the last scene");
assert.ok(!preview.some((p) => p.type === "final" || p.type === "back" || p.type === "colophon"));
for (const p of scenes) {
  const free = p.scene.sceneNumber <= 3;
  assert.equal(p.locked, !free, `scene ${p.scene.sceneNumber} locked`);
  if (!free) assert.equal(p.imageUrl, null, `scene ${p.scene.sceneNumber} art must not leave`);
  assert.equal(p.scene.text, `Text ${p.scene.sceneNumber}`, "every scene keeps its text");
}
const shownArt = new Set(preview.flatMap((p) => (p.type === "scene" && p.imageUrl ? [p.imageUrl] : [])));
assert.deepEqual([...shownArt].sort(), [art(1), art(2), art(3)].sort(), "only the free scenes' art");
assert.ok(!JSON.stringify(preview).includes(art(17)), "no locked secondary illustration");
assert.ok(pages.every((p) => p.type !== "scene" || !p.locked), "input not mutated");

const order = { title: "T", characterName: "Lucía", coverUrl: null, format: "softcover" as const, priceFrom: "34,90 €" };
const full = withTeaserEnd(preview, { characterName: "Lucía", order });
assert.equal(full.length, 29, "complete desktop spreads");
const paint = full[27];
assert.equal(paint.type, "teaser_paint");
assert.equal(full[28].type, "teaser_order");
if (paint.type === "teaser_paint") {
  assert.deepEqual(paint.chapters.map((c) => c.sceneNumber), [4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(paint.imageUrl, art(3), "backdrop = last art seen");
}
// Outdated preview (cannot be bought): no order page.
assert.equal(withTeaserEnd(preview, { characterName: "Lucía" }).length, 28);
// Malformed story without scenes: header only, no teaser.
assert.equal(toPreviewPages(pages.slice(0, 3)).length, 3);

console.log("preview-pages.check: all assertions passed");
