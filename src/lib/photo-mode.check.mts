// Runnable check: photo mode (2026-11-09). The photo is turned into an illustrated portrait
// (POST /api/characters/photo-portrait); the traits read FROM THAT DRAWING write the Character
// Bible; the drawing is the face anchor of the prep, the story and the final book. The builder
// ("Créalo tú") never receives the photo traits, and the prepare/stories bodies agree.
//   npx tsx --tsconfig tsconfig.json src/lib/photo-mode.check.mts
import assert from "node:assert/strict";
import {
  activePhotoCharacter,
  builderColours,
  characterLookPayload,
  characterPrepareBody,
  migrateCreateState,
  protagonistReadiness,
  protagonistSnapshot,
  storyCharacterBody,
} from "./creation-flow";
import { INITIAL_STATE, type CreateBookState, type PhotoCharacter } from "./create-store";
import { photoPortraitInputSchema, portraitInputSchema, prepareInputSchema } from "./character-look";
import { bibleHash, prepBible } from "./ai/character-prep";
import { SKIN_MAP, HAIR_COLOR_MAP, EYE_COLOR_MAP, PORTRAIT_LOOK, buildCharacterBible, isPortraitLook } from "./ai/character-description";
import { buildPlanChildDescription } from "./ai/book-plan";
import { finalFaceAnchor } from "./ai/face-anchor";
import { defaultPhotoTraits, parsePhotoTraits, photoTraitOptions } from "./photo-traits";
import { AVATAR_FRAME, buildPhotoPortraitPrompt } from "./ai/image-prompts";
import { photoStyleRefPaths } from "./ai/book-images";
import { AVATAR_HAIRSTYLES, ageBandFor } from "./avatar/manifest";
import { existsSync } from "node:fs";

const USER = "11111111-2222-4333-8444-555555555555";
const PHOTO = `${USER}/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg`;
const PORTRAIT = `portraits/${USER}/cccccccc-bbbb-4ccc-8ddd-eeeeeeeeeeee/portrait-1.png`;
const drawing: PhotoCharacter = {
  portraitPath: PORTRAIT,
  portraitUrl: `https://example.supabase.co/storage/v1/object/sign/illustrations/${PORTRAIT}?token=x`,
  gender: "girl",
  traits: { skinTone: "#8d5524", hairColor: "#2a2a2a", eyeColor: "#5d4037", hairstyle: "curly", glasses: "round-dark", freckles: true },
};
const draft = (over: Partial<CreateBookState> = {}): CreateBookState => ({
  ...INITIAL_STATE,
  character: { ...INITIAL_STATE.character, name: "Lucía", gender: "girl", age: 6, favoriteColor: "#43A047" },
  basicsConfirmed: { age: true, gender: true },
  ...over,
});
const photoDraft = draft({ protagonistMode: "photo", photoCharacter: drawing });

// ── Readiness: photo mode needs the drawing (for the current gender) ─────────
assert.equal(protagonistReadiness(draft(), true), "ready", "avatar mode is always ready");
assert.equal(protagonistReadiness(draft({ protagonistMode: "photo" }), true), "photo_missing");
assert.equal(protagonistReadiness(draft({ protagonistMode: "photo", photoPath: PHOTO }), true), "photo_missing", "an uploaded photo is not enough");
assert.equal(protagonistReadiness(photoDraft, true), "ready");
assert.equal(protagonistReadiness(draft({ protagonistMode: "photo" }), false), "ready", "flag off: the photo tab does not exist");
const boy = { ...photoDraft, character: { ...photoDraft.character, gender: "boy" as const } };
assert.equal(activePhotoCharacter(boy), null, "a drawing made for another gender is discarded");
assert.equal(protagonistReadiness(boy, true), "photo_missing");
assert.equal(activePhotoCharacter({ ...photoDraft, protagonistMode: "avatar" }), null, "avatar tab ignores the drawing");

// ── Bodies: drawing traits over the parent's data, the drawing as the anchor ─
const prepBody = characterPrepareBody(photoDraft);
const storyBody = storyCharacterBody(photoDraft);
assert.equal(prepBody.portraitUrl, PORTRAIT, "prep anchors on the drawing (object path, not the signed URL)");
assert.equal(storyBody.portraitUrl, PORTRAIT, "the story stores the drawing as avatar_url → finalFaceAnchor");
assert.ok(!("avatarAssetPath" in prepBody) && !("avatarAssetPath" in storyBody), "no avatar asset in photo mode");
assert.ok(!("photoPath" in prepBody), "the photo never reaches the prep");
assert.equal(prepBody.skinTone, "#8d5524");
assert.equal(prepBody.hairstyle, "curly");
assert.equal(prepBody.gender, "girl", "gender from the parent");
assert.equal(prepBody.age, 6, "age from the parent");
assert.equal(prepBody.favoriteColor, "#43A047", "favourite colour from the parent");
assert.equal(storyBody.character.name, "Lucía");
const look = characterLookPayload({ ...photoDraft.character, ...drawing.traits });
for (const k of Object.keys(look) as (keyof typeof look)[]) {
  assert.deepEqual(prepBody[k], look[k], `prepare ${k}`);
  assert.deepEqual(storyBody.character[k], look[k], `stories ${k}`);
}
// The builder keeps the parent's own choices (switching tabs never leaks photo traits).
assert.equal(photoDraft.character.skinTone, INITIAL_STATE.character.skinTone);
const avatarBody = characterPrepareBody({ ...photoDraft, protagonistMode: "avatar" });
assert.equal(avatarBody.skinTone, INITIAL_STATE.character.skinTone, "avatar tab: builder traits");
assert.ok(!("portraitUrl" in avatarBody), "avatar tab: no drawing anchor");

// The Bible says what the drawing shows, and prep + story hash the same.
const bible = prepBible(prepareInputSchema.parse(prepBody));
assert.ok(bible.description.includes(SKIN_MAP["#8d5524"]), bible.description);
assert.ok(bible.description.includes(HAIR_COLOR_MAP["#2a2a2a"]), bible.description);
assert.equal(bibleHash(prepBible(prepareInputSchema.parse({ ...storyBody.character }))), bibleHash(bible));
assert.notEqual(bibleHash(prepBible({ ...look, skinTone: "#fce4d6" })), bibleHash(bible));

// Snapshot follows the drawing, not the builder.
assert.notEqual(protagonistSnapshot(photoDraft), protagonistSnapshot({ ...photoDraft, photoCharacter: { ...drawing, portraitPath: `${PORTRAIT}x` } }));
assert.notEqual(protagonistSnapshot(photoDraft), protagonistSnapshot({ ...photoDraft, protagonistMode: "avatar" }));
assert.equal(protagonistSnapshot(photoDraft), protagonistSnapshot({ ...photoDraft, character: { ...photoDraft.character, skinTone: "#523218" } }), "builder edits don't touch a photo prep");

// ── Server schemas ───────────────────────────────────────────────────────────
assert.ok(prepareInputSchema.safeParse(prepBody).success, "photo-mode prep accepted");
assert.ok(!prepareInputSchema.safeParse({ ...prepBody, photoPath: PHOTO }).success, "prepare never takes a photo");
assert.ok(!prepareInputSchema.safeParse({ ...prepBody, avatarAssetPath: "/images/avatar/girl/big/dark/black-curly.webp" }).success, "two anchors refused");
assert.ok(prepareInputSchema.safeParse(characterPrepareBody(draft())).success, "avatar prep unaffected");
assert.ok(photoPortraitInputSchema.safeParse({ photoPath: PHOTO, gender: "girl", age: 6 }).success);
assert.ok(photoPortraitInputSchema.safeParse({ photoPath: PHOTO, gender: "girl", age: 6, favoriteColor: "#43A047" }).success);
assert.ok(!photoPortraitInputSchema.safeParse({ photoPath: "../x.jpg", gender: "girl", age: 6 }).success, "bad photo path refused");
assert.ok(!photoPortraitInputSchema.safeParse({ photoPath: PHOTO, gender: "girl", age: 13 }).success);
const portraitBody = { childName: "Lucía", ...look };
assert.ok(portraitInputSchema.safeParse(portraitBody).success, "legacy portrait without photo accepted");
assert.ok(!portraitInputSchema.safeParse({ ...portraitBody, photoPath: PHOTO }).success, "legacy portrait with photo refused");

// ── Traits contract (what the vision read may answer) ────────────────────────
for (const g of ["boy", "girl", "neutral"] as const) {
  const o = photoTraitOptions(g);
  assert.deepEqual(o.hairstyle, [...AVATAR_HAIRSTYLES[g]]);
  for (const k of ["skinTone", "hairColor", "eyeColor"] as const) assert.ok(o[k].length > 0);
  assert.ok(parsePhotoTraits(defaultPhotoTraits(g), g), `defaults valid for ${g}`);
}
assert.equal(parsePhotoTraits({ ...drawing.traits, hairstyle: "mohawk" }, "girl"), null, "hairstyle outside the gender's list refused");
assert.equal(parsePhotoTraits({ ...drawing.traits, skinTone: "#c68642" }, "girl"), null, "legacy skin hex refused");
assert.equal(parsePhotoTraits({ ...drawing.traits, freckles: "yes" }, "girl"), null);

// ── Photo portrait: photo = identity, avatar matrix = style, no identity text ─
const p = buildPhotoPortraitPrompt({ age: 6, genderWord: "girl", styleRefs: 2 });
assert.ok(p.includes("FIRST attached image is a photo"), p);
assert.ok(p.includes("SECOND to THIRD attached images are character portraits"), p);
assert.ok(p.includes(AVATAR_FRAME), "same composition as the avatar matrix");
assert.ok(!buildPhotoPortraitPrompt({ age: 6, genderWord: "girl", styleRefs: 0 }).includes("SECOND"), "no style refs → no dangling role");
for (const g of ["boy", "girl", "neutral"] as const) {
  for (const age of [3, 9]) {
    const refs = photoStyleRefPaths(g, age);
    assert.equal(refs.length, 2, `${g} ${age}: two rendered style refs`);
    for (const r of refs) assert.ok(existsSync(`public${r}`), `${r} exists`);
    assert.ok(refs.every((r) => r.includes(`/${ageBandFor(age)}/`)), "same age band");
  }
}
for (const words of Object.values(SKIN_MAP)) assert.ok(!p.includes(words), `no skin text in the photo prompt (${words})`);
for (const words of Object.values(HAIR_COLOR_MAP)) assert.ok(!p.includes(words), `no hair text in the photo prompt (${words})`);

// ── Draft migration ──────────────────────────────────────────────────────────
const persisted = (over: Record<string, unknown>) => ({ ...JSON.parse(JSON.stringify(photoDraft)), currentStep: 3, ...over });
assert.equal(migrateCreateState(persisted({})).currentStep, 3, "photo draft with its drawing keeps its screen");
assert.deepEqual(migrateCreateState(persisted({})).photoCharacter, drawing);
assert.equal(migrateCreateState(persisted({ photoCharacter: null })).currentStep, 2, "no drawing → back to screen 2");
assert.equal(migrateCreateState(persisted({ photoCharacter: { ...drawing, traits: { ...drawing.traits, glasses: "huge" } } })).photoCharacter, null, "invalid drawing dropped");
assert.equal(migrateCreateState(persisted({ photoCharacter: undefined, photoPath: PHOTO, photoTraitsConfirmed: true })).currentStep, 2, "pre-2026-11-09 drafts upload again");
assert.equal(migrateCreateState(persisted({ photoPath: PHOTO })).photoPath, PHOTO, "a leftover photo path is kept so /create can delete it");
assert.equal(migrateCreateState(persisted({ photoPath: "../evil.jpg" })).photoPath, null);
assert.equal(migrateCreateState(persisted({ protagonistMode: "avatar", photoCharacter: null })).currentStep, 3, "avatar drafts untouched");
assert.equal(
  migrateCreateState(persisted({ character: { ...photoDraft.character, gender: "boy" } })).currentStep,
  2,
  "drawing of another gender → back to screen 2",
);

// ── Traits unreadable → neutral look (owner decision 2026-11-09) ─────────────
const neutralDraft = draft({ protagonistMode: "photo", photoCharacter: { ...drawing, traits: null } });
assert.equal(protagonistReadiness(neutralDraft, true), "ready", "a drawing without readable traits is still the child");
const nPrep = characterPrepareBody(neutralDraft);
const nStory = storyCharacterBody(neutralDraft);
assert.equal(nPrep.portraitUrl, PORTRAIT, "neutral: still anchored on the drawing");
assert.equal(nPrep.skinTone, PORTRAIT_LOOK, "neutral marker travels in the single builders");
const nBible = prepBible(prepareInputSchema.parse(nPrep));
const traitWords = [
  ...Object.values(SKIN_MAP), ...Object.values(HAIR_COLOR_MAP), ...Object.values(EYE_COLOR_MAP),
  "skin", "hair", "eyes", "glasses", "freckles", "curls", "braids", "ponytail", "bob", "afro",
];
for (const w of traitWords) assert.ok(!nBible.identity.includes(w), `neutral Bible names no trait ("${w}"): ${nBible.identity}`);
assert.ok(nBible.identity.includes("reference portrait"), nBible.identity);
assert.ok(nBible.description.includes(nBible.outfit), "the outfit stays (the drawing wears it)");
// prepare ≡ stories ≡ generate route (StoryInput from the stored character row, defaults applied)
assert.equal(bibleHash(prepBible(prepareInputSchema.parse({ ...nStory.character }))), bibleHash(nBible), "prepare ≡ stories hash");
const storedRow = { gender: nStory.character.gender, age: nStory.character.age, skinTone: nStory.character.skinTone, hairColor: nStory.character.hairColor, eyeColor: nStory.character.eyeColor, hairstyle: nStory.character.hairstyle, favoriteColor: nStory.character.favoriteColor, glasses: nStory.character.glasses, freckles: nStory.character.freckles };
assert.equal(bibleHash(buildCharacterBible(storedRow)), bibleHash(nBible), "generate route rebuilds the same neutral Bible");
assert.equal(buildPlanChildDescription({ ...storedRow, childName: "Lucía" } as Parameters<typeof buildPlanChildDescription>[0]), nBible.description, "scene prompts use the neutral text too");
assert.notEqual(bibleHash(nBible), bibleHash(bible), "neutral ≠ read traits (no stale prep reuse)");
// Persisted + restored as the explicit null state, never as builder defaults
assert.equal(migrateCreateState({ ...JSON.parse(JSON.stringify(neutralDraft)), currentStep: 3 }).photoCharacter?.traits, null);
assert.equal(migrateCreateState({ ...JSON.parse(JSON.stringify(neutralDraft)), currentStep: 3 }).currentStep, 3);
// The marker never reaches the builder ("Créalo tú", dashboard character reuse)
assert.deepEqual(builderColours({ skinTone: PORTRAIT_LOOK, hairColor: PORTRAIT_LOOK, eyeColor: "#1976d2" }, INITIAL_STATE.character), {
  skinTone: INITIAL_STATE.character.skinTone, hairColor: INITIAL_STATE.character.hairColor, eyeColor: "#1976d2",
});
assert.equal(migrateCreateState({ ...JSON.parse(JSON.stringify(draft())), character: { ...draft().character, skinTone: PORTRAIT_LOOK } }).character.skinTone, INITIAL_STATE.character.skinTone);
assert.ok(!isPortraitLook(prepBody), "read traits are not neutral");

// ── Final book face anchor ───────────────────────────────────────────────────
assert.equal(finalFaceAnchor(PORTRAIT, { url: "character-preps/x/sheet-child-1.jpg" }), PORTRAIT, "the drawing anchors the final book");
assert.equal(finalFaceAnchor(null, { url: "character-preps/x/sheet-child-1.jpg" }), null, "no anchor: Bible only (unchanged)");

console.log("photo-mode checks passed");
