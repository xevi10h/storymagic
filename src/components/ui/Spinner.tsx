import { cx } from "./cx";
import s from "./BrandLoader.module.css";

export interface SpinnerProps {
  /** Classes on the svg. Sized by font-size (1em) and coloured by currentColor. */
  className?: string;
}

/**
 * Inline spinner for buttons and tiny inline waits: a quiet arc on a faint track, 1em,
 * currentColor. Decorative (aria-hidden): the button carries aria-busy and a gerund label.
 */
export function Spinner({ className }: SpinnerProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cx(s.spinner, className)}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity={0.22} strokeWidth={2.5} />
      <path d="M12 3 a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  );
}
