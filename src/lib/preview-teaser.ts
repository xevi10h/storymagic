// End of the free preview: instead of a blank padlock page, the book closes on
// "what's still to come" (the remaining chapter titles over blurred art from the
// book) and, facing it, the printed book with its price and a CTA.
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
 * Replaces the trailing locked teaser page(s) of a preview slice with the two
 * teaser pages. `order` omitted → only the chapters page (e.g. a read-only view).
 * 3 header pages + 6 scene pages + 2 teaser pages = 11: every two-page spread is
 * full on desktop (cover alone, then complete pairs).
 */
export function withTeaserEnd(
  previewPages: BookPage[],
  opts: { scenes: { sceneNumber: number; title: string }[]; characterName: string; order?: TeaserOrder },
): BookPage[] {
  const pages = [...previewPages];
  while (pages.length > 0) {
    const last = pages[pages.length - 1];
    if (last.type === "scene" && last.locked) pages.pop();
    else break;
  }

  const shown = new Set(pages.flatMap((p) => (p.type === "scene" ? [p.scene.sceneNumber] : [])));
  const remaining = opts.scenes.filter((s) => !shown.has(s.sceneNumber)).sort((a, b) => a.sceneNumber - b.sceneNumber);
  if (remaining.length === 0) return pages;

  // Blurred backdrop: the last illustration the reader has just seen.
  const lastArt = [...pages].reverse().find((p): p is Extract<BookPage, { type: "scene" }> => p.type === "scene" && !!p.imageUrl);

  pages.push({
    type: "teaser_chapters",
    chapters: remaining.map((s) => s.title),
    firstChapter: remaining[0].sceneNumber,
    characterName: opts.characterName,
    imageUrl: lastArt?.imageUrl ?? null,
  });
  if (opts.order) pages.push({ type: "teaser_order", ...opts.order });
  return pages;
}
