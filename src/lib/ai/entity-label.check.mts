// Runnable check: entity names in English image prompts (es / ca / en / fr).
//   npx tsx src/lib/ai/entity-label.check.mts
//
// Regression for "The s ardillas", "The el dinosaurio naranja looks like this"
// and "casa de the child" (showcase books, 2026-09-30).
import assert from "node:assert/strict";
import { castLabel, stripArticle, worldLabel } from "./entity-label";
import { humanizeIds, scrubChildName, type PlanCastMember, type PlanWorldAsset } from "./book-plan";
import { buildScenePrompt, label } from "./image-prompts";
import type { CharacterBible } from "./character-description";
import type { ShotSpec } from "./scene-screenplay";

// ── stripArticle: every article of the four book languages, never a name ─────
const cases: [string, string][] = [
  // es
  ["las ardillas", "ardillas"],
  ["Las Ardillas", "Ardillas"],
  ["los cocineros", "cocineros"],
  ["el búho Bruno", "búho Bruno"],
  ["la maestra Miga", "maestra Miga"],
  ["El Mar Turquesa", "Mar Turquesa"],
  // ca
  ["els follets", "follets"],
  ["les fades", "fades"],
  ["en Pau", "Pau"],
  ["na Maria", "Maria"],
  ["l'Anna", "Anna"],
  ["l’óliba", "óliba"],
  // fr
  ["le dragon", "dragon"],
  ["la sirène", "sirène"],
  ["les étoiles", "étoiles"],
  ["l'écureuil", "écureuil"],
  ["des lucioles", "lucioles"],
  // en
  ["the squirrels", "squirrels"],
  ["The Owl", "Owl"],
  // names that merely START like an article stay whole (the old regex cut them)
  ["Leo", "Leo"],
  ["Lana", "Lana"],
  ["Elsa", "Elsa"],
  ["Enzo", "Enzo"],
  ["Lesley", "Lesley"],
  ["Theo", "Theo"],
  ["Laia", "Laia"],
  ["Unai", "Unai"],
  ["Lola", "Lola"],
  ["Coral", "Coral"],
  // an article alone is kept rather than emptied
  ["la", "la"],
];
for (const [input, expected] of cases) assert.equal(stripArticle(input), expected, `stripArticle(${JSON.stringify(input)})`);

// ── Labels: the plan's English label wins; old plans fall back safely ────────
assert.equal(castLabel({ id: "ardillas", name: "las ardillas", label: "squirrels" }), "squirrels");
assert.equal(castLabel({ id: "ardillas", name: "las ardillas" }), "ardillas"); // frozen plan: no "s ardillas"
assert.equal(castLabel({ id: "leo", name: "Leo" }), "Leo");
assert.equal(worldLabel({ id: "casa_de_noa", name: "la casa de Noa", label: "the child's house" }), "child's house");
assert.equal(worldLabel({ id: "orange_dinosaur", name: "el dinosaurio naranja" }), "orange dinosaur"); // never "el dinosaurio naranja"

// ── humanizeIds on real Book Plan prose (forest showcase, es) ─────────────────
const cast: PlanCastMember[] = [
  { id: "ardillas", name: "las ardillas", label: "squirrels", kind: "creature", gender: "none", visual: "Three small red squirrels." },
  { id: "buho_bruno", name: "el búho Bruno", label: "Bruno the owl", kind: "creature", gender: "none", visual: "A round brown owl." },
  { id: "maestra_miga", name: "la maestra Miga", label: "Miga the cook", kind: "character", gender: "female", visual: "A round castle cook." },
];
const world: PlanWorldAsset[] = [
  { id: "casa_de_noa", name: "la casa de Noa", label: "child's house", kind: "location", visual: "A small flat with a balcony." },
  { id: "cofre_musgo", name: "el cofre antiguo", label: "moss chest", kind: "object", visual: "A mossy wooden chest." },
  { id: "cohete", name: "el cohete", label: "rocket", kind: "object", visual: "A retro rocket." },
];
const prose = (t: string) => scrubChildName(humanizeIds(t, cast, world), "Noa");
assert.equal(prose("The child holds the glowing cofre_musgo while the ardillas perch nearby."), "The child holds the glowing moss chest while the squirrels perch nearby.");
assert.equal(prose("The ardillas hold it close."), "The squirrels hold it close.");
assert.equal(prose("Inside casa_de_noa, the buho_bruno watches."), "Inside child's house, Bruno the owl watches.");
assert.equal(prose("The cohete waits by maestra_miga."), "The rocket waits by Miga the cook.");
for (const out of [prose("the ardillas and the cofre_musgo in casa_de_noa")]) {
  assert.doesNotMatch(out, /\bThe s |\bthe s |de the child|\bNoa\b/);
}

// ── Scene prompt: English labels, no book-language articles, no child's name ─
const bible = { description: "a 4-year-old girl with red curls", age: 4, genderWord: "girl" } as CharacterBible;
const shot: ShotSpec = {
  sceneNumber: 9,
  frame: "square",
  camera: "Medium shot",
  shotScale: "medium",
  action: "The child kneels while the squirrels hold out the key",
  moment: "The squirrels give the child the flower key",
  setting: "Forest floor",
  light: "Soft",
  cast: ["child", "ardillas"],
  world: ["casa_de_noa", "cofre_musgo"],
};
const promptCast = {
  bible,
  cast: [
    { id: "ardillas", name: "las ardillas", label: "squirrels", kind: "creature" as const, description: "Three small red squirrels.", scenes: [9, 10] },
    { id: "buho_bruno", name: "el búho Bruno", label: "Bruno the owl", kind: "creature" as const, description: "A round brown owl.", scenes: [4, 6] },
  ],
  world: [
    { id: "casa_de_noa", name: "la casa de Noa", label: "child's house", kind: "location" as const, description: "A small flat.", scenes: [1, 11] },
    { id: "cofre_musgo", name: "el cofre antiguo", label: "moss chest", kind: "object" as const, description: "A mossy chest.", scenes: [6, 9] },
  ],
};
const prompt = buildScenePrompt(promptCast, shot, [{ kind: "sheet", names: promptCast.cast.map(label) }]);
assert.match(prompt, /SQUIRRELS/);
assert.match(prompt, /BRUNO THE OWL is NOT in this scene/);
assert.match(prompt, /The child's house looks like this/);
assert.match(prompt, /The moss chest looks like this/);
assert.match(prompt, /The moment of the story: The squirrels give the child the flower key\./);
assert.doesNotMatch(prompt, /\bThe (el|la|los|las|els|les|en|le|l')\b/i);
assert.doesNotMatch(prompt, /LAS ARDILLAS|EL BÚHO|\bNoa\b|The s /);

// A plan frozen before labels existed: ids as words, never the Spanish name.
const frozen = { ...promptCast, world: promptCast.world.map((w) => ({ ...w, label: undefined })), cast: promptCast.cast.map((c) => ({ ...c, label: undefined })) };
const frozenPrompt = buildScenePrompt(frozen, shot, [{ kind: "sheet", names: frozen.cast.map(label) }]);
assert.match(frozenPrompt, /The casa de noa looks like this/);
assert.doesNotMatch(frozenPrompt, /\bThe (el|la|los|las)\b|LAS ARDILLAS/);
assert.match(frozenPrompt, /\bARDILLAS\b/);

console.log(`entity-label: ${cases.length} article cases + labels + prose + prompts OK`);
