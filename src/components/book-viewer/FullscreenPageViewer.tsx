"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { getBookPageNumber } from "./types";
import type { BookPage } from "./types";
import MobileBookPage from "./MobileBookPage";

interface FullscreenPageViewerProps {
  pages: BookPage[];
  templateId: string;
  gender?: string;
  initialPage: number;
  onClose: () => void;
  onPageChange: (pageIndex: number) => void;
}

export default function FullscreenPageViewer({
  pages,
  templateId,
  gender,
  initialPage,
  onClose,
  onPageChange,
}: FullscreenPageViewerProps) {
  const t = useTranslations("crear.preview");
  const [current, setCurrent] = useState(initialPage);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(pages.length - 1, idx));
      setCurrent(clamped);
      onPageChange(clamped);
    },
    [pages.length, onPageChange]
  );

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goTo(current - 1);
      if (e.key === "ArrowRight") goTo(current + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [current, goTo, onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
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
    if (Math.abs(touchDeltaX.current) > 50) {
      if (touchDeltaX.current < 0) goTo(current + 1);
      else goTo(current - 1);
    }
    touchDeltaX.current = 0;
  };

  const currentPageData = pages[current];
  const isLocked =
    currentPageData?.type === "scene" && currentPageData?.locked;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 animate-in fade-in duration-200">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-medium tabular-nums">
          {current + 1} / {pages.length}
        </span>
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
          aria-label="Close"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>
      </div>

      {/* Page content — swipeable */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center px-4 pb-4 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="relative w-full max-w-md aspect-square rounded-xl overflow-hidden shadow-2xl">
          <MobileBookPage
            page={pages[current]}
            templateId={templateId}
            gender={gender}
            pageNumber={pages[current].type === "scene" ? getBookPageNumber(pages, current) : undefined}
          />
        </div>
      </div>

      {/* Bottom nav */}
      <div className="flex items-center justify-center gap-4 px-4 pb-6">
        <button
          onClick={() => goTo(current - 1)}
          disabled={current === 0}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-30"
          aria-label="Previous"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>

        {isLocked ? (
          <button
            onClick={() => {
              onClose();
              setTimeout(() => {
                const el = document.getElementById("checkout-section");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 300);
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-create-primary px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-create-primary/30 transition-colors hover:bg-create-primary-hover"
          >
            <span className="material-symbols-outlined text-base">shopping_bag</span>
            {t("lockedCta")}
          </button>
        ) : (
          <span className="text-sm text-white/50 tabular-nums">
            {t("swipeHint")}
          </span>
        )}

        <button
          onClick={() => goTo(current + 1)}
          disabled={current === pages.length - 1}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-30"
          aria-label="Next"
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>
    </div>
  );
}
