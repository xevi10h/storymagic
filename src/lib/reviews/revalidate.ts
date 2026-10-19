// Pages that render published reviews (and carry them in the Product JSON-LD) are
// static / ISR: refresh them when a review goes live or is hidden, so a hidden review
// disappears at once and the markup never drifts from what is visible. Never throws.

import { revalidatePath } from "next/cache";

const REVIEW_PAGES = [
  "/[locale]",
  "/[locale]/gifts/[occasion]",
  "/[locale]/personalized-books/[age]",
  "/[locale]/themes/[theme]",
] as const;

export function revalidateReviewPages(): void {
  for (const route of REVIEW_PAGES) {
    try {
      revalidatePath(route, "page");
    } catch (err) {
      console.warn(`[reviews] Could not revalidate ${route}:`, err instanceof Error ? err.message : err);
    }
  }
}
