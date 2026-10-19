import { cx } from "@/components/ui";

const STAR_PATH = "M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45 6.2 20.5l1.1-6.45-4.7-4.6 6.5-.95z";

/** One star (filled in brand orange or empty). Decorative: the caller labels the group. */
export function Star({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cx("shrink-0", filled ? "text-gold" : "text-line-warm", className)}>
      <path d={STAR_PATH} fill="currentColor" />
    </svg>
  );
}

/** Read-only row of 5 stars with an accessible label ("4 de 5 estrellas"). */
export function Stars({ rating, label, className, starClassName = "h-4 w-4" }: { rating: number; label: string; className?: string; starClassName?: string }) {
  const rounded = Math.round(rating);
  return (
    <span role="img" aria-label={label} className={cx("inline-flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} filled={n <= rounded} className={starClassName} />
      ))}
    </span>
  );
}
