// QA judge evaluation on a labelled set of real final renders (scripts/qa-eval/labelled-set.json).
//
//   npx tsx scripts/qa-eval/run.mts [--only=id,id] [--repeat=N] [--out=file.json]
//
// Runs the production judge (judgeScenes, the same QAScene the final pipeline
// builds with qaSceneFor) on each labelled image and reports recall on the
// "bad" images, false alarms on the "good" ones and the judge's own cost
// (captured from the chat-completions `usage` of every call). No image is
// generated. Reads stories + images with the service role (.env.local).

import { readFileSync, writeFileSync } from "fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

// The judge is a no-op in mock mode (local dev .env.local may set it).
process.env.MOCK_MODE = "false";

const { createClient } = await import("@supabase/supabase-js");
const { judgeScenes, failsQa } = await import("../../src/lib/ai/qa-judge");
const { qaSceneFor, qaCharacters } = await import("../../src/lib/ai/final-book");
const { estimateCostUsd } = await import("../../src/lib/ai/openai-http");

interface Item {
  id: string;
  label: "bad" | "good";
  story: string;
  shot: number;
  image: string;
  textReplace?: [string, string][];
  defect?: string;
}

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")) as [string, string][]);
const only = args.only ? new Set(args.only.split(",")) : null;
const repeat = Number(args.repeat || 1);
const set = JSON.parse(readFileSync("scripts/qa-eval/labelled-set.json", "utf8")) as { items: Item[] };
const items = set.items.filter((i) => !only || only.has(i.id));

// Capture the cost of every judge call from its usage block.
let spend = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const res = await realFetch(input, init);
  if (String(input).includes("/v1/chat/completions") && res.ok) {
    res
      .clone()
      .json()
      .then((j: { model?: string; usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } } }) => {
        const u = j.usage ?? {};
        spend +=
          estimateCostUsd(j.model ?? "", {
            inputTokens: u.prompt_tokens ?? 0,
            cachedInputTokens: u.prompt_tokens_details?.cached_tokens ?? 0,
            outputTokens: u.completion_tokens ?? 0,
            reasoningTokens: 0,
          }) ?? 0;
      })
      .catch(() => {});
  }
  return res;
}) as typeof fetch;

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stories = new Map<string, any>();
const sheets = new Map<string, { sheet: Buffer; extraSheet: Buffer | null }>();
async function download(path: string): Promise<Buffer> {
  const { data, error } = await admin.storage.from("illustrations").download(path);
  if (error) throw new Error(`${path}: ${error.message}`);
  return Buffer.from(await data.arrayBuffer());
}
for (const id of new Set(items.map((i) => i.story))) {
  const { data, error } = await admin.from("stories").select("generated_text").eq("id", id).single();
  if (error) throw error;
  const g = data.generated_text;
  // Plans frozen before 2026-09-30 carry the illustrated moment only in the Book Plan: copy it onto the shot like new plans do.
  if (!args["no-moment"]) {
    for (const shot of g.imagePlan.shots) {
      shot.moment ??= g.bookPlan?.scenes?.find((s: { sceneNumber: number }) => s.sceneNumber === shot.sceneNumber)?.illustratedMoment;
    }
  }
  stories.set(id, g);
  const final = g.imageAssets.final;
  sheets.set(id, { sheet: await download(final.mainUrl), extraSheet: final.extraUrl ? await download(final.extraUrl) : null });
}

interface Row {
  id: string;
  label: string;
  run: number;
  flagged: boolean;
  verdict: unknown;
}
const rows: Row[] = [];
const t0 = Date.now();
const queue = items.flatMap((item) => Array.from({ length: repeat }, (_, run) => ({ item, run })));
async function worker() {
  for (let job = queue.shift(); job; job = queue.shift()) {
    const { item, run } = job;
    const g = structuredClone(stories.get(item.story));
    const scene = g.scenes.find((s: { sceneNumber: number }) => s.sceneNumber === item.shot);
    for (const [from, to] of item.textReplace ?? []) {
      if (!scene.text.includes(from) && !scene.title.includes(from)) throw new Error(`${item.id}: "${from}" not in the page text`);
      scene.text = scene.text.replace(from, to);
      scene.title = scene.title.replace(from, to);
    }
    const qaScene = qaSceneFor(g.imagePlan, g, item.shot, item.image, g.imageAssets.mapGame);
    const refs = sheets.get(item.story)!;
    const qa = await judgeScenes({ scenes: [qaScene], sheet: refs.sheet, extraSheet: refs.extraSheet, characters: qaCharacters(g.imagePlan), iterationNumber: 1 });
    const v = qa.verdicts[0];
    const flagged = v ? failsQa(v) : false;
    rows.push({ id: item.id, label: item.label, run, flagged, verdict: v ?? { skipped: qa.skipReason } });
    const ok = (item.label === "bad") === flagged;
    console.log(`${ok ? "OK  " : "MISS"} ${item.label.padEnd(4)} ${item.id.padEnd(22)} ${flagged ? "FAIL" : "pass"} ${v ? JSON.stringify(v).slice(0, 400) : qa.skipReason}`);
  }
}
await Promise.all(Array.from({ length: 4 }, worker));

const bad = rows.filter((r) => r.label === "bad");
const good = rows.filter((r) => r.label === "good");
const summary = {
  recall: `${bad.filter((r) => r.flagged).length}/${bad.length}`,
  falseAlarms: `${good.filter((r) => r.flagged).length}/${good.length}`,
  judgeSpendUsd: Math.round(spend * 10000) / 10000,
  perImageUsd: Math.round((spend / rows.length) * 10000) / 10000,
  seconds: Math.round((Date.now() - t0) / 1000),
};
console.log(JSON.stringify(summary));
if (args.out) writeFileSync(args.out, JSON.stringify({ summary, rows }, null, 1));
