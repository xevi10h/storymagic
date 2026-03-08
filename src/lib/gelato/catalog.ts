// Gelato Catalog API helpers
// Used to query product specs before generating print-ready files.

import { gelatoProductFetch } from "./client";

export interface CoverDimensions {
  /** Total spread width in mm (back cover + spine + front cover + bleeds) */
  coverWidthMm: number;
  /** Total spread height in mm (trim + bleeds) */
  coverHeightMm: number;
  /** Front cover width in mm (trim only) */
  frontCoverWidthMm: number;
  /** Back cover width in mm (trim only) */
  backCoverWidthMm: number;
  /** Spine width in mm */
  spineWidthMm: number;
}

interface GelatoCoverDimensionsResponse {
  productUid: string;
  pageCount: number;
  // Gelato returns dimensions in mm
  coverWidth?: number;
  coverHeight?: number;
  frontCoverWidth?: number;
  backCoverWidth?: number;
  spineWidth?: number;
  // Some versions use these names
  width?: number;
  height?: number;
  spine?: number;
}

/**
 * Fetch the exact cover spread dimensions for a given product + page count.
 * The spine width changes with page count, so this must be called per book.
 *
 * pageCount = number of INNER pages (not counting front/back cover).
 * For our 32-page book: pageCount = 30.
 */
export async function getCoverDimensions(
  productUid: string,
  pageCount: number,
): Promise<CoverDimensions> {
  const data = await gelatoProductFetch<GelatoCoverDimensionsResponse>(
    `/v3/products/${encodeURIComponent(productUid)}/cover-dimensions?pageCount=${pageCount}`,
  );

  // Normalize field names — Gelato API docs show different naming conventions
  const coverWidthMm = data.coverWidth ?? data.width ?? 0;
  const coverHeightMm = data.coverHeight ?? data.height ?? 208; // fallback: bleed page height
  const spineWidthMm = data.spineWidth ?? data.spine ?? 0;
  const frontCoverWidthMm = data.frontCoverWidth ?? 204; // 200mm trim + 4mm bleed
  const backCoverWidthMm = data.backCoverWidth ?? 204;

  return {
    coverWidthMm,
    coverHeightMm,
    frontCoverWidthMm,
    backCoverWidthMm,
    spineWidthMm,
  };
}
