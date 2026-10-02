import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { buttonClass, cx, focusRing } from "@/components/ui";
import { PRICING, formatPrice } from "@/lib/pricing";
import { Breadcrumbs, PageHero, kicker, marketingH1, marketingLead, type Crumb } from "@/components/seo-landing/MarketingHeader";

// Building blocks of the editorial guide pages (/personalized-books/in-catalan,
// /personalized-books/looks-like-your-child, /compare). FAQ, guide sections and
// related links reuse the tools-page parts (components/tools/ToolLanding.tsx).

export interface GuideCta {
  href: string;
  label: string;
  /** Create the book in another locale (the book is written in the site's language). */
  locale?: Locale;
  /** One line under the button, e.g. why it opens the Catalan site. */
  note?: string;
}

/** "Desde 34,90 € · IVA incluido · Envío gratis" (B2C: VAT next to every price). */
export async function PriceLine({ locale, tone = "paper" }: { locale: string; tone?: "paper" | "dark" }) {
  const th = await getTranslations({ locale, namespace: "hero" });
  const tp = await getTranslations({ locale, namespace: "pricing" });
  const fromPrice = formatPrice(Math.min(PRICING.softcover.price, PRICING.hardcover.price), locale);
  return (
    <p className={cx("text-sm", tone === "dark" ? "text-paper/85" : "text-ink-soft")}>
      <span className={cx("font-bold tabular-nums", tone === "dark" ? "text-paper" : "text-brand-deep")}>
        {th("priceFrom", { price: fromPrice })}
      </span>
      <span> · {tp("vatIncluded")}</span>
      <span> · {th("freeShipping")}</span>
    </p>
  );
}

export function GuideCtaLink({ cta, id, className }: { cta: GuideCta; id?: string; className?: string }) {
  return (
    <Link id={id} href={cta.href} locale={cta.locale} className={buttonClass({ className: cx("min-h-14 sm:px-8", className) })}>
      {cta.label}
      <span aria-hidden className="material-symbols-outlined text-xl transition-transform group-hover:translate-x-1">
        arrow_forward
      </span>
    </Link>
  );
}

/** Hero of a guide page: breadcrumbs, kicker, H1, lead, the one CTA, price line, trust ticks, optional visual. */
export async function GuideHero({
  locale,
  crumbs,
  breadcrumbLabel,
  eyebrow,
  h1,
  lead,
  cta,
  secondary,
  trust,
  aside,
}: {
  locale: string;
  crumbs: Crumb[];
  breadcrumbLabel: string;
  eyebrow: string;
  h1: string;
  lead: string;
  cta: GuideCta;
  secondary?: { href: string; label: string };
  trust: string[];
  aside?: ReactNode;
}) {
  return (
    <PageHero>
      <Breadcrumbs label={breadcrumbLabel} items={crumbs} />
      <div
        className={cx(
          "mt-4 grid grid-cols-1 items-center gap-8 lg:mt-8",
          Boolean(aside) && "lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-16 xl:grid-cols-[minmax(0,1fr)_440px]",
        )}
      >
        {aside && <div className="lg:order-2">{aside}</div>}
        <div className="max-w-3xl lg:order-1">
          <p className={kicker}>{eyebrow}</p>
          <h1 className={cx("mt-2", marketingH1)}>{h1}</h1>
          <p className={cx("mt-4 max-w-2xl", marketingLead)}>{lead}</p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <GuideCtaLink cta={cta} id="hero-cta" />
            {secondary && (
              <Link
                href={secondary.href}
                className={cx(
                  "inline-flex min-h-11 items-center justify-center gap-1 self-center rounded-full px-3 text-sm font-semibold text-ink-soft underline decoration-brand/30 underline-offset-4 transition-colors hover:text-brand-text sm:self-auto",
                  focusRing,
                )}
              >
                {secondary.label}
              </Link>
            )}
          </div>
          {cta.note && <p className="mt-3 max-w-xl text-sm leading-snug text-ink-muted">{cta.note}</p>}
          <div className="mt-3 text-center sm:text-left">
            <PriceLine locale={locale} />
          </div>

          <ul className="mt-6 flex flex-col gap-2.5 border-t border-line pt-5 text-sm text-ink-soft sm:flex-row sm:flex-wrap sm:gap-x-6">
            {trust.map((line) => (
              <li key={line} className="flex items-center gap-2">
                <span aria-hidden className="material-symbols-outlined !text-xl text-brand">
                  check_circle
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </PageHero>
  );
}

/** Closing brand-deep band with the page's CTA (used where the landing FinalCta's /create would open the wrong locale). */
export async function GuideCtaBand({
  locale,
  eyebrow,
  heading,
  text,
  cta,
}: {
  locale: string;
  eyebrow: string;
  heading: string;
  text: string;
  cta: GuideCta;
}) {
  return (
    <section id="final-cta" aria-labelledby="guide-cta-title" className="bg-brand-deep px-4 py-16 text-paper sm:px-6 sm:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-line-warm">{eyebrow}</p>
        <h2 id="guide-cta-title" className="mt-3 text-balance font-display text-[28px] font-bold leading-[1.12] text-paper sm:text-4xl">
          {heading}
        </h2>
        <p className="mx-auto mt-4 max-w-prose text-base leading-relaxed text-paper/85 sm:text-lg">{text}</p>
        <div className="mt-7 flex flex-col items-center gap-3">
          <GuideCtaLink cta={cta} />
          {cta.note && <p className="max-w-md text-sm text-paper/85">{cta.note}</p>}
          <PriceLine locale={locale} tone="dark" />
        </div>
      </div>
    </section>
  );
}
