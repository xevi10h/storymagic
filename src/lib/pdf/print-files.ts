/**
 * One call for fulfilment: geometry → validation → render → re-validation.
 *
 *   const files = await renderPrintFiles({ input, productUid });
 *   // files.interiorPdf → Gelato "inside", files.coverPdf → cover file
 *
 * Throws PrintValidationError (with .result listing every problem) instead of
 * producing a file that would print wrong.
 */

import { PDFDocument } from "pdf-lib";
import { getCoverDimensions, type CoverDimensions } from "@/lib/gelato/catalog";
import { prepareBookRender, renderBookPdf, renderInteriorPdf, type BookPdfInput } from "./book-template";
import { renderCoverSpreadPdf } from "./cover-spread";
import { INTERIOR_PAGE_COUNT } from "./layout";
import { PrintValidationError, validatePrintableBook, type PrintValidationResult } from "./validate";

export interface PrintFiles {
  /** Gelato "inside" file — 32 pages (pastedown + 30 inner + pastedown), 208×208 mm (200 mm trim + 4 mm bleed) */
  interiorPdf: Buffer;
  /** Gelato cover file — one page, exact geometry from the catalog API */
  coverPdf: Buffer;
  /** Digital book for the customer download (34 pages) */
  bookPdf: Buffer;
  coverDimensions: CoverDimensions;
  validation: PrintValidationResult;
}

export async function renderPrintFiles(args: {
  input: BookPdfInput;
  productUid: string;
  /** Pre-fetched geometry (skips the catalog call) */
  coverDimensions?: CoverDimensions;
}): Promise<PrintFiles> {
  const coverDimensions = args.coverDimensions ?? (await getCoverDimensions(args.productUid, INTERIOR_PAGE_COUNT));
  const geometry = coverDimensions.geometry;
  const prepared = await prepareBookRender(args.input);

  const before = await validatePrintableBook(args.input, { coverGeometry: geometry, prepared });
  if (!before.ok) throw new PrintValidationError(before);

  const [interiorPdf, coverPdf, bookPdf] = await Promise.all([
    renderInteriorPdf(args.input, prepared),
    renderCoverSpreadPdf(args.input, geometry, prepared),
    renderBookPdf(args.input, prepared),
  ]);

  const validation = await validatePrintableBook(args.input, { coverGeometry: geometry, interiorPdf, coverPdf, prepared });
  if (!validation.ok) throw new PrintValidationError(validation);

  return { interiorPdf, coverPdf, bookPdf, coverDimensions, validation };
}

/**
 * Single-file variant of Gelato's photobook template:
 *   page 1 cover spread · then the inside file (pastedown · 30 inner pages · pastedown).
 * Use it if the order is submitted with one "default" file instead of cover + "inside".
 */
export async function buildGelatoSingleFilePdf(coverPdf: Buffer, interiorPdf: Buffer): Promise<Buffer> {
  const out = await PDFDocument.create();
  const cover = await PDFDocument.load(coverPdf);
  const interior = await PDFDocument.load(interiorPdf);
  const [coverPage] = await out.copyPages(cover, [0]);
  out.addPage(coverPage);
  for (const p of await out.copyPages(interior, interior.getPageIndices())) out.addPage(p);
  return Buffer.from(await out.save());
}
