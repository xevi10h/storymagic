import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import MobileStickyCta from "@/components/landing/MobileStickyCta";
import FaqItem from "@/components/landing/FaqItem";
import FinalCta from "@/components/landing/FinalCta";
import BookCollectionCard from "@/components/landing/BookCollectionCard";
import type { CatalogWorld } from "@/components/landing/BookCollectionData";
import LiveCover from "@/components/crear/LiveCover";
import { BreadcrumbJsonLd, ProductJsonLd } from "@/components/seo/JsonLd";
import { Heading, buttonClass, cx, focusRing } from "@/components/ui";
import { STORY_TEMPLATES } from "@/lib/create-store";
import { getShowcaseStories } from "@/lib/showcase";
import { PRICING, formatPrice } from "@/lib/pricing";
import {
  type SeoPageType,
  featuredTemplateIds,
  relatedSeoPages,
  seoCtaHref,
  seoPath,
  seoHubPath,
  SEO_HUB_HEADING_KEY,
} from "@/lib/seo-landing";
import { CHRISTMAS_DELIVERY_PATH } from "@/lib/shipping";
import { Breadcrumbs, PageHero, kicker, marketingH1, marketingLead } from "./MarketingHeader";

const BASE_URL = "https://meapica.com";

// Conversion-ordered subset of the legal FAQ reused on every SEO page.
const FAQ_ORDER = [2, 3, 1, 4] as const;

// Gift pages that link to the Christmas / Reyes delivery deadlines.
const SEASONAL_GIFT_SLUGS = new Set(["christmas", "three-kings"]);

// Same track as the landing catalog: snap carousel below xl, 4-column grid on wide desktop.
const TRACK =
  "no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:gap-4 sm:px-6 xl:mx-0 xl:grid xl:grid-cols-4 xl:gap-5 xl:overflow-visible xl:px-0 xl:pb-0";
const TRACK_ITEM = "w-[min(78vw,280px)] shrink-0 snap-start xl:w-auto";

type Props = {
  type: SeoPageType;
  slug: string;
  locale: string;
};

export default async function SeoLandingPage({ type, slug, locale }: Props) {
  const t = await getTranslations({ locale, namespace: "seo" });
  const tf = await getTranslations({ locale, namespace: "legal" });
  const tcd = await getTranslations({ locale, namespace: "christmasDelivery" });
  const th = await getTranslations({ locale, namespace: "hero" });
  const tp = await getTranslations({ locale, namespace: "pricing" });

  const k = (field: string) => t(`${type}.${slug}.${field}`);
  const ctaHref = seoCtaHref(type, slug);
  const ctaLabel = th("cta");
  const fromPrice = formatPrice(Math.min(PRICING.softcover.price, PRICING.hardcover.price), locale);

  const featured = featuredTemplateIds(type, slug)
    .map((id) => STORY_TEMPLATES.find((tpl) => tpl.id === id))
    .filter((tpl): tpl is (typeof STORY_TEMPLATES)[number] => Boolean(tpl));

  // Real books painted in each world ("Ver por dentro"), newest first — same data as the landing catalog.
  const showcase = await getShowcaseStories(locale);
  const worlds: CatalogWorld[] = featured.map((template) => {
    const book = showcase.find((s) => s.templateId === template.id && s.coverImage);
    return {
      template,
      example: book ? { id: book.id, templateId: book.templateId, title: book.title, coverImage: book.coverImage } : null,
    };
  });

  const related = relatedSeoPages(type, slug);
  const pageUrl = `${BASE_URL}/${locale}${seoPath(type, slug)}`;
  const hubPath = seoHubPath(type);
  const hubLabel = t(SEO_HUB_HEADING_KEY[type]);
  const heroTemplateId = featured[0]?.id ?? null;

  // benefits is a JSON array — next-intl t.raw returns it as-is
  const benefits = t.raw(`${type}.${slug}.benefits`) as string[];
  const bodyParagraphs = t.raw(`${type}.${slug}.bodyParagraphs`) as string[];

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: t("common.breadcrumbHome"), url: `${BASE_URL}/${locale}` },
          { name: hubLabel, url: `${BASE_URL}/${locale}${hubPath}` },
          { name: k("h1"), url: pageUrl },
        ]}
      />
      <ProductJsonLd locale={locale} />
      <Navbar />

      <main>
        {/* Hero: the promise + the live cover of this world */}
        <PageHero>
          <Breadcrumbs
            label={t("common.breadcrumbLabel")}
            items={[
              { label: t("common.breadcrumbHome"), href: "/" },
              { label: hubLabel, href: hubPath },
              { label: k("h1") },
            ]}
          />

          <div className="mt-4 grid grid-cols-1 items-center gap-8 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="mx-auto w-[52vw] max-w-[220px] lg:order-2 lg:w-full lg:max-w-none">
              <LiveCover name="" templateId={heroTemplateId} priority sizes="(max-width: 1024px) 220px, 420px" />
            </div>

            <div className="lg:order-1">
              <p className={kicker}>{hubLabel}</p>
              <h1 className={cx("mt-2", marketingH1)}>{k("h1")}</h1>
              <p className={cx("mt-4 max-w-xl", marketingLead)}>{k("heroIntro")}</p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link id="hero-cta" href={ctaHref} className={buttonClass({ className: "min-h-14 text-lg! sm:px-8" })}>
                  {ctaLabel}
                  <span aria-hidden className="material-symbols-outlined text-xl transition-transform group-hover:translate-x-1">
                    arrow_forward
                  </span>
                </Link>
                <Link
                  href="/ejemplo"
                  className={cx(
                    "inline-flex min-h-11 items-center justify-center gap-1 self-center rounded-full px-3 text-sm font-semibold text-ink-soft underline decoration-brand/30 underline-offset-4 transition-colors hover:text-brand-text sm:self-auto",
                    focusRing,
                  )}
                >
                  {th("sampleCta")}
                </Link>
              </div>

              <p className="mt-3 text-center text-sm text-ink-soft sm:text-left">
                <span className="font-bold tabular-nums text-brand-deep">{th("priceFrom", { price: fromPrice })}</span>
                <span> · {tp("vatIncluded")}</span>
                <span> · {th("freeShipping")}</span>
              </p>

              <ul className="mt-6 flex flex-col gap-2.5 border-t border-line pt-5 text-sm text-ink-soft sm:flex-row sm:flex-wrap sm:gap-x-6">
                {[th("trustPreview"), th("trustFormats")].map((line) => (
                  <li key={line} className="flex items-center gap-2">
                    <span aria-hidden className="material-symbols-outlined !text-xl text-brand">
                      check_circle
                    </span>
                    {line}
                  </li>
                ))}
              </ul>

              {type === "gifts" && SEASONAL_GIFT_SLUGS.has(slug) && (
                <Link
                  href={CHRISTMAS_DELIVERY_PATH}
                  className={cx(
                    "mt-5 inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-ink-soft underline decoration-brand/30 underline-offset-4 transition-colors hover:text-brand-text",
                    focusRing,
                  )}
                >
                  <span aria-hidden className="material-symbols-outlined !text-xl text-success">
                    local_shipping
                  </span>
                  {tcd("seoCallout")}
                </Link>
              )}
            </div>
          </div>
        </PageHero>

        {/* Body copy + what makes it special */}
        <section aria-labelledby="seo-body-title" className="border-y border-line bg-surface px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16">
            <div>
              <Heading id="seo-body-title" as="h2" size="page" className="max-w-2xl text-balance">
                {k("bodyHeading")}
              </Heading>
              <div className="mt-6 flex max-w-prose flex-col gap-5">
                {bodyParagraphs.map((p, i) => (
                  <p key={i} className="text-base leading-relaxed text-ink-body sm:text-lg sm:leading-[1.75]">
                    {p}
                  </p>
                ))}
              </div>
            </div>
            <aside className="self-start rounded-2xl border-2 border-line bg-paper p-6 sm:p-7">
              <h3 className="font-display text-lg font-semibold leading-snug text-ink sm:text-xl">{k("benefitsHeading")}</h3>
              <ul className="mt-4 flex flex-col gap-3.5">
                {benefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-3 text-[15px] leading-snug text-ink-soft">
                    <span aria-hidden className="material-symbols-outlined mt-px !text-xl shrink-0 text-brand">
                      check_circle
                    </span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </section>

        {/* Worlds for this page, same cards as the landing catalog */}
        <section aria-labelledby="seo-featured-title" className="bg-paper px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-[1200px]">
            <Heading
              id="seo-featured-title"
              as="h2"
              size="page"
              subtitle={t("common.featuredSubheading")}
              className="mb-8 max-w-2xl text-balance"
            >
              {t("common.featuredHeading")}
            </Heading>
            <div className={TRACK}>
              {worlds.map((world) => (
                <BookCollectionCard key={world.template.id} world={world} fromPrice={fromPrice} className={TRACK_ITEM} />
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section aria-labelledby="seo-faq-title" className="bg-paper px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="mx-auto max-w-3xl">
            <Heading id="seo-faq-title" as="h2" size="page" className="mb-8 text-balance text-center">
              {t("common.faqHeading")}
            </Heading>
            <div className="divide-y divide-line overflow-hidden rounded-2xl border-2 border-line bg-surface">
              {FAQ_ORDER.map((n) => (
                <FaqItem key={n} question={tf(`faq.section${n}Title`)} answer={tf(`faq.section${n}Text`)} />
              ))}
            </div>
          </div>
        </section>

        {/* Related pages — internal linking */}
        <section aria-labelledby="seo-related-title" className="border-y border-line bg-surface px-4 py-14 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-[1200px]">
            <Heading id="seo-related-title" as="h2" size="section" className="mb-5">
              {t("common.relatedHeading")}
            </Heading>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <li key={`${p.type}-${p.slug}`}>
                  <Link
                    href={seoPath(p.type, p.slug)}
                    className={cx(
                      "group flex min-h-14 items-center justify-between gap-3 rounded-2xl border-2 border-line bg-paper px-5 py-3 font-display text-base font-semibold leading-snug text-ink transition-colors hover:border-brand/40",
                      focusRing,
                    )}
                  >
                    <span className="min-w-0">{t(`${p.type}.${p.slug}.h1`)}</span>
                    <span
                      aria-hidden
                      className="material-symbols-outlined !text-xl shrink-0 text-ink-muted transition-transform group-hover:translate-x-1 group-hover:text-brand-text"
                    >
                      arrow_forward
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <FinalCta />
      </main>

      <Footer />
      <MobileStickyCta />
    </>
  );
}
