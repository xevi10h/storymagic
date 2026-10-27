"use client";

// The full-book CTA of the Advent calendar (dark brand band). "wide" = the calendar page
// (Main.dc.html), "compact" = under an opened door (DoorMobile.dc.html). Prices and dates
// come from adventOffer() (live cut-off, Pack Reyes while issued, PDF after the cut-off),
// always with "IVA incluido".

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cx } from "@/components/ui";
import { trackEvent } from "@/lib/tracking/consent";
import type { AdventOffer } from "@/lib/advent/email";
import type { AdventLocale } from "@/lib/advent/render";
import type { AdventChild } from "./child-store";
import { createHref } from "./links";

export function AdventBookBand({
  child,
  nameIn,
  deName,
  offer,
  variant,
  art = "/images/landing/bedtime.webp",
}: {
  locale: AdventLocale;
  child: AdventChild | null;
  /** The name as used inside a sentence ("la Noa" in Catalan). */
  nameIn: string;
  deName: string;
  offer: AdventOffer;
  variant: "wide" | "compact";
  art?: string;
}) {
  const t = useTranslations("advent.book");
  const name = child ? nameIn : "";
  const heading =
    variant === "wide"
      ? name
        ? t("heading", { name })
        : t("headingNoName")
      : name
        ? t("mobileHeading", { name })
        : t("mobileHeadingNoName");
  const text = variant === "wide" ? t("text", { pages: offer.pages }) : t("mobileText", { pages: offer.pages });
  const priceLine = [t("from", { price: offer.fromPrice }), offer.packPrice ? t("pack", { price: offer.packPrice }) : null].filter(Boolean).join(" · ");
  const dateLine = offer.deadline ? t("deadline", { date: offer.deadline }) : offer.latePdfPrice ? t("late", { price: offer.latePdfPrice }) : null;

  const cta = (
    <Link
      href={createHref(child)}
      onClick={() => trackEvent("advent_cta_click", { placement: variant })}
      className={cx(
        "inline-flex min-h-[52px] items-center justify-center rounded-[14px] bg-brand px-6 text-center text-[19px] font-bold text-white transition-colors hover:bg-brand-hover",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
        variant === "compact" && "w-full",
      )}
      data-testid="advent-book-cta"
    >
      {name ? t("cta", { deName }) : t("ctaNoName")}
    </Link>
  );

  if (variant === "compact") {
    return (
      <section className="overflow-hidden rounded-3xl bg-brand-deep text-white" aria-label={heading}>
        <div className="relative h-[170px] w-full">
          <Image src={art} alt="" fill sizes="(min-width: 640px) 640px, 100vw" className="object-cover" />
        </div>
        <div className="flex flex-col gap-2.5 px-5 pb-6 pt-5">
          <h2 className="font-display text-[25px] font-semibold leading-tight">{heading}</h2>
          <p className="text-[15px] leading-relaxed text-white/85">{text}</p>
          <div className="mt-1.5">{cta}</div>
          <p className="text-center text-[13px] text-white/80">{priceLine}</p>
          {dateLine && <p className="text-center text-[13px] font-semibold text-white">{dateLine}</p>}
        </div>
      </section>
    );
  }

  return (
    <section className="mt-12 flex flex-wrap overflow-hidden rounded-[28px] bg-brand-deep text-white lg:mt-14" aria-labelledby="advent-book-title">
      {/* The art is a vignette on near-white: the panel takes that colour and the full band height. */}
      <div className="relative min-h-[220px] min-w-0 flex-[1_1_380px] bg-[#fdfdfd] sm:min-h-[320px]">
        <Image src={art} alt="" fill sizes="(min-width: 1024px) 560px, 100vw" className="object-contain" />
      </div>
      <div className="flex min-w-0 flex-[1_1_440px] flex-col justify-center gap-3 p-6 sm:p-10">
        <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-line-warm">{t("kicker")}</p>
        <h2 id="advent-book-title" className="text-balance font-display text-[28px] font-semibold leading-[1.15] sm:text-[34px]">
          {heading}
        </h2>
        <p className="text-base leading-relaxed text-white/85">{text}</p>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          {cta}
          <span className="text-sm text-white/85">{priceLine}</span>
        </div>
        {dateLine && <p className="text-sm font-semibold text-white">{dateLine}</p>}
      </div>
    </section>
  );
}

