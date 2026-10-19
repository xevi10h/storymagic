import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import FinalCta from "@/components/landing/FinalCta";
import MobileStickyCta from "@/components/landing/MobileStickyCta";
import { BreadcrumbJsonLd, FAQJsonLd, GuideArticleJsonLd, ProductJsonLd } from "@/components/seo/JsonLd";
import { FaqSection, GuideSections, RelatedLinks } from "@/components/tools/ToolLanding";
import { GuideHero } from "@/components/seo-guides/GuideParts";
import { Heading } from "@/components/ui";
import { FOUNDER, SITE_URL } from "@/lib/product-facts";
import { GUIDES, GUIDE_LINK_LABELS, isGuideLocale, guideByline } from "@/lib/guides";
import { guideMetadata } from "@/lib/guides-metadata";
import { ABOUT_GUIDE_COPY } from "@/lib/guide-copy/about";
import { guideFacts } from "@/lib/guide-copy/facts";
import { isPhotoUploadEnabled } from "@/lib/privacy/child-photo-policy";
import { CHRISTMAS_DELIVERY_PATH } from "@/lib/shipping";

// "Qué es Meapica": the facts sheet answer engines cite. The FAQ quotes this season's
// Reyes cut-off: refresh daily.
export const revalidate = 86400;

const ID = "about" as const;
const PATH = GUIDES[ID].path;

type PageProps = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return GUIDES[ID].locales.map((locale) => ({ locale }));
}

function copyFor(locale: string) {
  return ABOUT_GUIDE_COPY[locale]?.(guideFacts(locale), { photoUpload: isPhotoUploadEnabled() }) ?? null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return guideMetadata(ID, locale, copyFor(locale));
}

export default async function Page({ params }: PageProps) {
  const { locale } = await params;
  if (!isGuideLocale(ID, locale)) notFound();
  setRequestLocale(locale);
  const copy = copyFor(locale)!;
  const ts = await getTranslations({ locale, namespace: "seo" });
  const tsc = await getTranslations({ locale, namespace: "showcase" });
  const tcd = await getTranslations({ locale, namespace: "christmasDelivery" });
  const tf = await getTranslations({ locale, namespace: "footer" });
  const pageUrl = `${SITE_URL}/${locale}${PATH}`;
  const byline = guideByline(ID, locale, FOUNDER.name);
  // The last section ("Quién está detrás") is the #author anchor the Person JSON-LD points to.
  const sections = copy.sections.slice(0, -1);
  const authorSection = copy.sections[copy.sections.length - 1];

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: ts("common.breadcrumbHome"), url: `${SITE_URL}/${locale}` },
          { name: copy.breadcrumb, url: pageUrl },
        ]}
      />
      <FAQJsonLd questions={copy.faq} />
      <GuideArticleJsonLd id={ID} locale={locale} headline={copy.h1} description={copy.metaDescription} type="AboutPage" />
      <ProductJsonLd locale={locale} url={pageUrl} />
      <Navbar />

      <main>
        <GuideHero
          locale={locale}
          breadcrumbLabel={ts("common.breadcrumbLabel")}
          crumbs={[{ label: ts("common.breadcrumbHome"), href: "/" }, { label: copy.breadcrumb }]}
          eyebrow={copy.eyebrow}
          h1={copy.h1}
          lead={copy.lead}
          cta={{ href: "/create", label: copy.cta }}
          secondary={{ href: "/examples", label: tsc("title") }}
          trust={copy.trust}
        />

        {/* The facts, one per row: what answer engines quote */}
        <section aria-labelledby="about-facts-title" className="border-y border-line bg-surface px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-3xl">
            <Heading id="about-facts-title" as="h2" size="page" className="text-balance">
              {copy.factsHeading}
            </Heading>
            <p className="mt-2 text-sm text-ink-muted">
              <time dateTime={byline.date}>{byline.text}</time>
            </p>
            <dl className="mt-8 divide-y divide-line overflow-hidden rounded-2xl border-2 border-line bg-paper">
              {copy.facts.map((fact) => (
                <div key={fact.term} className="grid gap-1 px-5 py-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6 sm:px-6">
                  <dt className="text-sm font-bold text-ink">{fact.term}</dt>
                  <dd className="break-words text-[15px] leading-relaxed text-ink-body">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="bg-paper px-4 py-16 sm:px-6 sm:py-24">
          <GuideSections sections={sections} />
          <div id="author" className="mt-12 scroll-mt-[calc(var(--landing-nav-h,64px)+1rem)]">
            <GuideSections sections={[authorSection]} />
          </div>
        </section>

        <FaqSection heading={ts("common.faqHeading")} faqs={copy.faq} />

        <RelatedLinks
          heading={copy.relatedHeading}
          links={[
            { href: GUIDES.likeness.path, label: GUIDE_LINK_LABELS.likeness[locale] },
            { href: GUIDES.compare.path, label: GUIDE_LINK_LABELS.compare[locale] },
            { href: GUIDES.catalan.path, label: GUIDE_LINK_LABELS.catalan[locale] },
            { href: "/examples", label: tsc("title") },
            { href: CHRISTMAS_DELIVERY_PATH, label: tcd("footerLink") },
            { href: "/legal", label: tf("legalNotice") },
          ]}
        />

        <FinalCta />
      </main>

      <Footer />
      <MobileStickyCta />
    </>
  );
}
