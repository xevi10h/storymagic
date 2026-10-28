"use client";

import type { FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { buttonClass } from "@/components/ui";
import { MAX_NAME_LENGTH } from "@/lib/creation-flow";
import { formatChildName } from "@/lib/child-name";
import { useDeliveryLine } from "@/components/purchase/delivery";
import {
  createPageHref,
  currentCarriedParams,
  setHeroName,
  useHeroName,
} from "@/components/landing/HeroNameStore";
import { trackEvent } from "@/lib/tracking/consent";

function ArrowIcon() {
  return (
    <span
      aria-hidden
      className="material-symbols-outlined inline-block w-5 shrink-0 overflow-hidden text-xl leading-5 transition-transform group-hover:translate-x-1"
      data-icon="arrow_forward"
    />
  );
}

/** Same hand-off as the landing hero: format the name, keep it in HeroNameStore, open /create?name=… (+ the ad's UTMs). */
function useGoToCreate(placement: string) {
  const router = useRouter();
  const name = useHeroName();
  return () => {
    trackEvent("cta_click", { placement });
    const formatted = formatChildName(name);
    setHeroName(formatted);
    router.push(createPageHref(formatted, currentCarriedParams()));
  };
}

/**
 * Ad landing name field + CTA. Shares HeroNameStore with MobileStickyCta, so the name typed here
 * travels with every CTA of the page. Without JS it is a plain GET to /{locale}/create?name=….
 * `#hero-cta` is what MobileStickyCta watches to appear once this button scrolls away.
 */
export function AdNameForm({ ctaLabel }: { ctaLabel: string }) {
  const t = useTranslations("hero");
  const locale = useLocale();
  const name = useHeroName();
  const go = useGoToCreate("ad_hero");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    go();
  }

  return (
    <form action={`/${locale}/create`} method="get" onSubmit={onSubmit} noValidate className="flex flex-col gap-2.5">
      <label htmlFor="ad-name" className="text-[13px] font-bold text-ink-soft">
        {t("nameLabel")}
      </label>
      <input
        id="ad-name"
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
        className="h-[52px] w-full min-w-0 rounded-xl border-[1.5px] border-line-warm bg-surface px-4 text-[17px] font-semibold text-ink outline-none transition-colors placeholder:font-normal placeholder:text-ink-muted focus:border-brand"
      />
      <button id="hero-cta" type="submit" className={buttonClass({ block: true, className: "min-h-14" })}>
        <span className="min-w-0 break-words">{ctaLabel}</span>
        <ArrowIcon />
      </button>
    </form>
  );
}

/** Closing CTA (no field: the name typed above, if any, is already in HeroNameStore). */
export function AdCreateButton({ ctaLabel }: { ctaLabel: string }) {
  const go = useGoToCreate("ad_final");
  return (
    <button type="button" onClick={go} className={buttonClass({ block: true, className: "min-h-14" })}>
      <span className="min-w-0 break-words">{ctaLabel}</span>
      <ArrowIcon />
    </button>
  );
}

/** "Llega entre el 5 y el 10 de noviembre · fecha estimada" (softcover, ordered today); reserved line until hydration. */
export function AdDeliveryLine() {
  const tPurchase = useTranslations("crear.purchase");
  const delivery = useDeliveryLine("softcover");
  return (
    <span className="block min-h-5 text-[13px] font-semibold leading-5 text-success">
      {delivery && (
        <>
          {delivery} <span className="whitespace-nowrap">· {tPurchase("deliveryEstimate")}</span>
        </>
      )}
    </span>
  );
}
