"use client";

import { useRef, useCallback, useEffect, useState, useSyncExternalStore } from "react";
import HTMLFlipBook from "react-pageflip";
import { useTranslations } from "next-intl";
import MobileBookPage, { BOOK_LAYOUT_PX } from "./MobileBookPage";
import FullscreenPageViewer from "./FullscreenPageViewer";
import { getBookPageNumber } from "./types";
import type { BookViewerProps } from "./types";
import { playPageTurnSound } from "./page-turn-sound";
import { spreadCount, spreadIndexOf, spreadLabel, spreadPages } from "./spreads";

// null = not yet measured (SSR). The flip book must NOT mount until this
// resolves: its size props are only read on init.
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

/**
 * The book as it is printed, on every screen: the cover alone, then two facing pages
 * (react-pageflip landscape mode, same pairing as print — see ./spreads).
 *
 * Phones: the spread fills the width (a 2:1 box), each page laid out at its full size and
 * scaled down (MobileBookPage `scale`), swipe turns the spread, a tap on a page opens it
 * enlarged (FullscreenPageViewer; a phone held sideways sees the spread big).
 * Desktop: the flip book stretches to its column; clicking a page turns it.
 */
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
  actions,
}: BookViewerProps) {
  const t = useTranslations("crear.preview");
  const tPurchase = useTranslations("crear.purchase");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flipBookRef = useRef<any>(null);
  const lastReportedPage = useRef(currentPage);
  // Page changes mirrored from the fullscreen viewer turn the hidden book silently.
  const silentSync = useRef(false);
  const isNarrow = useIsNarrow();
  const [fullscreenPage, setFullscreenPage] = useState<number | null>(null);
  const [sceneWidth, setSceneWidth] = useState<number | null>(null);
  // Hide the raw page stack until page-flip lays it out (avoids a flash of
  // all pages flowing as a plain grid on mount).
  const [flipReady, setFlipReady] = useState(false);

  // Measure the available width before mounting the flip book: in fixed mode page-flip
  // takes the page size in pixels, so on phones it must derive from the real container.
  // The callback ref re-attaches the observer when the placeholder swaps for the real scene.
  //
  // Touch taps: browsers follow a tap with compatibility mouse events, which page-flip reads
  // as a click on the page (a turn). On phones a tap opens the page instead, so a mousedown
  // right after a touch is stopped before it reaches the book (capture on the ancestor).
  const cleanupRef = useRef<(() => void) | null>(null);
  const attachScene = useCallback((el: HTMLDivElement | null) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (!el) return;
    const measure = () => setSceneWidth(Math.floor(el.getBoundingClientRect().width));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    let lastTouch = 0;
    const onTouchStart = () => {
      lastTouch = Date.now();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (Date.now() - lastTouch < 1000) e.stopPropagation();
    };
    el.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
    el.addEventListener("mousedown", onMouseDown, true);
    cleanupRef.current = () => {
      ro.disconnect();
      el.removeEventListener("touchstart", onTouchStart, true);
      el.removeEventListener("mousedown", onMouseDown, true);
    };
  }, []);
  useEffect(() => () => cleanupRef.current?.(), []);

  // Sync external page changes (keyboard, fullscreen) to the flip book
  useEffect(() => {
    if (flipBookRef.current && currentPage !== lastReportedPage.current) {
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
      if (silentSync.current) silentSync.current = false;
      else playPageTurnSound();
    },
    [onPageChange],
  );

  const total = pages.length;
  const shown = spreadPages(currentPage, total);
  const spreadIdx = spreadIndexOf(currentPage, total);
  const spreads = spreadCount(total);
  const isFirst = spreadIdx === 0;
  const isLast = spreadIdx >= spreads - 1;
  // A lone page (the cover on the right, an even book's back cover on the left) is centred:
  // the book slides by a quarter of its width.
  const single = shown.length === 1;
  const centreShift = single ? (shown[0] === 0 ? -25 : 25) : 0;

  // Two pages across the measured width (desktop: 150–520 px a page). Every page is laid
  // out at BOOK_LAYOUT_PX and scaled to this size, so text wraps as printed at any size.
  const pagePx =
    sceneWidth !== null ? (isNarrow ? Math.floor(sceneWidth / 2) : Math.max(150, Math.min(520, Math.floor(sceneWidth / 2)))) : null;
  const ready = isNarrow !== null && pagePx !== null;

  if (!ready) {
    return (
      <div className="flex flex-col items-center w-full">
        <div ref={attachScene} className="book-scene w-full mx-auto max-md:-mx-2 max-md:w-[calc(100%+1rem)]">
          <div className="book-body w-full mx-auto aspect-[2/1] animate-pulse rounded-lg bg-create-neutral/40" />
        </div>
      </div>
    );
  }

  const scale = pagePx! / BOOK_LAYOUT_PX;
  // Small pages (phones, a phone held sideways): a tap opens the page enlarged instead of turning it.
  const zoomable = !!isNarrow || pagePx! < 300;

  return (
    <div className="flex flex-col items-center">
      {/* Open book */}
      <div
        ref={attachScene}
        className="book-scene w-full mx-auto max-md:-mx-2 max-md:w-[calc(100%+1rem)]"
        data-testid="book-viewer"
        data-spread={shown.join("-")}
      >
        <div
          className={`book-body w-full transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none ${
            flipReady ? "opacity-100" : "opacity-0"
          }`}
          data-single={single}
          style={
            centreShift
              ? { transform: isNarrow ? `translateX(${centreShift}%)` : `translateX(${centreShift}%) rotateX(2deg)` }
              : undefined
          }
        >
          <HTMLFlipBook
            key={`book-${pagePx}`}
            onInit={() => setFlipReady(true)}
            ref={flipBookRef}
            width={pagePx!}
            height={pagePx!}
            size="fixed"
            minWidth={pagePx!}
            maxWidth={pagePx!}
            minHeight={pagePx!}
            maxHeight={pagePx!}
            showCover={true}
            drawShadow={true}
            flippingTime={isNarrow ? 600 : 700}
            // Always two facing pages, as printed (the cover and a lone back cover alone).
            usePortrait={false}
            mobileScrollSupport={true}
            swipeDistance={30}
            showPageCorners={!zoomable}
            maxShadowOpacity={0.5}
            useMouseEvents={true}
            clickEventForward={true}
            startPage={currentPage}
            startZIndex={0}
            autoSize={true}
            // Phones: a tap opens the page enlarged; swipes (and the page corners) turn it.
            disableFlipByClick={zoomable}
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
                scale={scale}
                onOpen={zoomable ? () => setFullscreenPage(i) : undefined}
              />
            ))}
          </HTMLFlipBook>
        </div>
      </div>

      {/* Navigation arrows + progress (by spread) */}
      <div className={`${isNarrow ? "mt-4" : "mt-5"} flex items-center justify-center gap-3 w-full max-w-sm mx-auto px-4`}>
        <button
          type="button"
          onClick={() => flipBookRef.current?.pageFlip()?.flipPrev()}
          disabled={isFirst}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-light bg-white text-text-muted transition-all hover:border-create-primary hover:text-create-primary disabled:opacity-30 disabled:hover:border-border-light disabled:hover:text-text-muted"
          aria-label={t("previous")}
          data-testid="book-prev"
        >
          <span aria-hidden className="material-symbols-outlined text-lg">chevron_left</span>
        </button>

        <div className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full h-1.5 bg-border-light rounded-full overflow-hidden">
            <div
              className="h-full bg-create-primary rounded-full transition-all duration-300"
              style={{ width: `${(spreadIdx / Math.max(spreads - 1, 1)) * 100}%` }}
            />
          </div>
          {!hidePageCount && (
            <span className="text-[11px] font-bold text-text-muted tabular-nums" data-testid="book-page-count">
              {spreadLabel(currentPage, total)}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => flipBookRef.current?.pageFlip()?.flipNext()}
          disabled={isLast}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-light bg-white text-text-muted transition-all hover:border-create-primary hover:text-create-primary disabled:opacity-30 disabled:hover:border-border-light disabled:hover:text-text-muted"
          aria-label={t("next")}
          data-testid="book-next"
        >
          <span aria-hidden className="material-symbols-outlined text-lg">chevron_right</span>
        </button>
      </div>

      {/* Phones: the pages are small, so enlarging is the obvious action; desktop: click / keys */}
      {(zoomable || actions) && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {zoomable && (
            <button
              type="button"
              onClick={() => setFullscreenPage(shown[0])}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border-light bg-white px-4 py-1.5 text-xs font-semibold text-create-text-dark transition-colors hover:border-create-primary hover:text-create-primary"
              data-testid="book-zoom"
            >
              <span aria-hidden className="material-symbols-outlined text-lg text-create-primary">zoom_in</span>
              {t("zoomPage")}
            </button>
          )}
          {actions}
        </div>
      )}
      <p className="mt-2 px-4 text-center text-xs text-text-muted">
        {zoomable ? `${t("swipeHint")} · ${t("tapToZoom")}` : tPurchase("desktopHint")}
      </p>

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
            // Keep the book (hidden behind the viewer) on the same spread, without animating.
            const pf = flipBookRef.current?.pageFlip();
            if (pf && spreadIndexOf(idx, total) !== spreadIndexOf(lastReportedPage.current, total)) {
              silentSync.current = true;
              pf.turnToPage(idx);
            }
          }}
        />
      )}
    </div>
  );
}
