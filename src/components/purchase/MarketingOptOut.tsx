"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";

/**
 * Opt-out offered at collection (LSSI art. 21.2): an UNCHECKED box, "No quiero recibir
 * ofertas…", plus one line on what we may send. Sent to /api/checkout as
 * `marketingOptOut`; ticked = never commercial email to this buyer (email_suppressions).
 * Shown on every checkout (paywall and "Comprar otra copia").
 */
export function MarketingOptOut({
  checked,
  onChange,
  className = "",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}) {
  const t = useTranslations("pricing.marketingOptOut");
  const noteId = useId();
  return (
    <label
      data-testid="marketing-opt-out"
      className={`flex cursor-pointer items-start gap-2.5 px-3 text-[12.5px] leading-snug text-ink-soft ${className}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={noteId}
        className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-brand"
      />
      <span>
        {t("label")}
        <span id={noteId} className="mt-0.5 block text-xs text-ink-muted">
          {t("note")}
        </span>
      </span>
    </label>
  );
}
