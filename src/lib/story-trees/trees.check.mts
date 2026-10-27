// Runnable check: every story tree is valid and complete, and seasonal worlds are gated.
//   npx tsx src/lib/story-trees/trees.check.mts
import assert from "node:assert/strict";
import { STORY_TREES, validateTree, type LocalizedText } from "./index";
import { templateHasTree } from "./loaders";
import { EVERGREEN_TEMPLATES, STORY_TEMPLATES, getTemplateConfig, isTemplateAvailable } from "../create-store";
import { applyFixedCast, fixedCastPrompt, TEMPLATE_FIXED_CAST } from "../ai/template-cast";
import type { PlanCastMember } from "../ai/book-plan";

const LOCALES = ["es", "ca", "en", "fr"] as const;

// ── Every template has a registered tree (server registry + client loader) ──
for (const t of STORY_TEMPLATES) {
  assert.ok(STORY_TREES[t.id], `${t.id}: no tree in STORY_TREES`);
  assert.ok(templateHasTree(t.id), `${t.id}: no client loader`);
}

// ── Structure + content of every tree ────────────────────────────────────────
for (const [id, tree] of Object.entries(STORY_TREES)) {
  assert.equal(tree.templateId, id, `${id}: templateId mismatch`);
  assert.deepEqual(validateTree(tree), [], `${id}: validateTree`);

  const full = (t: LocalizedText, where: string) => {
    for (const l of LOCALES) assert.ok((t[l] ?? "").trim(), `${id} ${where}: missing ${l}`);
    const withName = LOCALES.filter((l) => (t[l] ?? "").includes("{name}"));
    assert.ok(withName.length === 0 || withName.length === LOCALES.length, `${id} ${where}: {name} only in ${withName.join(",")}`);
  };

  const seeds = new Set<string>();
  let options = 0;
  for (const node of Object.values(tree.nodes)) {
    if (node.id === tree.ending) continue;
    if (id === "reyes") full(node.question, `${node.id}.question`);
    for (const o of node.options) {
      options++;
      assert.ok(!seeds.has(o.imageSeed), `${id}: duplicate imageSeed ${o.imageSeed}`);
      seeds.add(o.imageSeed);
      if (id === "reyes") {
        full(o.title, `${node.id}.${o.id}.title`);
        full(o.desc, `${node.id}.${o.id}.desc`);
        full(o.narrative, `${node.id}.${o.id}.narrative`);
        assert.ok(o.imageSeed.startsWith("reyes-"), `reyes: seed ${o.imageSeed} must start with reyes-`);
        // desc.en becomes the path-art prompt: never the child, never a King.
        assert.ok(!/\{name\}|\bchild\b|\bkings?\b|melchior|caspar|balthazar|\bpage\b/i.test(o.desc.en ?? ""), `reyes ${o.imageSeed}: desc.en shows a person: ${o.desc.en}`);
        assert.ok(!/[{}]/.test(o.title.en ?? "") && !/[{}]/.test(o.desc.en ?? ""), `reyes ${o.imageSeed}: braces break the path-art parser`);
        // Quoted words and onomatopoeia get painted as lettering by the image model.
        assert.ok(!/[“”«»"]|\b(pom|quack|tee-hee)\b/i.test(o.desc.en ?? ""), `reyes ${o.imageSeed}: desc.en invites lettering: ${o.desc.en}`);
      }
    }
  }
  if (id === "reyes") assert.equal(options, 39, "reyes: 39 options (3 + 9 + 27)");
}

// ── Availability window (Europe/Madrid, inclusive) ───────────────────────────
const reyes = getTemplateConfig("reyes");
assert.ok(reyes?.seasonal, "reyes is seasonal");
assert.equal(isTemplateAvailable("reyes", "2026-10-26"), true);
assert.equal(isTemplateAvailable("reyes", "2027-01-06"), true, "orderable on 6 January");
assert.equal(isTemplateAvailable("reyes", "2027-01-07"), false, "gone on 7 January");
assert.equal(isTemplateAvailable({ ...reyes!, availableFrom: "2026-11-01" }, "2026-10-31"), false, "availableFrom respected");
assert.equal(isTemplateAvailable({ ...reyes!, availableFrom: "2026-11-01" }, "2026-11-01"), true);
assert.equal(isTemplateAvailable("castle", "2030-01-07"), true, "evergreen always available");
assert.equal(isTemplateAvailable("nope", "2026-10-26"), false, "unknown id");

// ── Evergreen list: counts and catalogs keep saying ten worlds ────────────────
assert.equal(EVERGREEN_TEMPLATES.length, 10);
assert.ok(!EVERGREEN_TEMPLATES.some((t) => t.seasonal));
assert.ok(getTemplateConfig("reyes"), "paid books still resolve their template");

// ── The Three Kings keep their canonical look whatever the model wrote ───────
const fixed = TEMPLATE_FIXED_CAST.reyes;
const cm = (c: Partial<PlanCastMember> & Pick<PlanCastMember, "id" | "name">): PlanCastMember => ({
  label: c.name,
  kind: "character",
  gender: "none",
  visual: "a man with a painted face",
  ...c,
});
const out = applyFixedCast("reyes", [
  cm({ id: "melchor", name: "Melchor" }),
  cm({ id: "rey_gaspar", name: "el rey Gaspar", label: "King Gaspar" }),
  cm({ id: "balthazar", name: "Balthazar" }),
  cm({ id: "camello_melchor", name: "el camello de Melchor", label: "Melchior's camel", kind: "creature", visual: "a camel" }),
  cm({ id: "fox", name: "Zorro", visual: "a fox" }),
]);
assert.equal(out[0].visual, fixed.members[0].visual);
assert.equal(out[1].visual, fixed.members[1].visual, "matched by name");
assert.equal(out[1].id, "rey_gaspar", "id kept so shots still resolve");
assert.equal(out[2].visual, fixed.members[2].visual);
assert.ok(out.slice(0, 3).every((c) => c.gender === "male" && c.kind === "character"));
assert.equal(out[3].visual, "a camel", "a King's camel keeps its own look");
assert.equal(out[4].visual, "a fox");
assert.ok(/Black man with deep brown skin/.test(fixed.members[2].visual));
for (const m of fixed.members) assert.ok(!/paint|make-?up|blackface|costume/i.test(m.visual), `${m.id}: forbidden wording`);
const group = applyFixedCast("reyes", [cm({ id: "reyes_magos", name: "los Reyes Magos", label: "the Three Kings" })]);
assert.ok(group[0].visual.includes(fixed.members[2].visual), "group entry gets all three looks");
assert.deepEqual(applyFixedCast("castle", [cm({ id: "melchor", name: "Melchor" })])[0].visual, "a man with a painted face", "other worlds untouched");
assert.ok(fixedCastPrompt("reyes", "ca")?.includes("Melcior"));
assert.equal(fixedCastPrompt("castle", "es"), null);

console.log(`trees.check: ${Object.keys(STORY_TREES).length} trees valid, reyes gated + Kings fixed — OK`);
