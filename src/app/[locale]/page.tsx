import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import BookCollection from "@/components/landing/BookCollection";
import QualitySection from "@/components/landing/QualitySection";
import UniqueEdition from "@/components/landing/UniqueEdition";
import AdventurePack from "@/components/landing/AdventurePack";
import Testimonials from "@/components/landing/Testimonials";
import CollectionOffer from "@/components/landing/CollectionOffer";
import Footer from "@/components/landing/Footer";
import { OrganizationJsonLd, ProductJsonLd } from "@/components/seo/JsonLd";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function Home({ params }: Props) {
  const { locale } = await params;

  return (
    <>
      <OrganizationJsonLd locale={locale} />
      <ProductJsonLd locale={locale} />
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <BookCollection />
        <QualitySection />
        <UniqueEdition />
        <AdventurePack />
        <Testimonials />
        <CollectionOffer />
      </main>
      <Footer />
    </>
  );
}
