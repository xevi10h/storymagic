import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import Navbar from "@/components/landing/Navbar";
import CustomerReviews from "@/components/reviews/CustomerReviews";
import { ReviewForm, type ReviewPageState } from "@/components/reviews/ReviewForm";
import { summarizeReviews, type PublishedReview } from "@/lib/reviews/review-content";

/**
 * DEV-ONLY visual harness for the review flow with fixture data (404 in production builds).
 * /es/dev/reviews?state=form|reviewed|invalid|unavailable  → the /review page states
 * /es/dev/reviews?state=list                                → the public reviews section
 * Never reads the database; the form POSTs to the real API, which rejects the fake token.
 */
const FIXTURE_REVIEWS: PublishedReview[] = [
  { id: "f1", rating: 5, body: "A la Lucía li encanta veure's dins del conte. El llegim cada nit!", displayName: "Marta G.", locale: "ca", publishedAt: "2026-11-10T09:00:00Z" },
  { id: "f2", rating: 4, body: "Precioso y muy bien impreso. Tardó un par de días más de lo previsto.", displayName: "Jordi P.", locale: "es", publishedAt: "2026-11-08T09:00:00Z" },
  { id: "f3", rating: 5, body: null, displayName: "Anne-Sophie O.", locale: "fr", publishedAt: "2026-11-05T09:00:00Z" },
];

export default async function ReviewsDevPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { locale } = await params;
  setRequestLocale(locale);
  const { state = "form" } = await searchParams;

  if (state === "list") {
    return (
      <>
        <Navbar />
        <main style={{ paddingTop: "var(--landing-nav-h, 56px)" }}>
          <CustomerReviews locale={locale} summary={summarizeReviews([5, 4, 5, 5, 3, 5, 5], FIXTURE_REVIEWS, 6)} />
        </main>
      </>
    );
  }

  const pageState: ReviewPageState =
    state === "invalid" || state === "unavailable" || state === "reviewed"
      ? { kind: state }
      : { kind: "form", token: "dev-fixture", bookTitle: "Lucía y el bosque de las luciérnagas", suggestedName: "Marta G." };
  return (
    <>
      <Navbar />
      <main
        className="flex min-h-[70dvh] flex-col items-center bg-paper px-4 pb-16 sm:px-6"
        style={{ paddingTop: "calc(var(--landing-nav-h, 56px) + 2.5rem)" }}
      >
        <ReviewForm state={pageState} locale={locale} trustpilotUrl="https://www.trustpilot.com/evaluate/example.com" />
      </main>
    </>
  );
}
