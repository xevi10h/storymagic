import type { ElementType, ReactNode } from "react";
import { cx } from "./cx";

export type EyebrowTone = "ink" | "brand" | "muted";

const EYEBROW_TONES: Record<EyebrowTone, string> = {
  ink: "text-ink-soft", // form labels ("NOMBRE DEL NIÑO O LA NIÑA")
  brand: "text-brand-text", // kickers above a heading ("CAPÍTULO 1")
  muted: "text-ink-muted", // quiet group labels ("ELIGE EL FORMATO")
};

export interface EyebrowProps {
  children: ReactNode;
  tone?: EyebrowTone;
  /** Rendered element: p (default), span, label, legend… */
  as?: ElementType;
  htmlFor?: string;
  id?: string;
  className?: string;
}

/** Small uppercase label/kicker — the creation flow's field labels and chapter kickers. */
export function Eyebrow({ children, tone = "ink", as: Tag = "p", className, ...rest }: EyebrowProps) {
  return (
    <Tag className={cx("text-xs font-bold uppercase tracking-wide", EYEBROW_TONES[tone], className)} {...rest}>
      {children}
    </Tag>
  );
}

export type HeadingSize = "display" | "page" | "section" | "card";

// page/section/card are the creation flow's h1/h2/card titles; display is the
// one step up for landing heroes (docs/brand.md › Typography).
const HEADING_SIZES: Record<HeadingSize, string> = {
  display: "text-[34px] leading-[1.08] sm:text-5xl lg:text-[64px]",
  page: "text-[26px] leading-tight sm:text-4xl",
  section: "text-lg leading-snug sm:text-xl",
  card: "text-base leading-tight",
};

const SUBTITLE_SIZES: Record<HeadingSize, string> = {
  display: "mt-4 text-base sm:text-lg",
  page: "mt-1.5 text-sm sm:text-base",
  section: "mt-1 text-sm",
  card: "mt-0.5 text-xs",
};

export interface HeadingProps {
  children: ReactNode;
  /** Optional line under the title, in --ink-muted. */
  subtitle?: ReactNode;
  /** Optional kicker above the title (brand tone). */
  eyebrow?: ReactNode;
  size?: HeadingSize;
  /** Semantic level; defaults to h1 for display/page, h2 for section, h3 for card. */
  as?: "h1" | "h2" | "h3" | "h4";
  id?: string;
  /** Classes for the wrapper (alignment, max-width…). */
  className?: string;
}

/** Fredoka heading with optional eyebrow + subtitle, sized on the brand scale. */
export function Heading({ children, subtitle, eyebrow, size = "page", as, id, className }: HeadingProps) {
  const Tag = as ?? (size === "section" ? "h2" : size === "card" ? "h3" : "h1");
  return (
    <div className={className}>
      {eyebrow && (
        <Eyebrow tone="brand" className="mb-1">
          {eyebrow}
        </Eyebrow>
      )}
      <Tag id={id} className={cx("font-display font-bold text-ink", HEADING_SIZES[size])}>
        {children}
      </Tag>
      {subtitle && <p className={cx("font-medium text-ink-muted", SUBTITLE_SIZES[size])}>{subtitle}</p>}
    </div>
  );
}
