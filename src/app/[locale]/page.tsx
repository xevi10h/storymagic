import type { Metadata } from "next";
import { cookies } from "next/headers";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import Moments from "@/components/landing/Moments";
import BookCollection from "@/components/landing/BookCollection";
import QualitySection from "@/components/landing/QualitySection";
import UniqueEdition from "@/components/landing/UniqueEdition";
import AdventurePack from "@/components/landing/AdventurePack";
import FaqSection from "@/components/landing/FaqSection";
import WhatIsSection from "@/components/landing/WhatIsSection";
import FinalCta from "@/components/landing/FinalCta";
import Footer from "@/components/landing/Footer";
import MobileStickyCta from "@/components/landing/MobileStickyCta";
import WaitlistPage from "@/components/waitlist/WaitlistPage";
import { OrganizationJsonLd, ProductJsonLd } from "@/components/seo/JsonLd";
import DevResetCreateState from "@/components/dev/DevResetCreateState";
import CustomerReviews from "@/components/reviews/CustomerReviews";
import { ADDON_ENABLED } from "@/lib/pricing";
import { getReviewSummary } from "@/lib/reviews/published";
import { SITE_URL } from "@/lib/product-facts";

// The FAQ quotes this season's Christmas/Reyes order cut-offs (depend on "today"):
// re-render at most hourly, like /christmas-delivery.
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
};

/** Canonical + hreflang of the home (title, description and OG come from the locale layout). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const languages: Record<string, string> = {};
  for (const loc of routing.locales) languages[loc] = `${SITE_URL}/${loc}`;
  languages["x-default"] = `${SITE_URL}/${routing.defaultLocale}`;
  return { alternates: { canonical: `${SITE_URL}/${locale}`, languages } };
}

export default async function Home({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Waitlist mode: show waitlist unless user has access cookie
  const isWaitlistMode = process.env.WAITLIST_MODE === "true";
  if (isWaitlistMode) {
    const cookieStore = await cookies();
    const hasAccess =
      cookieStore.get("meapica_access")?.value ===
      process.env.WAITLIST_ACCESS_CODE;

    if (!hasAccess) {
      return <WaitlistPage />;
    }
  }

  // Real published reviews: shown on the page AND in the Product markup (same data).
  const reviews = await getReviewSummary();

  return (
    <>
      <DevResetCreateState />
      <OrganizationJsonLd locale={locale} />
      <ProductJsonLd locale={locale} reviews={reviews} />
      <Navbar />
      <main>
        {/* Conversion order: promise → how → what the gift really is → pick a story → proof it is theirs →
            the physical book → what a personalised story is (the head term, server-rendered) →
            objections (FAQ) → close with their name. */}
        <Hero />
        <HowItWorks />
        <Moments />
        <BookCollection />
        <UniqueEdition />
        <QualitySection />
        {ADDON_ENABLED.adventure_pack && <AdventurePack />}
        <CustomerReviews locale={locale} summary={reviews} />
        <WhatIsSection locale={locale} />
        <FaqSection />
        <FinalCta />
      </main>
      <Footer />
      <MobileStickyCta />
    </>
  );
}
