"use client";

import { useState, useRef, useCallback, useEffect, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import type { BookPage } from "./types";
import MobileBookPage, { BOOK_LAYOUT_PX } from "./MobileBookPage";
import { spreadCount, spreadIndexOf, spreadLabel, spreadPages, spreadStart } from "./spreads";

interface FullscreenPageViewerProps {
  pages: BookPage[];
  templateId: string;
  gender?: string;
  favoriteColor?: string;
  initialPage: number;
  onClose: () => void;
  onPageChange: (pageIndex: number) => void;
  /** Preview only: CTA on the teaser_order page */
  onOrder?: () => void;
}

/** Wider than tall (a phone held sideways): show the whole spread. */
function useIsLandscape(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia("(orientation: landscape)");
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(orientation: landscape)").matches,
    () => false,
  );
}

/**
 * A page enlarged over the whole screen. Portrait: one page at a time, swipe / arrows
 * page by page. Landscape: the two facing pages as printed, sized to the screen height,
 * navigation by spread.
 */
export default function FullscreenPageViewer({
  pages,
  templateId,
  gender,
  favoriteColor,
  initialPage,
  onClose,
  onPageChange,
  onOrder,
}: FullscreenPageViewerProps) {
  const t = useTranslations("crear.preview");
  const [current, setCurrent] = useState(initialPage);
  const landscape = useIsLandscape();
  const total = pages.length;
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Measured box: landscape → the stage (two pages across, one page high); portrait → the page.
  const [stage, setStage] = useState<{ w: number; h: number } | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const attachStage = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setStage({ w: Math.floor(r.width), h: Math.floor(r.height) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    roRef.current = ro;
  }, []);
  useEffect(() => () => roRef.current?.disconnect(), []);

  const goTo = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(total - 1, idx));
      setCurrent(clamped);
      onPageChange(clamped);
    },
    [total, onPageChange],
  );
  const step = useCallback(
    (dir: 1 | -1) => {
      if (landscape) goTo(spreadStart(spreadIndexOf(current, total) + dir));
      else goTo(current + dir);
    },
    [landscape, current, total, goTo],
  );

  const shown = landscape ? spreadPages(current, total) : [current];
  const atStart = landscape ? spreadIndexOf(current, total) === 0 : current === 0;
  const atEnd = landscape ? spreadIndexOf(current, total) >= spreadCount(total) - 1 : current === total - 1;

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [step, onClose]);

  // Lock body scroll; focus the close button (keyboard / screen readers land in the dialog)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };
  const handleTouchEnd = () => {
    if (Math.abs(touchDeltaX.current) > 50) step(touchDeltaX.current < 0 ? 1 : -1);
    touchDeltaX.current = 0;
  };

  const isLocked = shown.some((i) => {
    const p = pages[i];
    return p?.type === "scene" && p.locked;
  });
  const goToCheckout = () => {
    onClose();
    setTimeout(() => {
      document.getElementById("checkout-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);
  };

  const renderPage = (i: number, scale?: number) => (
    <MobileBookPage
      page={pages[i]}
      templateId={templateId}
      gender={gender}
      favoriteColor={favoriteColor}
      onOrder={onOrder}
      scale={scale}
    />
  );

  const navButton = (dir: 1 | -1, extra = "") => (
    <button
      type="button"
      onClick={() => step(dir)}
      disabled={dir === -1 ? atStart : atEnd}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-30 ${extra}`}
      aria-label={dir === -1 ? t("previous") : t("next")}
    >
      <span aria-hidden className="material-symbols-outlined">{dir === -1 ? "chevron_left" : "chevron_right"}</span>
    </button>
  );

  const counter = landscape ? spreadLabel(current, total) : `${current + 1} / ${total}`;
  const closeButton = (
    <button
      ref={closeRef}
      type="button"
      onClick={onClose}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      aria-label={t("closeZoom")}
      data-testid="fullscreen-close"
    >
      <span aria-hidden className="material-symbols-outlined text-xl">close</span>
    </button>
  );

  if (landscape) {
    // Two pages across the stage, one page high
    const pagePx = stage ? Math.floor(Math.min(stage.w / 2, stage.h)) : 0;
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("zoomTitle")}
        className="fixed inset-0 z-50 flex items-stretch bg-black/95 animate-in fade-in duration-200"
        data-testid="fullscreen-viewer"
        data-mode="spread"
      >
        <div className="flex w-16 shrink-0 flex-col items-center justify-between py-3 pl-[env(safe-area-inset-left)]">
          <span className="text-xs font-medium tabular-nums text-white/80">{counter}</span>
          {navButton(-1)}
          <span />
        </div>
        <div
          ref={attachStage}
          className="relative flex min-w-0 flex-1 items-center justify-center py-3"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {pagePx > 0 && (
            <div className="relative flex shadow-2xl" style={{ height: pagePx }}>
              {shown.map((i) => (
                <div key={i} className="relative overflow-hidden" style={{ width: pagePx, height: pagePx }}>
                  {renderPage(i, pagePx / BOOK_LAYOUT_PX)}
                </div>
              ))}
              {shown.length === 2 && <div aria-hidden className="book-gutter" />}
            </div>
          )}
          {isLocked && (
            <button
              type="button"
              onClick={goToCheckout}
              className="absolute bottom-5 left-1/2 inline-flex min-h-12 -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-create-primary px-6 py-2.5 text-[19px] font-bold leading-tight text-white shadow-lg transition-colors hover:bg-create-primary-hover"
            >
              <span aria-hidden className="material-symbols-outlined text-xl">shopping_bag</span>
              {t("lockedCta")}
            </button>
          )}
        </div>
        <div className="flex w-16 shrink-0 flex-col items-center justify-between py-3 pr-[env(safe-area-inset-right)]">
          {closeButton}
          {navButton(1)}
          <span />
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("zoomTitle")}
      className="fixed inset-0 z-50 flex flex-col bg-black/95 animate-in fade-in duration-200"
      data-testid="fullscreen-viewer"
      data-mode="page"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-medium tabular-nums">{counter}</span>
        {closeButton}
      </div>

      {/* Page content — swipeable */}
      <div
        className="flex-1 flex items-center justify-center px-4 pb-4 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div ref={attachStage} className="relative w-full max-w-md aspect-square rounded-xl overflow-hidden shadow-2xl">
          {stage && stage.w > 0 && renderPage(current, stage.w / BOOK_LAYOUT_PX)}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="flex items-center justify-center gap-4 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {navButton(-1)}
        {isLocked ? (
          <button
            type="button"
            onClick={goToCheckout}
            className="inline-flex min-h-12 items-center gap-2 whitespace-nowrap rounded-full bg-create-primary px-6 py-2.5 text-[19px] font-bold leading-tight text-white shadow-lg shadow-create-primary/30 transition-colors hover:bg-create-primary-hover"
          >
            <span aria-hidden className="material-symbols-outlined text-xl">shopping_bag</span>
            {t("lockedCta")}
          </button>
        ) : (
          <span className="text-center text-xs text-white/60">{t("rotateHint")}</span>
        )}
        {navButton(1)}
      </div>
    </div>
  );
}
