/** Join class names, skipping falsy values. Tiny local helper (no clsx dependency). */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Keyboard focus ring used across the brand (see docs/brand.md › Focus). */
export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

/**
 * AA-safe "orange" for small text (badges, step numbers, avatar initials, urgent tags):
 * brand-text on the opaque --brand-tint (4.58:1) with a brand ring. White on --brand
 * is only 3.2:1, so a solid orange fill may carry text only at >= 19px bold.
 */
export const brandBadge = "bg-brand-tint text-brand-text ring-1 ring-inset ring-brand";
