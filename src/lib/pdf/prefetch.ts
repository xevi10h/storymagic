// PDF image pre-fetching utilities
//
// @react-pdf silently fails to render many external image URLs and does not
// support WebP/AVIF. We pre-fetch all images and convert them to base64 data
// URIs so the renderer works reliably regardless of the image host.

import sharp from "sharp";
import { toServerFetchUrl } from "@/lib/storage/illustration-urls";

export interface IllustrationRef {
  sceneNumber: number;
  imageUrl: string | null;
}

/**
 * Normalises any fetched image into something react-pdf embeds well:
 * - JPEG without rotation → passed through untouched
 * - opaque images (the norm for AI art) → high-quality JPEG (q92, no chroma
 *   subsampling). Embedding 2432² PNGs as-is makes a ~150 MB interior PDF.
 * - images with real transparency → PNG
 * - EXIF orientation is baked into the pixels (react-pdf ignores the tag)
 * - WebP/AVIF/SVG are converted (react-pdf only reads PNG/JPEG)
 */
async function toPrintableImage(raw: Buffer): Promise<{ buffer: Buffer; type: string }> {
  const image = sharp(raw, { failOn: "none" });
  const meta = await image.metadata();
  if (meta.format === "jpeg" && (meta.orientation ?? 1) === 1) {
    return { buffer: raw, type: "image/jpeg" };
  }
  const opaque = !meta.hasAlpha || (await sharp(raw).stats()).isOpaque;
  if (opaque) {
    const buffer = await sharp(raw).rotate().flatten({ background: "#ffffff" }).jpeg({ quality: 92, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer();
    return { buffer, type: "image/jpeg" };
  }
  return { buffer: await sharp(raw).rotate().png().toBuffer(), type: "image/png" };
}

export async function prefetchImageAsDataUri(
  url: string,
  timeoutMs = 15000,
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // Illustration refs (private bucket paths / legacy public URLs) → short-lived signed URL.
    const response = await fetch(await toServerFetchUrl(url), { signal: controller.signal });
    clearTimeout(timer);

    if (!response.ok) {
      console.warn(`[PDF] Image fetch failed (${response.status}): ${url}`);
      return null;
    }

    const rawBuffer = Buffer.from(await response.arrayBuffer());
    const { buffer: finalBuffer, type: finalType } = await toPrintableImage(rawBuffer);

    const base64 = finalBuffer.toString("base64");
    return `data:${finalType};base64,${base64}`;
  } catch (error) {
    console.warn(
      `[PDF] Image fetch error for ${url}:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function prefetchAllIllustrations(
  illustrations: IllustrationRef[],
): Promise<IllustrationRef[]> {
  const results = await Promise.allSettled(
    illustrations.map(async (ill) => {
      if (!ill.imageUrl) return ill;

      const dataUri = await prefetchImageAsDataUri(ill.imageUrl);
      if (dataUri) {
        console.log(
          `[PDF] Scene ${ill.sceneNumber}: pre-fetched (${(dataUri.length / 1024).toFixed(0)} KB)`,
        );
      } else {
        console.warn(
          `[PDF] Scene ${ill.sceneNumber}: not available — validatePrintableBook will reject this book for print`,
        );
      }

      return { sceneNumber: ill.sceneNumber, imageUrl: dataUri };
    }),
  );

  return results.map((r, i) =>
    r.status === "fulfilled" ? r.value : { ...illustrations[i], imageUrl: null },
  );
}
