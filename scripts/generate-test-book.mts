/**
 * End-to-end validation of the OpenAI image engine with the REAL pipeline code:
 *
 *   avatar portrait (renderPortrait, same as /api/characters/portrait)
 *   → preview (generateArchitect + generatePreviewBook, same as /api/stories/[id]/generate)
 *   → final images (advanceFinalImages, same as the fulfilment pipeline — run in
 *     270 s slices like the cron, state carried between slices)
 *   → print files (renderPrintFiles: hardcover + softcover, validatePrintableBook)
 *   → rasterised PDF pages + contact sheets in artifacts/engine-validation/<name>/
 *
 * Writes to the PRODUCTION Supabase (that is what .env.local points at), but only
 * rows owned by a dedicated QA user (qa-test+engine@meapica.com, user_metadata.qa_test)
 * with story_decisions.qaTest = true and is_showcase = false. Never creates
 * orders, never calls Gelato order creation (catalog GET only).
 *
 *   npx tsx --tsconfig tsconfig.json scripts/generate-test-book.mts [--only=martina|leo]
 *     [--reuse]   reuse the stories from the last run (skips portrait + preview)
 *     [--pdf-only] only rebuild print files from the stored final images
 *
 * Budget guard: stops when the ledger passes $15 of image spend.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from "fs";
import { join, resolve } from "path";
import { execFileSync } from "child_process";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
process.env.MOCK_MODE = "false"; // .env.local enables mock mode for the dev server; this script must be real

const { createClient } = await import("@supabase/supabase-js");
const sharp = (await import("sharp")).default;
const { generateArchitect } = await import("../src/lib/ai/story-generator.ts");
const { generatePreviewBook } = await import("../src/lib/ai/preview-book.ts");
const { advanceFinalImages } = await import("../src/lib/ai/final-book.ts");
const { buildCharacterBible, renderPortrait, stageConfig } = await import("../src/lib/ai/book-images.ts");
const { uploadGeneratedImage } = await import("../src/lib/supabase/storage.ts");
const { renderPrintFiles, prefetchAllIllustrations, prefetchImageAsDataUri } = await import("../src/lib/pdf/index.ts");
const { getStoryTree } = await import("../src/lib/story-trees/index.ts");
const { STORY_TEMPLATES } = await import("../src/lib/create-store.ts");

type StoryInput = import("../src/lib/ai/story-generator.ts").StoryInput;
type GeneratedStory = import("../src/lib/ai/story-generator.ts").GeneratedStory;
type BookImagePlan = import("../src/lib/ai/book-images.ts").BookImagePlan;
type BookImageAssets = import("../src/lib/ai/book-images.ts").BookImageAssets;
type FinalBookState = import("../src/lib/ai/final-book.ts").FinalBookState;
type QAResult = import("../src/lib/ai/qa-judge.ts").QAResult;
type BookPdfInput = import("../src/lib/pdf/index.ts").BookPdfInput;

const OUT = resolve(process.cwd(), "artifacts/engine-validation");
const LEDGER = join(OUT, "ledger.json");
const STATE = join(OUT, "state.json");
const BUDGET_USD = 15;
const QA_EMAIL = "qa-test+engine@meapica.com";
const SLICE_MS = 270_000;

const args = process.argv.slice(2);
const opt = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
const flag = (n: string) => args.includes(`--${n}`);

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
mkdirSync(OUT, { recursive: true });

// ── Ledger (image spend across runs) ─────────────────────────────────────────

interface LedgerEntry { at: string; name: string; stage: string; costUsd: number; seconds: number }
const ledger: LedgerEntry[] = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : [];
const spent = () => ledger.reduce((s, e) => s + e.costUsd, 0);
function record(name: string, stage: string, costUsd: number, seconds: number) {
  ledger.push({ at: new Date().toISOString(), name, stage, costUsd: Math.round(costUsd * 10000) / 10000, seconds: Math.round(seconds) });
  writeFileSync(LEDGER, JSON.stringify(ledger, null, 2));
  console.log(`💰 ${name} ${stage}: $${costUsd.toFixed(3)} in ${seconds.toFixed(0)}s — total spent $${spent().toFixed(2)} / $${BUDGET_USD}`);
}
function guard(next: number) {
  if (spent() + next > BUDGET_USD) throw new Error(`BUDGET STOP: spent $${spent().toFixed(2)}, next step ~$${next}`);
}

// ── Test characters ──────────────────────────────────────────────────────────

interface TestCase {
  key: string;
  name: string;
  gender: "girl" | "boy";
  age: number;
  skinTone: string;
  hairColor: string;
  hairstyle: string;
  eyeColor: string;
  favoriteColor: string;
  favoriteCompanion: string;
  interests: string[];
  city: string;
  templateId: string;
  locale: string;
  dedication: string;
  sender: string;
  traits: { glasses?: boolean; freckles?: boolean };
  /** Option index taken at each node of the story tree */
  branch: number;
}

const CASES: TestCase[] = [
  {
    key: "martina",
    name: "Martina",
    gender: "girl",
    age: 5,
    skinTone: "#d4a574",
    hairColor: "#5d4037",
    hairstyle: "curly",
    eyeColor: "#8d6e63",
    favoriteColor: "#FDD835",
    favoriteCompanion: "un zorrito llamado Pip",
    interests: ["animals"],
    city: "Girona",
    templateId: "forest",
    locale: "es",
    dedication: "Para Martina, que siempre encuentra el camino de vuelta a casa. Con todo nuestro amor.",
    sender: "Mamá y papá",
    traits: { freckles: true },
    branch: 0,
  },
  {
    key: "leo",
    name: "Leo",
    gender: "boy",
    age: 8,
    skinTone: "#fce4d6",
    hairColor: "#e6c07b",
    hairstyle: "short",
    eyeColor: "#1976d2",
    favoriteColor: "#43A047",
    favoriteCompanion: "un robot petit que es diu Bip",
    interests: ["space"],
    city: "Sabadell",
    templateId: "space",
    locale: "ca",
    dedication: "Per al Leo, que mira les estrelles cada nit. T'estimem fins a la lluna i tornar.",
    sender: "La iaia Rosa",
    traits: { glasses: true },
    branch: 1,
  },
];

function treePath(templateId: string, branch: number): { nodeId: string; optionId: string }[] {
  const tree = getStoryTree(templateId);
  if (!tree) return [];
  const path: { nodeId: string; optionId: string }[] = [];
  let nodeId: string | null = tree.root;
  while (nodeId && nodeId !== tree.ending && path.length < 20) {
    const node = tree.nodes[nodeId];
    if (!node || node.options.length === 0) break;
    const option = node.options[Math.min(branch, node.options.length - 1)];
    path.push({ nodeId, optionId: option.id });
    nodeId = option.next;
  }
  return path;
}

// ── Supabase helpers (QA user only) ──────────────────────────────────────────

async function qaUserId(): Promise<string> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email === QA_EMAIL);
    if (found) return found.id;
    if (data.users.length < 200) break;
  }
  const { data, error } = await admin.auth.admin.createUser({ email: QA_EMAIL, email_confirm: true, user_metadata: { qa_test: true, purpose: "image engine validation" } });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  return data.user.id;
}

function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error || res.data === null) throw new Error(`${what}: ${res.error?.message ?? "no data"}`);
  return res.data;
}

// ── Contact sheet ────────────────────────────────────────────────────────────

async function contactSheet(out: string, title: string, images: { label: string; buf: Buffer }[], cols = 4, h = 420) {
  const tiles = await Promise.all(
    images.map(async ({ label, buf }) => {
      const meta = await sharp(buf).metadata();
      const w = Math.round(((meta.width ?? 1) * h) / (meta.height ?? 1));
      const img = await sharp(buf).resize({ height: h }).jpeg({ quality: 85 }).toBuffer();
      const text = Buffer.from(`<svg width="${w}" height="28"><text x="4" y="20" font-family="Helvetica" font-size="18" fill="#000">${label} (${meta.width}×${meta.height})</text></svg>`);
      return { w, img, text };
    }),
  );
  const pad = 14;
  const rows: (typeof tiles)[] = [];
  for (let i = 0; i < tiles.length; i += cols) rows.push(tiles.slice(i, i + cols));
  const width = Math.max(...rows.map((r) => r.reduce((s, t) => s + t.w + pad, pad)));
  const height = 50 + rows.length * (h + 28 + pad);
  const composites: { input: Buffer; left: number; top: number }[] = [
    { input: Buffer.from(`<svg width="${width}" height="40"><text x="${pad}" y="30" font-family="Helvetica" font-size="26" fill="#000">${title}</text></svg>`), left: 0, top: 0 },
  ];
  rows.forEach((r, ri) => {
    let x = pad;
    const y = 50 + ri * (h + 28 + pad);
    for (const t of r) {
      composites.push({ input: t.text, left: x, top: y }, { input: t.img, left: x, top: y + 28 });
      x += t.w + pad;
    }
  });
  await sharp({ create: { width, height, channels: 3, background: "#ffffff" } }).composite(composites).jpeg({ quality: 85 }).toFile(out);
  console.log(`🖼  ${out}`);
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// ── One book ─────────────────────────────────────────────────────────────────

interface RunState { [key: string]: { storyId: string; characterId: string } }
const runState: RunState = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};

async function runBook(tc: TestCase, userId: string) {
  const dir = join(OUT, tc.key);
  mkdirSync(dir, { recursive: true });
  const report: Record<string, unknown> = { key: tc.key, model: { preview: stageConfig("preview"), final: stageConfig("final") } };
  let storyId: string;

  const input: StoryInput = {
    childName: tc.name,
    gender: tc.gender,
    age: tc.age,
    city: tc.city,
    interests: tc.interests,
    favoriteColor: tc.favoriteColor,
    favoriteCompanion: tc.favoriteCompanion,
    hairColor: tc.hairColor,
    eyeColor: tc.eyeColor,
    skinTone: tc.skinTone,
    hairstyle: tc.hairstyle,
    templateId: tc.templateId,
    templateTitle: STORY_TEMPLATES.find((t) => t.id === tc.templateId)?.title ?? tc.templateId,
    creationMode: "solo",
    decisions: { treePath: treePath(tc.templateId, tc.branch), qaTest: true },
    dedication: tc.dedication,
    senderName: tc.sender,
    locale: tc.locale,
  };

  if ((flag("reuse") || flag("pdf-only")) && runState[tc.key]) {
    storyId = runState[tc.key].storyId;
    console.log(`\n══ ${tc.key}: reusing story ${storyId}`);
  } else {
    console.log(`\n══ ${tc.key}: portrait → preview`);
    guard(1);
    // 1. Avatar portrait — exactly what /api/characters/portrait does.
    const bible = buildCharacterBible({ ...input, ...tc.traits });
    writeFileSync(join(dir, "bible.txt"), bible.description + "\n");
    const t0 = Date.now();
    const portrait = await renderPortrait(bible, null, { label: `QA ${tc.key} portrait` });
    const avatarUrl = await uploadGeneratedImage(admin, `portraits/qa-test-${tc.key}`, "portrait", portrait.image, portrait.mime);
    writeFileSync(join(dir, "avatar.jpg"), portrait.image);
    record(tc.key, "portrait", portrait.costUsd, (Date.now() - t0) / 1000);

    // 2. Character + story rows (QA user only).
    const character = must(
      await admin
        .from("characters")
        .insert({
          user_id: userId,
          name: tc.name,
          gender: tc.gender,
          age: tc.age,
          hair_color: tc.hairColor,
          eye_color: tc.eyeColor,
          skin_tone: tc.skinTone,
          hairstyle: tc.hairstyle,
          favorite_color: tc.favoriteColor,
          favorite_companion: tc.favoriteCompanion,
          interests: tc.interests,
          city: tc.city,
          avatar_url: avatarUrl,
        })
        .select("id")
        .single(),
      "insert character",
    );
    const story = must(
      await admin
        .from("stories")
        .insert({
          user_id: userId,
          character_id: character.id,
          template_id: tc.templateId,
          creation_mode: "solo",
          story_decisions: input.decisions as never,
          dedication_text: tc.dedication,
          sender_name: tc.sender,
          locale: tc.locale,
          status: "generating",
          is_showcase: false,
        })
        .select("id")
        .single(),
      "insert story",
    );
    storyId = story.id;
    runState[tc.key] = { storyId, characterId: character.id };
    writeFileSync(STATE, JSON.stringify(runState, null, 2));

    // 3. Preview — exactly what /api/stories/[id]/generate does after the claim.
    const p0 = Date.now();
    const architect = await generateArchitect(input);
    if (architect.isMock) throw new Error("generateArchitect returned a mock story");
    const preview = await generatePreviewBook({ db: admin, storage: admin, storyId, input, architect, avatarUrl, extraTraits: tc.traits });
    const previewSeconds = (Date.now() - p0) / 1000;
    record(tc.key, "preview", preview.costUsd, previewSeconds);
    report.preview = { seconds: Math.round(previewSeconds), imageCostUsd: preview.costUsd, planCostUsd: architect.planReport?.costUsd, planSeconds: architect.planReport ? architect.planReport.totalMs / 1000 : null, ...preview };
  }

  // 4. Load what the preview saved.
  const storyRow = must(await admin.from("stories").select("*").eq("id", storyId).single(), "load story");
  const generated = storyRow.generated_text as unknown as GeneratedStory & { imagePlan: BookImagePlan; imageAssets?: BookImageAssets };
  if (!generated?.imagePlan) throw new Error("story has no imagePlan");
  writeFileSync(join(dir, "image-plan.json"), JSON.stringify(generated.imagePlan, null, 2));
  writeFileSync(join(dir, "story-text.json"), JSON.stringify(generated.scenes.map((s) => ({ n: s.sceneNumber, title: s.title, text: s.text })), null, 2));

  // Preview contact sheet
  if (!flag("pdf-only")) {
    const rows = must(await admin.from("story_illustrations").select("scene_number, image_url").eq("story_id", storyId).order("scene_number"), "rows");
    const previewImgs: { label: string; buf: Buffer }[] = [];
    if (generated.imageAssets?.preview) previewImgs.push({ label: "preview sheet", buf: await download(generated.imageAssets.preview.mainUrl) });
    for (const r of rows) if (r.image_url && r.image_url.includes("/preview/")) previewImgs.push({ label: `scene ${r.scene_number}`, buf: await download(r.image_url) });
    if (storyRow.cover_image_url?.includes("/preview/")) previewImgs.push({ label: "cover", buf: await download(storyRow.cover_image_url) });
    if (previewImgs.length) await contactSheet(join(dir, "contact-preview.jpg"), `${tc.key} — PREVIEW (${stageConfig("preview").model})`, previewImgs, 5, 360);
  }

  // 5. Final images — the pipeline's engine, in cron-sized slices with state carried over.
  let qa: QAResult | null = null;
  if (!flag("pdf-only")) {
    guard(4);
    const rows = must(await admin.from("story_illustrations").select("scene_number, image_url").eq("story_id", storyId).order("scene_number"), "rows");
    const finalScenes = new Map<number, string>();
    for (const r of rows) if (r.image_url?.includes("/final/")) finalScenes.set(r.scene_number, r.image_url);
    const state: FinalBookState = {
      storyId,
      plan: generated.imagePlan,
      assets: generated.imageAssets ?? {},
      story: generated,
      finalScenes,
      qaPass: 0,
      qaDone: false,
    };
    const f0 = Date.now();
    let cost = 0;
    let slices = 0;
    for (;;) {
      slices++;
      const progress = await advanceFinalImages({
        state,
        storage: admin,
        deadline: Date.now() + SLICE_MS,
        store: {
          async saveAssets(assets) {
            generated.imageAssets = assets;
            must(await admin.from("stories").update({ generated_text: JSON.parse(JSON.stringify(generated)) }).eq("id", storyId).select("id"), "save assets");
          },
          async saveScene(n, url, prompt) {
            // (render_stage/rendered_at columns are not migrated in this database yet)
            must(await admin.from("story_illustrations").update({ image_url: url, status: "ready", prompt_used: prompt }).eq("story_id", storyId).eq("scene_number", n).select("id"), `save scene ${n}`);
          },
          async saveCover(url, assets) {
            generated.imageAssets = assets;
            must(await admin.from("stories").update({ cover_image_url: url, generated_text: JSON.parse(JSON.stringify(generated)) }).eq("id", storyId).select("id"), "save cover");
          },
          async saveQaPass() {},
          async saveQaDone(result) {
            qa = result;
          },
          async onQaSkipped(reason) {
            console.error(`QA SKIPPED: ${reason}`);
          },
        },
      });
      cost += progress.costUsd;
      if (progress.qa) qa = progress.qa;
      console.log(`slice ${slices}: done=${progress.done} rendered=[${progress.rendered.join(",")}] repaired=[${progress.repaired.join(",")}] $${progress.costUsd.toFixed(2)}`);
      if (progress.done) break;
      if (slices >= 8) throw new Error("final images did not finish in 8 slices");
    }
    const finalSeconds = (Date.now() - f0) / 1000;
    record(tc.key, "final", cost, finalSeconds);
    report.final = { seconds: Math.round(finalSeconds), slices, imageCostUsd: cost, qa };
    writeFileSync(join(dir, "qa.json"), JSON.stringify(qa, null, 2));
    must(await admin.from("stories").update({ status: "ready" }).eq("id", storyId).select("id"), "status ready");
  }

  // 6. Final contact sheet
  const story = must(await admin.from("stories").select("*, characters(*)").eq("id", storyId).single(), "reload story");
  const gen = story.generated_text as unknown as GeneratedStory & { imageAssets?: BookImageAssets };
  const rows = must(await admin.from("story_illustrations").select("scene_number, status, image_url").eq("story_id", storyId).order("scene_number"), "rows");
  const finals: { label: string; buf: Buffer }[] = [];
  if (gen.imageAssets?.final) finals.push({ label: "FINAL sheet", buf: await download(gen.imageAssets.final.mainUrl) });
  if (gen.imageAssets?.final?.extraUrl) finals.push({ label: "extra sheet", buf: await download(gen.imageAssets.final.extraUrl) });
  if (story.cover_image_url) finals.push({ label: "cover", buf: await download(story.cover_image_url) });
  for (const r of rows) {
    if (!r.image_url) continue;
    const buf = await download(r.image_url);
    writeFileSync(join(dir, `scene-${String(r.scene_number).padStart(2, "0")}.jpg`), buf);
    finals.push({ label: `scene ${r.scene_number}`, buf });
  }
  if (story.cover_image_url) writeFileSync(join(dir, "cover.jpg"), await download(story.cover_image_url));
  if (gen.imageAssets?.final) writeFileSync(join(dir, "sheet-final.jpg"), await download(gen.imageAssets.final.mainUrl));
  await contactSheet(join(dir, "contact-final.jpg"), `${tc.key} — FINAL (${stageConfig("final").model})`, finals, 4, 420);

  // 7. Print files — the same call the fulfilment pipeline makes (catalog GET only).
  const character = story.characters as { name: string; age: number; gender: string; city: string | null; interests: string[] | null; favorite_color: string | null; favorite_companion: string | null; future_dream: string | null };
  const [illustrations, coverImageUrl] = await Promise.all([
    prefetchAllIllustrations(rows.map((r) => ({ sceneNumber: r.scene_number, imageUrl: r.image_url }))),
    story.cover_image_url ? prefetchImageAsDataUri(story.cover_image_url) : Promise.resolve(null),
  ]);
  const pdfInput: BookPdfInput = {
    story: story.title ? { ...gen, bookTitle: story.title } : gen,
    templateId: story.template_id,
    characterName: character.name,
    characterAge: character.age,
    characterGender: character.gender,
    characterCity: character.city,
    characterInterests: character.interests ?? [],
    favoriteColor: character.favorite_color,
    favoriteCompanion: character.favorite_companion,
    futureDream: character.future_dream,
    dedicationText: story.dedication_text,
    senderName: story.sender_name,
    storyId,
    coverImageUrl,
    portraitUrl: coverImageUrl, // print gate requires a page-27 portrait; the pipeline uses the final hero shot, falling back to the cover
    illustrations,
    locale: story.locale,
  };
  const printReport: Record<string, unknown> = {};
  for (const format of ["hardcover", "softcover"] as const) {
    const productUid = process.env[format === "hardcover" ? "GELATO_PRODUCT_UID_HARDCOVER" : "GELATO_PRODUCT_UID_SOFTCOVER"]!;
    try {
      const files = await renderPrintFiles({ input: pdfInput, productUid });
      writeFileSync(join(dir, `${format}-interior.pdf`), files.interiorPdf);
      writeFileSync(join(dir, `${format}-cover.pdf`), files.coverPdf);
      if (format === "hardcover") writeFileSync(join(dir, "book-digital.pdf"), files.bookPdf);
      printReport[format] = {
        ok: files.validation.ok,
        errors: files.validation.errors.map((e) => e.message),
        warnings: files.validation.warnings.map((w) => w.message),
        dpi: files.validation.resolutions.map((r) => `${r.where}: ${r.dpi}`),
      };
      console.log(`📕 ${format}: validation ok=${files.validation.ok}, ${files.validation.errors.length} errors, ${files.validation.warnings.length} warnings`);
    } catch (err) {
      const e = err as { result?: { errors: { message: string }[] }; message: string };
      printReport[format] = { ok: false, errors: e.result?.errors.map((x) => x.message) ?? [e.message] };
      console.error(`❌ ${format} print files failed:`, printReport[format]);
    }
  }
  report.print = printReport;

  // 8. Rasterise interior + cover
  const pagesDir = join(dir, "pages");
  rmSync(pagesDir, { recursive: true, force: true });
  mkdirSync(pagesDir, { recursive: true });
  if (existsSync(join(dir, "hardcover-interior.pdf"))) {
    execFileSync("pdftoppm", ["-r", "40", "-jpeg", join(dir, "hardcover-interior.pdf"), join(pagesDir, "p")]);
    execFileSync("pdftoppm", ["-r", "40", "-jpeg", join(dir, "hardcover-cover.pdf"), join(pagesDir, "cover-hard")]);
    execFileSync("pdftoppm", ["-r", "40", "-jpeg", join(dir, "softcover-cover.pdf"), join(pagesDir, "cover-soft")]);
    const pages = readdirSync(pagesDir).filter((f) => f.startsWith("p-")).sort();
    // Spreads as they are seen in the book: p1 alone, then (2,3) … (28,29), p30 alone
    const spreadImgs: { label: string; buf: Buffer }[] = [];
    const pageBuf = (i: number) => readFileSync(join(pagesDir, pages[i - 1]));
    for (let left = 2; left <= 28; left += 2) {
      const [a, b] = [pageBuf(left), pageBuf(left + 1)];
      const ma = await sharp(a).metadata();
      const joined = await sharp({ create: { width: (ma.width ?? 0) * 2, height: ma.height ?? 0, channels: 3, background: "#fff" } })
        .composite([{ input: a, left: 0, top: 0 }, { input: b, left: ma.width ?? 0, top: 0 }])
        .jpeg()
        .toBuffer();
      spreadImgs.push({ label: `p${left}-${left + 1}`, buf: joined });
    }
    await contactSheet(join(dir, "contact-pdf-spreads.jpg"), `${tc.key} — PDF interior spreads`, spreadImgs, 3, 300);
    const covers = readdirSync(pagesDir).filter((f) => f.startsWith("cover-")).sort().map((f) => ({ label: f, buf: readFileSync(join(pagesDir, f)) }));
    await contactSheet(join(dir, "contact-pdf-covers.jpg"), `${tc.key} — cover files`, covers, 2, 400);
  }

  writeFileSync(join(dir, "report.json"), JSON.stringify(report, null, 2));
  return report;
}

// ── main ─────────────────────────────────────────────────────────────────────

const userId = await qaUserId();
console.log(`QA user ${QA_EMAIL} → ${userId}`);
const only = opt("only");
const selected = CASES.filter((c) => !only || c.key === only);
const results = await Promise.all(selected.map((c) => runBook(c, userId).catch((err) => ({ key: c.key, error: err instanceof Error ? err.stack : String(err) }))));
writeFileSync(join(OUT, "summary.json"), JSON.stringify({ spentUsd: spent(), results }, null, 2));
console.log(`\nDone. Total image spend $${spent().toFixed(2)}`);
for (const r of results) if ("error" in r) console.error(`❌ ${r.key}:`, r.error);
