// Gelato Catalog API helpers
// Used to query product specs before generating print-ready files.

import { gelatoProductFetch } from "./client";
import type { GelatoCoverDimensionsResponse, GelatoMmBox } from "./types";

/** Rectangle in mm, measured from the top-left corner of the cover file. */
export interface MmRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Exact cover-file geometry for a product + page count, as returned by Gelato.
 *
 * Softcover:  [bleed][ back 200 ][spine][ front 200 ][bleed]          (bleed 3 mm)
 * Hardcover:  [wrap+edge][ back 198 ][joint 8][spine][joint 8][ front 198 ][edge+wrap]
 *             (wraparound 17 mm folded around the board + 3 mm board edge)
 */
export interface CoverGeometry {
  productUid: string;
  /** Inner pages requested (30) */
  pageCount: number;
  binding: "softcover" | "hardcover";
  totalWidthMm: number;
  totalHeightMm: number;
  /** Visible back panel (trim / board face) */
  back: MmRect;
  spine: MmRect;
  /** Visible front panel (trim / board face) */
  front: MmRect;
  /** Hardcover hinge grooves between board and spine (null for softcover) */
  jointBack: MmRect | null;
  jointFront: MmRect | null;
  /** Material beyond the visible panels on the outer edges: bleed (soft) or edge + wraparound (hard) */
  outerExtensionMm: number;
}

export interface CoverDimensions {
  /** Total cover file width in mm (everything: wrap/bleed + back + joints + spine + front) */
  coverWidthMm: number;
  /** Total cover file height in mm */
  coverHeightMm: number;
  /** Visible front panel width in mm */
  frontCoverWidthMm: number;
  /** Visible back panel width in mm */
  backCoverWidthMm: number;
  /** Spine width in mm */
  spineWidthMm: number;
  /** Full geometry — use this to build the cover file */
  geometry: CoverGeometry;
}

function rect(box: GelatoMmBox | undefined, name: string): MmRect {
  if (!box) throw new Error(`Gelato cover-dimensions: missing ${name}`);
  const r = { left: box.left, top: box.top, width: box.width, height: box.height };
  for (const [k, v] of Object.entries(r)) {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
      throw new Error(`Gelato cover-dimensions: ${name}.${k} is invalid (${String(v)})`);
    }
  }
  if (r.width <= 0 || r.height <= 0) {
    throw new Error(`Gelato cover-dimensions: ${name} has zero size (${r.width}×${r.height} mm)`);
  }
  return r;
}

/** Parses and sanity-checks a cover-dimensions response. Throws on anything missing/inconsistent. */
export function parseCoverDimensions(
  data: GelatoCoverDimensionsResponse,
  productUid: string,
  pageCount: number,
): CoverDimensions {
  if (data.measureUnit && data.measureUnit !== "mm") {
    throw new Error(`Gelato cover-dimensions: unexpected unit "${data.measureUnit}"`);
  }

  const isHardcover = !!data.wraparoundInsideSize;
  const total = rect(isHardcover ? data.wraparoundInsideSize : data.bleedSize, isHardcover ? "wraparoundInsideSize" : "bleedSize");
  const back = rect(data.contentBackSize, "contentBackSize");
  const front = rect(data.contentFrontSize, "contentFrontSize");
  const spine = rect(data.spineSize, "spineSize");
  const jointBack = data.jointBackSize ? rect(data.jointBackSize, "jointBackSize") : null;
  const jointFront = data.jointFrontSize ? rect(data.jointFrontSize, "jointFrontSize") : null;

  if (isHardcover && (!jointBack || !jointFront)) {
    throw new Error("Gelato cover-dimensions: hardcover response without joint sizes");
  }

  // Panels must tile left→right without gaps: back | (joint) | spine | (joint) | front
  const chain: MmRect[] = [back, ...(jointBack ? [jointBack] : []), spine, ...(jointFront ? [jointFront] : []), front];
  for (let i = 1; i < chain.length; i++) {
    const gap = chain[i].left - (chain[i - 1].left + chain[i - 1].width);
    if (Math.abs(gap) > 0.05) {
      throw new Error(`Gelato cover-dimensions: panels do not tile (gap ${gap.toFixed(2)} mm at index ${i})`);
    }
  }
  const outerExtensionMm = front.top;
  const rightExtension = total.width - (front.left + front.width);
  const bottomExtension = total.height - (front.top + front.height);
  if (
    Math.abs(back.left - outerExtensionMm) > 0.05 ||
    Math.abs(rightExtension - outerExtensionMm) > 0.05 ||
    Math.abs(bottomExtension - outerExtensionMm) > 0.05
  ) {
    throw new Error(
      `Gelato cover-dimensions: asymmetric outer extension (left ${back.left}, right ${rightExtension.toFixed(2)}, top ${front.top}, bottom ${bottomExtension.toFixed(2)} mm)`,
    );
  }

  if (data.pagesCount !== undefined && data.pagesCount !== pageCount + 4) {
    // Gelato counts the 4 cover sides in pagesCount (30 inner → 34). Anything else means semantics changed.
    throw new Error(`Gelato cover-dimensions: pagesCount ${data.pagesCount} ≠ ${pageCount} inner + 4 cover pages`);
  }

  const geometry: CoverGeometry = {
    productUid,
    pageCount,
    binding: isHardcover ? "hardcover" : "softcover",
    totalWidthMm: total.width,
    totalHeightMm: total.height,
    back,
    spine,
    front,
    jointBack,
    jointFront,
    outerExtensionMm,
  };

  return {
    coverWidthMm: total.width,
    coverHeightMm: total.height,
    frontCoverWidthMm: front.width,
    backCoverWidthMm: back.width,
    spineWidthMm: spine.width,
    geometry,
  };
}

/**
 * Fetch the exact cover spread dimensions for a given product + page count.
 * The spine width changes with page count, so this must be called per book.
 *
 * pageCount = number of INNER pages (not counting front/back cover). Our books: 30.
 * Throws if any required dimension is missing or zero — never print on guessed geometry.
 */
export async function getCoverDimensions(
  productUid: string,
  pageCount: number,
): Promise<CoverDimensions> {
  const data = await gelatoProductFetch<GelatoCoverDimensionsResponse>(
    `/v3/products/${encodeURIComponent(productUid)}/cover-dimensions?pageCount=${pageCount}`,
  );
  return parseCoverDimensions(data, productUid, pageCount);
}
