import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import FaqItem from "@/components/landing/FaqItem";
import { BreadcrumbJsonLd, FAQJsonLd } from "@/components/seo/JsonLd";
import { Heading, buttonClass, cx } from "@/components/ui";
import { Breadcrumbs, PageHero, kicker, marketingH1, marketingLead } from "@/components/seo-landing/MarketingHeader";
import GiftVoucherForm, { type VoucherFormatOption } from "@/components/gift-voucher/GiftVoucherForm";
import { PRICING, formatPrice } from "@/lib/pricing";
import { CHRISTMAS_DELIVERY_PATH, nextPhysicalCutoff, spainToday } from "@/lib/shipping";
import { GIFT_VOUCHER_PATH, VOUCHER_FORMATS } from "@/lib/promo-codes";
import { getPromotionSetup } from "@/lib/growth/stripe-promotions";

const BASE_URL = "https://meapica.shop";
const PATH = GIFT_VOUCHER_PATH;
const INTL_LOCALE: Record<string, string> = { es: "es-ES", ca: "ca-ES", en: "en-GB", fr: "fr-FR" };

// Availability (Stripe setup) and the Christmas cut-off depend on "now": re-render hourly.
export const revalidate = 3600;

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "giftVoucher" });
  const url = `${BASE_URL}/${locale}${PATH}`;
  const languages: Record<string, string> = {};
  for (const loc of routing.locales) languages[loc] = `${BASE_URL}/${loc}${PATH}`;
  languages["x-default"] = `${BASE_URL}/${routing.defaultLocale}${PATH}`;
  return {
    title: { absolute: t("metaTitle") },
    description: t("metaDescription"),
    alternates: { canonical: url, languages },
    openGraph: { title: t("metaTitle"), description: t("metaDescription"), url, type: "website" },
  };
}

export default async function Page({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "giftVoucher" });
  const ts = await getTranslations({ locale, namespace: "seo" });
  const tp = await getTranslations({ locale, namespace: "pricing" });
  const th = await getTranslations({ locale, namespace: "hero" });

  const setup = await getPromotionSetup();
  const options: VoucherFormatOption[] = VOUCHER_FORMATS.filter((f) => !!setup.voucherPrices[f]).map((f) => ({
    id: f,
    label: t(`formats.${f}.label`),
    note: t(`formats.${f}.note`),
    price: formatPrice(PRICING[f].price, locale),
    shipping: PRICING[f].requiresShipping,
  }));

  const today = spainToday();
  const cutoff = nextPhysicalCutoff(today);
  const cutoffDate = cutoff
    ? new Intl.DateTimeFormat(INTL_LOCALE[locale] ?? "es-ES", { timeZone: "UTC", day: "numeric", month: "long" }).format(
        new Date(`${cutoff.lastOrderDate}T00:00:00Z`),
      )
    : null;

  const points = t.raw("points") as string[];
  const steps = t.raw("howSteps") as string[];
  const faqs = (t.raw("faq") as { q: string; a: string }[]).map((f) => ({ question: f.q, answer: f.a }));
  const pageUrl = `${BASE_URL}/${locale}${PATH}`;

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
        <PageHero>
          <Breadcrumbs
            label={ts("common.breadcrumbLabel")}
            items={[
              { label: ts("common.breadcrumbHome"), href: "/" },
              { label: ts("nav.giftHeading"), href: "/gifts" },
              { label: t("breadcrumb") },
            ]}
          />
          <div className="mt-4 grid gap-10 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-16">
            <div className="max-w-2xl">
              <p className={kicker}>{t("eyebrow")}</p>
              <h1 className={cx("mt-2", marketingH1)}>{t("h1")}</h1>
              <p className={cx("mt-4", marketingLead)}>{t("intro")}</p>
              <ul className="mt-6 flex flex-col gap-3">
                {points.map((p, i) => (
                  <li key={p} className="flex items-start gap-3 text-base leading-snug text-ink-body">
                    <span aria-hidden className="material-symbols-outlined mt-px !text-xl shrink-0 text-brand-text">
                      {["mail", "local_shipping", "event"][i] ?? "check"}
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>

            <div className="self-start rounded-2xl border-2 border-line bg-surface p-5 sm:p-6" id="buy">
              {options.length > 0 ? (
                <GiftVoucherForm
                  locale={locale}
                  options={options}
                  copy={{
                    legend: t("formLegend"),
                    vatIncluded: tp("vatIncluded"),
                    recipientLabel: t("recipientLabel"),
                    recipientPlaceholder: t("recipientPlaceholder"),
                    messageLabel: t("messageLabel"),
                    messagePlaceholder: t("messagePlaceholder"),
                    messageCount: t.raw("messageCount") as string,
                    buy: t.raw("buy") as string,
                    secure: t("secure"),
                    terms: t("terms"),
                    termsLink: t("termsLink"),
                    error: t("error"),
                  }}
                />
              ) : (
                <div data-testid="gift-voucher-unavailable">
                  <span aria-hidden className="material-symbols-outlined !text-3xl text-brand-text">
                    redeem
                  </span>
                  <h2 className="mt-2 font-display text-xl font-bold leading-snug text-ink">{t("unavailableTitle")}</h2>
                  <p className="mt-2 text-base leading-relaxed text-ink-body">{t("unavailableText")}</p>
                  <p className="mt-4 text-sm text-ink-soft">
                    <span className="font-bold tabular-nums text-brand-deep">{formatPrice(PRICING.digital_pdf.price, locale)}</span>
                    <span> · {tp("vatIncluded")}</span>
                  </p>
                  <Link href="/create" className={buttonClass({ variant: "secondary", block: true, className: "mt-3" })}>
                    {t("unavailableCta")}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </PageHero>

        {/* How it works */}
        <section aria-labelledby="voucher-how" className="border-y border-line bg-surface px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-[1200px]">
            <Heading id="voucher-how" as="h2" size="page" className="mb-8 text-balance">
              {t("howHeading")}
            </Heading>
            <ol className="grid gap-6 sm:grid-cols-3 sm:gap-8">
              {steps.map((step, i) => (
                <li key={i} className="flex items-start gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint font-display text-base font-bold tabular-nums text-brand-text">
                    {i + 1}
                  </span>
                  <p className="text-base leading-relaxed text-ink-body">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Christmas: the voucher still makes it on the day */}
        <section aria-labelledby="voucher-xmas" className="bg-paper px-4 pt-16 sm:px-6 sm:pt-20">
          <div className="mx-auto max-w-[1200px]">
            <div className="flex flex-col gap-4 rounded-2xl border-2 border-line bg-surface p-6 sm:flex-row sm:items-center sm:gap-8 sm:p-8">
              <span aria-hidden className="material-symbols-outlined !text-4xl shrink-0 text-brand-text">
                celebration
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="voucher-xmas" className="font-display text-xl font-bold leading-snug text-ink sm:text-2xl">
                  {t("christmasHeading")}
                </h2>
                <p className="mt-2 max-w-prose text-base leading-relaxed text-ink-body">
                  {cutoff && cutoffDate
                    ? t("christmasOpen", { occasion: t(`occasion.${cutoff.occasion}`), date: cutoffDate })
                    : t("christmasClosed")}
                </p>
              </div>
              <Link href={CHRISTMAS_DELIVERY_PATH} className={buttonClass({ variant: "secondary", size: "sm", className: "shrink-0" })}>
                {t("christmasLink")}
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ / terms */}
        <section aria-labelledby="voucher-faq" className="bg-paper px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-3xl">
            <Heading id="voucher-faq" as="h2" size="page" className="mb-8 text-balance text-center">
              {t("faqHeading")}
            </Heading>
            <div className="divide-y divide-line overflow-hidden rounded-2xl border-2 border-line bg-surface">
              {faqs.map((f) => (
                <FaqItem key={f.question} question={f.question} answer={f.answer} />
              ))}
            </div>
            <p className="mt-8 text-center">
              <Link href="/create" className={buttonClass({ variant: "secondary" })}>
                {th("cta")}
              </Link>
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
