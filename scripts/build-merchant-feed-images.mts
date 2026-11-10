// Builds the product images of the Merchant Center / ChatGPT product feeds
// (public/images/feed/*.jpg, referenced by src/lib/merchant-feed.ts).
//
// Each image is the real example book (Noa, forest world, showcase v2: the same book
// the landing follows) rendered by the site's own book mockup at 1500 × 1500, plus the
// bare cover art. The art is made with an image model, so every file carries the IPTC
// DigitalSourceType "trainedAlgorithmicMedia" XMP tag Google requires on AI-generated
// product images (Merchant Center "image_link" spec). Never strip it (no re-encoding
// through a tool that drops metadata).
//
// Story-world items (FEED_WORLDS: every world with a landing page + the Reyes edition) get
// their own shots: hardcover, softcover and the bare art. The cover is the newest real
// example book of that world when one is published (GET /api/showcase, the same covers the
// landing catalog shows, with its real title), otherwise the world's own art with the story
// title and no child name. Nothing is invented: no sample names on template art.
//
// Needs the dev server (the mockup harness 404s in production builds):
//   npm run dev   (port 3013)   then
//   npx tsx --tsconfig tsconfig.json scripts/build-merchant-feed-images.mts [baseUrl] [all|formats|worlds]
// "worlds" rebuilds only the story-world images (leaves the three format images untouched).

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { FEED_IMAGES, FEED_WORLDS, FEED_WORLD_FORMATS, feedWorldImages } from "../src/lib/merchant-feed";
import { getTemplateConfig } from "../src/lib/create-store";
import { getBookColors } from "../src/lib/template-colors";

const BASE = process.argv[2] ?? "http://localhost:3013";
const ONLY = process.argv[3] ?? "all";
const OUT_DIR = path.join(process.cwd(), "public");
const SIZE = 1500;

/** Noa's final print renders (public `showcase` bucket mirror, 2–4 MB originals). */
const NOA = "https://rmxjtugoyfaxxkiiayss.supabase.co/storage/v1/object/public/showcase/bc6e2dbd-fd14-4c5d-a9d0-07b10cffdbf2/final";
const NOA_COVER = `${NOA}/cover-muo2qwb9-e00cdd.jpg`;
const NOA_SPREAD = "/images/landing/noa/scene-8.webp";
const NOA_TITLE = "Noa y la llave de flor";

const XMP = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/"
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia">
   <dc:creator><rdf:Seq><rdf:li>Meapica</rdf:li></rdf:Seq></dc:creator>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

/**
 * Product shot: trim the white stage around the book, then centre it on a white square
 * with a small margin, so the product fills most of the frame (Google recommends 75-90 %).
 */
async function productSquare(png: Buffer): Promise<Buffer> {
  const trimmed = await sharp(png).flatten({ background: "#ffffff" }).trim({ background: "#ffffff", threshold: 12 }).toBuffer({ resolveWithObject: true });
  const side = Math.round(Math.max(trimmed.info.width, trimmed.info.height) / 0.88);
  const left = Math.floor((side - trimmed.info.width) / 2);
  const top = Math.floor((side - trimmed.info.height) / 2);
  return sharp({ create: { width: side, height: side, channels: 3, background: "#ffffff" } })
    .composite([{ input: trimmed.data, left, top }])
    .png()
    .toBuffer();
}

async function writeJpeg(input: Buffer, rel: string) {
  const file = path.join(OUT_DIR, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await sharp(input)
    .resize(SIZE, SIZE, { fit: "cover" })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 86, mozjpeg: true })
    .withXmp(XMP)
    .toFile(file);
  const meta = await sharp(file).metadata();
  if (meta.width !== SIZE || meta.height !== SIZE || !meta.xmp?.toString().includes("trainedAlgorithmicMedia")) {
    throw new Error(`${rel}: bad output (${meta.width}x${meta.height}, xmp=${Boolean(meta.xmp)})`);
  }
  console.log(`✓ ${rel}`);
}

interface Shot {
  rel: string;
  format: "hardcover" | "softcover" | "pdf";
  variant: "closed" | "open";
  cover: string;
  title: string;
  name: string;
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Per world: its mockup shots and where its bare art comes from. */
async function worldShots(): Promise<{ shots: Shot[]; art: Array<{ rel: string; url: string }> }> {
  const res = await fetch(`${BASE}/api/showcase?locale=es`);
  if (!res.ok) throw new Error(`showcase ${res.status}`);
  const showcase = (await res.json()) as Array<{ templateId: string; title: string; coverImage: string | null }>;
  const shots: Shot[] = [];
  const art: Array<{ rel: string; url: string }> = [];
  for (const world of FEED_WORLDS) {
    const template = getTemplateConfig(world.templateId);
    if (!template) throw new Error(`unknown template ${world.templateId}`);
    // Newest real book of this world (the API returns newest first), else the world's own art.
    const example = showcase.find((b) => b.templateId === world.templateId && b.coverImage);
    const cover = example?.coverImage ?? `${BASE}${template.image}`;
    const title = example?.title ?? template.title;
    // Real books are titled "<Name> y …": the name is the title's first word.
    const name = example ? example.title.split(" ")[0] : "";
    const images = feedWorldImages(world.key);
    for (const format of FEED_WORLD_FORMATS) shots.push({ rel: images[format], format, variant: "closed", cover, title, name });
    art.push({ rel: images.art, url: cover });
    console.log(`· ${world.key}: ${example ? `example "${example.title}"` : "template art"}`);
  }
  return { shots, art };
}

async function main() {
  const browser = await chromium.launch();
  // Square viewport; DPR 2 so the 3D mockup is rasterised sharper than the output size.
  const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 2, reducedMotion: "reduce" });

  const noa = { cover: NOA_COVER, title: NOA_TITLE, name: "Noa" };
  const formatShots: Shot[] = [
    { rel: FEED_IMAGES.hardcover, format: "hardcover", variant: "closed", ...noa },
    { rel: FEED_IMAGES.softcover, format: "softcover", variant: "closed", ...noa },
    { rel: FEED_IMAGES.digital_pdf, format: "pdf", variant: "closed", ...noa },
    { rel: FEED_IMAGES.openSpread, format: "hardcover", variant: "open", ...noa },
  ];
  const worlds = ONLY === "formats" ? { shots: [], art: [] } : await worldShots();
  const shots = [...(ONLY === "worlds" ? [] : formatShots), ...worlds.shots];
  for (const shot of shots) {
    const q = new URLSearchParams({
      solo: "1",
      scale: "0",
      format: shot.format,
      variant: shot.variant,
      cover: shot.cover,
      title: shot.title,
      name: shot.name,
      spine: getBookColors(undefined, undefined, null).gradientStart,
      panorama: `${BASE}${NOA_SPREAD}`,
    });
    await page.goto(`${BASE}/es/dev/book-mockup?${q}`, { waitUntil: "networkidle" });
    // White page behind the product (Google: plain background, no borders).
    // Hide the Next.js dev indicator too.
    await page.addStyleTag({ content: "main{background:#fff!important} nextjs-portal{display:none!important}" });
    await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
    await page.waitForTimeout(1200); // format transition + fonts
    const png = await page.locator('[data-testid="mockup"]').screenshot({ type: "png" });
    await writeJpeg(await productSquare(png), shot.rel);
  }
  await browser.close();

  // The bare cover art (portrait original → centred square crop).
  if (ONLY !== "worlds") await writeJpeg(await fetchBuffer(NOA_COVER), FEED_IMAGES.coverArt);
  for (const a of worlds.art) await writeJpeg(await fetchBuffer(a.url), a.rel);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
