"use client";

import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cx } from "./cx";
import s from "./BrandLoader.module.css";

/*
 * The Meapica book mark, redrawn as strokes (viewBox units, traced over
 * /images/m-icon.png): left page, spine swash (a filled shape revealed by a
 * masked stroke so it keeps the logo's swell), right page, two loose leaves.
 */
const VIEWBOX = "96 96 832 832";
const LEFT_PAGE = "M156 712 C170 540 172 380 156 208 C300 204 445 240 506 342";
const RIGHT_PAGE = "M512 866 C575 770 700 716 862 712 C846 540 846 370 864 206 C700 208 566 244 506 342";
const SPINE_PATH = "M504 318 C470 450 440 620 470 800 C480 860 500 880 520 880";
const SPINE_FILL =
  "M466 350 C466 320 486 302 506 302 C526 302 546 320 546 350 C540 400 530 440 534 480 C530 580 540 690 560 790 L572 858 C556 888 530 906 500 906 C468 906 438 885 424 830 C400 740 414 630 440 520 C452 460 466 400 466 350 Z";
const PAGE_TINT = "M548 800 C600 740 700 720 862 712 C846 540 846 370 864 206 C700 208 566 244 520 330 C540 400 530 560 548 800 Z";
const LEAF_LEFT = "M458 292 C410 200 320 140 226 126";
const LEAF_RIGHT = "M556 292 C605 200 700 140 796 124";

const SIZES = { sm: 28, md: 56, lg: 96 } as const;
export type BrandLoaderSize = keyof typeof SIZES;

export interface BrandLoaderProps {
  /** sm 28 px (inline/section), md 56 px (section, default), lg 96 px (full page). */
  size?: BrandLoaderSize;
  /** Visible line under the mark ("Cargando tu cuento…"). Also announced to screen readers. */
  caption?: ReactNode;
  /** Screen-reader label when there is no caption. Defaults to common.loading ("Cargando…"). */
  label?: string;
  /** Wrapper classes. Colour via text-*, default text-brand-deep. */
  className?: string;
}

/**
 * Brand loader: the open-book mark draws itself, settles, and retracts (2.4 s loop).
 * Page and section loading states. For buttons use <Spinner /> from ./Spinner (the draw is illegible at 20 px
 * and too slow for a sub-second wait). Reduced motion: static mark, soft opacity pulse.
 */
export function BrandLoader({ size = "md", caption, label, className }: BrandLoaderProps) {
  const t = useTranslations("common");
  const maskId = `bl-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const px = SIZES[size];
  const svgRef = useRef<SVGSVGElement>(null);

  // Phase-lock every loader to the document timeline so a route loading.tsx handing over to
  // the page's own loader (or two loaders on screen) continues the same stroke, never restarts.
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof svg.getAnimations !== "function") return;
    for (const animation of svg.getAnimations({ subtree: true })) animation.startTime = 0;
  }, []);
  const leaf = 36;
  const page = 80;

  return (
    <div role="status" className={cx("inline-flex flex-col items-center gap-3 text-brand-deep", s.appear, className)}>
      <svg
        ref={svgRef}
        viewBox={VIEWBOX}
        width={px}
        height={px}
        aria-hidden="true"
        focusable="false"
        className={s.mark}
      >
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="96" y="96" width="832" height="832">
            <path className={cx(s.stroke, s.spine, s.spineMask)} strokeWidth={200} d={SPINE_PATH} />
          </mask>
        </defs>
        <path className={s.tint} d={PAGE_TINT} />
        <path className={cx(s.stroke, s.left)} strokeWidth={page} d={LEFT_PAGE} />
        <path fill="currentColor" mask={`url(#${maskId})`} d={SPINE_FILL} />
        <path className={cx(s.stroke, s.right)} strokeWidth={page} d={RIGHT_PAGE} />
        <path className={cx(s.stroke, s.leafLeft)} strokeWidth={leaf} d={LEAF_LEFT} />
        <path className={cx(s.stroke, s.leafRight)} strokeWidth={leaf} d={LEAF_RIGHT} />
      </svg>
      {caption ? (
        <p className="text-center text-sm font-medium text-ink-muted">{caption}</p>
      ) : (
        <span className="sr-only">{label ?? t("loading")}</span>
      )}
    </div>
  );
}

/** Full-viewport centred BrandLoader: route `loading.tsx` files and whole-page waits. */
export function PageLoader({ caption, label, className }: Omit<BrandLoaderProps, "size">) {
  return (
    <div className={cx("flex min-h-[100dvh] items-center justify-center px-4", className)}>
      <BrandLoader size="lg" caption={caption} label={label} />
    </div>
  );
}
