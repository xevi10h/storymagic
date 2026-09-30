"use client";

import { useRef, useCallback, useEffect, useState, useSyncExternalStore } from "react";
import HTMLFlipBook from "react-pageflip";
import { useTranslations } from "next-intl";
import MobileBookPage from "./MobileBookPage";
import FullscreenPageViewer from "./FullscreenPageViewer";
import { getBookPageNumber } from "./types";
import type { BookViewerProps } from "./types";
import { playPageTurnSound } from "./page-turn-sound";

// null = not yet measured (SSR). The flip book must NOT mount until this
// resolves: react-pageflip reads usePortrait only on init, so mounting with
// the wrong mode leaves the cover clipped on phones.
function useIsNarrow(breakpoint = 768): boolean | null {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches,
    () => null,
  );
}

export default function MobileBookViewer({
  pages,
  templateId,
  gender,
  favoriteColor,
  currentPage,
  onPageChange,
  onEdit,
  onOrder,
  hidePageCount = false,
}: BookViewerProps) {
  const t = useTranslations("crear.preview");
  const tPurchase = useTranslations("crear.purchase");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flipBookRef = useRef<any>(null);
  const lastReportedPage = useRef(currentPage);
  const isNarrow = useIsNarrow();
  const [fullscreenPage, setFullscreenPage] = useState<number | null>(null);
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const [sceneWidth, setSceneWidth] = useState<number | null>(null);
  // Hide the raw page stack until page-flip lays it out (avoids a flash of
  // all pages flowing as a plain grid on mount).
  const [flipReady, setFlipReady] = useState(false);

  // Measure the available width before mounting the flip book: page-flip only
  // honors min/maxWidth as fixed pixel bounds, so they must derive from the
  // real container or single-page (portrait) mode overflows on phones.
  // The callback ref re-attaches the observer when the placeholder swaps for
  // the real scene container.
  const observerRef = useRef<ResizeObserver | null>(null);
  const attachScene = useCallback((el: HTMLDivElement | null) => {
    sceneRef.current = el;
    observerRef.current?.disconnect();
    if (!el) return;
    const measure = () =>
      setSceneWidth(Math.floor(el.getBoundingClientRect().width));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    observerRef.current = ro;
  }, []);
  useEffect(() => () => observerRef.current?.disconnect(), []);

  // Sync external page changes to the flip book
  useEffect(() => {
    if (
      flipBookRef.current &&
      currentPage !== lastReportedPage.current
    ) {
      const pageFlip = flipBookRef.current.pageFlip();
      if (pageFlip) {
        pageFlip.flip(currentPage);
        lastReportedPage.current = currentPage;
      }
    }
  }, [currentPage]);

  const handleFlip = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => {
      const newPage = e.data as number;
      lastReportedPage.current = newPage;
      onPageChange(newPage);
      playPageTurnSound();
    },
    [onPageChange]
  );

  const isOnCover = currentPage === 0;
  const isOnBack = currentPage === pages.length - 1;
  // Two-page (landscape) view: the cover sits alone in the right half and a lone back
  // cover in the left half. Slide the book by a quarter so a single page is centred.
  const loneBack = isOnBack && pages.length % 2 === 0;
  const centreShift = isNarrow ? 0 : isOnCover ? -25 : loneBack ? 25 : 0;

  // Page size for phones: exactly the container width, capped at 400.
  const portraitSize = sceneWidth !== null ? Math.min(sceneWidth, 400) : null;
  const ready = isNarrow !== null && (!isNarrow || portraitSize !== null);

  // Wait for the viewport/container measurement before mounting the flip book
  if (!ready) {
    return (
      <div className="flex flex-col items-center w-full">
        <div ref={attachScene} className="book-scene w-full mx-auto">
          <div className="book-body w-full mx-auto aspect-square max-w-[420px] animate-pulse rounded-lg bg-create-neutral/40" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {/* Open book */}
      <div ref={attachScene} className="book-scene w-full mx-auto">
        <div
          className={`book-body w-full transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none ${
            flipReady ? "opacity-100" : "opacity-0"
          }`}
          style={centreShift ? { transform: `translateX(${centreShift}%) rotateX(2deg)` } : undefined}
        >
          <HTMLFlipBook
            key={isNarrow ? `portrait-${portraitSize}` : "landscape"}
            onInit={() => setFlipReady(true)}
            ref={flipBookRef}
            width={isNarrow ? portraitSize! : 420}
            height={isNarrow ? portraitSize! : 420}
            size={isNarrow ? "fixed" : "stretch"}
            // page-flip picks portrait only when blockWidth < 2*minWidth, so on
            // phones the bounds are pinned to the measured container width.
            minWidth={isNarrow ? portraitSize! : 150}
            maxWidth={isNarrow ? portraitSize! : 520}
            minHeight={150}
            maxHeight={isNarrow ? portraitSize! : 520}
            showCover={true}
            drawShadow={true}
            flippingTime={700}
            usePortrait={isNarrow}
            mobileScrollSupport={true}
            swipeDistance={30}
            showPageCorners={true}
            maxShadowOpacity={0.5}
            useMouseEvents={true}
            clickEventForward={true}
            startPage={currentPage}
            startZIndex={0}
            autoSize={true}
            disableFlipByClick={false}
            onFlip={handleFlip}
            className="book-flip"
            style={{}}
          >
            {pages.map((page, i) => (
              <MobileBookPage
                key={i}
                page={page}
                templateId={templateId}
                gender={gender}
                favoriteColor={favoriteColor}
                pageNumber={page.type === "scene" ? getBookPageNumber(pages, i) : undefined}
                onEdit={onEdit}
                onOrder={onOrder}
              />
            ))}
          </HTMLFlipBook>
        </div>
      </div>

      {/* Fullscreen expand button (mobile only) */}
      {isNarrow && (
        <button
          onClick={() => setFullscreenPage(currentPage)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border-light bg-white px-4 py-1.5 text-xs text-text-muted transition-colors hover:border-create-primary hover:text-create-primary"
        >
          <span aria-hidden className="material-symbols-outlined text-sm">fullscreen</span>
          {t("expandPage")}
        </button>
      )}

      {/* Navigation arrows + progress */}
      <div className={`${isNarrow ? "mt-3" : "mt-5"} flex items-center justify-center gap-3 w-full max-w-sm mx-auto px-4`}>
        <button
          onClick={() => {
            const pf = flipBookRef.current?.pageFlip();
            if (pf) pf.flipPrev();
          }}
          disabled={isOnCover}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-light bg-white text-text-muted transition-all hover:border-create-primary hover:text-create-primary disabled:opacity-30 disabled:hover:border-border-light disabled:hover:text-text-muted"
          aria-label={t("previous")}
        >
          <span aria-hidden className="material-symbols-outlined text-lg">chevron_left</span>
        </button>

        {/* Progress bar + page number */}
        <div className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full h-1.5 bg-border-light rounded-full overflow-hidden">
            <div
              className="h-full bg-create-primary rounded-full transition-all duration-300"
              style={{ width: `${((currentPage) / Math.max(pages.length - 1, 1)) * 100}%` }}
            />
          </div>
          {!hidePageCount && (
            <span className="text-[10px] font-bold text-text-muted tabular-nums">
              {currentPage + 1} / {pages.length}
            </span>
          )}
        </div>

        <button
          onClick={() => {
            const pf = flipBookRef.current?.pageFlip();
            if (pf) pf.flipNext();
          }}
          disabled={isOnBack}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-light bg-white text-text-muted transition-all hover:border-create-primary hover:text-create-primary disabled:opacity-30 disabled:hover:border-border-light disabled:hover:text-text-muted"
          aria-label={t("next")}
        >
          <span aria-hidden className="material-symbols-outlined text-lg">chevron_right</span>
        </button>
      </div>

      {/* Interaction hint: swipe on phones, click / arrow keys with a mouse */}
      <p className="mt-2 text-center text-xs text-text-muted">
        {isNarrow ? t("swipeHint") : tPurchase("desktopHint")}
      </p>

      {/* Fullscreen page viewer modal */}
      {fullscreenPage !== null && (
        <FullscreenPageViewer
          pages={pages}
          templateId={templateId}
          gender={gender}
          favoriteColor={favoriteColor}
          initialPage={fullscreenPage}
          onClose={() => setFullscreenPage(null)}
          onOrder={
            onOrder
              ? () => {
                  setFullscreenPage(null);
                  onOrder();
                }
              : undefined
          }
          onPageChange={(idx) => {
            // Sync flip book when user swipes in fullscreen
            const pf = flipBookRef.current?.pageFlip();
            if (pf) pf.flip(idx);
            onPageChange(idx);
          }}
        />
      )}
    </div>
  );
}
