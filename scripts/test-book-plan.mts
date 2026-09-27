/**
 * Book Plan validation — generates full plans for 4 reference cases with REAL
 * story-tree paths, prints the manuscripts and checks them against the print
 * layout. No DB access, no writes except artifacts/book-plan-validation/.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/test-book-plan.mts [flags]
 *
 * Flags:
 *   --case=es|ca|fr|en   run a single case (default: all 4, in parallel)
 *   --model=<id>         override OPENAI_BOOK_PLAN_MODEL
 *   --reasoning=<effort> override OPENAI_BOOK_PLAN_REASONING
 *   --tag=<name>         output subfolder (default: model name)
 */

import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { resolve, join } from "path";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
process.env.MOCK_MODE = "false";

const args = process.argv.slice(2);
const arg = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
if (arg("model")) process.env.OPENAI_BOOK_PLAN_MODEL = arg("model");
if (arg("reasoning")) process.env.OPENAI_BOOK_PLAN_REASONING = arg("reasoning");

const bp = await import("../src/lib/ai/book-plan.ts");
const { getStoryTree } = await import("../src/lib/story-trees/index.ts");
const { getTemplateConfig } = await import("../src/lib/create-store.ts");
const { ensurePdfFontsLoaded } = await import("../src/lib/pdf/fonts.ts");
const { planInteriorPages } = await import("../src/lib/pdf/layout.ts");
const { getPdfTextConfig } = await import("../src/lib/pdf/theme.ts");
type StoryInput = import("../src/lib/ai/story-generator.ts").StoryInput;

/** Walk the real tree picking option index `picks[i]` at each chapter. */
function treePath(templateId: string, picks: number[]) {
  const tree = getStoryTree(templateId);
  if (!tree) throw new Error(`no tree for ${templateId}`);
  const path: { nodeId: string; optionId: string }[] = [];
  let nodeId: string | null = tree.root;
  for (const pick of picks) {
    if (!nodeId || nodeId === tree.ending) break;
    const node = tree.nodes[nodeId];
    const opt = node.options[pick % node.options.length];
    path.push({ nodeId, optionId: opt.id });
    nodeId = opt.next;
  }
  return path;
}

function ending(templateId: string, i: number): string | undefined {
  return getTemplateConfig(templateId)?.endings[i]?.id;
}

const base = { interests: [] as string[], hairColor: "#5d4037", eyeColor: "#5d4037", skinTone: "#eebb99", hairstyle: "short", creationMode: "solo" as const };

const CASES: Record<string, StoryInput> = {
  es: {
    ...base,
    childName: "Lucía",
    gender: "girl",
    age: 5,
    city: "Zaragoza",
    interests: ["animales", "dibujar"],
    favoriteColor: "#43a047",
    favoriteCompanion: "Canela, su perrita",
    hairstyle: "pigtails",
    templateId: "forest",
    templateTitle: "El Bosque Mágico",
    decisions: { treePath: treePath("forest", [0, 0, 1]) },
    endingChoice: ending("forest", 0),
    dedication: "Para mi pequeña exploradora: que nunca dejes de preguntarte qué hay detrás de cada árbol. Te quiero hasta la luna (¡y vuelta!).",
    senderName: "Mamá",
    locale: "es",
  },
  ca: {
    ...base,
    childName: "Pau",
    gender: "boy",
    age: 8,
    city: "Girona",
    interests: ["futbol", "construir robots"],
    favoriteColor: "#1e88e5",
    futureDream: "astronaut",
    templateId: "space",
    templateTitle: "Viatge a les Estrelles",
    decisions: { treePath: treePath("space", [0, 1, 0]) },
    endingChoice: ending("space", 2),
    locale: "ca",
  },
  fr: {
    ...base,
    childName: "Léa",
    gender: "girl",
    age: 3,
    city: "Lyon",
    interests: ["les animaux", "chanter"],
    favoriteColor: "#fdd835",
    hairstyle: "curly",
    skinTone: "#8d5524",
    hairColor: "#2a2a2a",
    templateId: "safari",
    templateTitle: "Safari Sauvage",
    creationMode: "juntos",
    decisions: { treePath: treePath("safari", [1, 0, 0]) },
    endingChoice: ending("safari", 1),
    dedication: "À notre Léa, qui rugit plus fort que tous les lions. Papi & Mamie",
    senderName: "Papi et Mamie",
    locale: "fr",
  },
  en: {
    ...base,
    childName: "Oliver",
    gender: "boy",
    age: 11,
    city: "Bristol",
    interests: ["chess", "sailing", "maps"],
    favoriteColor: "#00acc1",
    favoriteCompanion: "Biscuit, his old beagle",
    futureDream: "marine biologist",
    templateId: "pirates",
    templateTitle: "Pirate Adventure",
    decisions: { treePath: treePath("pirates", [1, 2, 0]) },
    endingChoice: ending("pirates", 1),
    dedication: "Oliver — for every storm you've sailed through already. Keep your compass true. Love, Dad",
    senderName: "Dad",
    locale: "en",
  },
};

await ensurePdfFontsLoaded();

function printFit(story: import("../src/lib/ai/story-generator.ts").GeneratedStory, input: StoryInput) {
  const plan = planInteriorPages({
    story,
    characterAge: input.age,
    dedicationText: input.dedication ?? null,
    senderName: input.senderName ?? null,
    availableImages: new Set(Array.from({ length: 12 }, (_, i) => i + 1)),
  });
  const tc = getPdfTextConfig(input.age);
  const shrunk: number[] = [];
  for (const pg of plan.pages as Array<Record<string, unknown>>) {
    const scene = pg.scene as { sceneNumber: number } | undefined;
    const type = (pg.bodyType ?? (pg.overlay as { type?: { fontSize: number }; role?: string } | undefined)?.type) as { fontSize: number } | undefined;
    const isBody = pg.kind === "text" ? pg.variant !== "puente" : pg.kind === "spread" ? pg.half === "right" : false;
    if (isBody && scene && type && type.fontSize < tc.body - 0.6) shrunk.push(scene.sceneNumber);
  }
  return {
    errors: plan.issues.filter((i: { severity: string }) => i.severity === "error").map((i: { message: string }) => i.message),
    bodyPt: tc.body,
    shrunkScenes: [...new Set(shrunk)],
  };
}

const selected = arg("case") ? [arg("case")!] : Object.keys(CASES);
const tag = arg("tag") ?? (process.env.OPENAI_BOOK_PLAN_MODEL || bp.BOOK_PLAN_MODEL);
const outDir = resolve(process.cwd(), "artifacts/book-plan-validation", tag);
mkdirSync(outDir, { recursive: true });

const results = await Promise.allSettled(
  selected.map(async (key) => {
    const input = CASES[key];
    const t0 = Date.now();
    const early: Record<string, number> = {};
    const { plan, report } = await bp.generateBookPlan(input, {
      onProgress: (p) => {
        if (p.cover && early.cover === undefined) early.cover = Date.now() - t0;
        if (p.scenes.length >= 1 && early.scene1 === undefined) early.scene1 = Date.now() - t0;
        if (p.scenes.length >= 3 && early.scene3 === undefined) early.scene3 = Date.now() - t0;
      },
    });
    const story = bp.planToGeneratedStory(plan, bp.buildPlanChildDescription(input));
    const fit = printFit(story, input);
    const spec = bp.getPlanSpec(input.age);
    const words = plan.scenes.map((s) => s.text.split(/\s+/).filter(Boolean).length);
    const dedicationOk = input.dedication ? story.dedication === input.dedication : story.dedicationSource === "generated";

    const md = [
      `# [${key}] ${plan.title}`,
      `Alternates: ${plan.alternateTitles.join(" · ")}`,
      `Mode: ${plan.mode} · age ${input.age} · ${input.gender} · model ${report.model}`,
      `Dedication (${plan.dedicationSource}${dedicationOk ? ", verbatim OK" : ", MISMATCH"}): ${story.dedication}`,
      plan.refrain ? `Refrain: «${plan.refrain}»` : "",
      `Setup/payoff: ${plan.setupPayoff.detail} (${plan.setupPayoff.setupScene} → ${plan.setupPayoff.payoffScene})`,
      `Cast: ${plan.cast.map((c) => `${c.id} (${c.name})`).join(", ") || "-"} · World: ${plan.world.map((w) => w.id).join(", ")}`,
      "",
      ...plan.scenes.map((s, i) => {
        const b = bp.getSlotBudget(spec, s.sceneNumber);
        return `## ${s.sceneNumber}. ${s.title}  _(${s.type}, ${words[i]} words, budget ${b.min}–${b.max})_\n\n${s.text}\n\n> 🎬 ${s.shot.camera} [${s.shot.shotScale}] — ${s.shot.action} | cast: ${s.shot.castIds.join(",")} | world: ${s.shot.worldIds.join(",")}`;
      }),
      "",
      `**Final message:** ${plan.finalMessage}`,
      `**Synopsis:** ${plan.synopsis}`,
      "",
      `Streaming: cover shot ready at ${((early.cover ?? NaN) / 1000).toFixed(1)}s, scene 1 at ${((early.scene1 ?? NaN) / 1000).toFixed(1)}s, scene 3 at ${((early.scene3 ?? NaN) / 1000).toFixed(1)}s`,
      `Timing: plan ${(report.planMs / 1000).toFixed(1)}s, repairs [${report.repairMs.map((m) => (m / 1000).toFixed(1)).join(", ")}]s, total ${(report.totalMs / 1000).toFixed(1)}s · cost ~$${report.costUsd.toFixed(3)} · tokens in ${report.usage.inputTokens} out ${report.usage.outputTokens} (reasoning ${report.usage.reasoningTokens})`,
      `Initial violations: ${report.initialViolations.length}${report.initialViolations.map((v) => `\n- ${v.sceneNumber} ${v.code}: ${v.message}`).join("")}`,
      `Final violations: ${report.finalViolations.length}${report.finalViolations.map((v) => `\n- ${v.sceneNumber} ${v.code}: ${v.message}`).join("")}`,
      `Print fit: ${fit.errors.length ? fit.errors.join("; ") : "OK"} · body ${fit.bodyPt}pt${fit.shrunkScenes.length ? ` · shrunk on scenes ${fit.shrunkScenes.join(",")}` : " · no shrink"}`,
    ]
      .filter((l) => l !== "")
      .join("\n");

    writeFileSync(join(outDir, `${key}.md`), md);
    writeFileSync(join(outDir, `${key}.json`), JSON.stringify({ input, plan, report, fit }, null, 2));
    return { key, report, fit, dedicationOk, md };
  }),
);

let totalCost = 0;
for (const r of results) {
  if (r.status === "rejected") {
    console.error("CASE FAILED:", r.reason);
    continue;
  }
  const { key, report, fit, dedicationOk, md } = r.value;
  totalCost += report.costUsd;
  console.log(`\n${"=".repeat(80)}\n${md}\n`);
  console.log(`[${key}] total ${(report.totalMs / 1000).toFixed(1)}s · $${report.costUsd.toFixed(3)} · violations ${report.initialViolations.length}→${report.finalViolations.length} · print ${fit.errors.length ? "ERR" : "ok"} · dedication ${dedicationOk ? "ok" : "BAD"}`);
}
console.log(`\nTotal cost ~$${totalCost.toFixed(3)} · outputs in ${outDir}`);
