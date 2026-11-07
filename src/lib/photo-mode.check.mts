// Runnable check: photo mode builds the child's look from the traits the parent CONFIRMED
// after uploading (never the untouched defaults, never inferred from the photo), the prepare
// and stories bodies agree on them, the server refuses unconfirmed photo preps, and the final
// book keeps the photo sheet as its face anchor.
//   npx tsx --tsconfig tsconfig.json src/lib/photo-mode.check.mts
import assert from "node:assert/strict";
import {
  characterLookPayload,
  characterPrepareBody,
  migrateCreateState,
  protagonistReadiness,
  storyCharacterBody,
} from "./creation-flow";
import { INITIAL_STATE, type CreateBookState } from "./create-store";
import { portraitInputSchema, prepareInputSchema } from "./character-look";
import { bibleHash, prepBible } from "./ai/character-prep";
import { SKIN_MAP, HAIR_COLOR_MAP } from "./ai/character-description";
import { finalFaceAnchor } from "./ai/face-anchor";

const PHOTO = "11111111-2222-4333-8444-555555555555/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg";
const draft = (over: Partial<CreateBookState> = {}): CreateBookState => ({
  ...INITIAL_STATE,
  character: { ...INITIAL_STATE.character, name: "Lucía", gender: "girl", age: 6 },
  basicsConfirmed: { age: true, gender: true },
  ...over,
});

// ── Readiness: photo mode needs the photo AND confirmed traits ──────────────
assert.equal(protagonistReadiness(draft(), true), "ready", "avatar mode is always ready");
assert.equal(protagonistReadiness(draft({ protagonistMode: "photo" }), true), "photo_missing");
assert.equal(protagonistReadiness(draft({ protagonistMode: "photo", photoPath: PHOTO }), true), "traits_unconfirmed");
assert.equal(protagonistReadiness(draft({ protagonistMode: "photo", photoPath: PHOTO, photoTraitsConfirmed: true }), true), "ready");
assert.equal(protagonistReadiness(draft({ protagonistMode: "photo" }), false), "ready", "flag off: the photo tab does not exist");

// ── The confirmed traits reach BOTH bodies, the photo sheet takes no avatar ──
const confirmed = draft({
  protagonistMode: "photo",
  photoPath: PHOTO,
  photoTraitsConfirmed: true,
  character: {
    ...draft().character,
    skinTone: "#8d5524", // rich medium-dark brown (not the light default)
    hairColor: "#2a2a2a", // jet-black (not the dark-brown default)
    hairstyle: "curly",
    eyeColor: "#2a2a2a",
    glasses: "round-dark",
    freckles: true,
  },
});
const prepBody = characterPrepareBody(confirmed);
const storyBody = storyCharacterBody(confirmed);
assert.equal(prepBody.photoPath, PHOTO);
assert.equal(prepBody.photoTraitsConfirmed, true);
assert.ok(!("avatarAssetPath" in prepBody), "photo prep: no avatar anchor");
assert.ok(!("avatarAssetPath" in storyBody), "photo story: no avatar anchor");
const look = characterLookPayload(confirmed.character);
for (const k of Object.keys(look) as (keyof typeof look)[]) {
  assert.deepEqual(prepBody[k], look[k], `prepare ${k}`);
  assert.deepEqual(storyBody.character[k], look[k], `stories ${k}`);
}
assert.equal(prepBody.skinTone, "#8d5524");

// The Bible (what the story text and every sheet are written from) says the confirmed traits.
const bible = prepBible(prepareInputSchema.parse(prepBody));
assert.ok(bible.description.includes(SKIN_MAP["#8d5524"]), bible.description);
assert.ok(bible.description.includes(HAIR_COLOR_MAP["#2a2a2a"]), bible.description);
assert.ok(!bible.description.includes(SKIN_MAP["#fce4d6"]), "never the default skin once confirmed");
// Same traits → same hash on the story side (the prepared photo sheet is reused, not redrawn).
assert.equal(bibleHash(prepBible(prepareInputSchema.parse({ ...storyBody.character }))), bibleHash(bible));
// A changed trait → a different hash (the old sheet is not reused for a different child).
assert.notEqual(bibleHash(prepBible({ ...look, skinTone: "#fce4d6" })), bibleHash(bible));

// ── Server guard ─────────────────────────────────────────────────────────────
assert.ok(prepareInputSchema.safeParse(prepBody).success, "confirmed photo prep accepted");
assert.ok(!prepareInputSchema.safeParse({ ...prepBody, photoTraitsConfirmed: false }).success, "unconfirmed refused");
const { photoTraitsConfirmed: _omit, ...withoutFlag } = prepBody;
void _omit;
assert.ok(!prepareInputSchema.safeParse(withoutFlag).success, "missing confirmation refused");
assert.ok(
  !prepareInputSchema.safeParse({ ...prepBody, avatarAssetPath: "/images/avatar/girl/big/dark/black-curly.webp" }).success,
  "photo + avatar anchor refused",
);
assert.ok(prepareInputSchema.safeParse(characterPrepareBody(draft())).success, "avatar prep unaffected");
assert.ok(!prepareInputSchema.safeParse({ ...prepBody, photoPath: "../x.jpg" }).success, "bad photo path refused");

// The legacy portrait route never takes a photo (no path around the trait confirmation).
const portraitBody = { childName: "Lucía", ...look };
assert.ok(portraitInputSchema.safeParse(portraitBody).success, "portrait without photo accepted");
assert.ok(!portraitInputSchema.safeParse({ ...portraitBody, photoPath: PHOTO }).success, "portrait with photo refused");
assert.ok(!portraitInputSchema.safeParse({ ...portraitBody, keepPhotoForSheet: true }).success, "keepPhotoForSheet refused");

// ── Draft migration ──────────────────────────────────────────────────────────
const persisted = (over: Record<string, unknown>) => ({ ...JSON.parse(JSON.stringify(confirmed)), currentStep: 3, ...over });
assert.equal(migrateCreateState(persisted({})).currentStep, 3, "confirmed photo draft keeps its screen");
assert.equal(migrateCreateState(persisted({})).photoTraitsConfirmed, true);
const unconfirmed = migrateCreateState(persisted({ photoTraitsConfirmed: false }));
assert.equal(unconfirmed.currentStep, 2, "unconfirmed photo draft goes back to confirm");
assert.equal(migrateCreateState(persisted({ photoTraitsConfirmed: undefined })).currentStep, 2, "pre-confirmation drafts too");
assert.equal(migrateCreateState(persisted({ photoPath: null })).photoTraitsConfirmed, false, "no photo → nothing confirmed");
assert.equal(migrateCreateState(persisted({ protagonistMode: "avatar", photoTraitsConfirmed: false })).currentStep, 3, "avatar drafts untouched");

// ── Final book face anchor ───────────────────────────────────────────────────
const sheet = "character-preps/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/sheet-child-1.jpg";
assert.equal(finalFaceAnchor("/images/avatar/girl/big/dark/black-curly.webp", { url: sheet, fromPhoto: true }), "/images/avatar/girl/big/dark/black-curly.webp");
assert.equal(finalFaceAnchor(null, { url: sheet, fromPhoto: true }), sheet, "photo mode: the photo sheet anchors the final book");
assert.equal(finalFaceAnchor(null, { url: sheet }), null, "no photo, no avatar: unchanged (Bible only)");
assert.equal(finalFaceAnchor(null, { url: sheet, fromPhoto: false }), null);

console.log("photo-mode checks passed");
