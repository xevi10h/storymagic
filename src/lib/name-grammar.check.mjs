// Runnable check for the name grammar used in UI copy (no deps, no test runner):
//   node --experimental-strip-types src/lib/name-grammar.check.mjs
import assert from "node:assert/strict";
import { catalanArticle, coverTitleKind, deName } from "./name-grammar.ts";

// Catalan personal article with a known gender
const cases = [
  ["Noa", "girl", "de la Noa"],
  ["Pau", "boy", "d'en Pau"],
  ["Anna", "girl", "de l'Anna"],
  ["Àlex", "boy", "de l'Àlex"],
  ["Arnau", "boy", "de l'Arnau"],
  ["Helena", "girl", "de l'Helena"],
  ["Hugo", "boy", "de l'Hugo"], // mute h + vowel elides
  ["Irene", "girl", "de la Irene"], // unstressed i: no elision for feminine
  ["Isabel", "girl", "de la Isabel"],
  ["Inés", "girl", "de la Inés"],
  ["Ivet", "girl", "de la Ivet"],
  ["Imma", "girl", "de l'Imma"], // stressed i elides
  ["Iris", "girl", "de l'Iris"],
  ["Úrsula", "girl", "de l'Úrsula"],
  ["Isidre", "boy", "de l'Isidre"], // masculine always elides before a vowel
  ["Iolanda", "girl", "de la Iolanda"], // semi-vowel
  ["Ian", "boy", "d'en Ian"],
  ["Lucía Núria", "girl", "de la Lucía Núria"],
];
for (const [name, gender, expected] of cases) assert.equal(deName(name, "ca", gender), expected, `${name} (${gender})`);

// Unknown gender: the article only when it does not depend on gender
assert.equal(catalanArticle("Àlex", "neutral"), "l'");
assert.equal(catalanArticle("Anna", undefined), "l'");
assert.equal(catalanArticle("Noa", "neutral"), null);
assert.equal(catalanArticle("Irene", null), null); // la Irene / l'Irene would depend on gender
assert.equal(catalanArticle("", "girl"), null);
assert.equal(deName("Àlex", "ca"), "de l'Àlex");
assert.equal(deName("Noa", "ca"), "de Noa"); // formal-register fallback
assert.equal(deName("Olívia", "fr"), "d'Olívia");
assert.equal(deName("Lucía", "es", "girl"), "de Lucía");
assert.equal(deName("Leo", "en", "boy"), "Leo");

// Cover title layout
assert.equal(coverTitleKind("", "ca", "girl"), "empty");
assert.equal(coverTitleKind("   ", "es"), "empty");
assert.equal(coverTitleKind("Noa", "ca", "girl"), "fem");
assert.equal(coverTitleKind("Pau", "ca", "boy"), "masc");
assert.equal(coverTitleKind("Àlex", "ca", "boy"), "vowel");
assert.equal(coverTitleKind("Anna", "ca"), "vowel");
assert.equal(coverTitleKind("Noa", "ca"), "nameFirst");
assert.equal(coverTitleKind("Noa", "ca", "neutral"), "nameFirst");
assert.equal(coverTitleKind("Émile", "fr"), "elided");
assert.equal(coverTitleKind("Noa", "fr", "girl"), "plain");
assert.equal(coverTitleKind("Ana", "es", "girl"), "plain");

console.log("name-grammar: all checks passed");
