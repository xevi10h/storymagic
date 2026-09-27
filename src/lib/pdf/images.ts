/**
 * Image placement for print: uniform cover-fit (never stretched) and
 * effective-DPI accounting at the size an image is actually printed.
 */

export const PT_PER_INCH = 72;
export const MM_PER_INCH = 25.4;
export const MM_TO_PT = PT_PER_INCH / MM_PER_INCH; // 2.834645…

/** Below this the printer rejects / prints visibly soft. */
export const MIN_PRINT_DPI = 150;
/** Target for picture-book artwork. */
export const TARGET_PRINT_DPI = 300;

export interface ImageDims {
  widthPx: number;
  heightPx: number;
}

/** Box-relative placement of an image, in pt. left/top are ≤ 0 when the image overhangs the box. */
export interface Placement {
  width: number;
  height: number;
  left: number;
  top: number;
  /** Effective resolution at the printed size (uniform scale → one value) */
  dpi: number;
}

/**
 * Uniformly scales an image so it fully covers a box (CSS object-fit: cover).
 * `focusX`/`focusY` (0..1) choose which part stays visible when cropping
 * (0.5/0.5 = centred, focusY 0 = keep the top).
 */
export function coverFit(
  img: ImageDims,
  boxWidth: number,
  boxHeight: number,
  focusX = 0.5,
  focusY = 0.5,
): Placement {
  const scale = Math.max(boxWidth / img.widthPx, boxHeight / img.heightPx); // pt per px
  const width = img.widthPx * scale;
  const height = img.heightPx * scale;
  return {
    width,
    height,
    left: -(width - boxWidth) * focusX,
    top: -(height - boxHeight) * focusY,
    dpi: PT_PER_INCH / scale,
  };
}

/** Pixel dimensions from a data URI (or null when it cannot be decoded). */
export async function probeImageDims(src: string | null | undefined): Promise<ImageDims | null> {
  if (!src) return null;
  const comma = src.indexOf(",");
  if (!src.startsWith("data:") || comma < 0) return null;
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(Buffer.from(src.slice(comma + 1), "base64")).metadata();
    if (!meta.width || !meta.height) return null;
    // Raw pixel grid: prefetch.ts bakes EXIF orientation in, and react-pdf ignores EXIF
    return { widthPx: meta.width, heightPx: meta.height };
  } catch {
    return null;
  }
}
