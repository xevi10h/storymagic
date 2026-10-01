"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card, cx, focusRing } from "@/components/ui";
import type { CatalogWorld } from "./BookCollectionData";

interface BookCollectionCardProps {
  world: CatalogWorld;
  /** Formatted lowest price ("34,90 €"), from src/lib/pricing. */
  fromPrice: string;
  className?: string;
}

/** Card sizes: carousel card ≤ 280 px below xl, grid column ≤ 224 px on wide desktop. */
const COVER_SIZES = "(max-width: 1279px) 280px, 224px";

export default function BookCollectionCard({ world, fromPrice, className }: BookCollectionCardProps) {
  const t = useTranslations("bookCollection");
  const td = useTranslations("data");
  const tPricing = useTranslations("pricing");
  const { template, example } = world;
  const title = td(`templates.${template.id}.title`);
  // The creation flow reads ?template= and opens with this world pre-chosen.
  const createHref = `/create?template=${template.id}&from=catalog`;

  return (
    // The whole card is one link to /create (stretched ::after over the card); "Ver por dentro"
    // sits above it (z-10), so there are no nested interactive elements.
    <Card as="article" interactive className={cx("group relative flex flex-col overflow-hidden", className)}>
      {/* Covers are square (the book is 20 × 20 cm): no cropping. */}
      <div className="relative aspect-square w-full bg-line">
        <Image
          src={example?.coverImage ?? template.image}
          alt={example ? example.title : title}
          fill
          sizes={COVER_SIZES}
          className="object-cover"
        />
        <span className="absolute left-2.5 top-2.5 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-ink-soft shadow-sm tabular-nums">
          {td("ageRange", { min: template.ageMin, max: template.ageMax })}
        </span>
        {example && (
          <Link
            href={`/examples/${example.id}`}
            className={cx(
              "absolute bottom-2.5 left-2.5 z-10 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/95 px-3.5 text-[13px] font-bold text-ink-soft shadow-sm transition-colors hover:text-brand-text",
              focusRing,
            )}
          >
            <span aria-hidden className="material-symbols-outlined inline-block w-5 overflow-hidden text-lg leading-5">
              menu_book
            </span>
            {t("seeInside")}
            <span className="sr-only">: {example.title}</span>
          </Link>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-lg font-semibold leading-tight text-ink text-balance">
          <Link
            href={createHref}
            className="rounded-2xl outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-brand"
          >
            {title}
            <span className="sr-only">: {t("cta")}</span>
          </Link>
        </h3>
        <p className="mt-1 line-clamp-2 text-sm leading-snug text-ink-muted">{td(`templates.${template.id}.description`)}</p>
        <div className="mt-auto pt-3">
          <p className="text-sm text-ink-soft tabular-nums">
            <span className="whitespace-nowrap">
              {t.rich("priceFrom", {
                price: fromPrice,
                b: (chunks) => <strong className="font-bold text-brand-deep">{chunks}</strong>,
              })}
            </span>{" "}
            {/* Same line in the carousel; its own line in the narrow 5-column grid (xl). */}
            <span className="whitespace-nowrap text-xs text-ink-muted xl:block">
              <span aria-hidden className="xl:hidden">· </span>
              {tPricing("vatIncluded")}
            </span>
          </p>
          {/* Visual affordance only: the card itself is the link. */}
          <span
            aria-hidden
            className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-brand-text"
          >
            {t("cta")}
            <span className="material-symbols-outlined inline-block w-5 overflow-hidden text-lg leading-5 transition-transform group-hover:translate-x-1 motion-reduce:transition-none">
              arrow_forward
            </span>
          </span>
        </div>
      </div>
    </Card>
  );
}
