import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cx, focusRing } from "@/components/ui";

export interface Crumb {
  label: string;
  /** Omit for the current page (last crumb). */
  href?: string;
}

/**
 * Visible breadcrumb trail for marketing pages (SEO landings, hubs, blog, seasonal).
 * The BreadcrumbList JSON-LD is emitted separately by each page (BreadcrumbJsonLd).
 */
export function Breadcrumbs({ items, label = "Breadcrumb" }: { items: Crumb[]; label?: string }) {
  return (
    <nav aria-label={label} className="text-sm text-ink-muted">
      <ol className="flex flex-wrap items-center gap-x-1">
        {items.map((item, i) => (
          // The current page repeats the H1 right below: phones show only the path to it (no orphan line).
          <li
            key={`${item.label}-${i}`}
            className={cx("min-w-0 items-center gap-x-1", item.href || i === 0 ? "flex" : "hidden sm:flex")}
          >
            {i > 0 && (
              <span aria-hidden className="material-symbols-outlined !text-base text-ink-muted/70">
                chevron_right
              </span>
            )}
            {item.href ? (
              <Link
                href={item.href}
                className={cx(
                  "inline-flex min-h-11 items-center rounded-md font-medium transition-colors hover:text-brand-text",
                  focusRing,
                )}
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="inline-flex min-h-11 min-w-0 items-center truncate font-medium text-ink-soft">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Top band of a marketing page: flat paper, clears the fixed landing Navbar
 * (--landing-nav-h also accounts for the seasonal banner), 1200px content width.
 */
export function PageHero({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <header
      className={cx("bg-paper px-4 pb-12 sm:px-6 sm:pb-16 lg:pb-20", className)}
      style={{ paddingTop: "calc(var(--landing-nav-h, 56px) + 0.5rem)" }}
    >
      <div className="mx-auto max-w-[1200px]">{children}</div>
    </header>
  );
}

/** Marketing H1: one step below the landing display size, same Fredoka scale. */
export const marketingH1 =
  "text-balance font-display text-[32px] font-bold leading-[1.08] text-ink sm:text-5xl lg:text-[56px]";

/** Lead paragraph under a marketing H1. */
export const marketingLead = "text-base leading-relaxed text-ink-body sm:text-lg";

/** Orange kicker above a heading (text-brand-text: AA at 12px, unlike the --brand fill colour). */
export const kicker = "text-xs font-bold uppercase tracking-wide text-brand-text";
