import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import FinalCta from "@/components/landing/FinalCta";
import MobileStickyCta from "@/components/landing/MobileStickyCta";
import { Link } from "@/i18n/navigation";
import { BreadcrumbJsonLd, FAQJsonLd, ProductJsonLd } from "@/components/seo/JsonLd";
import ExampleBookCard from "@/components/seo-landing/ExampleBookCard";
import { kicker } from "@/components/seo-landing/MarketingHeader";
import { FaqSection, GuideSections, RelatedLinks } from "@/components/tools/ToolLanding";
import { GuideHero } from "@/components/seo-guides/GuideParts";
import { cx, focusRing } from "@/components/ui";
import { STORY_TEMPLATES } from "@/lib/create-store";
import { AGE_BANDS, SITE_URL, ageBandSlug } from "@/lib/product-facts";
import { PREVIEW_ILLUSTRATION_COUNT } from "@/lib/pricing";
import { GUIDES, GUIDE_LINK_LABELS, isGuideLocale } from "@/lib/guides";
import { guideMetadata } from "@/lib/guides-metadata";
import { CATALAN_AGES_GUIDE_COPY } from "@/lib/guide-copy/catalan-ages";
import { guideFacts } from "@/lib/guide-copy/facts";
import { featuredTemplateIds, seoPath, themeSlugForTemplate } from "@/lib/seo-landing";
import { getShowcaseStories, type ShowcaseStory } from "@/lib/showcase";

// Prices and age ranges come from product-facts: static is fine, refresh daily anyway.
export const revalidate = 86400;

const ID = "catalanAges" as const;
const PATH = GUIDES[ID].path;

type PageProps = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return GUIDES[ID].locales.map((locale) => ({ locale }));
}

function copyFor(locale: string) {
  return CATALAN_AGES_GUIDE_COPY[locale]?.(guideFacts(locale), PREVIEW_ILLUSTRATION_COUNT) ?? null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return guideMetadata(ID, locale, copyFor(locale));
}

const worldChip = "inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-line bg-paper px-4 text-sm font-semibold text-ink-soft";

export default async function Page({ params }: PageProps) {
  const { locale } = await params;
  if (!isGuideLocale(ID, locale)) notFound();
  setRequestLocale(locale);
  const copy = copyFor(locale)!;
  const ts = await getTranslations({ locale, namespace: "seo" });
  const td = await getTranslations({ locale, namespace: "data" });
  const tsc = await getTranslations({ locale, namespace: "showcase" });
  const th = await getTranslations({ locale, namespace: "hero" });
  const pageUrl = `${SITE_URL}/${locale}${PATH}`;

  // Real example books in this language, by the age band of the child they were made for.
  let examples: ShowcaseStory[] = [];
  try {
    examples = (await getShowcaseStories(locale)).filter((s) => s.locale === locale);
  } catch {
    // The examples are a bonus: the page stands without them.
  }

  const bands = AGE_BANDS.map((band) => ({
    slug: band.slug,
    copy: copy.bands[band.slug],
    // Worlds whose own age range touches the band (same rule as /personalized-books/{band}).
    worlds: featuredTemplateIds("ages", band.slug)
      .map((id) => STORY_TEMPLATES.find((tpl) => tpl.id === id))
      .filter((tpl): tpl is (typeof STORY_TEMPLATES)[number] => Boolean(tpl)),
    examples: examples.filter((s) => ageBandSlug(s.characterAge) === band.slug).slice(0, 2),
  }));

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: ts("common.breadcrumbHome"), url: `${SITE_URL}/${locale}` },
          { name: copy.hubCrumb, url: `${SITE_URL}/${locale}/personalized-books` },
          { name: copy.parentCrumb, url: `${SITE_URL}/${locale}${GUIDES.catalan.path}` },
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
          crumbs={[
            { label: ts("common.breadcrumbHome"), href: "/" },
            { label: copy.hubCrumb, href: "/personalized-books" },
            { label: copy.parentCrumb, href: GUIDES.catalan.path },
            { label: copy.breadcrumb },
          ]}
          eyebrow={copy.eyebrow}
          h1={copy.h1}
          lead={copy.lead}
          cta={{ href: "/create", label: copy.cta }}
          secondary={{ href: "/examples", label: th("sampleCta") }}
          trust={copy.trust}
        />

        {bands.map((band, i) => (
          <section
            key={band.slug}
            aria-labelledby={`band-${band.slug}-title`}
            className={cx("border-t border-line px-4 py-16 sm:px-6 sm:py-24", i % 2 === 0 ? "bg-surface" : "bg-paper")}
          >
            <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-16">
              <div className="max-w-prose">
                <p className={kicker}>{band.copy.stage}</p>
                <h2 id={`band-${band.slug}-title`} className="mt-2 text-balance font-display text-[26px] font-bold leading-tight text-ink sm:text-4xl">
                  {band.copy.heading}
                </h2>
                <div className="mt-5 flex flex-col gap-4">
                  {band.copy.paragraphs.map((p, j) => (
                    <p key={j} className="text-base leading-relaxed text-ink-body sm:text-lg sm:leading-[1.75]">
                      {p}
                    </p>
                  ))}
                </div>

                <h3 className="mt-8 text-xs font-bold uppercase tracking-wide text-ink-soft">{copy.worldsLabel}</h3>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {band.worlds.map((world) => {
                    const theme = themeSlugForTemplate(world.id);
                    const label = (
                      <>
                        {td(`templates.${world.id}.title`)}
                        <span className="font-medium tabular-nums text-ink-muted">{td("ageRange", { min: world.ageMin, max: world.ageMax })}</span>
                      </>
                    );
                    return (
                      <li key={world.id}>
                        {theme ? (
                          <Link href={seoPath("themes", theme)} className={cx(worldChip, "transition-colors hover:border-brand/40 hover:text-brand-text", focusRing)}>
                            {label}
                          </Link>
                        ) : (
                          <span className={worldChip}>{label}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>

                <Link
                  href={seoPath("ages", band.slug)}
                  className={cx(
                    "mt-6 inline-flex min-h-11 items-center gap-1 rounded-md text-base font-semibold text-brand-text underline decoration-brand/30 underline-offset-4",
                    focusRing,
                  )}
                >
                  {ts(`ages.${band.slug}.h1`)}
                  <span aria-hidden className="material-symbols-outlined !text-lg">
                    arrow_forward
                  </span>
                </Link>
              </div>

              {band.examples.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-ink-soft">{copy.exampleLabel}</h3>
                  <ul className="mt-3 grid grid-cols-2 gap-3 sm:gap-4">
                    {band.examples.map((s) => (
                      <li key={s.id}>
                        <ExampleBookCard story={s} headingLevel="h3" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        ))}

        <section className="border-y border-line bg-paper px-4 py-16 sm:px-6 sm:py-24">
          <GuideSections sections={copy.sections} />
        </section>

        <FaqSection heading={ts("common.faqHeading")} faqs={copy.faq} />

        <RelatedLinks
          heading={copy.relatedHeading}
          links={[
            { href: GUIDES.catalan.path, label: GUIDE_LINK_LABELS.catalan[locale] },
            { href: "/personalized-books", label: ts("hubs.ages.h1") },
            { href: seoPath("gifts", "sant-jordi"), label: ts("gifts.sant-jordi.h1") },
            { href: GUIDES.tio.path, label: GUIDE_LINK_LABELS.tio[locale] },
            { href: GUIDES.likeness.path, label: GUIDE_LINK_LABELS.likeness[locale] },
            { href: "/examples", label: tsc("title") },
          ]}
        />

        <FinalCta />
      </main>

      <Footer />
      <MobileStickyCta />
    </>
  );
}
