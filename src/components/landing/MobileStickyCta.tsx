"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { buttonClass } from "@/components/ui";
import { PRICING, formatPrice } from "@/lib/pricing";
import { deName, firstName } from "@/lib/creation-flow";
import { formatChildName } from "@/lib/child-name";
import { crearHref, useHeroName } from "./HeroNameStore";

/**
 * Bottom "Crear su libro" bar for phones and tablets (< lg). It appears once the
 * hero CTA (#hero-cta) has scrolled out above the viewport and hides while the
 * closing name form (#final-cta) or the footer is on screen, so it never doubles
 * another primary CTA or covers the legal links.
 */
export default function MobileStickyCta() {
  const t = useTranslations("hero");
  const tPricing = useTranslations("pricing");
  const locale = useLocale();
  const name = useHeroName();
  const [heroPassed, setHeroPassed] = useState(false);
  const [endVisible, setEndVisible] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observers: IntersectionObserver[] = [];

    const heroCta = document.getElementById("hero-cta");
    if (heroCta) {
      const io = new IntersectionObserver(([entry]) => {
        // Only "passed" once it is above the viewport (not while still below it).
        setHeroPassed(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      });
      io.observe(heroCta);
      observers.push(io);
    }

    // Pages without the landing hero (blog, /ejemplo, SEO pages…): show it once the
    // reader has scrolled past most of the first screen.
    let onScroll: (() => void) | null = null;
    if (!heroCta) {
      onScroll = () => setHeroPassed(window.scrollY > window.innerHeight * 0.6);
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    // Closing CTA section + footer: hidden while any of them is on screen.
    const ends = [document.getElementById("final-cta"), document.querySelector("footer")].filter(
      (el): el is HTMLElement => el !== null,
    );
    if (ends.length > 0) {
      const onScreen = new Set<Element>();
      const io = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) onScreen.add(entry.target);
          else onScreen.delete(entry.target);
        }
        setEndVisible(onScreen.size > 0);
      });
      ends.forEach((el) => io.observe(el));
      observers.push(io);
    }

    return () => {
      observers.forEach((io) => io.disconnect());
      if (onScroll) window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const visible = heroPassed && !endVisible;
  const first = firstName(formatChildName(name));
  const ctaLabel = first ? t("ctaWithName", { deName: deName(first, locale) }) : t("cta");

  return (
    <div
      aria-hidden={!visible}
      inert={!visible}
      data-testid="mobile-sticky-cta"
      data-visible={visible}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-brand/10 bg-paper/90 backdrop-blur-md transition-[transform,opacity] duration-300 ease-[cubic-bezier(.2,.9,.3,1)] motion-reduce:transition-none lg:hidden ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"
      }`}
    >
      <div className="mx-auto flex max-w-xl items-center justify-between gap-2 px-4 sm:gap-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 sm:px-6">
        <p className="shrink-0 leading-tight">
          <span className="block text-sm font-bold tabular-nums text-brand-deep">
            {t("priceFrom", { price: formatPrice(PRICING.softcover.price, locale) })}
          </span>
          <span className="block text-xs text-ink-muted">{tPricing("vatIncluded")}</span>
        </p>
        <Link
          href={crearHref(name)}
          // 19px bold label (AA on --brand); tight gaps so "Crear el seu llibre" fits at 360px
          className={buttonClass({ className: "h-12 min-w-0 flex-1 gap-1.5! px-4! sm:flex-none sm:px-8!" })}
        >
          <span className="min-w-0 truncate">{ctaLabel}</span>
          <span
            aria-hidden
            className="material-symbols-outlined inline-block w-5 shrink-0 overflow-hidden text-xl leading-5 transition-transform group-hover:translate-x-1"
          >
            arrow_forward
          </span>
        </Link>
      </div>
    </div>
  );
}
