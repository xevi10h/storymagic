// Public API of the PDF/print module.

export {
  renderBookPdf,
  renderInteriorPdf,
  prepareBookRender,
  type BookPdfInput,
  type BookRenderContext,
} from "./book-template";
export { renderCoverSpreadPdf, planCoverSpread, BARCODE_RESERVE_MM, MIN_SPINE_TEXT_MM } from "./cover-spread";
export {
  validatePrintableBook,
  PrintValidationError,
  type PrintIssue,
  type PrintValidationResult,
  type ImageResolution,
  type ValidateOptions,
} from "./validate";
export { renderPrintFiles, buildGelatoSingleFilePdf, type PrintFiles } from "./print-files";
export { INSIDE_FILE_PAGE_COUNT, INTERIOR_PAGE_COUNT, SCENE_COUNT, SECONDARY_SCENE_OFFSET, planInteriorPages } from "./layout";
export { MIN_PRINT_DPI, TARGET_PRINT_DPI } from "./images";
export { prefetchAllIllustrations, prefetchImageAsDataUri, type IllustrationRef } from "./prefetch";
