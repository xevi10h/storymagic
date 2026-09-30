"use client";

import React from "react";
import { useLocale, useTranslations } from "next-intl";
import { getBookColors } from "@/lib/template-colors";
import { BookMockup } from "@/components/book-mockup";
import { deName } from "@/lib/creation-flow";
import type { BookPage } from "./types";
import BookPrintPage from "./BookPrintPage";

// Every page is laid out at BOOK_LAYOUT_PX (the desktop page size) and scaled to the size it
// is shown at (MobileBookPage `scale`), so every screen shows the same page. The printed pages
// themselves are drawn by BookPrintPage in the PDF's geometry (container units).

/** Layout size of a page, px (square). */
export const BOOK_LAYOUT_PX = 420;

// ── Main component ────────────────────────────────────────────────────────────

interface MobileBookPageProps {
  page: BookPage;
  templateId: string;
  /** Character gender — influences color palette tinting */
  gender?: string;
  /** Child's favorite color hex — overrides accent palette */
  favoriteColor?: string;
  /** Preview only: ✎ on the cover (title) and dedication pages */
  onEdit?: (target: "cover" | "dedication") => void;
  /** Preview only: CTA of the teaser_order page */
  onOrder?: () => void;
  /**
   * Rendered size ÷ BOOK_LAYOUT_PX. The page content is laid out at the layout
   * size and scaled with a transform, so text wraps exactly as on a full-size page.
   */
  scale?: number;
  /** Tap on the page (not on one of its buttons/links): e.g. open it enlarged. */
  onOpen?: () => void;
}

const MobileBookPage = React.forwardRef<HTMLDivElement, MobileBookPageProps>(
  function MobileBookPage({ page, templateId, gender, favoriteColor, onEdit, onOrder, scale, onOpen }, ref) {
    const colors = getBookColors(templateId, gender, favoriteColor);
    const scaled = scale !== undefined && Math.abs(scale - 1) > 0.001;
    return (
      <div
        ref={ref}
        className={`book-page h-full w-full bg-white overflow-hidden relative ${onOpen ? "cursor-zoom-in" : ""}`}
        onClick={
          onOpen
            ? (e) => {
                if (e.target instanceof Element && e.target.closest("button, a, input, label")) return;
                onOpen();
              }
            : undefined
        }
      >
        {/* Inner wrapper carries CSS custom properties — the outer ref div's
            inline style gets overwritten by react-pageflip, so vars must live here.
            It is also the container (cqi) and, when scaled, the layout-size box. */}
        <div
          className={`absolute @container ${scaled ? "left-0 top-0 origin-top-left" : "inset-0"}`}
          style={{
            ...(scaled
              ? { width: `${100 / scale!}%`, height: `${100 / scale!}%`, transform: `scale(${scale})` }
              : null),
            "--bk-accent": colors.accent,
            "--bk-accent-light": colors.accentLight,
            "--bk-title": colors.titleColor,
            "--bk-ornament": colors.ornamentColor,
            "--bk-tint": colors.pageTint,
            "--bk-grad-start": colors.gradientStart,
            "--bk-grad-end": colors.gradientEnd,
          } as React.CSSProperties}
        >
          {page.type === "teaser_chapters" || page.type === "teaser_order" ? (
            <TeaserPage page={page} templateId={templateId} gender={gender} favoriteColor={favoriteColor} onOrder={onOrder} />
          ) : (
            <BookPrintPage page={page} colors={colors} />
          )}
          {onEdit && (page.type === "cover" || page.type === "title_dedication") && (
            <EditPill onClick={() => onEdit(page.type === "cover" ? "cover" : "dedication")} target={page.type === "cover" ? "cover" : "dedication"} />
          )}
          {/* Locked overlay */}
          {page.type === "scene" && page.locked && (
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("checkout-section");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-md z-10 cursor-pointer transition-colors hover:bg-white/50 group"
            >
              <span className="material-symbols-outlined text-[clamp(1.5rem,8cqi,2.5rem)] text-create-primary/60 mb-1 group-hover:text-brand-text transition-colors">
                lock
              </span>
              <LockedText />
            </button>
          )}
        </div>
      </div>
    );
  }
);

export default MobileBookPage;

// ── Edit pill (preview) ──────────────────────────────────────────────────────
// page-flip only lets a click through when the event target IS the button
// (clickEventForward), so everything inside it ignores the pointer.

function EditPill({ onClick, target }: { onClick: () => void; target: "cover" | "dedication" }) {
  const t = useTranslations("crear.purchase");
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`edit-${target}`}
      className="absolute right-[3%] top-[3%] z-20 inline-flex items-center gap-1 rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-bold text-create-text-dark shadow-md shadow-black/15 ring-1 ring-black/5 transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-create-primary"
    >
      <span aria-hidden className="material-symbols-outlined pointer-events-none text-[14px]">edit</span>
      <span className="pointer-events-none">{t("editPage")}</span>
    </button>
  );
}

// ── Locked text ───────────────────────────────────────────────────────────────

function LockedText() {
  const t = useTranslations("crear.preview");
  return (
    <div className="flex flex-col items-center gap-2 px-4 max-w-[90%]">
      <p className="font-display text-[clamp(0.75rem,3cqi,1.1rem)] font-bold text-center leading-tight" style={{ color: "var(--bk-title)" }}>
        {t("lockedTitle")}
      </p>
      <p className="text-[clamp(0.6rem,2.5cqi,0.875rem)] text-text-muted text-center leading-snug">
        {t("lockedDescription")}
      </p>
      <span className="mt-1 inline-flex items-center gap-1 rounded-full border-2 border-brand bg-brand-tint px-3 py-1.5 text-[clamp(0.6rem,2.2cqi,0.75rem)] font-bold text-brand-text group-hover:bg-surface transition-colors">
        <span className="material-symbols-outlined text-[clamp(0.7rem,2.5cqi,0.875rem)]">shopping_bag</span>
        {t("lockedCta")}
      </span>
    </div>
  );
}

// ── Preview teaser pages (viewer-only, not printed) ──────────────────────────

function TeaserPage({ page, templateId, gender, favoriteColor, onOrder }: { page: Extract<BookPage, { type: "teaser_chapters" | "teaser_order" }>; templateId: string; gender?: string; favoriteColor?: string; onOrder?: () => void }) {
  const t = useTranslations("crear.preview");
  const tp = useTranslations("crear.purchase");
  const locale = useLocale();
  switch (page.type) {
    case "teaser_chapters": {
      return (
        <div className="absolute inset-0 overflow-hidden bg-cream">
          {page.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={page.imageUrl} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-xl" />
          )}
          <div className="absolute inset-0 bg-cream/80" />
          <div className="relative flex h-full flex-col justify-center px-[9%] py-[8%]">
            <p className="font-display text-[clamp(0.95rem,5.2cqi,1.4rem)] font-bold leading-tight" style={{ color: "var(--bk-title)" }}>
              {tp("teaserComingTitle")}
            </p>
            <div className="mt-[3%] mb-[4%] h-px w-12" style={{ backgroundColor: "var(--bk-ornament)" }} />
            <ol className="space-y-[1.6cqi]">
              {page.chapters.map((chapter, i) => (
                <li key={i} className="flex items-baseline gap-[2.5cqi] text-[clamp(0.7rem,3.5cqi,0.95rem)] leading-snug text-create-text-dark">
                  <span className="w-[5cqi] shrink-0 text-right font-display font-bold tabular-nums" style={{ color: "var(--bk-accent)" }}>
                    {page.firstChapter + i}
                  </span>
                  <span className="min-w-0 truncate">{chapter}</span>
                </li>
              ))}
            </ol>
            <p className="mt-[4%] font-display text-[clamp(0.7rem,3.4cqi,0.95rem)] italic text-create-text-sub">
              {tp("teaserComingMore", { name: page.characterName, deName: deName(page.characterName, locale) })}
            </p>
          </div>
        </div>
      );
    }

    case "teaser_order": {
      const colors = getBookColors(templateId, gender, favoriteColor);
      const names = { name: page.characterName, deName: deName(page.characterName, locale) };
      return (
        <div className="absolute inset-0 flex flex-col items-center overflow-hidden bg-cream px-[7%] pt-[3%] pb-[7%] text-center">
          <div className="w-[82%]">
            <BookMockup
              coverUrl={page.coverUrl}
              title={page.title}
              childName={page.characterName}
              subtitle={t("personalizedStory")}
              format={page.format}
              spineColor={colors.gradientStart}
              showScale={false}
              interactive={false}
              alt={page.title}
            />
          </div>
          <p className="-mt-[2%] font-display text-[clamp(0.9rem,4.6cqi,1.25rem)] font-bold leading-tight" style={{ color: "var(--bk-title)" }}>
            {tp("teaserOrderTitle", names)}
          </p>
          <p className="mt-[1.5%] text-[clamp(0.65rem,3.1cqi,0.85rem)] leading-snug text-create-text-sub">
            {tp("teaserOrderBody")}
          </p>
          <p className="mt-[2.5%] text-[clamp(0.7rem,3.4cqi,0.9rem)] text-create-text-dark">
            <span className="font-bold tabular-nums">{tp("teaserOrderPrice", { price: page.priceFrom })}</span>
            <span className="text-create-text-sub"> · {tp("ctaNotePhysical")}</span>
          </p>
          {onOrder && (
            <button
              type="button"
              onClick={onOrder}
              className="mt-auto inline-flex items-center gap-1.5 rounded-full border-2 border-brand bg-brand-tint px-[6cqi] py-[2.4cqi] text-[clamp(0.75rem,3.6cqi,0.95rem)] font-bold text-brand-text transition-colors hover:bg-surface"
            >
              <span className="pointer-events-none">{tp("teaserOrderCta")}</span>
              <span aria-hidden className="material-symbols-outlined pointer-events-none text-[1.1em]">arrow_downward</span>
            </button>
          )}
        </div>
      );
    }

  }
}
