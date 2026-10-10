/**
 * Assert script — print vs digital editions + French typography, on a synthetic French book
 * (no network, no DB, no image generation: flat PNGs made with sharp).
 *
 *   npx tsx --tsconfig tsconfig.json scripts/check-pdf-editions.mts [--keep]
 *
 * Checks
 *   1. Editions: the Gelato inside file is 32 pages of 208 mm (trim + 4 mm bleed); the digital
 *      book is 34 pages of 200 mm (the trim); every font is embedded in both.
 *   2. Fold: the panorama halves of the digital book meet at the fold with no repeated strip
 *      (a horizontal colour ramp must run on across the fold; the old bleed pages jumped 8 mm).
 *   3. French: U+202F (narrow no-break space, before ? ! ;) and U+00A0 (no-break space, before :
 *      and inside « ») survive in BOTH editions — mapped in the PDF text layer (ToUnicode) and
 *      drawn with real width (every "?", "!", ";", ":", "»" sits after a visible gap on the SAME
 *      line as the word before it; the missing glyph used to print "Oui!" glued with a stray mark).
 *   4. Referral QR (src/lib/promo-codes.ts): with a referral code the last inner page (colophon)
 *      prints the QR + code + line, the inside file keeps 32 pages, and every word of that page
 *      stays inside the 15 mm text safe area. --keep also writes the page as PNG (both editions).
 *
 * Needs poppler (pdftotext, pdftoppm), like scripts/render-test-book.mts. Exit code 1 on failure.
 */

import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execFileSync } from "child_process";
import { inflateSync } from "zlib";
import sharp from "sharp";
import { PDFDocument, PDFName, PDFRawStream, PDFDict } from "pdf-lib";

const { prepareBookRender, renderBookPdf, renderInteriorPdf } = await import("../src/lib/pdf/index.ts");
type BookPdfInput = import("../src/lib/pdf/index.ts").BookPdfInput;
const { SCENE_LAYOUTS } = await import("../src/lib/book/sequence.ts");

const NNBSP = "\u202F";
const NBSP = "\u00A0";
const failures: string[] = [];
const check = (ok: boolean, label: string) => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failures.push(label);
};

// ── Synthetic French book ─────────────────────────────────────────────────
/** Flat art; panoramas get a left→right red ramp (0 → 255 across the whole spread). */
async function art(width: number, height: number, ramp: boolean, tint: number): Promise<string> {
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      raw[i] = ramp ? Math.round((x / (width - 1)) * 255) : 90 + tint * 10;
      raw[i + 1] = 140;
      raw[i + 2] = 170;
    }
  }
  const png = await sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

const LINES = [
  `Oui${NNBSP}! Noa court vers la forêt.`,
  `Tu viens${NNBSP}? demande Bruno.`,
  `Le hibou cligne des yeux${NBSP}: regarde${NNBSP}!`,
  `«${NBSP}Bonjour${NBSP}», dit la clé-fleur${NNBSP}; tout le monde sourit.`,
  `Ding, ding${NNBSP}! La porte s’ouvre${NNBSP}!`,
];
const scenes = Array.from({ length: 12 }, (_, i) => ({
  sceneNumber: i + 1,
  title: i % 2 ? `Où es-tu${NNBSP}?` : `Allons-y${NNBSP}!`,
  text: `${LINES[i % LINES.length]} ${LINES[(i + 2) % LINES.length]}`,
  imagePrompt: "",
  type: "scene" as const,
}));
const panoramas = new Set(SCENE_LAYOUTS.flatMap((l, i) => (l === "spread" ? [i + 1] : [])));
const illustrations = await Promise.all(
  scenes.map(async (s) => ({ sceneNumber: s.sceneNumber, imageUrl: panoramas.has(s.sceneNumber) ? await art(1600, 800, true, 0) : await art(600, 600, false, s.sceneNumber) })),
);
const cover = await art(600, 600, false, 3);
const input: BookPdfInput = {
  story: {
    bookTitle: `Noa et la clé-fleur${NNBSP}!`,
    titleOptions: [],
    coverImagePrompt: "",
    scenes,
    dedication: "",
    finalMessage: `Merci, Noa${NNBSP}! À bientôt${NNBSP}?`,
    synopsis: `Noa part en forêt${NNBSP}: que va-t-elle trouver${NNBSP}?`,
  },
  templateId: "enchanted-forest",
  characterName: "Noa",
  characterAge: 4,
  characterGender: "girl",
  dedicationText: `Pour Noa${NNBSP}: on t’aime${NNBSP}!`,
  senderName: "Maman",
  storyId: "check-pdf-editions",
  coverImageUrl: cover,
  portraitUrl: cover,
  illustrations,
  locale: "fr",
};

// ── Render both editions ──────────────────────────────────────────────────
const dir = mkdtempSync(join(tmpdir(), "pdf-editions-"));
const prepared = await prepareBookRender(input);
const printPdf = await renderInteriorPdf(input, prepared);
const digitalPdf = await renderBookPdf(input, prepared, { edition: "digital" });
const files = { print: join(dir, "interior.pdf"), digital: join(dir, "book.pdf") };
writeFileSync(files.print, printPdf);
writeFileSync(files.digital, digitalPdf);

const MM = 72 / 25.4;
async function pageSizesMm(buf: Buffer): Promise<string[]> {
  const doc = await PDFDocument.load(buf);
  return doc.getPages().map((p) => `${(p.getWidth() / MM).toFixed(1)}×${(p.getHeight() / MM).toFixed(1)}`);
}
function fontsEmbedded(file: string): boolean {
  const rows = execFileSync("pdffonts", [file], { encoding: "utf8" }).split("\n").slice(2).filter(Boolean);
  return rows.length > 0 && rows.every((r) => / yes +yes +yes /.test(r));
}

console.log("\n1. Editions");
const printSizes = await pageSizesMm(printPdf);
const digitalSizes = await pageSizesMm(digitalPdf);
check(printSizes.length === 32 && printSizes.every((s) => s === "208.0×208.0"), `print inside file: 32 pages of 208×208 mm (got ${printSizes.length}, ${[...new Set(printSizes)].join(", ")})`);
check(digitalSizes.length === 34 && digitalSizes.every((s) => s === "200.0×200.0"), `digital book: 34 pages of 200×200 mm (got ${digitalSizes.length}, ${[...new Set(digitalSizes)].join(", ")})`);
check(fontsEmbedded(files.print) && fontsEmbedded(files.digital), "all fonts embedded (both editions)");

// ── 2. Fold continuity (digital) ──────────────────────────────────────────
console.log("\n2. Panorama fold (digital)");
const spreadPages = prepared.plan.pages.filter((p) => p.kind === "spread" && p.half === "left").map((p) => p.pageNumber);
check(spreadPages.length > 0, `book has panoramas (inner pages ${spreadPages.join(", ")})`);
for (const left of spreadPages) {
  // Reading order: cover, endpaper, then inner page n = PDF page n + 2
  const first = left + 2;
  const prefix = join(dir, `fold-${left}`);
  execFileSync("pdftoppm", ["-f", String(first), "-l", String(first + 1), "-r", "150", "-png", files.digital, prefix]);
  const [l, r] = await Promise.all(
    [first, first + 1].map(async (n) => {
      const file = `${prefix}-${String(n).padStart(2, "0")}.png`;
      const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
      return { data, info };
    }),
  );
  // Red channel on a row near the top (clear of titles, text and folios)
  const red = (img: typeof l, x: number) => img.data[(Math.round(img.info.height * 0.1) * img.info.width + x) * img.info.channels];
  // The edge pixel column is only partly covered at 150 dpi (566.9 pt = 1181.1 px): compare the
  // left page's last FULL column with the right page's first.
  const leftLast = red(l, l.info.width - 2);
  const slope = Math.abs(leftLast - red(l, l.info.width - 26)) / 24; // ramp per pixel
  const jump = Math.abs(red(r, 0) - leftLast);
  // Bleed pages repeated 8 mm at the fold (≈ 5 levels of this ramp); trim pages step by one pixel.
  check(jump <= slope * 3 + 1.5, `pp. ${left}–${left + 1}: ramp continues across the fold (jump ${jump} levels, ramp ${slope.toFixed(2)}/px)`);
}

// ── 3. French spacing ─────────────────────────────────────────────────────
console.log("\n3. French spacing");
/** Unicode targets of every ToUnicode CMap in the file (hex, upper-case). */
async function toUnicodeTargets(buf: Buffer): Promise<Set<string>> {
  const doc = await PDFDocument.load(buf);
  const out = new Set<string>();
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFDict)) continue;
    const ref = obj.get(PDFName.of("ToUnicode"));
    if (!ref) continue;
    const stream = doc.context.lookup(ref);
    if (!(stream instanceof PDFRawStream)) continue;
    const filter = stream.dict.get(PDFName.of("Filter"));
    const bytes = filter && filter.toString() === "/FlateDecode" ? inflateSync(stream.contents) : Buffer.from(stream.contents);
    for (const m of bytes.toString("latin1").matchAll(/<([0-9a-fA-F]{4,})>/g)) out.add(m[1].toUpperCase());
  }
  return out;
}

interface Word { text: string; xMin: number; xMax: number; yMin: number; yMax: number }
function pagesWords(file: string): Word[][] {
  const xml = execFileSync("pdftotext", ["-bbox", file, "-"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return xml.split("<page ").slice(1).map((page) =>
    [...page.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)].map((m) => ({
      xMin: +m[1], yMin: +m[2], xMax: +m[3], yMax: +m[4], text: m[5].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"'),
    })),
  );
}

/** A spaced mark as its own word ("»," keeps its trailing comma). */
const PUNCT = /^[?!;:»][,.]*$/;

for (const [edition, buf] of [["print", printPdf], ["digital", digitalPdf]] as const) {
  const targets = await toUnicodeTargets(buf);
  check(targets.has("202F"), `${edition}: U+202F in the text layer (ToUnicode)`);
  check(targets.has("00A0"), `${edition}: U+00A0 in the text layer (ToUnicode)`);
  // Every mark the book prints is spaced in this sample (no-break space before it)
  const expected = execFileSync("pdftotext", [edition === "print" ? files.print : files.digital, "-"], { encoding: "utf8" }).match(/[?!;:»]/g)?.length ?? 0;
  let seen = 0;
  const bad: string[] = [];
  for (const words of pagesWords(edition === "print" ? files.print : files.digital)) {
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (!PUNCT.test(w.text)) continue;
      seen++;
      const prev = words[i - 1];
      const h = w.yMax - w.yMin;
      const sameLine = prev && Math.abs(prev.yMin - w.yMin) < h * 0.3;
      const gap = prev ? w.xMin - prev.xMax : -1;
      // A real narrow/no-break space: ≥ 0.08 line-box (≈ 0.1 em) and not a line break
      if (!sameLine || gap < h * 0.08 || gap > h * 0.6) bad.push(`"${prev?.text ?? "∅"}" ${gap.toFixed(2)}pt "${w.text}"${sameLine ? "" : " (line break)"}`);
    }
  }
  check(expected >= 40 && seen === expected, `${edition}: every spaced mark printed apart from its word (${seen} of ${expected})`);
  check(bad.length === 0, `${edition}: each mark sits after a visible gap on the same line${bad.length ? ` — ${bad.slice(0, 4).join(" · ")}` : ""}`);
}

// ── 4. Referral QR on the last inner page ─────────────────────────────────
console.log("\n4. Referral QR (last inner page)");
const REF_CODE = "MEA7K3P9Q";
for (const locale of ["fr", "es", "ca"] as const) {
  const refInput: BookPdfInput = { ...input, locale, referral: { code: REF_CODE, url: `https://meapica.shop/${locale}/r/${REF_CODE}` } };
  const refPrepared = await prepareBookRender(refInput);
  const refPrint = await renderInteriorPdf(refInput, refPrepared);
  const refDigital = await renderBookPdf(refInput, refPrepared, { edition: "digital" });
  const refFiles = { print: join(dir, `referral-${locale}-interior.pdf`), digital: join(dir, `referral-${locale}-book.pdf`) };
  writeFileSync(refFiles.print, refPrint);
  writeFileSync(refFiles.digital, refDigital);
  const sizes = await pageSizesMm(refPrint);
  check(sizes.length === 32 && sizes.every((x) => x === "208.0×208.0"), `${locale}: inside file still 32 pages of 208×208 mm`);
  // Inside file: pastedown + 30 inner + pastedown → the colophon is page 31; digital: cover + endpaper + 30 + endpaper + back → 32.
  for (const [edition, file, pageNo, sizePt, safePt] of [
    ["print", refFiles.print, 31, 208 * MM, 19 * MM],
    ["digital", refFiles.digital, 32, 200 * MM, 15 * MM],
  ] as const) {
    const words = pagesWords(file)[pageNo - 1] ?? [];
    const text = words.map((w) => w.text).join(" ");
    check(text.includes(REF_CODE), `${locale} ${edition}: code printed on the last inner page`);
    check(/meapica\.shop/.test(text), `${locale} ${edition}: meapica.shop under the QR`);
    const out = words.filter((w) => w.xMin < safePt || w.yMin < safePt || w.xMax > sizePt - safePt || w.yMax > sizePt - safePt);
    check(out.length === 0, `${locale} ${edition}: every word inside the safe area${out.length ? ` (${out.map((w) => w.text).join(" ")})` : ""}`);
    if (process.argv.includes("--keep")) {
      execFileSync("pdftoppm", ["-f", String(pageNo), "-l", String(pageNo), "-r", "150", "-png", "-singlefile", file, join(dir, `referral-${locale}-${edition}-last-page`)]);
    }
  }
}

if (process.argv.includes("--keep")) console.log(`\nFiles kept in ${dir}`);
else rmSync(dir, { recursive: true, force: true });
if (failures.length) {
  console.error(`\n${failures.length} check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll checks passed");
