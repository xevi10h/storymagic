import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import MobileStickyCta from "@/components/landing/MobileStickyCta";
import FaqItem from "@/components/landing/FaqItem";
import FinalCta from "@/components/landing/FinalCta";
import BookCollectionCard from "@/components/landing/BookCollectionCard";
import type { CatalogWorld } from "@/components/landing/BookCollectionData";
import LiveCover from "@/components/create/LiveCover";
import { BreadcrumbJsonLd, FAQJsonLd } from "@/components/seo/JsonLd";
import DeadlineCards from "@/components/seasonal/DeadlineCards";
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
import { CHRISTMAS_DELIVERY_PATH, earliestPrintedCutoff, spainToday } from "@/lib/shipping";
import { factParams } from "@/lib/product-facts";
import { Breadcrumbs, PageHero, kicker, marketingH1, marketingLead } from "./MarketingHeader";

const BASE_URL = "https://meapica.shop";

// Fallback only: a page without its own `faq` block shows this subset of the legal FAQ.
const FALLBACK_FAQ_ORDER = [2, 3, 1, 4] as const;
// Each page carries its own questions: seo.{type}.{slug}.faq.q1/a1 … q4/a4.
const PAGE_FAQ_SLOTS = [1, 2, 3, 4] as const;
const INTL_LOCALE: Record<string, string> = { es: "es-ES", ca: "ca-ES", en: "en-GB", fr: "fr-FR" };

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

  // Every field may quote product facts ({ageMin}, {hardcover}…); unused params are ignored.
  const facts = factParams((cents) => formatPrice(cents, locale));
  const k = (field: string) => t(`${type}.${slug}.${field}`, facts);
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

  // Per-page FAQ. Answers may quote product facts and this season's order-by dates.
  const today = spainToday();
  const cutoffDate = (occasion: "christmas" | "reyes") =>
    new Intl.DateTimeFormat(INTL_LOCALE[locale] ?? "es-ES", { timeZone: "UTC", day: "numeric", month: "long" }).format(
      new Date(`${earliestPrintedCutoff(today, occasion)}T00:00:00Z`),
    );
  const faqValues = {
    ...facts,
    christmasDate: cutoffDate("christmas"),
    reyesDate: cutoffDate("reyes"),
  };
  const pageFaq = PAGE_FAQ_SLOTS.filter((n) => t.has(`${type}.${slug}.faq.q${n}`)).map((n) => ({
    question: t(`${type}.${slug}.faq.q${n}`, faqValues),
    answer: t(`${type}.${slug}.faq.a${n}`, faqValues),
  }));
  const faqs =
    pageFaq.length > 0
      ? pageFaq
      : FALLBACK_FAQ_ORDER.map((n) => ({ question: tf(`faq.section${n}Title`), answer: tf(`faq.section${n}Text`, faqValues) }));
  const isSeasonal = type === "gifts" && SEASONAL_GIFT_SLUGS.has(slug);

  const related = relatedSeoPages(type, slug);
  const pageUrl = `${BASE_URL}/${locale}${seoPath(type, slug)}`;
  const hubPath = seoHubPath(type);
  const hubLabel = t(SEO_HUB_HEADING_KEY[type]);
  const heroTemplateId = featured[0]?.id ?? null;

  // Arrays are read with t.raw for their length, then each item is formatted (facts as ICU params).
  const list = (key: string) =>
    (t.raw(`${type}.${slug}.${key}`) as string[]).map((_, i) => t(`${type}.${slug}.${key}.${i}`, faqValues));
  const benefits = list("benefits");
  const bodyParagraphs = list("bodyParagraphs");
  // Optional long-form guide under the body copy: seo.{type}.{slug}.sections = [{ heading, paragraphs[] }].
  const sections = t.has(`${type}.${slug}.sections`)
    ? (t.raw(`${type}.${slug}.sections`) as { heading: string; paragraphs: string[] }[]).map((sec, i) => ({
        heading: t(`${type}.${slug}.sections.${i}.heading`, faqValues),
        paragraphs: sec.paragraphs.map((_, j) => t(`${type}.${slug}.sections.${i}.paragraphs.${j}`, faqValues)),
      }))
    : [];

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: t("common.breadcrumbHome"), url: `${BASE_URL}/${locale}` },
          { name: hubLabel, url: `${BASE_URL}/${locale}${hubPath}` },
          { name: k("h1"), url: pageUrl },
        ]}
      />
      <FAQJsonLd questions={faqs} />
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
                <Link id="hero-cta" href={ctaHref} className={buttonClass({ className: "min-h-14 sm:px-8" })}>
                  {ctaLabel}
                  <span aria-hidden className="material-symbols-outlined text-xl transition-transform group-hover:translate-x-1">
                    arrow_forward
                  </span>
                </Link>
                <Link
                  href="/examples"
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

              {isSeasonal && (
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
              {sections.map((sec) => (
                <div key={sec.heading} className="mt-10 max-w-prose">
                  <h3 className="font-display text-lg font-semibold leading-snug text-ink sm:text-xl">{sec.heading}</h3>
                  <div className="mt-3 flex flex-col gap-4">
                    {sec.paragraphs.map((p, i) => (
                      <p key={i} className="text-base leading-relaxed text-ink-body sm:text-lg sm:leading-[1.75]">
                        {p}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
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

        {/* Christmas / Reyes: this season's order-by dates, same cards as /christmas-delivery */}
        {isSeasonal && (
          <section aria-labelledby="seo-deadlines-title" className="border-b border-line bg-paper px-4 py-16 sm:px-6 sm:py-24">
            <div className="mx-auto max-w-[1200px]">
              <Heading
                id="seo-deadlines-title"
                as="h2"
                size="page"
                subtitle={tcd("formatsSub")}
                className="mb-8 max-w-2xl text-balance"
              >
                {tcd("formatsHeading")}
              </Heading>
              <DeadlineCards serverToday={today} />
              <p className="mt-6 max-w-prose text-sm leading-relaxed text-ink-soft">
                {tcd("regionNote")}{" "}
                <Link
                  href={CHRISTMAS_DELIVERY_PATH}
                  className={cx("font-semibold text-brand-text underline decoration-brand/30 underline-offset-4", focusRing)}
                >
                  {tcd("seoCallout")}
                </Link>
              </p>
            </div>
          </section>
        )}

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
              {faqs.map((f) => (
                <FaqItem key={f.question} question={f.question} answer={f.answer} />
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
