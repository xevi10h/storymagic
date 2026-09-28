/**
 * Print gate — run BEFORE submitting anything to Gelato.
 *
 * Reuses the exact page plan and image placements the renderer uses, so a
 * book that passes here prints the way it was validated.
 */

import { PDFDocument } from "pdf-lib";
import type { CoverGeometry } from "@/lib/gelato/catalog";
import { backCoverImage, prepareBookRender, type BookPdfInput, type BookRenderContext } from "./book-template";
import { planCoverSpread } from "./cover-spread";
import { GEOMETRY, INTERIOR_PAGE_COUNT, SCENE_COUNT, imageBoxesOf, type PlanIssue } from "./layout";
import { MIN_PRINT_DPI, MM_TO_PT, TARGET_PRINT_DPI, coverFit, type ImageDims } from "./images";
import { unprintableCharacters } from "./text";
import { BOOK } from "./theme";

export type PrintIssue = PlanIssue;

/**
 * Planned page art is 2432 px (multiple of 16 required by the image model) = 297 dpi over
 * the 208 mm bleed page — treat anything within 2% of the target as on target.
 */
const SOFT_DPI_TOLERANCE = 0.98;
/** Warn when cover-fit crops away more than 35% of an illustration (wrong aspect ratio). */
const MIN_VISIBLE_SHARE = 0.65;

export interface ImageResolution {
  where: string;
  pageNumber?: number;
  sceneNumber?: number;
  widthPx: number;
  heightPx: number;
  dpi: number;
}

export interface PrintValidationResult {
  ok: boolean;
  errors: PrintIssue[];
  warnings: PrintIssue[];
  /** Effective DPI of every placed image at its printed size */
  resolutions: ImageResolution[];
}

export class PrintValidationError extends Error {
  constructor(public readonly result: PrintValidationResult) {
    super(`Book is not printable: ${result.errors.map((e) => e.message).join("; ")}`);
    this.name = "PrintValidationError";
  }
}

export interface ValidateOptions {
  /** Real Gelato cover geometry (getCoverDimensions().geometry) — validates the cover layout too */
  coverGeometry?: CoverGeometry;
  /** Rendered interior PDF — checks page count and page size */
  interiorPdf?: Buffer;
  /** Rendered cover PDF — checks it matches the geometry */
  coverPdf?: Buffer;
  /** Reuse a prepared render context (avoids probing images twice) */
  prepared?: BookRenderContext;
}

function checkDpi(
  out: { errors: PrintIssue[]; warnings: PrintIssue[]; resolutions: ImageResolution[] },
  where: string,
  dims: ImageDims,
  dpi: number,
  extra: { pageNumber?: number; sceneNumber?: number },
  belowMinIs: "error" | "warning" = "error",
) {
  const rounded = Math.round(dpi);
  out.resolutions.push({ where, ...extra, widthPx: dims.widthPx, heightPx: dims.heightPx, dpi: rounded });
  const size = `${dims.widthPx}×${dims.heightPx}px`;
  if (dpi < MIN_PRINT_DPI) {
    (belowMinIs === "error" ? out.errors : out.warnings).push({
      severity: belowMinIs,
      code: "low_dpi",
      message: `${where}: ${rounded} dpi (${size}) — minimum is ${MIN_PRINT_DPI}`,
      pageNumber: extra.pageNumber,
    });
  } else if (dpi < TARGET_PRINT_DPI * SOFT_DPI_TOLERANCE) {
    out.warnings.push({ severity: "warning", code: "soft_dpi", message: `${where}: ${rounded} dpi (${size}) — target is ${TARGET_PRINT_DPI}`, pageNumber: extra.pageNumber });
  }
}

/**
 * Validates everything that would make a printed book wrong:
 * missing / undecodable illustrations, page count ≠ 30, panorama parity,
 * text that does not fit, effective DPI < 150 (warning < 300), cover geometry,
 * unprintable characters, and — when given — the rendered PDFs themselves.
 */
export async function validatePrintableBook(input: BookPdfInput, options: ValidateOptions = {}): Promise<PrintValidationResult> {
  const ctx = options.prepared ?? (await prepareBookRender(input));
  const out = { errors: [] as PrintIssue[], warnings: [] as PrintIssue[], resolutions: [] as ImageResolution[] };
  for (const issue of ctx.plan.issues) (issue.severity === "error" ? out.errors : out.warnings).push(issue);

  // Illustrations: every primary scene image must exist and decode
  for (let n = 1; n <= SCENE_COUNT; n++) {
    const img = ctx.images.scenes.get(n);
    if (img && !img.dims) out.errors.push({ severity: "error", code: "undecodable_image", message: `Scene ${n} illustration cannot be decoded` });
  }
  for (const [n, img] of ctx.images.scenes) {
    if (n > SCENE_COUNT && !img.dims) out.warnings.push({ severity: "warning", code: "undecodable_image", message: `Secondary illustration ${n} cannot be decoded` });
  }

  // Effective DPI of every placed interior image
  for (const page of ctx.plan.pages) {
    for (const box of imageBoxesOf(page)) {
      const img = ctx.images.scenes.get(box.sceneNumber);
      if (!img?.dims) continue; // missing → already an error from the plan
      const fit = coverFit(img.dims, box.boxWidth, box.boxHeight);
      const where = `Page ${page.pageNumber} (scene ${box.sceneNumber})`;
      checkDpi(out, where, img.dims, fit.dpi, { pageNumber: page.pageNumber, sceneNumber: box.sceneNumber });
      // Uniform cover-fit never distorts, but a wrong aspect ratio crops art away
      const visibleShare = (box.boxWidth * box.boxHeight) / (fit.width * fit.height);
      if (visibleShare < MIN_VISIBLE_SHARE) {
        out.warnings.push({
          severity: "warning",
          code: "aspect_crop",
          message: `${where}: ${Math.round((1 - visibleShare) * 100)}% of the ${img.dims.widthPx}×${img.dims.heightPx}px image is cropped (box ratio ${(box.boxWidth / box.boxHeight).toFixed(2)}:1)`,
          pageNumber: page.pageNumber,
        });
      }
    }
  }

  // Keepsake portrait (page 27, full page) — required: without it the page prints as a bare colour field
  if (!ctx.images.portrait) {
    out.errors.push({ severity: "error", code: "missing_portrait", message: "No portrait for page 27 (pass the hero shot, or the cover art as fallback)", pageNumber: 27 });
  } else if (!ctx.images.portrait.dims) {
    out.errors.push({ severity: "error", code: "undecodable_image", message: "Page 27 portrait cannot be decoded", pageNumber: 27 });
  } else {
    const { dpi } = coverFit(ctx.images.portrait.dims, BOOK.pageWidth, BOOK.pageHeight);
    checkDpi(out, "Page 27 portrait", ctx.images.portrait.dims, dpi, { pageNumber: 27 });
  }

  // Adventure map (pp. 28–29) — optional: books without one print a patterned endpaper spread
  if (input.mapGame && !ctx.images.map) {
    out.warnings.push({ severity: "warning", code: "map_missing", message: "Adventure map image not available — pages 28–29 print as an endpaper", pageNumber: 28 });
  } else if (ctx.images.map && !ctx.images.map.dims) {
    out.warnings.push({ severity: "warning", code: "undecodable_image", message: "Adventure map cannot be decoded — pages 28–29 print as an endpaper", pageNumber: 28 });
  } else if (ctx.images.map?.dims && ctx.plan.pages.some((p) => p.kind === "map")) {
    const { dpi } = coverFit(ctx.images.map.dims, GEOMETRY.spreadWidth, BOOK.pageHeight);
    checkDpi(out, "Pages 28–29 adventure map", ctx.images.map.dims, dpi, { pageNumber: 28 });
  }

  // Cover
  if (!ctx.images.cover) {
    out.errors.push({ severity: "error", code: "missing_cover", message: "No front cover artwork" });
  } else if (!ctx.images.cover.dims) {
    out.errors.push({ severity: "error", code: "undecodable_image", message: "Front cover artwork cannot be decoded" });
  }
  if (options.coverGeometry) {
    const g = options.coverGeometry;
    if (!(g.totalWidthMm > 0 && g.totalHeightMm > 0 && g.spine.width > 0 && g.front.width > 0 && g.back.width > 0)) {
      out.errors.push({ severity: "error", code: "cover_geometry", message: `Cover geometry has zero dimensions (${g.totalWidthMm}×${g.totalHeightMm} mm, spine ${g.spine.width} mm)` });
    } else {
      if (g.pageCount !== INTERIOR_PAGE_COUNT) {
        out.errors.push({ severity: "error", code: "cover_geometry", message: `Cover geometry is for ${g.pageCount} pages, interior has ${INTERIOR_PAGE_COUNT}` });
      }
      const layout = planCoverSpread(ctx, g);
      for (const msg of layout.issues) out.warnings.push({ severity: "warning", code: "cover_text", message: msg });
      if (layout.frontPlacement && ctx.images.cover?.dims) {
        checkDpi(out, "Front cover", ctx.images.cover.dims, layout.frontPlacement.dpi, {});
      }
      const backImg = backCoverImage(ctx);
      if (layout.backPlacement && backImg?.dims) {
        // Printed at 35% opacity under a dark veil — softness is far less visible
        checkDpi(out, "Back cover (faded art)", backImg.dims, layout.backPlacement.dpi, {}, "warning");
      }
    }
  } else {
    out.warnings.push({ severity: "warning", code: "cover_not_checked", message: "Cover geometry not provided — cover layout not validated" });
  }

  // Characters no embedded font can draw (emoji etc. are dropped)
  const texts: [string, string, "display" | "body"][] = [
    ["Title", input.story.bookTitle, "display"],
    ["Name", input.characterName, "display"],
    ["Dedication", input.dedicationText || input.story.dedication || "", "body"],
    ["Sender", input.senderName ?? "", "body"],
    ...input.story.scenes.map((s): [string, string, "display" | "body"] => [`Scene ${s.sceneNumber}`, `${s.title}\n${s.text}`, "body"]),
    ...(ctx.plan.pages.some((p) => p.kind === "map") && input.mapGame
      ? [["Map game", [...input.mapGame.items.map((i) => i.label), input.mapGame.trailLine, ...input.mapGame.questions.flatMap((q) => [q.question, q.answer])].join("\n"), "body"] as [string, string, "display" | "body"]]
      : []),
  ];
  for (const [label, text, role] of texts) {
    const bad = unprintableCharacters(text, { role });
    if (bad.length) out.warnings.push({ severity: "warning", code: "unprintable_chars", message: `${label}: characters removed for print: ${bad.join(" ")}` });
  }

  // Rendered files
  if (options.interiorPdf) {
    const doc = await PDFDocument.load(options.interiorPdf);
    const count = doc.getPageCount();
    if (count !== INTERIOR_PAGE_COUNT) {
      out.errors.push({ severity: "error", code: "page_count", message: `Rendered interior has ${count} pages, expected ${INTERIOR_PAGE_COUNT}` });
    }
    doc.getPages().forEach((p, i) => {
      const { width, height } = p.getSize();
      if (Math.abs(width - BOOK.pageWidth) > 0.5 || Math.abs(height - BOOK.pageHeight) > 0.5) {
        out.errors.push({ severity: "error", code: "page_size", message: `Interior page ${i + 1} is ${(width / MM_TO_PT).toFixed(1)}×${(height / MM_TO_PT).toFixed(1)} mm, expected 208×208` });
      }
    });
  }
  if (options.coverPdf) {
    const doc = await PDFDocument.load(options.coverPdf);
    if (doc.getPageCount() !== 1) out.errors.push({ severity: "error", code: "cover_file", message: `Cover PDF has ${doc.getPageCount()} pages, expected 1` });
    if (options.coverGeometry) {
      const { width, height } = doc.getPage(0).getSize();
      const w = width / MM_TO_PT;
      const h = height / MM_TO_PT;
      if (Math.abs(w - options.coverGeometry.totalWidthMm) > 0.2 || Math.abs(h - options.coverGeometry.totalHeightMm) > 0.2) {
        out.errors.push({ severity: "error", code: "cover_file", message: `Cover PDF is ${w.toFixed(2)}×${h.toFixed(2)} mm, Gelato expects ${options.coverGeometry.totalWidthMm}×${options.coverGeometry.totalHeightMm}` });
      }
    }
  }

  return { ok: out.errors.length === 0, errors: out.errors, warnings: out.warnings, resolutions: out.resolutions };
}
