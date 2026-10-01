"use client";

import type { FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import LiveCover from "@/components/create/LiveCover";
import { useDeliveryLine } from "@/components/purchase/delivery";
import { buttonClass } from "@/components/ui";
import { PRICING, formatPrice } from "@/lib/pricing";
import { MAX_NAME_LENGTH, deName, firstName } from "@/lib/creation-flow";
import { formatChildName } from "@/lib/child-name";
import { createPageHref, setHeroName, useHeroName } from "./HeroNameStore";

/** Material Symbols glyph with a fixed box, so the late icon font never shifts the text. */
function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`material-symbols-outlined inline-block w-5 shrink-0 overflow-hidden text-center text-[18px] leading-5 ${className}`}
    >
      {name}
    </span>
  );
}

/**
 * Landing hero: the child is the protagonist. The parent types the name, the real
 * cover from the creation flow (LiveCover) updates on every keystroke, and the CTA
 * opens /create with the name already filled in (?name=, read by the create-page prefill).
 */
export default function Hero() {
  const t = useTranslations("hero");
  const tPricing = useTranslations("pricing");
  const tPurchase = useTranslations("crear.purchase");
  const locale = useLocale();
  const router = useRouter();
  const name = useHeroName();
  const delivery = useDeliveryLine("softcover");

  const priceFrom = formatPrice(PRICING.softcover.price, locale);
  const first = firstName(formatChildName(name));
  const ctaLabel = first ? t("ctaWithName", { deName: deName(first, locale) }) : t("cta");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    // Without JS the form still works: GET /{locale}/create?name=… (same prefill).
    e.preventDefault();
    const formatted = formatChildName(name);
    setHeroName(formatted);
    router.push(createPageHref(formatted));
  }

  return (
    <section
      aria-labelledby="hero-title"
      // Clears the fixed navbar. Fallbacks = its real height before hydration measures it
      // (h-14 / lg:h-16 + 1px border), so the hero does not jump (CLS).
      className="relative overflow-hidden bg-paper px-4 pt-[calc(var(--landing-nav-h,57px)+1.25rem)] pb-14 sm:px-6 sm:pb-20 lg:pt-[calc(var(--landing-nav-h,65px)+1.25rem)] lg:pb-28"
    >
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_440px] lg:grid-rows-[auto_auto] lg:gap-x-20 lg:pt-14 xl:grid-cols-[minmax(0,1fr)_480px]">
        {/* Copy */}
        <div className="mx-auto max-w-xl text-center text-balance lg:col-start-1 lg:row-start-1 lg:mx-0 lg:max-w-none lg:self-end lg:text-left">
          {/* The H1 carries the head term ("Cuento personalizado para niños", the eyebrow line) and the
              brand promise as one heading; the eyebrow keeps its kicker style. */}
          <h1 id="hero-title" className="font-display font-bold text-ink">
            <span className="mb-2 block font-sans text-xs font-bold uppercase tracking-wide text-brand-text sm:mb-3">
              {t("eyebrow")}
            </span>
            <span className="block text-[32px] leading-[1.08] min-[380px]:text-[34px] sm:text-5xl lg:text-[60px] xl:text-[64px]">
              {t.rich("title", { hl: (chunks) => <span className="text-brand">{chunks}</span> })}
            </span>
          </h1>
          <p className="mx-auto mt-3 max-w-[34rem] text-[15px] font-medium leading-relaxed text-ink-muted sm:mt-4 sm:text-lg lg:mx-0">
            {t("subtitle")}
          </p>
        </div>

        {/* Live cover: the one priority image of the page */}
        <div className="relative mx-auto mt-5 w-[min(50vw,220px)] sm:mt-8 sm:w-[280px] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:w-full lg:self-center">
          <div
            aria-hidden
            className="absolute left-1/2 top-1/2 -z-0 hidden aspect-square w-[118%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/[0.06] sm:block"
          />
          <div className="relative">
            {/* Page block peeking out under the board: reads as a real book, not a flat card */}
            <div
              aria-hidden
              className="absolute inset-0 translate-x-[3%] translate-y-[2.2%] rounded-[4px_14px_14px_4px] bg-surface shadow-book ring-1 ring-line-warm"
            />
            <LiveCover
              name={name}
              templateId={null}
              priority
              sizes="(min-width: 1280px) 480px, (min-width: 1024px) 440px, (min-width: 640px) 280px, 50vw"
            />
          </div>
          <p className="mt-5 hidden text-center text-xs font-medium text-ink-muted lg:block">
            {first ? t("coverCaptionWithName", { name: first }) : t("coverCaption")}
          </p>
        </div>

        {/* Name → CTA */}
        <div className="mx-auto mt-5 w-full max-w-xl sm:mt-8 lg:col-start-1 lg:row-start-2 lg:mx-0 lg:mt-9 lg:self-start">
          <form action={`/${locale}/create`} method="get" onSubmit={onSubmit} noValidate>
            <label
              htmlFor="hero-name"
              className="block text-center font-display text-lg font-semibold text-ink lg:text-left lg:text-xl"
            >
              {t("nameLabel")}
            </label>
            <div className="mt-2 flex flex-col gap-2.5 sm:flex-row sm:gap-3 lg:flex-col xl:flex-row">
              <input
                id="hero-name"
                name="name"
                type="text"
                value={name}
                onChange={(e) => setHeroName(e.target.value)}
                onBlur={(e) => {
                  const formatted = formatChildName(e.target.value);
                  if (formatted !== e.target.value) setHeroName(formatted);
                }}
                placeholder={t("namePlaceholder")}
                maxLength={MAX_NAME_LENGTH}
                autoComplete="off"
                autoCapitalize="words"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                className="h-14 w-full min-w-0 rounded-2xl border-2 border-line bg-surface px-5 font-display text-xl font-semibold text-ink outline-none transition-colors placeholder:font-normal placeholder:text-ink-muted/60 focus:border-brand sm:h-16 sm:flex-1 sm:text-2xl lg:flex-none xl:flex-1"
              />
              <button
                id="hero-cta"
                type="submit"
                className={buttonClass({
                  block: true,
                  // lg: the copy column is narrow (cover beside it), so input and button stack again.
                  className: "min-h-14 sm:min-h-16 sm:w-auto sm:max-w-[60%] sm:shrink-0 sm:px-8 lg:w-full lg:max-w-none xl:w-auto xl:max-w-[60%]",
                })}
              >
                <span className="min-w-0 break-words">{ctaLabel}</span>
                <span
                  aria-hidden
                  className="material-symbols-outlined inline-block w-5 shrink-0 overflow-hidden text-xl leading-5 transition-transform group-hover:translate-x-1"
                >
                  arrow_forward
                </span>
              </button>
            </div>
          </form>

          <div className="mt-3 flex flex-col items-center gap-1 text-sm lg:items-start">
            <p className="text-ink-soft">
              <span className="font-bold tabular-nums text-brand-deep">{t("priceFrom", { price: priceFrom })}</span>
              <span> · {tPricing("vatIncluded")}</span>
              <span> · {t("freeShipping")}</span>
            </p>
            {/* Reserved box: the date needs the browser's clock (appears after hydration). Phones
                reserve two lines, since long months ("noviembre") wrap there; icon stays inline. */}
            <p className="flex min-h-10 items-center text-balance text-center text-[13px] leading-5 text-ink-muted min-[380px]:text-sm sm:min-h-6 lg:text-left">
              {delivery && (
                <span>
                  <Icon name="local_shipping" className="mr-1.5 align-[-4px] text-success" />
                  {delivery} <span className="whitespace-nowrap">· {tPurchase("deliveryEstimate")}</span>
                </span>
              )}
            </p>
          </div>

          <ul className="mt-7 flex flex-col items-center gap-2.5 border-t border-line pt-6 text-sm text-ink-soft sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-6 lg:justify-start">
            <li className="flex items-center gap-2">
              <Icon name="check_circle" className="text-brand" />
              {t("trustPreview")}
            </li>
            <li className="flex items-center gap-2">
              <Icon name="check_circle" className="text-brand" />
              {t("trustFormats")}
            </li>
            <li>
              <Link
                href="/examples"
                className="inline-flex min-h-11 items-center gap-1 font-semibold text-ink-soft underline decoration-brand/30 underline-offset-4 transition-colors hover:text-brand-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:min-h-0"
              >
                {t("sampleCta")}
                <Icon name="arrow_forward" />
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
