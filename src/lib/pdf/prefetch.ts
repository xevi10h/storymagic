// PDF image pre-fetching utilities
//
// @react-pdf silently fails to render many external image URLs and does not
// support WebP/AVIF. We pre-fetch all images and convert them to base64 data
// URIs so the renderer works reliably regardless of the image host.

import sharp from "sharp";

export interface IllustrationRef {
  sceneNumber: number;
  imageUrl: string | null;
}

export async function prefetchImageAsDataUri(
  url: string,
  timeoutMs = 15000,
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!response.ok) {
      console.warn(`[PDF] Image fetch failed (${response.status}): ${url}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const rawBuffer = Buffer.from(await response.arrayBuffer());

    const needsConversion =
      contentType.includes("webp") ||
      contentType.includes("avif") ||
      contentType.includes("svg") ||
      (!contentType.includes("png") &&
        !contentType.includes("jpeg") &&
        !contentType.includes("jpg"));

    let finalBuffer: Buffer;
    let finalType: string;

    if (needsConversion) {
      console.log(`[PDF] Converting ${contentType} → image/png`);
      finalBuffer = await sharp(rawBuffer).png().toBuffer();
      finalType = "image/png";
    } else {
      finalBuffer = rawBuffer;
      finalType = contentType;
    }

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
          `[PDF] Scene ${ill.sceneNumber}: not available, will render placeholder`,
        );
      }

      return { sceneNumber: ill.sceneNumber, imageUrl: dataUri };
    }),
  );

  return results.map((r, i) =>
    r.status === "fulfilled" ? r.value : illustrations[i],
  );
}
