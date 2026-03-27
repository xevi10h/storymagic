/**
 * Cover Spread Builder (pdf-lib)
 *
 * Builds the Gelato cover spread by embedding ACTUAL rendered book pages
 * (front cover = page 0, back cover = last page) into a single wide page
 * with a spine strip in the middle.
 *
 * Layout: [ Back Cover (left) ] [ Spine (center) ] [ Front Cover (right) ]
 *
 * This replaces the @react-pdf text-only CoverSpreadPdf component which
 * only rendered gradients + text. Gelato needs the real cover artwork.
 */

import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import { readFileSync } from "fs";
import { resolve } from "path";

const MM_TO_PT = 2.83465;

/**
 * Convert a hex color string (#RRGGBB) to pdf-lib rgb() values (0-1 range).
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255,
  };
}

export interface CoverSpreadOptions {
  /** Full 32-page book PDF buffer (rendered by renderBookPdf) */
  fullBookBuffer: Buffer;
  /** Total cover spread width in mm (from Gelato API) */
  coverWidthMm: number;
  /** Total cover spread height in mm (from Gelato API) */
  coverHeightMm: number;
  /** Spine width in mm (from Gelato API) */
  spineWidthMm: number;
  /** Book title for the spine text */
  bookTitle: string;
  /** Spine background color — hex string from theme (e.g. "#1a1a4e") */
  spineColor: string;
}

/**
 * Build a print-ready cover spread PDF by embedding actual book pages.
 *
 * 1. Loads the full book PDF
 * 2. Embeds page 0 (front cover) on the RIGHT panel
 * 3. Embeds last page (back cover) on the LEFT panel
 * 4. Draws spine strip with theme color, rotated title, and Meapica logo
 *
 * Returns a Buffer containing the single-page cover spread PDF.
 */
export async function buildCoverSpreadFromBook(
  options: CoverSpreadOptions,
): Promise<Buffer> {
  const {
    fullBookBuffer,
    coverWidthMm,
    coverHeightMm,
    spineWidthMm,
    bookTitle,
    spineColor,
  } = options;

  // Convert mm → pt
  const spreadW = coverWidthMm * MM_TO_PT;
  const spreadH = coverHeightMm * MM_TO_PT;
  const spineW = spineWidthMm * MM_TO_PT;
  const panelW = (spreadW - spineW) / 2;
  const spineCenter = panelW + spineW / 2;

  // Load the full book PDF
  const fullDoc = await PDFDocument.load(fullBookBuffer);
  const pageCount = fullDoc.getPageCount();

  if (pageCount < 2) {
    throw new Error(`Book PDF has only ${pageCount} pages — need at least 2 for cover spread`);
  }

  // Create the cover spread document
  const coverDoc = await PDFDocument.create();
  const page = coverDoc.addPage([spreadW, spreadH]);

  // ── Back cover (last page of book → LEFT panel) ─────────────────────
  const [backEmbed] = await coverDoc.embedPdf(fullDoc, [pageCount - 1]);
  page.drawPage(backEmbed, { x: 0, y: 0, width: panelW, height: spreadH });

  // ── Spine background ────────────────────────────────────────────────
  const sc = hexToRgb(spineColor);
  page.drawRectangle({
    x: panelW,
    y: 0,
    width: spineW,
    height: spreadH,
    color: rgb(sc.r, sc.g, sc.b),
  });

  // ── Front cover (page 0 of book → RIGHT panel) ─────────────────────
  const [frontEmbed] = await coverDoc.embedPdf(fullDoc, [0]);
  page.drawPage(frontEmbed, { x: panelW + spineW, y: 0, width: panelW, height: spreadH });

  // ── Spine title (rotated 90°, centered vertically) ──────────────────
  const font = await coverDoc.embedFont(StandardFonts.HelveticaBold);
  const titleSize = 5.5;
  const titleWidth = font.widthOfTextAtSize(bookTitle, titleSize);

  page.drawText(bookTitle, {
    x: spineCenter + titleSize / 2.5,
    y: (spreadH - titleWidth) / 2,
    size: titleSize,
    font,
    color: rgb(1, 1, 1),
    rotate: degrees(90),
  });

  // ── Meapica logo on spine (SVG → white PNG → embed) ─────────────────
  try {
    const sharp = (await import("sharp")).default;
    const logoSvgPath = resolve(process.cwd(), "public/images/meapica-logo.svg");
    let svgContent = readFileSync(logoSvgPath, "utf-8");
    // Make the logo white
    svgContent = svgContent.replace(/fill="#[0-9a-fA-F]{6}"/g, 'fill="#ffffff"');

    const logoPng = await sharp(Buffer.from(svgContent))
      .resize({ height: 80 })
      .png()
      .toBuffer();

    const logoImage = await coverDoc.embedPng(logoPng);

    // Scale logo to fit spine width
    const logoH = spineW * 0.45;
    const logoW = logoH * (logoImage.width / logoImage.height);

    // Position: near top of spine, rotated 90°, centered on spine axis
    // After 90° rotation: center = x - logoH/2 → x = spineCenter + logoH/2
    const logoX = spineCenter + logoH / 2;
    const logoY = spreadH - logoW - 20; // 20pt from top edge

    page.drawImage(logoImage, {
      x: logoX,
      y: logoY,
      width: logoW,
      height: logoH,
      rotate: degrees(90),
    });
  } catch (err) {
    // Non-fatal: logo is decorative, spine still works without it
    console.warn("[CoverSpread] Failed to embed spine logo:", err);
  }

  return Buffer.from(await coverDoc.save());
}
