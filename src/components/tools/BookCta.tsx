"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createPageHref, useHeroName } from "@/components/landing/HeroNameStore";
import { buttonClass } from "@/components/ui";
import { formatChildName } from "@/lib/child-name";
import { deName, firstName } from "@/lib/creation-flow";

/**
 * "Crear el libro de Lucía": the name typed in the tool (HeroNameStore) carries
 * over to /create?name=…, so the parent lands on step 1 already filled in.
 */
export default function BookCta() {
  const t = useTranslations("hero");
  const locale = useLocale();
  const name = firstName(formatChildName(useHeroName().trim()));
  return (
    <Link href={createPageHref(name)} className={buttonClass({ className: "min-h-14 max-w-full sm:px-8" })} data-testid="tool-book-cta">
      <span className="min-w-0 truncate">{name ? t("ctaWithName", { deName: deName(name, locale) }) : t("cta")}</span>
      <span aria-hidden className="material-symbols-outlined shrink-0 text-xl transition-transform group-hover:translate-x-1">
        arrow_forward
      </span>
    </Link>
  );
}
