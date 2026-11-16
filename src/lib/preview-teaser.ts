// End of the free preview: after the last scene (the whole story is readable, only the
// first scenes are illustrated) the book closes on "the illustrations still to paint"
// (the chapters whose art is painted after ordering, over blurred art from the book)
// and, facing it, the printed book with its price and a CTA.
// Pure: client- and server-safe.

import type { BookPage } from "@/components/book-viewer/types";

export interface TeaserOrder {
  title: string;
  characterName: string;
  coverUrl: string | null;
  format: "hardcover" | "softcover" | "pdf";
  priceFrom: string;
}

/**
 * Appends the two teaser pages to a preview slice (toPreviewPages). `order` omitted →
 * only the illustrations page (e.g. a read-only view).
 * 3 header pages + 24 scene pages + 2 teaser pages = 29: every two-page spread is full
 * on desktop (cover alone, then complete pairs).
 */
export function withTeaserEnd(previewPages: BookPage[], opts: { characterName: string; order?: TeaserOrder }): BookPage[] {
  const pages = [...previewPages];

  // The chapters whose illustration is still to paint, once each, in book order.
  const toPaint: { sceneNumber: number; title: string }[] = [];
  for (const p of pages) {
    if (p.type !== "scene" || !p.locked || toPaint.some((s) => s.sceneNumber === p.scene.sceneNumber)) continue;
    toPaint.push({ sceneNumber: p.scene.sceneNumber, title: p.scene.title });
  }

  if (toPaint.length > 0) {
    // Blurred backdrop: the last illustration the reader has seen.
    const lastArt = [...pages].reverse().find((p): p is Extract<BookPage, { type: "scene" }> => p.type === "scene" && !!p.imageUrl);
    pages.push({
      type: "teaser_paint",
      chapters: toPaint,
      characterName: opts.characterName,
      imageUrl: lastArt?.imageUrl ?? null,
    });
  }
  if (opts.order) pages.push({ type: "teaser_order", ...opts.order });
  return pages;
}
