import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import BrandLogo from "@/components/BrandLogo";
import { CoverFace } from "@/components/book-mockup/CoverFace";
import Footer from "@/components/landing/Footer";
import MobileStickyCta from "@/components/landing/MobileStickyCta";
import { AdCreateButton, AdDeliveryLine, AdNameForm } from "@/components/ad-landing/AdNameForm";
import { AD_LANDING_COPY, AD_LANDING_LOCALES, AD_LANDING_SLUGS, getAdLanding } from "@/lib/ad-landing";
import { formatPrice } from "@/lib/pricing";
import { BOOK_INNER_PAGES, BOOK_SCENES, PRINTED_FROM_CENTS } from "@/lib/product-facts";

// Paid Meta ad landings (lib/ad-landing.ts): one template, the ad's scene and line per slug.
// Only es × the configured slugs exist; anything else is a 404 (no on-demand params).
export const dynamicParams = false;

// Both segments from here (like gifts/tio-de-nadal): this list replaces the layout's four locales.
export function generateStaticParams() {
  return AD_LANDING_LOCALES.flatMap((locale) => AD_LANDING_SLUGS.map((slug) => ({ locale, slug })));
}

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const variant = getAdLanding(locale, slug);
  if (!variant) return {};
  return {
    title: variant.metaTitle,
    description: variant.metaDescription,
    // Paid traffic only and the copy overlaps the home: never indexed (links still followed).
    robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
    alternates: { canonical: null },
  };
}

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`material-symbols-outlined inline-block w-5 shrink-0 overflow-hidden text-center text-[18px] leading-5 ${className}`}
      data-icon={name}
    />
  );
}

export default async function AdLandingPage({ params }: Props) {
  const { locale, slug } = await params;
  const variant = getAdLanding(locale, slug);
  if (!variant) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("hero");
  const tPricing = await getTranslations("pricing");
  const price = formatPrice(PRINTED_FROM_CENTS, locale);
  const copy = AD_LANDING_COPY;

  return (
    <>
      <header className="flex h-14 items-center justify-center border-b border-line bg-paper">
        <Link href="/" aria-label="Meapica" className="inline-flex min-h-11 items-center text-brand-deep">
          <BrandLogo className="h-6" />
        </Link>
      </header>

      <main className="bg-paper">
        {/* First screen (390 × 844): scene + quote, H1, price, name → CTA, preview promise. */}
        <section aria-labelledby="ad-title" className="mx-auto flex max-w-md flex-col gap-3 px-4 pt-3.5">
          <div className="relative aspect-[358/300] overflow-hidden rounded-[20px] bg-line">
            <Image
              src={variant.scene.src}
              width={variant.scene.width}
              height={variant.scene.height}
              alt={variant.scene.alt}
              preload
              loading="eager"
              fetchPriority="high"
              sizes="(min-width: 448px) 416px, calc(100vw - 32px)"
              className="h-full w-full object-cover"
            />
            <p className="absolute bottom-3 left-3 right-3 w-fit rounded-lg bg-ink/80 px-3 py-2 text-[15px] font-bold leading-snug text-white">
              {variant.quote}
            </p>
            <p className="absolute right-2.5 top-2.5 rounded-lg bg-white/85 px-2 py-1 text-[11px] font-semibold text-ink-soft">
              {copy.aiTag}
            </p>
          </div>

          <h1 id="ad-title" className="text-balance text-center font-display text-[30px] font-bold leading-[1.08] min-[400px]:text-[32px] text-ink">
            {variant.title[0]} <span className="block text-brand-text">{variant.title[1]}</span>
          </h1>

          <p className="text-center text-[15px] font-semibold text-brand-deep">
            <span className="tabular-nums">{t("priceFrom", { price })}</span> · {tPricing("vatIncluded")} · {t("freeShipping")}
          </p>

          <AdNameForm ctaLabel={copy.cta} />

          <p className="text-balance text-center text-[13px] font-medium leading-5 text-ink-soft min-[400px]:text-sm">
            <Icon name="visibility" className="mr-1.5 align-[-4px] text-brand-text" />
            {t("trustPreview")}
          </p>
        </section>

        {/* #final-cta: MobileStickyCta hides while this closing block (its own CTA) is on screen. */}
        <section aria-labelledby="ad-steps" className="mx-auto flex max-w-md flex-col gap-[22px] px-4 pb-16 pt-12">
          <h2 id="ad-steps" className="text-center font-display text-[22px] font-bold text-ink">
            {copy.stepsTitle}
          </h2>
          <ol className="flex flex-col gap-3">
            {copy.steps.map((step, i) => (
              <li key={step} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3.5">
                <span aria-hidden className="flex size-8 flex-none items-center justify-center rounded-full bg-brand-deep font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-[15px] text-ink-soft">{step}</span>
              </li>
            ))}
          </ol>

          <div id="final-cta" className="flex flex-col gap-[22px]">
            <div className="flex items-center gap-3.5">
              <div
                role="img"
                aria-label={`Portada de «${variant.book.title}»`}
                className="relative aspect-square w-[150px] flex-none overflow-hidden rounded-[10px] shadow-book"
              >
                <CoverFace
                  imageUrl={variant.book.coverSrc}
                  title={variant.book.title}
                  childName={variant.book.childName}
                  fallbackColor="#3a2418"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <h3 className="font-display text-[17px] font-semibold text-ink">{copy.bookKicker}</h3>
                <p className="text-sm text-ink-body">{copy.bookBody(BOOK_INNER_PAGES, BOOK_SCENES)}</p>
                <AdDeliveryLine />
              </div>
            </div>

            <AdCreateButton ctaLabel={copy.cta} />
            <p className="text-balance text-center text-[13px] text-ink-muted">{copy.priceLine(price)}</p>
          </div>
        </section>
      </main>
      <Footer />
      <MobileStickyCta label={copy.cta} />
    </>
  );
}
