import { useLocale, useTranslations } from "next-intl";
import { BookMockup } from "@/components/book-mockup";
import { Heading } from "@/components/ui";
import { PRICING, formatPrice } from "@/lib/pricing";
import { LANDING_EXAMPLE, landingExampleBook } from "./HowItWorksExample";

// Only facts that are true today (Gelato photobook 200×200, 170 g silk, matt
// lamination; PurchasePanel specs; shipping zone + window from the legal pages).
const SPECS = ["size", "paper", "cover", "shipping", "digital"] as const;

/** The printed book: the object (mockup at real proportions), its specs and prices. */
export default function QualitySection() {
  const t = useTranslations("quality");
  const locale = useLocale();
  const name = LANDING_EXAMPLE.childName;
  const book = landingExampleBook(locale);

  return (
    <section id="artisanal" aria-labelledby="quality-title" className="scroll-mt-[var(--landing-nav-h,64px)] bg-paper py-16 sm:py-24">
      <div className="mx-auto grid max-w-[1120px] gap-6 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-x-16 lg:gap-y-8">
        <Heading
          size="page"
          as="h2"
          id="quality-title"
          eyebrow={t("eyebrow")}
          subtitle={t("subtitle")}
          className="lg:col-start-2 lg:row-start-1 lg:self-end [&_h2]:text-balance"
        >
          {t("title")}
        </Heading>

        {/* The 5:4 stage leaves air above/below the open book: pull it in on small screens. */}
        <div className="mx-auto -my-[14%] w-full max-w-[380px] sm:-my-16 sm:max-w-[460px] lg:col-start-1 lg:my-0 lg:row-span-2 lg:row-start-1 lg:max-w-none">
          <BookMockup
            coverUrl={LANDING_EXAMPLE.coverSrc}
            title={book.title}
            childName={name}
            format="hardcover"
            variant="open"
            spread={{ panorama: LANDING_EXAMPLE.printSpread }}
            alt={t("mockupAlt", { name })}
          />
        </div>

        <div className="lg:col-start-2 lg:row-start-2 lg:self-start">
          <dl className="divide-y divide-line border-y border-line">
            {SPECS.map((id) => (
              <div key={id} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 py-2.5 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <dt className="text-sm font-bold text-ink-soft">{t(`specs.${id}.label`)}</dt>
                <dd className="text-sm text-ink-body">{t(`specs.${id}.value`)}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-ink-soft">
            <span className="whitespace-nowrap">
              {t("softcover")} <strong className="font-display text-base font-bold text-brand-deep tabular-nums">{formatPrice(PRICING.softcover.price, locale)}</strong>
            </span>
            <span className="whitespace-nowrap">
              {t("hardcover")} <strong className="font-display text-base font-bold text-brand-deep tabular-nums">{formatPrice(PRICING.hardcover.price, locale)}</strong>
            </span>
            <span className="whitespace-nowrap text-ink-body">{t("vatShipping")}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
