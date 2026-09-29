import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import MobileStickyCta from "@/components/landing/MobileStickyCta";
import { BreadcrumbJsonLd, FAQJsonLd } from "@/components/seo/JsonLd";
import DeliveryCountdown from "@/components/seasonal/DeliveryCountdown";
import DeadlineCards from "@/components/seasonal/DeadlineCards";
import { PRICING, formatPrice } from "@/lib/pricing";
import {
  CHRISTMAS_DELIVERY_PATH,
  DELIVERY_DAYS,
  PEAK_BUFFER_DAYS,
  formatDeadlines,
  giftSeason,
  spainToday,
} from "@/lib/shipping";

const BASE_URL = "https://meapica.com";
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
  const t = await getTranslations({ locale, namespace: "christmasDelivery" });
  const ts = await getTranslations({ locale, namespace: "seo" });
  const tp = await getTranslations({ locale, namespace: "pricing" });

  const today = spainToday();
  const years = seasonYears();
  const pageUrl = `${BASE_URL}/${locale}${PATH}`;
  const ctaLabel = ts("common.ctaPrimary");

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
    { question: t("faq.timeQ"), answer: t("faq.timeA") },
    { question: t("faq.regionQ"), answer: t("faq.regionA") },
  ];

  const days = DELIVERY_DAYS.hardcover.peninsula;
  const method = (t.raw("method") as string[]).map((line) =>
    line
      .replace("{min}", String(days.min))
      .replace("{max}", String(days.max))
      .replace("{buffer}", String(PEAK_BUFFER_DAYS)),
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
        <header className="relative overflow-hidden px-4 pt-32 pb-16">
          <div className="absolute top-0 right-0 -z-10 h-[500px] w-[500px] -translate-y-1/3 translate-x-1/3 rounded-full bg-primary-light/20 blur-[100px] mix-blend-multiply" />
          <div className="mx-auto max-w-5xl">
            <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-text-muted">
              <Link href="/" className="hover:text-primary">
                {ts("common.breadcrumbHome")}
              </Link>
              <span className="material-symbols-outlined text-base">chevron_right</span>
              <Link href="/gifts" className="hover:text-primary">
                {ts("nav.giftHeading")}
              </Link>
              <span className="material-symbols-outlined text-base">chevron_right</span>
              <span className="text-text-soft">{t("breadcrumb")}</span>
            </nav>

            <p className="text-xs font-bold uppercase tracking-wider text-primary">{t("eyebrow", years)}</p>
            <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold leading-[1.1] tracking-tight text-secondary lg:text-6xl">
              {t("h1")}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-text-soft">{t("intro")}</p>

            <DeliveryCountdown serverToday={today} ctaLabel={ctaLabel} />
          </div>
        </header>

        {/* Deadlines per format */}
        <section className="bg-cream px-4 py-20" aria-labelledby="deadlines-heading">
          <div className="mx-auto max-w-5xl">
            <div className="mb-10">
              <h2 id="deadlines-heading" className="font-display text-3xl font-bold text-secondary md:text-4xl">
                {t("formatsHeading")}
              </h2>
              <p className="mt-3 text-text-soft">{t("formatsSub")}</p>
            </div>
            <DeadlineCards serverToday={today} />
            <p className="mt-6 flex items-start gap-2 text-sm leading-relaxed text-text-soft">
              <span aria-hidden className="material-symbols-outlined mt-px shrink-0 text-lg text-text-muted">
                info
              </span>
              {t("regionNote")}
            </p>
          </div>
        </section>

        {/* How the dates are calculated + PDF fallback */}
        <section className="bg-white px-4 py-20">
          <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-[1.3fr_1fr]">
            <div>
              <h2 className="mb-6 font-display text-3xl font-bold text-secondary">{t("methodHeading")}</h2>
              <ol className="flex flex-col gap-5">
                {method.map((line, i) => (
                  <li key={i} className="flex items-start gap-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cream font-display text-sm font-bold text-primary">
                      {i + 1}
                    </span>
                    <p className="leading-relaxed text-text-soft">{line}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-2xl border border-border-light bg-cream/50 p-8">
              <span aria-hidden className="material-symbols-outlined text-3xl text-primary">
                download
              </span>
              <h2 className="mt-3 font-display text-2xl font-bold text-secondary">{t("lateHeading")}</h2>
              <p className="mt-4 leading-relaxed text-text-soft">{t("lateText")}</p>
              <p className="mt-5 text-sm font-bold text-secondary">
                {formatPrice(PRICING.digital_pdf.price, locale)}{" "}
                <span className="font-normal text-text-muted">· {tp("vatIncluded")}</span>
              </p>
              <Link
                href="/crear"
                className="mt-5 inline-flex items-center gap-2 rounded-lg border border-secondary px-5 py-3 text-sm font-bold text-secondary transition-colors hover:bg-secondary hover:text-white"
              >
                {t("ctaDigital")}
                <span aria-hidden className="material-symbols-outlined text-lg">arrow_forward</span>
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-cream px-4 py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-10 text-center font-display text-3xl font-bold text-secondary">{t("faqHeading")}</h2>
            <div className="flex flex-col gap-4">
              {faqs.map((f) => (
                <details
                  key={f.question}
                  className="group rounded-xl border border-border-light bg-white/70 transition-colors open:bg-white"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 font-display text-lg font-bold text-secondary [&::-webkit-details-marker]:hidden">
                    {f.question}
                    <span className="material-symbols-outlined shrink-0 text-text-muted transition-transform duration-300 group-open:rotate-180">
                      expand_more
                    </span>
                  </summary>
                  <p className="px-6 pb-6 leading-relaxed text-text-soft">{f.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 py-20 text-center">
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-6 font-display text-3xl font-bold text-secondary md:text-4xl">{t("finalHeading")}</h2>
            <Link
              href="/crear"
              className="mx-auto inline-flex items-center gap-2 rounded-lg bg-secondary px-10 py-4 text-lg font-bold text-white shadow-lg transition-all hover:scale-105 hover:bg-secondary-hover"
            >
              {ctaLabel}
              <span className="material-symbols-outlined">auto_stories</span>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
      <MobileStickyCta />
    </>
  );
}
