"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { BookPage } from "./types";

// Template gradient CSS classes
const TEMPLATE_GRADIENTS: Record<string, string> = {
  space: "from-indigo-900 to-slate-900",
  forest: "from-emerald-800 to-green-900",
  superhero: "from-red-700 to-rose-900",
  pirates: "from-blue-800 to-cyan-900",
  chef: "from-orange-600 to-amber-800",
};

function getGradient(templateId: string): string {
  return TEMPLATE_GRADIENTS[templateId] ?? "from-secondary to-secondary-hover";
}

interface MobileBookPageProps {
  page: BookPage;
  templateId: string;
}

/**
 * Single book page renderer for react-pageflip.
 * Must use forwardRef because HTMLFlipBook needs to attach a ref to each child.
 */
const MobileBookPage = React.forwardRef<HTMLDivElement, MobileBookPageProps>(
  function MobileBookPage({ page, templateId }, ref) {
    return (
      <div ref={ref} className="book-page h-full w-full bg-white overflow-hidden relative">
        <PageContent page={page} templateId={templateId} />
        {/* Locked overlay — clickable CTA to checkout */}
        {page.type === "scene" && page.locked && (
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById("checkout-section");
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-md z-10 cursor-pointer transition-colors hover:bg-white/50 group"
          >
            <span className="material-symbols-outlined text-4xl text-create-primary/60 mb-3 group-hover:text-create-primary transition-colors">
              lock
            </span>
            <LockedText />
          </button>
        )}
      </div>
    );
  }
);

export default MobileBookPage;

// Separate component for locked text (needs translations hook)
function LockedText() {
  const t = useTranslations("crear.preview");
  return (
    <>
      <p className="font-display text-base font-bold text-secondary text-center px-6">
        {t("lockedTitle")}
      </p>
      <p className="mt-1.5 text-sm text-text-muted text-center px-8 max-w-xs">
        {t("lockedDescription")}
      </p>
      <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-create-primary px-5 py-2 text-xs font-bold text-white shadow-md shadow-create-primary/20 group-hover:bg-create-primary-hover transition-colors">
        <span className="material-symbols-outlined text-sm">shopping_bag</span>
        {t("lockedCta")}
      </span>
    </>
  );
}

// Page content renderer
function PageContent({
  page,
  templateId,
}: {
  page: BookPage;
  templateId: string;
}) {
  const t = useTranslations("crear.preview");
  const gradient = getGradient(templateId);

  switch (page.type) {
    case "cover":
      return (
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br ${gradient} p-8 text-center`}
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
            <span className="material-symbols-outlined text-3xl text-white">
              auto_stories
            </span>
          </div>
          <h2 className="font-display text-2xl font-bold text-white leading-tight">
            {page.title}
          </h2>
          <p className="mt-3 text-sm text-white/70">
            {t("personalizedStory")}{" "}
            <span className="font-bold text-white">{page.characterName}</span>
          </p>
          <div className="mt-6 h-px w-16 bg-white/30" />
          <p className="mt-3 text-xs text-white/50 tracking-wider uppercase">
            StoryMagic
          </p>
        </div>
      );

    case "dedication":
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-cream p-8 text-center">
          <span className="material-symbols-outlined text-3xl text-create-gold mb-4">
            favorite
          </span>
          <p className="font-display text-base italic leading-relaxed text-secondary max-w-xs">
            &ldquo;{page.text}&rdquo;
          </p>
          {page.senderName && (
            <p className="mt-4 text-sm text-text-muted">
              — {page.senderName}
            </p>
          )}
        </div>
      );

    case "scene":
      return (
        <div
          className={`absolute inset-0 flex flex-col ${page.locked ? "select-none" : ""}`}
        >
          {/* Image area — takes most of the page */}
          <div className="relative h-[58%] overflow-hidden">
            {page.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={page.imageUrl}
                alt={page.scene.title}
                className={`h-full w-full object-cover ${page.locked ? "blur-lg" : ""}`}
              />
            ) : (
              <div
                className={`flex h-full items-center justify-center bg-cream ${page.locked ? "blur-lg" : ""}`}
              >
                <span className="material-symbols-outlined text-4xl text-text-light">
                  image
                </span>
              </div>
            )}
            {!page.locked && (
              <div className="absolute top-2.5 left-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 shadow-sm">
                <span className="text-[10px] font-bold text-secondary">
                  {page.scene.sceneNumber}
                </span>
              </div>
            )}
          </div>
          {/* Divider line */}
          <div className="h-px bg-border-light/40 mx-4" />
          {/* Text area */}
          <div className={`flex-1 overflow-hidden px-5 py-3 ${page.locked ? "blur-md" : ""}`}>
            <h3 className="font-display text-sm font-bold text-secondary leading-tight">
              {page.scene.title}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-text-soft line-clamp-6">
              {page.scene.text}
            </p>
          </div>
          {/* Page number */}
          {!page.locked && (
            <div className="pb-2.5 text-center">
              <span className="text-[9px] text-text-muted tabular-nums">
                {page.scene.sceneNumber}
              </span>
            </div>
          )}
        </div>
      );

    case "final":
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-cream p-8 text-center">
          <span className="material-symbols-outlined text-4xl text-create-gold mb-4">
            auto_awesome
          </span>
          <p className="font-display text-lg font-bold leading-relaxed text-secondary max-w-xs">
            {page.message}
          </p>
          <div className="mt-6 h-px w-16 bg-border-light" />
          <p className="mt-3 text-xs text-text-muted">{t("end")}</p>
        </div>
      );

    case "back":
      return (
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br ${gradient} p-8 text-center`}
        >
          <p className="text-sm text-white/70">{t("createdFor")}</p>
          <p className="mt-2 font-display text-2xl font-bold text-white">
            {page.characterName}
          </p>
          <div className="mt-6 h-px w-16 bg-white/30" />
          <p className="mt-4 text-xs text-white/40 tracking-wider uppercase">
            StoryMagic
          </p>
        </div>
      );
  }
}
