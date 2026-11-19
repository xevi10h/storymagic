// Runnable check for early-reader books (generated_text.earlyReader):
//   npx tsx --tsconfig tsconfig.json src/lib/book/early-reader.check.mts
// With the flag, the book's fixed copy and the child's name are in capitals in every
// locale, the Catalan article moves to the title page's name line, and the flag survives
// the unpaid-viewer redaction. Without it, nothing changes.
import assert from "node:assert/strict";
import { buildBookPages } from "../book-pages";
import { redactGeneratedStory } from "../preview-access";
import { capsFor, mapPanelStrings, titleForName } from "./print-text";

const upper = (s: string) => s === s.toLocaleUpperCase("ca");

// Helpers
const up = capsFor({ earlyReader: true }, "ca");
assert.deepEqual(titleForName("ca", "personalizedAdventure", "Aran", "boy", up), { kicker: "UNA AVENTURA PERSONALITZADA PER A", name: "L'ARAN" });
assert.deepEqual(titleForName("ca", "personalizedAdventure", "Pau", "boy", up), { kicker: "UNA AVENTURA PERSONALITZADA PER A", name: "EN PAU" });
assert.deepEqual(titleForName("ca", "personalizedAdventure", "Aran", "boy", capsFor({}, "ca")), { kicker: "Una aventura personalitzada per a l'", name: "Aran" });
for (const locale of ["es", "ca", "en", "fr"]) {
  const s = mapPanelStrings(locale, "little", 4, capsFor({ earlyReader: true }, locale));
  assert.ok(Object.values(s).every(upper), `map strings in capitals (${locale})`);
}
assert.deepEqual(redactGeneratedStory({ scenes: [], earlyReader: true })?.earlyReader, true);
assert.equal(redactGeneratedStory({ scenes: [] })?.earlyReader, undefined);

// Whole book (font-free plan), every locale
const scenes = Array.from({ length: 12 }, (_, i) => ({ sceneNumber: i + 1, type: i % 3 === 2 ? "bridge" : "scene", title: `T${i + 1}`, text: `TEXT ${i + 1}`, imagePrompt: "" }));
function book(locale: string, earlyReader: boolean) {
  return buildBookPages(
    {
      id: "s",
      locale,
      status: "preview",
      template_id: "space",
      title: "L'ARAN TOCA LES ESTRELLES",
      cover_image_url: null,
      character_portrait_url: null,
      generated_text: { bookTitle: "x", titleOptions: [], coverImagePrompt: "", scenes, dedication: "", finalMessage: "BONA NIT", synopsis: "", ...(earlyReader ? { earlyReader } : {}) },
      dedication_text: null,
      sender_name: null,
      characters: { name: "Aran", age: 4, gender: "boy", city: "Girona", interests: ["space"], favorite_color: "#E53935", favorite_companion: null, future_dream: null, avatar_url: null },
      story_illustrations: [],
    } as never,
    "",
    { preview: false },
  );
}
for (const locale of ["es", "ca", "en", "fr"]) {
  const pages = book(locale, true);
  const fixed: string[] = [];
  for (const p of pages) {
    if (p.type === "title_dedication") fixed.push(p.kicker, p.characterName);
    if (p.type === "final") fixed.push(p.kicker, p.end);
    if (p.type === "hero_card") fixed.push(p.characterName, p.heroLabel, p.ageLine, ...p.traits.map((t) => t.label), ...p.interests);
    if (p.type === "colophon") fixed.push(p.text);
  }
  assert.ok(fixed.length >= 10, `fixed copy found (${locale})`);
  for (const text of fixed) assert.ok(upper(text), `${locale}: "${text}" should be in capitals`);
  const cover = pages[0].type === "cover" ? pages[0].cover : null;
  assert.ok(cover && upper(cover.subtitle) && upper(cover.name), `${locale}: cover subtitle/name in capitals`);
}
const plain = book("ca", false).find((p) => p.type === "final");
assert.ok(plain?.type === "final" && plain.end === "Fi", "ordinary books keep their case");

console.log("early-reader check: OK");
