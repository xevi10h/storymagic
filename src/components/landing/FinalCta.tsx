"use client";

import type { FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getPathname, useRouter } from "@/i18n/navigation";
import LiveCover from "@/components/crear/LiveCover";
import { buttonClass } from "@/components/ui";
import { MAX_NAME_LENGTH, deName, firstName } from "@/lib/creation-flow";
import { formatChildName } from "@/lib/child-name";
import { PRICING, formatPrice } from "@/lib/pricing";
import { crearHref, setHeroName, useHeroName } from "./HeroNameStore";

/**
 * Last section of the landing: one emotional line + "¿Cómo se llama?". It shares the
 * hero's name (HeroNameStore): a name typed at the top is already here, so this is the
 * same field at the close, not a second form. The name renders the real cover live and
 * deep-links to /crear?name=… (step 1 pre-filled).
 * Works without JS too: the form is a plain GET to the localized /crear.
 */
export default function FinalCta() {
  const t = useTranslations("finalCta");
  const locale = useLocale();
  const router = useRouter();
  const name = useHeroName();

  const trimmed = name.trim();
  const first = firstName(formatChildName(trimmed));
  const fromPrice = formatPrice(PRICING.softcover.price, locale);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formatted = formatChildName(trimmed);
    setHeroName(formatted);
    router.push(crearHref(formatted));
  }

  return (
    <section id="final-cta" aria-labelledby="final-cta-title" className="bg-paper px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto grid max-w-[1120px] items-center gap-10 rounded-3xl bg-surface p-6 ring-1 ring-line sm:p-10 lg:grid-cols-[1fr_360px] lg:gap-16 lg:p-14">
        <div className="order-2 lg:order-1">
          <h2 id="final-cta-title" className="text-balance font-display text-[28px] font-bold leading-[1.12] text-ink sm:text-4xl lg:text-[44px]">
            {t("title")}
          </h2>
          <p className="mt-3 max-w-prose text-base leading-relaxed text-ink-body sm:text-lg">{t("subtitle")}</p>

          <form
            action={getPathname({ href: "/crear", locale })}
            method="get"
            onSubmit={onSubmit}
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {/* Same label style as the hero's name field: it is the same question. */}
              <label htmlFor="final-cta-name" className="font-display text-lg font-semibold text-ink lg:text-xl">
                {t("nameLabel")}
              </label>
              <input
                id="final-cta-name"
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
                className="h-14 w-full rounded-2xl border-2 border-line bg-surface px-4 font-display text-xl font-semibold text-ink outline-none transition-colors placeholder:font-normal placeholder:text-ink-muted/60 focus:border-brand sm:h-16 sm:text-2xl"
              />
            </div>
            <button
              type="submit"
              className={buttonClass({
                className: "min-h-14 max-w-full sm:min-h-16 sm:px-8 sm:text-lg",
              })}
            >
              <span className="truncate">{first ? t("ctaWithName", { deName: deName(first, locale) }) : t("cta")}</span>
              <span aria-hidden className="material-symbols-outlined text-xl transition-transform group-hover:translate-x-1">
                arrow_forward
              </span>
            </button>
          </form>

          <p className="mt-4 text-sm font-medium text-ink-soft">{t("meta", { price: fromPrice })}</p>
        </div>

        <div className="order-1 mx-auto w-[56vw] max-w-[230px] lg:order-2 lg:w-full lg:max-w-[360px]">
          <LiveCover name={trimmed} templateId={null} sizes="(max-width: 1024px) 230px, 360px" />
        </div>
      </div>
    </section>
  );
}
