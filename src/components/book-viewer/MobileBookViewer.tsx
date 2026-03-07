"use client";

import { useRef, useCallback, useEffect } from "react";
import HTMLFlipBook from "react-pageflip";
import { useTranslations } from "next-intl";
import MobileBookPage from "./MobileBookPage";
import type { BookViewerProps } from "./types";
import { playPageTurnSound } from "./page-turn-sound";

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
            width={420}
            height={560}
            size="stretch"
            minWidth={150}
            maxWidth={520}
            minHeight={200}
            maxHeight={700}
            showCover={true}
            drawShadow={true}
            flippingTime={700}
            usePortrait={false}
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

      {/* Navigation arrows + dots */}
      <div className="mt-5 flex items-center justify-center gap-3">
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
    </div>
  );
}
