// Runnable check for the pure illustration-ref helpers (no deps, no test runner):
//   node --experimental-strip-types src/lib/storage/illustration-refs.check.mjs
import assert from "node:assert/strict";
import { illustrationPath, illustrationScope, isIllustrationRef, portraitFolder, toShowcaseUrl } from "./illustration-refs.ts";

const SB = "https://proj.supabase.co";
const STORY = "0b0e4f2a-1c2d-4e5f-8a9b-0c1d2e3f4a5b";
const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

// ── Parsing ──────────────────────────────────────────────────────────────────
assert.equal(illustrationPath(`${STORY}/final/scene-3-x.jpg`), `${STORY}/final/scene-3-x.jpg`);
assert.equal(illustrationPath(`${SB}/storage/v1/object/public/illustrations/${STORY}/preview/cover.jpg`), `${STORY}/preview/cover.jpg`);
assert.equal(illustrationPath(`${SB}/storage/v1/object/public/illustrations/${STORY}/preview/cover.jpg?v=17`), `${STORY}/preview/cover.jpg`);
assert.equal(illustrationPath(`${SB}/storage/v1/object/sign/illustrations/portraits/${USER}/p/portrait-1.jpg?token=abc`), `portraits/${USER}/p/portrait-1.jpg`);
assert.equal(illustrationPath(`${SB}/storage/v1/object/sign/illustrations/a%20b/c.jpg?token=abc`), "a b/c.jpg");
assert.equal(illustrationPath(`${SB}/storage/v1/object/public/showcase/${STORY}/x.jpg`), null);
assert.equal(illustrationPath(`${SB}/storage/v1/object/sign/child-photos/${USER}/x.jpg?token=t`), null);
assert.equal(illustrationPath("https://picsum.photos/seed/x/1024"), null);
assert.equal(illustrationPath("data:image/png;base64,AAAA"), null);
assert.equal(illustrationPath("/images/cover.png"), null);
assert.equal(illustrationPath("../secrets/x.jpg"), null);
assert.equal(illustrationPath(`${SB}/storage/v1/object/public/illustrations/..%2F..%2Fx`), null);
assert.equal(illustrationPath("a//b.jpg"), null);
assert.equal(illustrationPath(""), null);
assert.equal(illustrationPath(null), null);
assert.equal(isIllustrationRef(`${STORY}/x.jpg`), true);

// ── Ownership scope ──────────────────────────────────────────────────────────
assert.deepEqual(illustrationScope(`${STORY}/final/scene-1.jpg`), { kind: "story", storyId: STORY });
assert.deepEqual(illustrationScope(`${portraitFolder(USER, "p1")}/portrait-1.jpg`), { kind: "user-portrait", userId: USER });
assert.deepEqual(illustrationScope(`portraits/${STORY}/portrait-1.jpg`), { kind: "legacy-portrait" });
assert.deepEqual(illustrationScope("portraits/qa-test-leo/portrait-1.jpg"), { kind: "legacy-portrait" });
assert.deepEqual(illustrationScope("portraits/not-a-uuid/x/portrait.jpg"), { kind: "other" });
assert.deepEqual(illustrationScope("waitlist-covers/kai.png"), { kind: "other" });
assert.deepEqual(illustrationScope("mock/scene-1.png"), { kind: "other" });
assert.deepEqual(illustrationScope(`${STORY}`), { kind: "other" });

// ── Showcase mirror ──────────────────────────────────────────────────────────
assert.equal(toShowcaseUrl(`${STORY}/final/cover.jpg`, SB), `${SB}/storage/v1/object/public/showcase/${STORY}/final/cover.jpg`);
assert.equal(toShowcaseUrl(`${SB}/storage/v1/object/public/illustrations/${STORY}/c.png`, `${SB}/`), `${SB}/storage/v1/object/public/showcase/${STORY}/c.png`);
assert.equal(toShowcaseUrl("https://picsum.photos/x", SB), "https://picsum.photos/x");
assert.equal(toShowcaseUrl(null, SB), null);

console.log("illustration refs: all checks passed");
