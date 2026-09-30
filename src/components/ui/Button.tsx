import type { ButtonHTMLAttributes } from "react";
import { cx, focusRing } from "./cx";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "quiet";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonClassOptions {
  /** primary = orange pill CTA · secondary = white pill, orange outline · quiet = text-only (header actions). */
  variant?: ButtonVariant;
  /** sm = inline/sheet actions (primary renders tinted: see VARIANTS) · md = page CTA, 19px bold · lg = checkout-size, 19px bold, 24px radius. */
  size?: ButtonSize;
  /** Full width; the label may wrap (inline buttons never wrap). */
  block?: boolean;
  className?: string;
}

// Extracted from the creation flow (CreationFooterNav, BookEditSheets, PurchasePanel)
// so landing/SEO CTAs match /crear exactly.
//
// Contrast (WCAG AA): white on --brand is 3.2:1, which passes only as LARGE text
// (>= 18.66px bold). So a filled orange button always carries a 19px bold label
// (md/lg). The small size can't, so `primary` + `sm` renders the AA-safe tinted
// pill instead (brand-text on --brand-tint, 4.58:1) with a full brand border.
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-white shadow-lg shadow-brand/30 hover:bg-brand-hover hover:shadow-xl hover:shadow-brand/40 active:scale-95 disabled:hover:shadow-lg",
  secondary: "border-2 border-brand/20 bg-surface text-brand-text hover:border-brand hover:bg-brand/5",
  quiet: "text-ink-muted hover:bg-line hover:text-ink-soft",
};

/** `primary` at `sm`: too small for white-on-orange, so orange text on a tint. */
const PRIMARY_SMALL = "border-2 border-brand bg-brand-tint text-brand-text hover:bg-surface active:scale-95";

const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-11 rounded-full px-5 text-sm",
  md: "min-h-12 rounded-full px-6 py-2.5 text-[19px] leading-tight sm:px-8",
  lg: "min-h-14 rounded-2xl px-5 py-3.5 text-[19px] leading-tight",
};

/**
 * Class string for a brand button. Use it on anything clickable that should look
 * like a button, including links: `<Link href="/crear" className={buttonClass()}>`.
 */
export function buttonClass({ variant = "primary", size = "md", block = false, className }: ButtonClassOptions = {}) {
  return cx(
    "group inline-flex items-center justify-center gap-2 font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40",
    focusRing,
    variant === "primary" && size === "sm" ? PRIMARY_SMALL : VARIANTS[variant],
    SIZES[size],
    // Block CTAs carry long labels ("Pedir el libro de Lucía · 49,90 €"): let them wrap.
    block ? "w-full text-center" : "whitespace-nowrap",
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, Omit<ButtonClassOptions, "className"> {
  /** Material Symbols name shown after the label; nudges right on hover (e.g. "arrow_forward"). */
  trailingIcon?: string;
  /** Material Symbols name shown before the label (e.g. "arrow_back" nudges left on hover). */
  leadingIcon?: string;
  /** Shows a spinner, disables the button and sets aria-busy. */
  loading?: boolean;
}

/** Brand button. Defaults to type="button" so it never submits a form by accident. */
export function Button({
  variant,
  size,
  block,
  className,
  trailingIcon,
  leadingIcon,
  loading = false,
  disabled,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, block, className })}
      {...rest}
    >
      {loading ? (
        <Spinner className="text-lg" />
      ) : (
        leadingIcon && (
          <span aria-hidden className="material-symbols-outlined text-lg transition-transform group-hover:-translate-x-1">
            {leadingIcon}
          </span>
        )
      )}
      {children}
      {!loading && trailingIcon && (
        <span aria-hidden className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">
          {trailingIcon}
        </span>
      )}
    </button>
  );
}
