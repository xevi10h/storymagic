// Runnable check of the QA judge's deterministic pass/fail rules (no API calls):
//   npx tsx src/lib/ai/qa-judge.check.mts
import assert from "node:assert/strict";
import { failsQa, verdictFrom, type Claim, type QAScene, type Verification } from "./qa-judge";

const scene: QAScene = { sceneNumber: 7, imageUrl: "x", text: "Pero Bruma dormía.", shot: "", present: ["THE CHILD", "CORAL", "BRUMA"], absent: ["LULO"] };
const claims: Claim[] = [{ claim: "Bruma is asleep (eyes closed)", quote: "Bruma dormía" }];
const clean: Verification = {
  claims: [{ index: 0, verdict: "shown", evidence: "eyes closed", obvious: false }],
  characters: [
    { name: "THE CHILD", visible: true, sameIndividualTwice: false },
    { name: "CORAL", visible: true, sameIndividualTwice: false },
    { name: "BRUMA", visible: true, sameIndividualTwice: false },
    { name: "LULO", visible: false, sameIndividualTwice: false },
  ],
  insideOf: "",
  insideOfAlsoVisibleOutside: false,
  childSameAsSheet: true,
  childGenderMatches: true,
  textInImage: false,
  sheetLayoutCopied: false,
  impossibleScene: [],
  consistencyScore: 9,
  coherenceScore: 9,
  qualityScore: 9,
  fix: "",
};
const judge = (patch: Partial<Verification>) => verdictFrom(scene, claims, { ...clean, ...patch });

// A clean review passes, whatever the model's own mood.
assert.equal(failsQa(judge({})), false);
// An obvious contradiction of the page text fails even with 9/9/9 scores (the old judge's blind spot).
const asleep = judge({ claims: [{ index: 0, verdict: "contradicted", evidence: "eye open", obvious: true }] });
assert.equal(failsQa(asleep), true);
assert.equal(asleep.hardFail, false); // repairable by an edit
assert.match(asleep.issues[0], /Bruma dormía/);
// A doubtful contradiction, or a fact simply not in view, does not.
assert.equal(failsQa(judge({ claims: [{ index: 0, verdict: "contradicted", evidence: "?", obvious: false }] })), false);
assert.equal(failsQa(judge({ claims: [{ index: 0, verdict: "not_shown", evidence: "off frame", obvious: false }] })), false);
// A group character painted as several members is not a duplicate; the same individual twice is hard.
assert.equal(failsQa(judge({})), false);
const twice = judge({ characters: clean.characters.map((c) => (c.name === "CORAL" ? { ...c, sameIndividualTwice: true } : c)) });
assert.equal(twice.hardFail, true);
// Excluded character visible, required one missing, impossible scene, inside-of seen outside: soft fails.
assert.equal(failsQa(judge({ characters: clean.characters.map((c) => (c.name === "LULO" ? { ...c, visible: true } : c)) })), true);
assert.equal(failsQa(judge({ characters: clean.characters.map((c) => (c.name === "BRUMA" ? { ...c, visible: false } : c)) })), true);
assert.equal(failsQa(judge({ impossibleScene: ["the pearl is in two places"] })), true);
assert.equal(failsQa(judge({ insideOf: "lighthouse", insideOfAlsoVisibleOutside: true })), true);
assert.equal(failsQa(judge({ insideOf: "", insideOfAlsoVisibleOutside: true })), false);
// Hard failures.
for (const patch of [{ textInImage: true }, { sheetLayoutCopied: true }, { childSameAsSheet: false }, { childGenderMatches: false }]) {
  assert.equal(judge(patch).hardFail, true, JSON.stringify(patch));
}
// The child's identity only matters when the child is in frame.
assert.equal(verdictFrom({ ...scene, present: ["BRUMA"] }, claims, { ...clean, childSameAsSheet: false }).hardFail, false);
// Consistency below 8 still fails on its own (identity drift).
assert.equal(failsQa(judge({ consistencyScore: 7 })), true);

// The map's search-and-find items must be visible: "not_shown" fails for a required fact.
const map: Claim[] = [{ claim: "a red kite is clearly visible and recognisable", quote: "red kite", required: true }];
const mapV = (verdict: "shown" | "not_shown" | "contradicted") => verdictFrom(scene, map, { ...clean, claims: [{ index: 0, verdict, evidence: "", obvious: false }] });
assert.equal(failsQa(mapV("shown")), false);
assert.equal(failsQa(mapV("not_shown")), true);
assert.equal(failsQa(mapV("contradicted")), true);

console.log("qa-judge rules OK");
