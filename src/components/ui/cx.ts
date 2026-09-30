/** Join class names, skipping falsy values. Tiny local helper (no clsx dependency). */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Keyboard focus ring used across the brand (see docs/brand.md › Focus). */
export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
