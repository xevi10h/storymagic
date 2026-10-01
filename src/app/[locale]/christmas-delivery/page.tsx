import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import MobileStickyCta from "@/components/landing/MobileStickyCta";
import FaqItem from "@/components/landing/FaqItem";
import { BreadcrumbJsonLd, FAQJsonLd } from "@/components/seo/JsonLd";
import { Heading, buttonClass, cx } from "@/components/ui";
import { Breadcrumbs, PageHero, kicker, marketingH1, marketingLead } from "@/components/seo-landing/MarketingHeader";
import DeliveryCountdown from "@/components/seasonal/DeliveryCountdown";
import DeadlineCards from "@/components/seasonal/DeadlineCards";
import { PRICING, formatPrice } from "@/lib/pricing";
import { COPY_PARAMS, DELIVERY_BUSINESS_DAYS } from "@/lib/product-facts";
import {
  CHRISTMAS_DELIVERY_PATH,
  DELIVERY_DAYS,
  PEAK_BUFFER_DAYS,
  formatDeadlines,
  giftSeason,
  spainToday,
} from "@/lib/shipping";

const BASE_URL = "https://meapica.shop";
const PATH = CHRISTMAS_DELIVERY_PATH;
const INTL_LOCALE: Record<string, string> = { es: "es-ES", ca: "ca-ES", en: "en-GB", fr: "fr-FR" };

// Dates depend on "today": re-render at most hourly (the countdown itself is live client-side).
export const revalidate = 3600;

type PageProps = { params: Promise<{ locale: string }> };

function seasonYears() {
  const season = giftSeason(spainToday());
  return { christmasYear: season.christmasYear, reyesYear: season.christmasYear + 1 };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "christmasDelivery" });
  const url = `${BASE_URL}/${locale}${PATH}`;
  const languages: Record<string, string> = {};
  for (const loc of routing.locales) languages[loc] = `${BASE_URL}/${loc}${PATH}`;
  languages["x-default"] = `${BASE_URL}/${routing.defaultLocale}${PATH}`;
  const title = t("metaTitle", seasonYears());
  const description = t("metaDescription");
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url, languages },
    openGraph: { title, description, url, type: "website" },
  };
}

export default async function Page({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "christmasDelivery" });
  const ts = await getTranslations({ locale, namespace: "seo" });
  const tp = await getTranslations({ locale, namespace: "pricing" });
  const th = await getTranslations({ locale, namespace: "hero" });

  const today = spainToday();
  const years = seasonYears();
  const pageUrl = `${BASE_URL}/${locale}${PATH}`;
  const ctaLabel = th("cta");

  // FAQ answers quote the earliest cut-off across printed formats/regions (valid for all).
  const earliestCutoff = (occasion: "christmas" | "reyes") =>
    (["hardcover", "softcover"] as const)
      .flatMap((f) => formatDeadlines(today, f, occasion).map((d) => d.lastOrderDate))
      .sort()[0];
  const faqDate = (occasion: "christmas" | "reyes") =>
    new Intl.DateTimeFormat(INTL_LOCALE[locale] ?? "es-ES", { timeZone: "UTC", day: "numeric", month: "long" }).format(
      new Date(`${earliestCutoff(occasion)}T00:00:00Z`),
    );

  const faqs = [
    { question: t("faq.reyesQ"), answer: t("faq.reyesA", { date: faqDate("reyes") }) },
    { question: t("faq.christmasQ"), answer: t("faq.christmasA", { date: faqDate("christmas") }) },
    { question: t("faq.timeQ"), answer: t("faq.timeA", COPY_PARAMS) },
    { question: t("faq.regionQ"), answer: t("faq.regionA") },
  ];

  const days = DELIVERY_DAYS.hardcover.peninsula;
  const method = (t.raw("method") as string[]).map((line) =>
    line
      .replace("{min}", String(days.min))
      .replace("{max}", String(days.max))
      .replace("{buffer}", String(PEAK_BUFFER_DAYS))
      .replace("{promisedMin}", String(DELIVERY_BUSINESS_DAYS.min))
      .replace("{promisedMax}", String(DELIVERY_BUSINESS_DAYS.max)),
  );

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: ts("common.breadcrumbHome"), url: `${BASE_URL}/${locale}` },
          { name: ts("nav.giftHeading"), url: `${BASE_URL}/${locale}/gifts` },
          { name: t("breadcrumb"), url: pageUrl },
        ]}
      />
      <FAQJsonLd questions={faqs} />
      <Navbar />

      <main>
        {/* Hero + live countdown */}
        <PageHero>
          <Breadcrumbs
            label={ts("common.breadcrumbLabel")}
            items={[
              { label: ts("common.breadcrumbHome"), href: "/" },
              { label: ts("nav.giftHeading"), href: "/gifts" },
              { label: t("breadcrumb") },
            ]}
          />
          <div className="mt-4 max-w-3xl lg:mt-8">
            <p className={kicker}>{t("eyebrow", years)}</p>
            <h1 className={cx("mt-2", marketingH1)}>{t("h1")}</h1>
            <p className={cx("mt-4 max-w-2xl", marketingLead)}>{t("intro")}</p>
          </div>
          <DeliveryCountdown serverToday={today} ctaLabel={ctaLabel} />
        </PageHero>

        {/* Deadlines per format */}
        <section aria-labelledby="deadlines-heading" className="border-y border-line bg-surface px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-[1200px]">
            <Heading id="deadlines-heading" as="h2" size="page" subtitle={t("formatsSub")} className="mb-8 max-w-2xl text-balance">
              {t("formatsHeading")}
            </Heading>
            <DeadlineCards serverToday={today} />
            <p className="mt-6 flex max-w-prose items-start gap-2 text-sm leading-relaxed text-ink-soft">
              <span aria-hidden className="material-symbols-outlined mt-px !text-lg shrink-0 text-ink-muted">
                info
              </span>
              {t("regionNote")}
            </p>
          </div>
        </section>

        {/* How the dates are calculated + PDF fallback */}
        <section aria-labelledby="method-heading" className="bg-paper px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-16">
            <div>
              <Heading id="method-heading" as="h2" size="page" className="text-balance">
                {t("methodHeading")}
              </Heading>
              <ol className="mt-6 flex max-w-prose flex-col gap-5">
                {method.map((line, i) => (
                  <li key={i} className="flex items-start gap-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-tint font-display text-sm font-bold tabular-nums text-brand-text">
                      {i + 1}
                    </span>
                    <p className="text-base leading-relaxed text-ink-body">{line}</p>
                  </li>
                ))}
              </ol>
            </div>
            <aside aria-labelledby="late-heading" className="self-start rounded-2xl border-2 border-line bg-surface p-6 sm:p-7">
              <h2 id="late-heading" className="font-display text-xl font-bold leading-snug text-ink sm:text-2xl">
                {t("lateHeading")}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-ink-body">{t("lateText")}</p>
              <p className="mt-5 text-sm text-ink-soft">
                <span className="font-bold tabular-nums text-brand-deep">{formatPrice(PRICING.digital_pdf.price, locale)}</span>
                <span> · {tp("vatIncluded")}</span>
              </p>
              <Link href="/create" className={buttonClass({ variant: "secondary", block: true, className: "mt-4" })}>
                {t("ctaDigital")}
                <span aria-hidden className="material-symbols-outlined !text-lg transition-transform group-hover:translate-x-1">
                  arrow_forward
                </span>
              </Link>
            </aside>
          </div>
        </section>

        {/* FAQ */}
        <section aria-labelledby="xmas-faq-title" className="bg-paper px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="mx-auto max-w-3xl">
            <Heading id="xmas-faq-title" as="h2" size="page" className="mb-8 text-balance text-center">
              {t("faqHeading")}
            </Heading>
            <div className="divide-y divide-line overflow-hidden rounded-2xl border-2 border-line bg-surface">
              {faqs.map((f) => (
                <FaqItem key={f.question} question={f.question} answer={f.answer} />
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section id="final-cta" aria-labelledby="xmas-final-title" className="bg-paper px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="mx-auto flex max-w-[1120px] flex-col items-center gap-6 rounded-3xl bg-surface p-8 text-center ring-1 ring-line sm:p-12">
            <h2 id="xmas-final-title" className="text-balance font-display text-[28px] font-bold leading-[1.12] text-ink sm:text-4xl">
              {t("finalHeading")}
            </h2>
            <Link href="/create" className={buttonClass({ className: "min-h-14 sm:px-8" })}>
              {ctaLabel}
              <span aria-hidden className="material-symbols-outlined text-xl transition-transform group-hover:translate-x-1">
                arrow_forward
              </span>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
      <MobileStickyCta />
    </>
  );
}
