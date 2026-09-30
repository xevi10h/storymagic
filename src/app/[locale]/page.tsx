import { cookies } from "next/headers";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import BookCollection from "@/components/landing/BookCollection";
import QualitySection from "@/components/landing/QualitySection";
import UniqueEdition from "@/components/landing/UniqueEdition";
import AdventurePack from "@/components/landing/AdventurePack";
import FaqSection from "@/components/landing/FaqSection";
import FinalCta from "@/components/landing/FinalCta";
import Footer from "@/components/landing/Footer";
import MobileStickyCta from "@/components/landing/MobileStickyCta";
import WaitlistPage from "@/components/waitlist/WaitlistPage";
import { OrganizationJsonLd, ProductJsonLd } from "@/components/seo/JsonLd";
import DevResetCreateState from "@/components/dev/DevResetCreateState";
import { ADDON_ENABLED } from "@/lib/pricing";

// The FAQ quotes this season's Christmas/Reyes order cut-offs (depend on "today"):
// re-render at most hourly, like /christmas-delivery.
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function Home({ params }: Props) {
  const { locale } = await params;

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

  return (
    <>
      <DevResetCreateState />
      <OrganizationJsonLd locale={locale} />
      <ProductJsonLd locale={locale} />
      <Navbar />
      <main>
        {/* Conversion order: promise → how → pick a story → proof it is theirs →
            the physical book → objections (FAQ) → close with their name. */}
        <Hero />
        <HowItWorks />
        <BookCollection />
        <UniqueEdition />
        <QualitySection />
        {ADDON_ENABLED.adventure_pack && <AdventurePack />}
        <FaqSection />
        <FinalCta />
      </main>
      <Footer />
      <MobileStickyCta />
    </>
  );
}
