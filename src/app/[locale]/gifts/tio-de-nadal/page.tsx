import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import FinalCta from "@/components/landing/FinalCta";
import MobileStickyCta from "@/components/landing/MobileStickyCta";
import { Link } from "@/i18n/navigation";
import { BreadcrumbJsonLd, FAQJsonLd, ProductJsonLd } from "@/components/seo/JsonLd";
import DeadlineCards from "@/components/seasonal/DeadlineCards";
import ExampleBookCard from "@/components/seo-landing/ExampleBookCard";
import { FaqSection, GuideSections, RelatedLinks } from "@/components/tools/ToolLanding";
import { ExampleCoverFigure, GuideHero } from "@/components/seo-guides/GuideParts";
import { Heading, cx, focusRing } from "@/components/ui";
import { SITE_URL } from "@/lib/product-facts";
import { PREVIEW_ILLUSTRATION_COUNT } from "@/lib/pricing";
import { GUIDES, GUIDE_LINK_LABELS, isGuideLocale } from "@/lib/guides";
import { guideMetadata } from "@/lib/guides-metadata";
import { TIO_GUIDE_COPY } from "@/lib/guide-copy/tio";
import { guideFacts } from "@/lib/guide-copy/facts";
import { seoHubPath, seoPath } from "@/lib/seo-landing";
import { CHRISTMAS_DELIVERY_PATH, spainToday } from "@/lib/shipping";
import { getShowcaseStories, type ShowcaseStory } from "@/lib/showcase";
import { showcasePath } from "@/lib/showcase-slug";
import { toolPath } from "@/lib/tools/registry";
import { LANDING_EXAMPLE, landingExampleBook } from "@/components/landing/HowItWorksExample";
import type { Locale } from "@/i18n/routing";

// The copy quotes this season's Christmas and Reyes cut-offs: refresh daily.
export const revalidate = 86400;

const ID = "tio" as const;
const PATH = GUIDES[ID].path;

type PageProps = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return GUIDES[ID].locales.map((locale) => ({ locale }));
}

function copyFor(locale: string) {
  return TIO_GUIDE_COPY[locale]?.(guideFacts(locale), PREVIEW_ILLUSTRATION_COUNT) ?? null;
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
  const th = await getTranslations({ locale, namespace: "hero" });
  const pageUrl = `${SITE_URL}/${locale}${PATH}`;
  const hubPath = seoHubPath("gifts");
  const hubLabel = ts("nav.giftHeading");

  // Real example books in this language; the hero shows one that is not the landing's Noa.
  let examples: ShowcaseStory[] = [];
  try {
    examples = (await getShowcaseStories(locale)).filter((s) => s.locale === locale);
  } catch {
    // The examples are a bonus: the page stands without them.
  }
  const heroBook = examples.find((s) => s.templateId !== LANDING_EXAMPLE.templateId && s.coverImage);
  const fallbackBook = landingExampleBook(locale);
  // The grid shows the other books (the hero already shows one).
  const gridBooks = examples.filter((s) => s.id !== heroBook?.id).slice(0, 4);

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: ts("common.breadcrumbHome"), url: `${SITE_URL}/${locale}` },
          { name: hubLabel, url: `${SITE_URL}/${locale}${hubPath}` },
          { name: copy.breadcrumb, url: pageUrl },
        ]}
      />
      <FAQJsonLd questions={copy.faq} />
      <ProductJsonLd locale={locale} url={pageUrl} />
      <Navbar />

      <main>
        <GuideHero
          locale={locale}
          breadcrumbLabel={ts("common.breadcrumbLabel")}
          crumbs={[{ label: ts("common.breadcrumbHome"), href: "/" }, { label: hubLabel, href: hubPath }, { label: copy.breadcrumb }]}
          eyebrow={copy.eyebrow}
          h1={copy.h1}
          lead={copy.lead}
          cta={{ href: "/create", label: copy.cta }}
          secondary={{ href: "/examples", label: th("sampleCta") }}
          trust={copy.trust}
          aside={
            <ExampleCoverFigure
              src={heroBook?.coverImage ?? LANDING_EXAMPLE.coverSrc}
              alt={tsc("coverAlt", { title: heroBook?.title ?? fallbackBook.title })}
              href={showcasePath(heroBook?.slug ?? fallbackBook.slug)}
              locale={locale as Locale}
              title={heroBook?.title ?? fallbackBook.title}
              caption={copy.exampleCaption}
            />
          }
        />

        <section className="border-y border-line bg-surface px-4 py-16 sm:px-6 sm:py-24">
          <GuideSections sections={copy.sections} />
        </section>

        {/* This season's order-by dates per format, same cards as /christmas-delivery */}
        <section aria-labelledby="tio-deadlines-title" className="border-b border-line bg-paper px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-[1200px]">
            <Heading id="tio-deadlines-title" as="h2" size="page" subtitle={tcd("formatsSub")} className="mb-8 max-w-2xl text-balance">
              {tcd("formatsHeading")}
            </Heading>
            <DeadlineCards serverToday={spainToday()} />
            <p className="mt-6 max-w-prose text-sm leading-relaxed text-ink-soft">
              {tcd("regionNote")}{" "}
              <Link href={CHRISTMAS_DELIVERY_PATH} className={cx("font-semibold text-brand-text underline decoration-brand/30 underline-offset-4", focusRing)}>
                {tcd("seoCallout")}
              </Link>
            </p>
          </div>
        </section>

        {gridBooks.length > 0 && (
          <section aria-labelledby="tio-examples-title" className="bg-paper px-4 py-16 sm:px-6 sm:py-24">
            <div className="mx-auto max-w-[1200px]">
              <Heading id="tio-examples-title" as="h2" size="page" subtitle={copy.examplesIntro} className="mb-8 max-w-2xl text-balance">
                {copy.examplesHeading}
              </Heading>
              <ul className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4">
                {gridBooks.map((s) => (
                  <li key={s.id}>
                    <ExampleBookCard story={s} headingLevel="h3" />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <FaqSection heading={ts("common.faqHeading")} faqs={copy.faq} />

        <RelatedLinks
          heading={copy.relatedHeading}
          links={[
            { href: seoPath("gifts", "christmas"), label: ts("gifts.christmas.h1") },
            { href: seoPath("gifts", "three-kings"), label: ts("gifts.three-kings.h1") },
            { href: toolPath("letter"), label: (await getTranslations({ locale, namespace: "tools.common" }))("footerLink") },
            { href: GUIDES.catalan.path, label: GUIDE_LINK_LABELS.catalan[locale] },
            { href: GUIDES.catalanAges.path, label: GUIDE_LINK_LABELS.catalanAges[locale] },
            { href: CHRISTMAS_DELIVERY_PATH, label: tcd("footerLink") },
          ]}
        />

        <FinalCta />
      </main>

      <Footer />
      <MobileStickyCta />
    </>
  );
}
