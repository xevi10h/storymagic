import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export type CardVariant = "outline" | "elevated" | "plain";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  /**
   * outline  = 2px --line border (form groups, option rows, the format picker)
   * elevated = 24px radius + soft shadow + hairline ring (purchase panel, main panels)
   * plain    = white on paper, no border (status notes, progress box)
   */
  variant?: CardVariant;
  /** Option-card state (outline only): orange border + faint orange wash. */
  selected?: boolean;
  /** Hover affordance for clickable cards (outline only). */
  interactive?: boolean;
  as?: ElementType;
}

const VARIANTS: Record<CardVariant, string> = {
  outline: "rounded-2xl border-2 bg-surface",
  elevated: "rounded-3xl bg-surface shadow-card ring-1 ring-line",
  plain: "rounded-2xl bg-surface",
};

/** Brand surface. Padding is up to the caller (p-4 sm:p-5 is the default rhythm). */
export function Card({ children, variant = "outline", selected = false, interactive = false, as: Tag = "div", className, ...rest }: CardProps) {
  return (
    <Tag
      className={cx(
        VARIANTS[variant],
        variant === "outline" &&
          (selected ? "border-brand bg-brand/[0.04]" : cx("border-line", interactive && "transition-colors hover:border-brand/40")),
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
