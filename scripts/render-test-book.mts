/**
 * Local print check — renders the Gelato interior + cover files (soft + hard)
 * and the digital book for a real story, validates them, and rasterises
 * spread contact sheets for visual review.
 *
 * READ-ONLY: Supabase GET via service role (PROD — never writes), Gelato
 * catalog GET only (never creates orders).
 *
 *   npx tsx --tsconfig tsconfig.json scripts/render-test-book.mts [storyId] [flags]
 *
 * Flags:
 *   --upscale        resample images to the planned final sizes (2432² pages,
 *                    3840×1920 panoramas) to preview the new pipeline's output
 *   --fill-missing   fill missing scene images with neighbours (layout check only)
 *   --stress         Catalan/Spanish edge-case strings in name, dedication, title
 *   --age=N          override the child's age (text sizing)
 *   --out=DIR        output dir (default artifacts/print-test/<storyId>)
 *   --map-game=FILE  print pp. 28–29 with this MapGame JSON instead of the stored one
 *                    (same map image — layout check of the other age bands)
 *
 * Needs `pdftoppm` (poppler) for the PNG contact sheets.
 */

import { readFileSync, mkdirSync, writeFileSync, rmSync, readdirSync } from "fs";
import { resolve, join } from "path";
import { execFileSync } from "child_process";
import sharp from "sharp";

// ── env ─────────────────────────────────────────────────────────────────────
for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const { prefetchImageAsDataUri, validatePrintableBook, renderInteriorPdf, renderBookPdf, renderCoverSpreadPdf, prepareBookRender } =
  await import("../src/lib/pdf/index.ts");
const { getCoverDimensions } = await import("../src/lib/gelato/catalog.ts");
type BookPdfInput = import("../src/lib/pdf/index.ts").BookPdfInput;

const args = process.argv.slice(2);
const storyId = args.find((a) => !a.startsWith("--")) ?? "458956ca-2f76-4b2e-9061-e9d813dd4539";
const flag = (f: string) => args.includes(f);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const outDir = resolve(process.cwd(), opt("out") ?? `artifacts/print-test/${storyId}${flag("--upscale") ? "-upscaled" : ""}${flag("--stress") ? "-stress" : ""}`);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
async function sbGet<T>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  if (!res.ok) throw new Error(`Supabase GET ${path}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

// ── load story (read-only) ─────────────────────────────────────────────────
interface StoryRow {
  id: string;
  template_id: string;
  locale: string | null;
  dedication_text: string | null;
  sender_name: string | null;
  cover_image_url: string | null;
  character_portrait_url: string | null;
  generated_text: BookPdfInput["story"];
  characters: { name: string; age: number; gender: string; city?: string; interests?: string[]; favorite_color?: string; favorite_companion?: string; future_dream?: string };
}
const [story] = await sbGet<StoryRow[]>(`stories?id=eq.${storyId}&select=id,template_id,locale,dedication_text,sender_name,cover_image_url,character_portrait_url,generated_text,characters(*)`);
if (!story) throw new Error(`Story ${storyId} not found`);
const ills = await sbGet<{ scene_number: number; image_url: string | null }[]>(`story_illustrations?story_id=eq.${storyId}&select=scene_number,image_url&order=scene_number`);
console.log(`Story ${storyId}: "${story.generated_text.bookTitle}" (${story.locale}, age ${story.characters.age}), ${ills.filter((i) => i.image_url).length} images`);

// ── prefetch images (same code path as production) ─────────────────────────
async function resampleTo(dataUri: string | null, w: number, h: number): Promise<string | null> {
  if (!dataUri) return null;
  const buf = Buffer.from(dataUri.split(",")[1], "base64");
  // Same encoding prefetch.ts produces for opaque art
  const out = await sharp(buf).resize(w, h, { fit: "cover", kernel: "lanczos3" }).jpeg({ quality: 92, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer();
  return `data:image/jpeg;base64,${out.toString("base64")}`;
}
const spreadScenes = new Set([3, 8]);
let illustrations = await Promise.all(
  ills.map(async (i) => {
    let uri = i.image_url ? await prefetchImageAsDataUri(i.image_url) : null;
    if (flag("--upscale") && uri) uri = spreadScenes.has(i.scene_number) ? await resampleTo(uri, 3840, 1920) : await resampleTo(uri, 2432, 2432);
    return { sceneNumber: i.scene_number, imageUrl: uri };
  }),
);
const FIXTURE_STORY = opt("fixtures") ?? "458956ca-2f76-4b2e-9061-e9d813dd4539";
let fixtureCover: string | null = null;
if (flag("--fill-missing")) {
  const byNum = new Map(illustrations.map((i) => [i.sceneNumber, i.imageUrl]));
  let pool = illustrations.filter((i) => i.imageUrl && i.sceneNumber <= 12);
  if (pool.length < 12 && FIXTURE_STORY !== storyId) {
    const fx = await sbGet<{ scene_number: number; image_url: string | null }[]>(`story_illustrations?story_id=eq.${FIXTURE_STORY}&select=scene_number,image_url&scene_number=lte.12&order=scene_number`);
    const fxImgs = await Promise.all(fx.map(async (i) => ({ sceneNumber: i.scene_number, imageUrl: i.image_url ? await prefetchImageAsDataUri(i.image_url) : null })));
    pool = fxImgs.filter((i) => i.imageUrl);
    const [fxStory] = await sbGet<{ cover_image_url: string | null }[]>(`stories?id=eq.${FIXTURE_STORY}&select=cover_image_url`);
    fixtureCover = fxStory?.cover_image_url ? await prefetchImageAsDataUri(fxStory.cover_image_url) : null;
  }
  for (let n = 1; n <= 12; n++) {
    if (!byNum.get(n) && pool.length) {
      const src = (pool.find((p) => p.sceneNumber === n) ?? pool[n % pool.length]).imageUrl;
      const up = flag("--upscale");
      const filled = !src ? null : spreadScenes.has(n) ? await resampleTo(src, up ? 3840 : 2048, up ? 1920 : 1024) : up ? await resampleTo(src, 2432, 2432) : src;
      illustrations = illustrations.filter((i) => i.sceneNumber !== n).concat({ sceneNumber: n, imageUrl: filled });
    }
  }
  console.log("  (filled missing scenes with fixture images — layout check only)");
}
let coverImageUrl = (story.cover_image_url ? await prefetchImageAsDataUri(story.cover_image_url) : null) ?? fixtureCover;
if (flag("--upscale")) coverImageUrl = await resampleTo(coverImageUrl, 3072, 3072);
// Same source as the fulfilment pipeline: final hero shot, falling back to the cover art
const heroUrl = (story.generated_text as { imageAssets?: { finalHero?: { url?: string } } }).imageAssets?.finalHero?.url ?? null;
const portraitUrl = (heroUrl ? await prefetchImageAsDataUri(heroUrl) : null) ?? coverImageUrl;
// Pages 28–29: same source as the fulfilment pipeline (map + its game, or the endpaper fallback)
type Assets = { finalMap?: { url?: string }; mapGame?: BookPdfInput["mapGame"] };
const assets = (story.generated_text as { imageAssets?: Assets }).imageAssets;
const mapFile = opt("map-game");
const mapGame = mapFile ? (JSON.parse(readFileSync(resolve(mapFile), "utf8")) as BookPdfInput["mapGame"]) : (assets?.mapGame ?? null);
const mapImageUrl = assets?.finalMap?.url && mapGame ? await prefetchImageAsDataUri(assets.finalMap.url) : null;

const c = story.characters;
const generated = structuredClone(story.generated_text);
let characterName = c.name;
let dedicationText = story.dedication_text;
let senderName = story.sender_name;
if (flag("--stress")) {
  characterName = "Núria";
  generated.bookTitle = "Núria, lŀl·lamp i el Col·legi dels Ñandús";
  dedicationText =
    "Per a la Núria, que va dir «Ça va!» al Col·legi i va fer riure a tothom ♥. D'en Zoë, l'Ñandú i la iaia: t'estimem moltíssim 🦄✨ — que mai no et falti la il·lusió d'aprendre.";
  senderName = "La iaia Mercè & l'avi Joan";
  generated.scenes[0] = { ...generated.scenes[0], title: "L'Ñandú del Col·legi", text: `${generated.scenes[0].text} "Ça va?", va preguntar la Zoë. L'Ñandú va somriure: 'Tot bé!'` };
}

const input: BookPdfInput = {
  story: generated,
  templateId: story.template_id,
  characterName,
  characterAge: Number(opt("age") ?? c.age),
  characterGender: c.gender,
  characterCity: c.city,
  characterInterests: c.interests,
  favoriteColor: c.favorite_color,
  favoriteCompanion: c.favorite_companion,
  futureDream: c.future_dream,
  dedicationText,
  senderName,
  storyId,
  coverImageUrl,
  portraitUrl,
  mapImageUrl,
  mapGame: mapImageUrl ? mapGame : null,
  illustrations,
  locale: story.locale ?? "es",
};

// ── geometry (live, read-only) ─────────────────────────────────────────────
const products = {
  softcover: process.env.GELATO_PRODUCT_UID_SOFTCOVER!,
  hardcover: process.env.GELATO_PRODUCT_UID_HARDCOVER!,
};
const dims = {
  softcover: await getCoverDimensions(products.softcover, 30),
  hardcover: await getCoverDimensions(products.hardcover, 30),
};
for (const [k, d] of Object.entries(dims)) {
  const g = d.geometry;
  console.log(`  ${k}: ${g.totalWidthMm}×${g.totalHeightMm} mm, spine ${g.spine.width} mm, joints ${g.jointBack?.width ?? 0} mm, outer ${g.outerExtensionMm} mm`);
}

// ── validate + render ──────────────────────────────────────────────────────
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const t0 = Date.now();
const prepared = await prepareBookRender(input);
// Sequential + labelled so any react-pdf layout warning names the file it came from
const _warn = console.warn;
let _label = "";
console.warn = (...a: unknown[]) => _warn(`[${_label}]`, ...a);
_label = "interior";
const interior = await renderInteriorPdf(input, prepared);
_label = "book";
const book = await renderBookPdf(input, prepared);
_label = "cover-softcover";
const coverSoft = await renderCoverSpreadPdf(input, dims.softcover.geometry, prepared);
_label = "cover-hardcover";
const coverHard = await renderCoverSpreadPdf(input, dims.hardcover.geometry, prepared);
console.warn = _warn;
console.log(`  rendered in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
writeFileSync(join(outDir, "interior.pdf"), interior);
writeFileSync(join(outDir, "book.pdf"), book);
writeFileSync(join(outDir, "cover-softcover.pdf"), coverSoft);
writeFileSync(join(outDir, "cover-hardcover.pdf"), coverHard);

for (const [k, cover] of [["softcover", coverSoft], ["hardcover", coverHard]] as const) {
  const v = await validatePrintableBook(input, { coverGeometry: dims[k].geometry, interiorPdf: interior, coverPdf: cover, prepared });
  console.log(`\n[validate ${k}] ok=${v.ok} errors=${v.errors.length} warnings=${v.warnings.length}`);
  for (const e of v.errors) console.log(`  ERROR  ${e.message}`);
  for (const w of v.warnings) console.log(`  warn   ${w.message}`);
  if (k === "softcover") writeFileSync(join(outDir, "validation.json"), JSON.stringify(v, null, 2));
}
console.log("\nPlan:");
for (const p of prepared.plan.pages) {
  const extra = "scene" in p ? ` scene ${p.scene.sceneNumber}` : "";
  const type = "bodyType" in p ? ` body ${p.bodyType.fontSize}/${p.bodyType.leading}` : "overlay" in p ? ` ${p.overlay.mode} ${p.overlay.type.fontSize}` : "";
  console.log(`  p${String(p.pageNumber).padStart(2)} ${p.side.padEnd(5)} ${p.kind}${"layout" in p ? `:${p.layout}` : ""}${"variant" in p ? `:${p.variant}` : ""}${"half" in p ? `:${p.half}` : ""}${extra}${type}`);
}

// ── rasterise + spread contact sheets ─────────────────────────────────────
const png = join(outDir, "png");
mkdirSync(png, { recursive: true });
execFileSync("pdftoppm", ["-r", "45", "-png", join(outDir, "interior.pdf"), join(png, "in")]);
execFileSync("pdftoppm", ["-r", "60", "-png", join(outDir, "cover-softcover.pdf"), join(png, "cover-soft")]);
execFileSync("pdftoppm", ["-r", "60", "-png", join(outDir, "cover-hardcover.pdf"), join(png, "cover-hard")]);
const pages = readdirSync(png).filter((f) => f.startsWith("in-")).sort();
const first = await sharp(join(png, pages[0])).metadata();
const pw = first.width!;
const ph = first.height!;
// Spreads as the reader sees them: [inside cover | p1], [p2 | p3] … [p30 | inside cover]
const spreads: [string | null, string | null][] = [[null, pages[0]]];
for (let i = 1; i < pages.length; i += 2) spreads.push([pages[i], pages[i + 1] ?? null]);
const gap = 16;
const perSheet = 8;
for (let s = 0; s < spreads.length; s += perSheet) {
  const chunk = spreads.slice(s, s + perSheet);
  const cols = 2;
  const rows = Math.ceil(chunk.length / cols);
  const sheetW = cols * (2 * pw) + (cols + 1) * gap;
  const sheetH = rows * (ph + 22) + (rows + 1) * gap;
  const composites: sharp.OverlayOptions[] = [];
  for (let i = 0; i < chunk.length; i++) {
    const x = gap + (i % cols) * (2 * pw + gap);
    const y = gap + Math.floor(i / cols) * (ph + 22 + gap);
    const [l, r] = chunk[i];
    const label = `<svg width="${2 * pw}" height="20"><text x="4" y="15" font-family="Helvetica" font-size="13" fill="#333">${l ? `p${pages.indexOf(l) + 1}` : "inside cover"} | ${r ? `p${pages.indexOf(r) + 1}` : "inside cover"}</text></svg>`;
    composites.push({ input: Buffer.from(label), left: x, top: y });
    for (const [side, f] of [[0, l], [1, r]] as const) {
      const input = f
        ? readFileSync(join(png, f))
        : await sharp({ create: { width: pw, height: ph, channels: 3, background: "#dddddd" } }).png().toBuffer();
      composites.push({ input, left: x + side * pw, top: y + 22 });
    }
    // fold line
    composites.push({ input: await sharp({ create: { width: 1, height: ph, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.6 } } }).png().toBuffer(), left: x + pw, top: y + 22 });
  }
  await sharp({ create: { width: sheetW, height: sheetH, channels: 3, background: "#f4f4f4" } })
    .composite(composites)
    .png()
    .toFile(join(outDir, `spreads-${String(s / perSheet + 1).padStart(2, "0")}.png`));
}
console.log(`\nOutput: ${outDir}`);
