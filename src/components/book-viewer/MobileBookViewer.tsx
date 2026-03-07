"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import HTMLFlipBook from "react-pageflip";
import { useTranslations } from "next-intl";
import MobileBookPage from "./MobileBookPage";
import FullscreenPageViewer from "./FullscreenPageViewer";
import type { BookViewerProps } from "./types";
import { playPageTurnSound } from "./page-turn-sound";

function useIsNarrow(breakpoint = 768) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    setNarrow(mql.matches);
    const handler = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [breakpoint]);
  return narrow;
}

export default function MobileBookViewer({
  pages,
  templateId,
  currentPage,
  onPageChange,
}: BookViewerProps) {
  const t = useTranslations("crear.preview");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flipBookRef = useRef<any>(null);
  const lastReportedPage = useRef(currentPage);
  const isNarrow = useIsNarrow();
  const [fullscreenPage, setFullscreenPage] = useState<number | null>(null);

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

  return (
    <div className="flex flex-col items-center">
      {/* Open book */}
      <div className="book-scene w-full mx-auto">
        <div className="book-body w-full">
          <HTMLFlipBook
            ref={flipBookRef}
            width={isNarrow ? 350 : 420}
            height={isNarrow ? 500 : 560}
            size="stretch"
            minWidth={150}
            maxWidth={isNarrow ? 400 : 520}
            minHeight={200}
            maxHeight={isNarrow ? 570 : 700}
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
          <span className="material-symbols-outlined text-sm">fullscreen</span>
          {t("expandPage")}
        </button>
      )}

      {/* Navigation arrows + dots */}
      <div className={`${isNarrow ? "mt-3" : "mt-5"} flex items-center justify-center gap-3`}>
        <button
          onClick={() => {
            const pf = flipBookRef.current?.pageFlip();
            if (pf) pf.flipPrev();
          }}
          disabled={isOnCover}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border-light bg-white text-text-muted transition-all hover:border-create-primary hover:text-create-primary disabled:opacity-30 disabled:hover:border-border-light disabled:hover:text-text-muted"
          aria-label="Previous page"
        >
          <span className="material-symbols-outlined text-lg">chevron_left</span>
        </button>

        <div className="flex items-center gap-1.5 flex-wrap">
          {pages.map((p, i) => {
            const isLocked = p.type === "scene" && p.locked;
            const isCurrent = i === currentPage;
            return (
              <button
                key={i}
                onClick={() => {
                  const pf = flipBookRef.current?.pageFlip();
                  if (pf) pf.flip(i);
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  isCurrent
                    ? isLocked
                      ? "w-5 bg-text-muted"
                      : "w-5 bg-create-primary"
                    : isLocked
                      ? "w-1.5 bg-border-light/50"
                      : "w-1.5 bg-border-light hover:bg-text-muted"
                }`}
                aria-label={`Go to page ${i + 1}`}
              />
            );
          })}
        </div>

        <button
          onClick={() => {
            const pf = flipBookRef.current?.pageFlip();
            if (pf) pf.flipNext();
          }}
          disabled={isOnBack}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border-light bg-white text-text-muted transition-all hover:border-create-primary hover:text-create-primary disabled:opacity-30 disabled:hover:border-border-light disabled:hover:text-text-muted"
          aria-label="Next page"
        >
          <span className="material-symbols-outlined text-lg">chevron_right</span>
        </button>
      </div>

      {/* Interaction hint */}
      <p className="mt-2 text-center text-xs text-text-muted">
        {t("swipeHint")}
      </p>

      {/* Fullscreen page viewer modal */}
      {fullscreenPage !== null && (
        <FullscreenPageViewer
          pages={pages}
          templateId={templateId}
          initialPage={fullscreenPage}
          onClose={() => setFullscreenPage(null)}
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
