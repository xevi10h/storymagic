import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { ReviewForm, type ReviewPageState } from "@/components/reviews/ReviewForm";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { resolveBuyerName } from "@/lib/email/notify-order";
import { suggestDisplayName } from "@/lib/reviews/review-content";
import { loadReviewableOrder } from "@/lib/reviews/review-order";
import { reviewKey, verifyReviewToken } from "@/lib/reviews/review-token";
import { TRUSTPILOT_REVIEW_URL } from "@/lib/product-facts";

// Review of one order, from the signed link in the review-request email (no login).
// Private token in the URL: never indexed or cached (middleware adds X-Robots-Tag).
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "review" });
  return {
    title: t("metaTitle"),
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    referrer: "no-referrer",
    alternates: { canonical: null },
  };
}

async function resolveState(token: string | null): Promise<ReviewPageState> {
  let orderId: string | null = null;
  try {
    orderId = verifyReviewToken("review", token, reviewKey("review"));
  } catch {
    orderId = null;
  }
  if (!orderId || !token) return { kind: "invalid" };
  try {
    const supabase = createFulfilmentClient();
    const target = await loadReviewableOrder(supabase, orderId);
    if (target.state === "unavailable") return { kind: "unavailable" };
    if (target.state === "reviewed") return { kind: "reviewed" };
    const buyerName = target.order.userId
      ? await resolveBuyerName(supabase, target.order.userId, target.order.checkoutSessionId).catch(() => null)
      : null;
    return { kind: "form", token, bookTitle: target.bookTitle, suggestedName: suggestDisplayName(buyerName) ?? "" };
  } catch (err) {
    console.error("[review] Could not load the order:", err instanceof Error ? err.message : err);
    return { kind: "unavailable" };
  }
}

export default async function ReviewPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const raw = (await searchParams).t;
  const state = await resolveState(typeof raw === "string" && raw ? raw : null);

  return (
    <>
      <Navbar />
      <main
        className="flex min-h-[70dvh] flex-col items-center bg-paper px-4 pb-16 sm:px-6"
        style={{ paddingTop: "calc(var(--landing-nav-h, 56px) + 2.5rem)" }}
      >
        <ReviewForm state={state} locale={locale} trustpilotUrl={TRUSTPILOT_REVIEW_URL || null} />
      </main>
      <Footer />
    </>
  );
}
