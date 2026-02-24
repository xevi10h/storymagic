import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import BookCollection from "@/components/landing/BookCollection";
import QualitySection from "@/components/landing/QualitySection";
import AdventurePack from "@/components/landing/AdventurePack";
import Testimonials from "@/components/landing/Testimonials";
import CollectionOffer from "@/components/landing/CollectionOffer";
import Footer from "@/components/landing/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <BookCollection />
        <QualitySection />
        <AdventurePack />
        <Testimonials />
        <CollectionOffer />
      </main>
      <Footer />
    </>
  );
}
