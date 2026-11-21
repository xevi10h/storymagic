"use client";

import { useLocale, useTranslations } from "next-intl";
import { useToday } from "./SalePrice";
import { guaranteeCopy } from "./guarantee";

/**
 * One short line near a price: "Llega para Nochebuena o te devolvemos el dinero · pide hasta el
 * 10 de diciembre". Renders nothing when no cut-off is open (src/lib/shipping.ts).
 */
export default function GuaranteeLine({ className }: { className?: string }) {
  const t = useTranslations("guarantee");
  const locale = useLocale();
  const today = useToday();
  const copy = today ? guaranteeCopy(today, locale, t) : null;
  if (!copy) return null;
  return (
    <p className={className} data-testid="guarantee-line">
      <span aria-hidden className="material-symbols-outlined mr-1 align-[-3px] text-[16px]" data-icon="verified" />
      {copy.short}
    </p>
  );
}
