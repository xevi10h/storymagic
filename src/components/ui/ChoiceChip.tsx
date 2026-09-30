import type { ButtonHTMLAttributes } from "react";
import { cx, focusRing } from "./cx";

export interface ChoiceChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "role"> {
  selected: boolean;
}

/**
 * Single-choice chip (role="radio"); wrap a set in `role="radiogroup"` with a label.
 * Extracted from the creation flow's age / gender / glasses chips.
 *
 * Selected = brand border + brand-text on the opaque --brand-tint (4.58:1, AA at
 * any size). Never a solid orange fill: chip labels are ~14px, and white on
 * --brand only passes AA as large text (>= 18.66px bold).
 */
export function ChoiceChip({ selected, className, type = "button", children, ...rest }: ChoiceChipProps) {
  return (
    <button
      type={type}
      role="radio"
      aria-checked={selected}
      className={cx(
        "flex min-h-11 items-center justify-center rounded-xl border-2 px-3 py-2 text-sm font-bold leading-tight transition-colors",
        focusRing,
        selected
          ? "border-brand bg-brand-tint text-brand-text"
          : "border-line bg-surface text-ink-soft hover:border-brand/40",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
