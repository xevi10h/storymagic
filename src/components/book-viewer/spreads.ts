// Two-page spreads, as the book is printed and as react-pageflip pairs pages with
// showCover: the cover alone on the right, then (1,2), (3,4)… and a lone last page on the
// left when the count is even. Pure helpers shared by the flipbook and the fullscreen viewer.

/** Pages shown together with page `index` (1 or 2 indexes, ascending). */
export function spreadPages(index: number, total: number): number[] {
  if (total <= 0) return [];
  const i = Math.max(0, Math.min(total - 1, index));
  if (i === 0) return [0];
  const left = i % 2 === 1 ? i : i - 1;
  return left + 1 < total ? [left, left + 1] : [left];
}

/** 0-based spread number of page `index`. */
export function spreadIndexOf(index: number, total: number): number {
  const i = Math.max(0, Math.min(total - 1, index));
  return i === 0 ? 0 : Math.floor((i - 1) / 2) + 1;
}

export function spreadCount(total: number): number {
  return total <= 0 ? 0 : 1 + Math.ceil((total - 1) / 2);
}

/** First page of spread number `spread`. */
export function spreadStart(spread: number): number {
  return spread <= 0 ? 0 : spread * 2 - 1;
}

/** "2–3 / 11" (or "1 / 11" for a lone page), 1-based. */
export function spreadLabel(index: number, total: number): string {
  const pages = spreadPages(index, total);
  const range = pages.length === 2 ? `${pages[0] + 1}–${pages[1] + 1}` : `${pages[0] + 1}`;
  return `${range} / ${total}`;
}
