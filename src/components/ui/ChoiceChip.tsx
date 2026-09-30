import type { ButtonHTMLAttributes } from "react";
import { cx, focusRing } from "./cx";

export interface ChoiceChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "role"> {
  selected: boolean;
  /** solid = filled orange when selected (short values: ages) · soft = tinted (words: "Una niña", "Redondas"). */
  tone?: "solid" | "soft";
}

/**
 * Single-choice chip (role="radio"); wrap a set in `role="radiogroup"` with a label.
 * Extracted from the creation flow's age / gender / glasses chips.
 */
export function ChoiceChip({ selected, tone = "soft", className, type = "button", children, ...rest }: ChoiceChipProps) {
  return (
    <button
      type={type}
      role="radio"
      aria-checked={selected}
      className={cx(
        "flex min-h-11 items-center justify-center rounded-xl border-2 px-3 py-2 text-sm font-bold leading-tight transition-colors",
        focusRing,
        selected
          ? tone === "solid"
            ? "border-brand bg-brand text-white"
            : "border-brand bg-brand/10 text-brand-text"
          : "border-line bg-surface text-ink-soft hover:border-brand/40",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
