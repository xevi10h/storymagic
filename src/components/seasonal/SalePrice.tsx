"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatPrice } from "@/lib/pricing";
import { BLACK_FRIDAY, blackFridayPriceCents, isBlackFriday, lowestPrice30Days } from "@/lib/black-friday";
import { formatSeasonDate, useSeasonToday } from "./season-client";

// Black Friday prices on the client (src/lib/black-friday.ts). The [locale] layout renders the
// page with its render date (ISR, hourly) through SeasonTodayProvider, so the sale price is in the
// static HTML (Google's landing-page check for the feed's sale_price); after hydration the live
// client date takes over, so a page rendered before the end never shows the offer after it.

const SeasonTodayContext = createContext<string | null>(null);

/** Hands the server render date (Spain, YYYY-MM-DD) to every client component below. */
export function SeasonTodayProvider({ today, children }: { today: string; children: ReactNode }) {
  return <SeasonTodayContext.Provider value={today}>{children}</SeasonTodayContext.Provider>;
}

/** Today in Spain: the server render date, then the live client date (dev: ?now=YYYY-MM-DD). */
export function useToday(): string | null {
  return useSeasonToday(useContext(SeasonTodayContext));
}

/** Is the Black Friday offer on (render date on the server, live date on the client)? */
export function useBlackFriday(): boolean {
  return isBlackFriday(useToday());
}

/** "30 de noviembre": the offer's last day, in the page locale. */
export function useBlackFridayEnd(): string {
  return formatSeasonDate(BLACK_FRIDAY.to, useLocale());
}

/** The struck list price inherits the surrounding colour (light and dark surfaces alike). */
const was = (chunks: ReactNode) => <s className="font-normal opacity-70 decoration-1">{chunks}</s>;

/**
 * A price that drops during Black Friday: outside the window it renders `children` (the page's
 * own regular price line, untouched); inside, the struck list price + the sale price.
 *  - variant "from": "Desde ~~34,90 €~~ 27,92 €" (the "desde" teasers)
 *  - variant "price": "~~34,90 €~~ 27,92 €"
 * The VAT note stays where each page already puts it ("IVA incluido").
 */
export function SalePrice({
  listCents,
  variant = "from",
  nowClassName = "font-bold",
  children,
}: {
  listCents: number;
  variant?: "from" | "price";
  nowClassName?: string;
  children: ReactNode;
}) {
  const t = useTranslations("blackFriday");
  const locale = useLocale();
  if (!useBlackFriday()) return <>{children}</>;
  return (
    <span data-testid="sale-price">
      {t.rich(variant, {
        was: formatPrice(lowestPrice30Days(listCents), locale),
        price: formatPrice(blackFridayPriceCents(listCents), locale),
        s: was,
        b: (chunks) => <strong className={nowClassName}>{chunks}</strong>,
      })}
    </span>
  );
}
