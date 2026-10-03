import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import FinalCta from "@/components/landing/FinalCta";
import MobileStickyCta from "@/components/landing/MobileStickyCta";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { BreadcrumbJsonLd, FAQJsonLd } from "@/components/seo/JsonLd";
import { FaqSection, GuideSections, RelatedLinks } from "@/components/tools/ToolLanding";
import { GuideCtaBand, GuideHero, type GuideCta } from "@/components/seo-guides/GuideParts";
import { SITE_URL } from "@/lib/product-facts";
import { GUIDES, GUIDE_LINK_LABELS, isGuideLocale } from "@/lib/guides";
import { guideMetadata } from "@/lib/guides-metadata";
import { CATALAN_GUIDE_COPY } from "@/lib/guide-copy/catalan";
import { guideFacts } from "@/lib/guide-copy/facts";
import { toolPath } from "@/lib/tools/registry";
import { LANDING_EXAMPLE, landingExampleBook } from "@/components/landing/HowItWorksExample";
import { showcasePath } from "@/lib/showcase-slug";
import { cx, focusRing } from "@/components/ui";

// The copy quotes this season's Reyes cut-off: refresh daily.
export const revalidate = 86400;

const ID = "catalan" as const;
const PATH = GUIDES[ID].path;

type PageProps = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return GUIDES[ID].locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const copy = CATALAN_GUIDE_COPY[locale]?.(guideFacts(locale)) ?? null;
  return guideMetadata(ID, locale, copy);
}

export default async function Page({ params }: PageProps) {
  const { locale } = await params;
  if (!isGuideLocale(ID, locale)) notFound();
  setRequestLocale(locale);
  const copy = CATALAN_GUIDE_COPY[locale](guideFacts(locale));
  const ts = await getTranslations({ locale, namespace: "seo" });
  const tsc = await getTranslations({ locale, namespace: "showcase" });
  const tt = await getTranslations({ locale, namespace: "tools.common" });
  const th = await getTranslations({ locale, namespace: "hero" });

  // The book is written in the site's language: the Spanish page creates it on the Catalan site.
  const cta: GuideCta = locale === "ca" ? { href: "/create", label: copy.cta } : { href: "/create", label: copy.cta, locale: "ca", note: copy.ctaNote };
  const pageUrl = `${SITE_URL}/${locale}${PATH}`;
  const caExample = landingExampleBook("ca");

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: ts("common.breadcrumbHome"), url: `${SITE_URL}/${locale}` },
          { name: copy.hubCrumb, url: `${SITE_URL}/${locale}/personalized-books` },
          { name: copy.breadcrumb, url: pageUrl },
        ]}
      />
      <FAQJsonLd questions={copy.faq} />
      <Navbar />

      <main>
        <GuideHero
          locale={locale}
          breadcrumbLabel={ts("common.breadcrumbLabel")}
          crumbs={[
            { label: ts("common.breadcrumbHome"), href: "/" },
            { label: copy.hubCrumb, href: "/personalized-books" },
            { label: copy.breadcrumb },
          ]}
          eyebrow={copy.eyebrow}
          h1={copy.h1}
          lead={copy.lead}
          cta={cta}
          secondary={{ href: "/examples", label: th("sampleCta") }}
          trust={copy.trust}
          aside={
            // A real book of the showcase, in its Catalan edition (/examples/{slug} on the ca site).
            <figure className="mx-auto w-[60vw] max-w-[240px] lg:w-full lg:max-w-[400px]">
              <div className="relative aspect-square overflow-hidden rounded-xl border border-line bg-line shadow-sm">
                <Image src={LANDING_EXAMPLE.coverSrc} alt="" fill priority sizes="(max-width: 1024px) 240px, 400px" className="object-cover" />
              </div>
              <figcaption className="mt-3 text-center text-sm leading-snug text-ink-muted">
                <Link
                  href={showcasePath(caExample.slug)}
                  locale="ca"
                  className={cx("font-semibold text-ink-soft underline decoration-brand/30 underline-offset-4 hover:text-brand-text", focusRing)}
                >
                  «{caExample.title}»
                </Link>
                {" "}
                {copy.exampleCaption}
              </figcaption>
            </figure>
          }
        />

        <section className="border-y border-line bg-surface px-4 py-16 sm:px-6 sm:py-24">
          <GuideSections sections={copy.sections} />
        </section>

        <FaqSection heading={ts("common.faqHeading")} faqs={copy.faq} />

        <RelatedLinks
          heading={copy.relatedHeading}
          links={[
            { href: "/gifts/sant-jordi", label: ts("gifts.sant-jordi.h1") },
            { href: "/gifts/three-kings", label: ts("gifts.three-kings.h1") },
            { href: toolPath("letter"), label: tt("footerLink") },
            { href: GUIDES.likeness.path, label: GUIDE_LINK_LABELS.likeness[locale] },
            { href: GUIDES.compare.path, label: GUIDE_LINK_LABELS.compare[locale] },
            { href: "/examples", label: tsc("title") },
          ]}
        />

        {locale === "ca" || !copy.closing ? <FinalCta /> : <GuideCtaBand locale={locale} {...copy.closing} cta={cta} />}
      </main>

      <Footer />
      {/* The sticky bar opens /create in the current locale: only where that is the Catalan site. */}
      {locale === "ca" && <MobileStickyCta />}
    </>
  );
}
