// Review content rules (pure, no imports: checked by src/lib/reviews/reviews.check.mjs).
// Shared by the review form (client), POST /api/reviews and the public read side.

export const REVIEW_BODY_MAX = 1000;
export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 40;
export const REVIEW_LOCALES = ["es", "ca", "en", "fr"] as const;
export type ReviewLocale = (typeof REVIEW_LOCALES)[number];

export interface ReviewInput {
  rating: number;
  body: string | null;
  displayName: string;
  publishConsent: boolean;
}

export type ReviewInputError = "rating" | "body" | "display_name";

// Letters (any script), spaces, dots, apostrophes and hyphens: "Marta G.", "Jordi i Anna", "O'Neill".
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u;
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
// A URL scheme or "www." in any case, or a bare lowercase domain ("tienda.com").
const LINK_RE = /https?:\/\/|www\./i;
const DOMAIN_RE = /\b[a-z0-9-]{2,}\.(com|es|cat|net|org|shop|io|fr)\b/;

/** Validate + normalise what the form sent. */
export function parseReviewInput(raw: {
  rating: unknown;
  body?: unknown;
  displayName: unknown;
  publishConsent?: unknown;
}): { ok: true; value: ReviewInput } | { ok: false; error: ReviewInputError } {
  const rating = typeof raw.rating === "number" ? raw.rating : Number.NaN;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, error: "rating" };

  let body: string | null = null;
  if (raw.body !== undefined && raw.body !== null) {
    if (typeof raw.body !== "string") return { ok: false, error: "body" };
    const cleaned = raw.body.replace(CONTROL_RE, "").replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if ([...cleaned].length > REVIEW_BODY_MAX) return { ok: false, error: "body" };
    body = cleaned || null;
  }

  if (typeof raw.displayName !== "string") return { ok: false, error: "display_name" };
  const displayName = raw.displayName.replace(/\s+/g, " ").trim();
  const nameLength = [...displayName].length;
  if (nameLength < DISPLAY_NAME_MIN || nameLength > DISPLAY_NAME_MAX || !NAME_RE.test(displayName)) {
    return { ok: false, error: "display_name" };
  }

  return { ok: true, value: { rating, body, displayName, publishConsent: raw.publishConsent === true } };
}

/**
 * Publish rule (owner decision 2026-10-19): any rating with the customer's consent goes
 * live at once. Held as pending (owner decides) only when the text carries a link,
 * the usual shape of spam.
 */
export function initialReviewStatus(input: ReviewInput): "published" | "pending" {
  if (!input.publishConsent) return "pending";
  return input.body && (LINK_RE.test(input.body) || DOMAIN_RE.test(input.body)) ? "pending" : "published";
}

/** Suggested display name: "Marta García López" → "Marta G."; one word → itself; null when unusable. */
export function suggestDisplayName(fullName: string | null | undefined): string | null {
  const words = (fullName ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length === 0) return null;
  const first = words[0];
  const initial = words[1] ? ` ${[...words[1]][0].toLocaleUpperCase()}.` : "";
  const name = `${first}${initial}`;
  return NAME_RE.test(name) && [...name].length <= DISPLAY_NAME_MAX && [...name].length >= DISPLAY_NAME_MIN ? name : null;
}

export function asReviewLocale(locale: string): ReviewLocale {
  return (REVIEW_LOCALES as readonly string[]).includes(locale) ? (locale as ReviewLocale) : "es";
}

// ── Public read side ───────────────────────────────────────────────────────────

export interface PublishedReview {
  id: string;
  rating: number;
  body: string | null;
  displayName: string;
  locale: string;
  publishedAt: string;
}

/** What a page shows: the average + count over ALL published reviews, and the newest few in full. */
export interface ReviewSummary {
  count: number;
  /** Average rating, one decimal (e.g. 4.7). */
  average: number;
  /** Newest published reviews, the ones rendered on the page (and in the markup). */
  shown: PublishedReview[];
}

export const EMPTY_REVIEW_SUMMARY: ReviewSummary = { count: 0, average: 0, shown: [] };

export function summarizeReviews(ratings: readonly number[], newest: readonly PublishedReview[], showLimit: number): ReviewSummary {
  const valid = ratings.filter((r) => Number.isInteger(r) && r >= 1 && r <= 5);
  if (valid.length === 0) return EMPTY_REVIEW_SUMMARY;
  const average = Math.round((valid.reduce((s, r) => s + r, 0) / valid.length) * 10) / 10;
  return { count: valid.length, average, shown: newest.slice(0, showLimit) };
}

/**
 * schema.org fields for the Product: ONLY real published reviews that the same page
 * renders visibly (Google review snippet rules). No reviews → no fields at all.
 */
export function productReviewMarkup(summary: ReviewSummary | null | undefined): Record<string, unknown> {
  if (!summary || summary.count < 1 || summary.shown.length < 1) return {};
  return {
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: summary.average.toFixed(1),
      reviewCount: summary.count,
      bestRating: 5,
      worstRating: 1,
    },
    review: summary.shown.map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.displayName },
      datePublished: r.publishedAt.slice(0, 10),
      inLanguage: r.locale,
      reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      ...(r.body ? { reviewBody: r.body } : {}),
    })),
  };
}
