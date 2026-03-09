"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import BrandLogo from "@/components/BrandLogo";
import { getBookColors } from "@/lib/template-colors";
import type { BookPage } from "./types";


// ── Main component ────────────────────────────────────────────────────────────

interface MobileBookPageProps {
  page: BookPage;
  templateId: string;
  /** Real book page number (1-based, only for scene pages) */
  pageNumber?: number;
}

const MobileBookPage = React.forwardRef<HTMLDivElement, MobileBookPageProps>(
  function MobileBookPage({ page, templateId, pageNumber }, ref) {
    const colors = getBookColors(templateId);
    return (
      <div
        ref={ref}
        className="book-page h-full w-full bg-white overflow-hidden relative @container"
        style={{
          "--bk-accent": colors.accent,
          "--bk-accent-light": colors.accentLight,
          "--bk-title": colors.titleColor,
          "--bk-ornament": colors.ornamentColor,
          "--bk-tint": colors.pageTint,
          "--bk-grad-start": colors.gradientStart,
          "--bk-grad-end": colors.gradientEnd,
        } as React.CSSProperties}
      >
        <PageContent page={page} templateId={templateId} pageNumber={pageNumber} />
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
            <span className="material-symbols-outlined text-[clamp(1.5rem,8cqi,2.5rem)] text-create-primary/60 mb-1 group-hover:text-create-primary transition-colors">
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
      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-create-primary px-3 py-1.5 text-[clamp(0.6rem,2.2cqi,0.75rem)] font-bold text-white shadow-md shadow-create-primary/20 group-hover:bg-create-primary-hover transition-colors">
        <span className="material-symbols-outlined text-[clamp(0.7rem,2.5cqi,0.875rem)]">shopping_bag</span>
        {t("lockedCta")}
      </span>
    </div>
  );
}

// ── Act label overlay ────────────────────────────────────────────────────────
// Shown on the first page of each narrative act (scenes 1, 4, 10).
// Uses a decorative ornamental divider — universal across locales.

function ActLabelOverlay({ label, variant }: { label: string; variant: "light" | "dark" }) {
  const isLight = variant === "light";
  return (
    <div className="absolute top-4 left-0 right-0 flex items-center justify-center gap-3 z-20 pointer-events-none">
      <div className="h-px w-6" style={{ backgroundColor: isLight ? "rgba(255,255,255,0.3)" : "var(--bk-ornament)" }} />
      <span className="font-display text-[10px] font-bold tracking-[0.3em]" style={{ color: isLight ? "rgba(255,255,255,0.6)" : "var(--bk-ornament)" }}>
        {label}
      </span>
      <div className="h-px w-6" style={{ backgroundColor: isLight ? "rgba(255,255,255,0.3)" : "var(--bk-ornament)" }} />
    </div>
  );
}

// ── Age-adaptive text sizing ─────────────────────────────────────────────────
// Font sizes and line-clamp values scale with the child's age to match
// the amount of text generated per scene:
//   Ages 2-4:  50-80 words  → large, readable text (toddler)
//   Ages 5-7:  100-140 words → balanced
//   Ages 8-12: 150-200 words → compact to fit dense narrative

interface TextConfig {
  body: string;           // Body text (general use)
  bodyTextOnly: string;   // Body text on text_only pages (full page, slightly larger)
  title: string;          // Scene title in text areas
  titleOverlay: string;   // Scene title overlaid on images
  clampSpread: string;    // Line clamp for spread_right overlay
}

function getTextConfig(age: number): TextConfig {
  if (age <= 4) {
    return {
      body: "text-[14px] leading-[1.9]",
      bodyTextOnly: "text-[16px] leading-[2]",
      title: "text-base",
      titleOverlay: "text-base",
      clampSpread: "line-clamp-3",
    };
  }
  if (age <= 7) {
    return {
      body: "text-[12px] leading-[1.75]",
      bodyTextOnly: "text-[13px] leading-[1.85]",
      title: "text-sm",
      titleOverlay: "text-sm",
      clampSpread: "line-clamp-5",
    };
  }
  return {
    body: "text-[10px] leading-[1.6]",
    bodyTextOnly: "text-[10px] leading-[1.65]",
    title: "text-[13px]",
    titleOverlay: "text-sm",
    clampSpread: "line-clamp-6",
  };
}

// ── Scene page layouts ──────────────────────────────────────────────────────
// Each layout uses a specific image aspect ratio (generated by Recraft at the
// correct size) so `object-cover` causes minimal or zero cropping.

type SceneProps = { page: Extract<BookPage, { type: "scene" }>; templateId: string; pageNumber?: number };

/** immersive — full-bleed illustration with scene title at bottom. */
function SceneImmersive({ page, pageNumber }: SceneProps) {
  const blur = page.locked ? "blur-lg" : "";
  const tc = getTextConfig(page.characterAge);
  return (
    <div className={`absolute inset-0 overflow-hidden ${page.locked ? "select-none" : ""}`}>
      {page.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={page.imageUrl} alt={page.scene.title}
          className={`absolute inset-0 h-full w-full object-cover ${blur}`} />
      ) : (
        <div className={`absolute inset-0 bg-cream ${blur}`} />
      )}
      <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
      {page.actLabel && <ActLabelOverlay label={page.actLabel} variant="light" />}
      {!page.locked && (
        <div className="absolute top-3 left-3 flex h-6 w-6 items-center justify-center rounded-full bg-white/80 shadow-sm">
          <span className="text-[10px] font-bold" style={{ color: "var(--bk-accent)" }}>{pageNumber ?? page.scene.sceneNumber}</span>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
        <h3 className={`font-display ${tc.titleOverlay} font-bold text-white leading-tight drop-shadow-sm`}>
          {page.scene.title}
        </h3>
      </div>
    </div>
  );
}

/** split_top — landscape image top ~78%, compact title strip below.
 *  Full text lives on the paired text_only / illustration_text page. */
function SceneSplitTop({ page, pageNumber }: SceneProps) {
  const blur = page.locked ? "blur-lg" : "";
  const tc = getTextConfig(page.characterAge);
  return (
    <div className={`absolute inset-0 flex flex-col bg-cream overflow-hidden ${page.locked ? "select-none" : ""}`}>
      <div className="relative shrink-0 overflow-hidden" style={{ height: "78%" }}>
        {page.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={page.imageUrl} alt={page.scene.title}
            className={`h-full w-full object-cover ${blur}`} />
        ) : (
          <div className={`h-full w-full bg-cream ${blur}`} />
        )}
        {page.actLabel && <ActLabelOverlay label={page.actLabel} variant="light" />}
        {!page.locked && (
          <div className="absolute top-3 left-3 flex h-6 w-6 items-center justify-center rounded-full bg-white/80 shadow-sm">
            <span className="text-[10px] font-bold" style={{ color: "var(--bk-accent)" }}>{pageNumber ?? page.scene.sceneNumber}</span>
          </div>
        )}
      </div>
      <div className="flex-1 flex items-center px-5">
        <div className="flex items-center gap-3">
          <div className="h-8 w-0.5 shrink-0 rounded-full" style={{ backgroundColor: "var(--bk-accent)" }} />
          <div>
            <h3 className={`font-display ${tc.title} font-bold leading-tight`} style={{ color: "var(--bk-title)" }}>
              {page.scene.title}
            </h3>
          </div>
        </div>
      </div>
    </div>
  );
}

/** split_bottom — compact title strip top, landscape image bottom ~78%.
 *  Full text lives on the paired text_only / illustration_text page. */
function SceneSplitBottom({ page, pageNumber }: SceneProps) {
  const blur = page.locked ? "blur-lg" : "";
  const tc = getTextConfig(page.characterAge);
  return (
    <div className={`absolute inset-0 flex flex-col bg-cream overflow-hidden ${page.locked ? "select-none" : ""}`}>
      <div className="flex-1 flex items-center px-5">
        {page.actLabel && <ActLabelOverlay label={page.actLabel} variant="dark" />}
        <div className="flex items-center gap-3">
          <div className="h-8 w-0.5 shrink-0 rounded-full" style={{ backgroundColor: "var(--bk-accent)" }} />
          <div>
            {!page.locked && (
              <span className="text-[7px] font-bold text-text-muted uppercase tracking-widest block">
                {String(pageNumber ?? page.scene.sceneNumber).padStart(2, "0")}
              </span>
            )}
            <h3 className={`font-display ${tc.title} font-bold leading-tight`} style={{ color: "var(--bk-title)" }}>
              {page.scene.title}
            </h3>
          </div>
        </div>
      </div>
      <div className="relative shrink-0 overflow-hidden" style={{ height: "78%" }}>
        {page.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={page.imageUrl} alt={page.scene.title}
            className={`h-full w-full object-cover ${blur}`} />
        ) : (
          <div className={`h-full w-full bg-cream ${blur}`} />
        )}
      </div>
    </div>
  );
}

/** full_illustration — image fills entire page, scene badge only */
function SceneFullIllustration({ page, pageNumber }: SceneProps) {
  const blur = page.locked ? "blur-lg" : "";
  return (
    <div className={`absolute inset-0 overflow-hidden ${page.locked ? "select-none" : ""}`}>
      {page.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={page.imageUrl} alt={page.scene.title}
          className={`absolute inset-0 h-full w-full object-cover ${blur}`} />
      ) : (
        <div className={`absolute inset-0 bg-cream ${blur}`} />
      )}
      {page.actLabel && <ActLabelOverlay label={page.actLabel} variant="light" />}
      {!page.locked && (
        <div className="absolute top-3 left-3 flex h-6 w-6 items-center justify-center rounded-full bg-white/80 shadow-sm">
          <span className="text-[10px] font-bold" style={{ color: "var(--bk-accent)" }}>{pageNumber ?? page.scene.sceneNumber}</span>
        </div>
      )}
    </div>
  );
}

/** spread_left — left half of a panoramic double-page spread.
 *  Uses object-position:left to show the left 50% of the 2048×1024 image.
 *  With 3 header pages, spread_left always lands on a LEFT viewer page. */
function SceneSpreadLeft({ page, pageNumber }: SceneProps) {
  const blur = page.locked ? "blur-lg" : "";
  return (
    <div className={`absolute inset-0 overflow-hidden ${page.locked ? "select-none" : ""}`}>
      {page.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={page.imageUrl} alt={page.scene.title}
          className={`absolute inset-0 h-full w-full object-cover object-left ${blur}`} />
      ) : (
        <div className={`absolute inset-0 bg-cream ${blur}`} />
      )}
      <div className="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent" />
      {page.actLabel && <ActLabelOverlay label={page.actLabel} variant="light" />}
      {!page.locked && (
        <div className="absolute top-3 left-3 flex h-6 w-6 items-center justify-center rounded-full bg-white/80 shadow-sm">
          <span className="text-[10px] font-bold" style={{ color: "var(--bk-accent)" }}>{pageNumber ?? page.scene.sceneNumber}</span>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
        <h3 className="font-display text-sm font-bold text-white leading-tight drop-shadow-sm">
          {page.scene.title}
        </h3>
      </div>
    </div>
  );
}

/** spread_right — right half of a panoramic double-page spread.
 *  Uses object-position:right to show the right 50% of the same 2048×1024 image. */
function SceneSpreadRight({ page, pageNumber }: SceneProps) {
  const blur = page.locked ? "blur-lg" : "";
  const tc = getTextConfig(page.characterAge);
  return (
    <div className={`absolute inset-0 overflow-hidden ${page.locked ? "select-none" : ""}`}>
      {page.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={page.imageUrl} alt={page.scene.title}
          className={`absolute inset-0 h-full w-full object-cover object-right ${blur}`} />
      ) : (
        <div className={`absolute inset-0 bg-cream ${blur}`} />
      )}
      <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
        <p className={`${tc.body} text-white/90 drop-shadow-sm ${tc.clampSpread}`}>
          {page.scene.text}
        </p>
      </div>
    </div>
  );
}

// ── Decorative ornaments (matching PDF editorial style) ──────────────────────

/** Ornamental divider — line · diamond · line */
function OrnamentalDivider({ color, width = 80 }: { color?: string; width?: number }) {
  return (
    <div className="flex items-center justify-center gap-2" style={{ width }}>
      <div className="flex-1 h-px" style={{ backgroundColor: color || "var(--bk-ornament)" }} />
      <div className="h-1.5 w-1.5 rotate-45" style={{ backgroundColor: color || "var(--bk-ornament)" }} />
      <div className="flex-1 h-px" style={{ backgroundColor: color || "var(--bk-ornament)" }} />
    </div>
  );
}

/** Star cluster — 3 small dots arranged in a triangle */
function StarCluster({ color, size = 24 }: { color?: string; size?: number }) {
  const c = color || "#d4af37";
  const d = Math.round(size * 0.18);
  return (
    <div className="flex flex-col items-center" style={{ height: size, width: size }}>
      <div className="rounded-full" style={{ width: d, height: d, backgroundColor: c, opacity: 0.7 }} />
      <div className="flex gap-1 -mt-0.5">
        <div className="rounded-full" style={{ width: d * 0.7, height: d * 0.7, backgroundColor: c, opacity: 0.5 }} />
        <div className="rounded-full" style={{ width: d * 0.7, height: d * 0.7, backgroundColor: c, opacity: 0.5 }} />
      </div>
    </div>
  );
}

/** Wavy line — 3 small dots in a row */
function WavyDots({ color }: { color?: string }) {
  const c = color || "var(--bk-ornament)";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1 w-1 rounded-full" style={{ backgroundColor: c, opacity: 0.4 }} />
      <div className="h-1 w-1 rounded-full" style={{ backgroundColor: c, opacity: 0.6 }} />
      <div className="h-1 w-1 rounded-full" style={{ backgroundColor: c, opacity: 0.4 }} />
    </div>
  );
}

/** Thin decorative frame border */
function FrameBorder() {
  return (
    <div
      className="absolute pointer-events-none rounded-md"
      style={{
        top: 10, left: 10, right: 10, bottom: 10,
        border: "1px solid var(--bk-ornament)",
        opacity: 0.35,
      }}
    />
  );
}

/** Page number with decorative lines */
function BookPageNumber({ num, color }: { num: number; color?: string }) {
  const c = color || "var(--bk-ornament)";
  return (
    <div className="shrink-0 pb-3 flex items-center justify-center gap-1.5">
      <div className="h-px w-3" style={{ backgroundColor: c, opacity: 0.4 }} />
      <span className="text-[9px] tabular-nums" style={{ color: c, opacity: 0.7 }}>{num}</span>
      <div className="h-px w-3" style={{ backgroundColor: c, opacity: 0.4 }} />
    </div>
  );
}

// ── Text page variants (matching PDF galeria/pergamino/ventana/puente) ──────

/** Galeria B — centered text with pill, ornamental divider, star cluster.
 *  Paper white bg, frame border, all content centered. */
function TextGaleriaB({ page, pageNumber }: SceneProps) {
  const tc = getTextConfig(page.characterAge);
  return (
    <div className={`absolute inset-0 flex flex-col bg-cream overflow-hidden ${page.locked ? "select-none blur-md" : ""}`}>
      <FrameBorder />
      <div className="relative flex-1 flex flex-col items-center overflow-hidden px-7 pt-6 pb-2">
        {/* Title */}
        <h3 className={`font-display ${tc.title} font-bold text-center leading-tight mb-3 shrink-0`} style={{ color: "var(--bk-title)" }}>
          {page.scene.title}
        </h3>
        <div className="shrink-0"><OrnamentalDivider /></div>
        {/* Body text — flex-1 to fill remaining space */}
        <p className={`${tc.bodyTextOnly} text-text-soft text-center mt-3 flex-1 overflow-hidden min-h-0`}>
          {page.scene.text}
        </p>
        {/* Bottom ornament */}
        <div className="mt-2 shrink-0">
          <StarCluster />
        </div>
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-linear-to-t from-cream to-transparent" />
      </div>
      <BookPageNumber num={pageNumber ?? page.scene.sceneNumber} />
    </div>
  );
}

/** Pergamino A — left-aligned text with accent rule, on colored background.
 *  accentLight bg, frame border, scene number "01", thick accent rule. */
function TextPergaminoA({ page, pageNumber }: SceneProps) {
  const tc = getTextConfig(page.characterAge);
  return (
    <div className={`absolute inset-0 flex flex-col overflow-hidden ${page.locked ? "select-none blur-md" : ""}`}
      style={{ backgroundColor: "var(--bk-accent-light)" }}>
      <FrameBorder />
      <div className="relative flex-1 flex flex-col overflow-hidden px-7 pt-6 pb-2">
        {/* Title */}
        <h3 className={`font-display ${tc.title} font-bold leading-tight mb-3 shrink-0`} style={{ color: "var(--bk-title)" }}>
          {page.scene.title}
        </h3>
        {/* Thick accent rule */}
        <div className="h-0.5 w-[35%] rounded-full mb-4 shrink-0" style={{ backgroundColor: "var(--bk-accent)", opacity: 0.8 }} />
        {/* Body text — flex-1 to fill remaining space */}
        <p className={`${tc.bodyTextOnly} text-text-soft flex-1 overflow-hidden min-h-0`}>
          {page.scene.text}
        </p>
        {/* Bottom wavy dots */}
        <div className="mt-2 shrink-0">
          <WavyDots />
        </div>
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6"
          style={{ background: "linear-gradient(to top, var(--bk-accent-light), transparent)" }} />
      </div>
      <BookPageNumber num={pageNumber ?? page.scene.sceneNumber} />
    </div>
  );
}

/** Ventana A — drop cap style, paper white background.
 *  First character enlarged as a drop cap, title above. */
function TextVentanaA({ page, pageNumber }: SceneProps) {
  const tc = getTextConfig(page.characterAge);
  const firstChar = page.scene.text.charAt(0);
  const restText = page.scene.text.slice(1);
  // Drop cap size adapts to age
  const dropCapSize = page.characterAge <= 4 ? "text-[36px]" : page.characterAge <= 7 ? "text-[32px]" : "text-[28px]";
  return (
    <div className={`absolute inset-0 flex flex-col bg-cream overflow-hidden ${page.locked ? "select-none blur-md" : ""}`}>
      <FrameBorder />
      <div className="relative flex-1 flex flex-col overflow-hidden px-7 pt-6 pb-2">
        {/* Title */}
        <h3 className={`font-display ${tc.title} font-bold leading-tight mb-4 shrink-0`} style={{ color: "var(--bk-title)" }}>
          {page.scene.title}
        </h3>
        {/* Drop cap + text — flex-1 to fill remaining space */}
        <div className="flex items-start gap-1.5 flex-1 overflow-hidden min-h-0">
          <span className={`font-display ${dropCapSize} font-bold leading-none shrink-0`}
            style={{ color: "var(--bk-accent)", marginTop: "0.05em" }}>
            {firstChar}
          </span>
          <p className={`${tc.bodyTextOnly} text-text-soft overflow-hidden flex-1`}>
            {restText}
          </p>
        </div>
        {/* Bottom ornament */}
        <div className="mt-2 shrink-0">
          <OrnamentalDivider width={70} />
        </div>
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-linear-to-t from-cream to-transparent" />
      </div>
      <BookPageNumber num={pageNumber ?? page.scene.sceneNumber} />
    </div>
  );
}

/** Puente B — bridge text page. Large centered display sentence.
 *  Colored background, frame border, corner dots, ornaments. */
function TextPuenteB({ page, pageNumber }: SceneProps) {
  const bridgeSize = page.characterAge <= 4 ? "text-[18px]" : page.characterAge <= 7 ? "text-[16px]" : "text-[14px]";
  return (
    <div className={`absolute inset-0 flex flex-col overflow-hidden ${page.locked ? "select-none blur-md" : ""}`}
      style={{ backgroundColor: "var(--bk-accent-light)" }}>
      <FrameBorder />
      {/* Corner dots */}
      <div className="absolute w-1.5 h-1.5 rounded-full" style={{ top: 16, left: 16, backgroundColor: "var(--bk-accent)", opacity: 0.3 }} />
      <div className="absolute w-1.5 h-1.5 rounded-full" style={{ top: 16, right: 16, backgroundColor: "var(--bk-accent)", opacity: 0.3 }} />
      <div className="absolute w-1.5 h-1.5 rounded-full" style={{ bottom: 16, left: 16, backgroundColor: "var(--bk-accent)", opacity: 0.3 }} />
      <div className="absolute w-1.5 h-1.5 rounded-full" style={{ bottom: 16, right: 16, backgroundColor: "var(--bk-accent)", opacity: 0.3 }} />

      <div className="flex-1 flex flex-col items-center justify-center px-8 py-8">
        <div className="flex flex-col items-center max-w-[80%]">
          <OrnamentalDivider width={60} />
          {/* Large centered bridge sentence */}
          <p className={`font-display ${bridgeSize} font-bold text-center leading-relaxed mt-5 mb-5`} style={{ color: "var(--bk-title)" }}>
            {page.scene.text}
          </p>
          <WavyDots />
        </div>
      </div>
      <BookPageNumber num={pageNumber ?? page.scene.sceneNumber} />
    </div>
  );
}

/** Routes to the correct text variant based on spreadType */
function SceneTextOnly({ page, pageNumber }: SceneProps) {
  const spreadType = page.spreadType ?? "galeria";
  switch (spreadType) {
    case "pergamino": return <TextPergaminoA page={page} templateId="" pageNumber={pageNumber} />;
    case "ventana": return <TextVentanaA page={page} templateId="" pageNumber={pageNumber} />;
    case "puente": return <TextPuenteB page={page} templateId="" pageNumber={pageNumber} />;
    case "galeria":
    default: return <TextGaleriaB page={page} templateId="" pageNumber={pageNumber} />;
  }
}

/** illustration_text — full-width landscape illustration + body text below.
 *  New images are 1820×1024 (~1.78:1 landscape), taking ~56% of square page at full width.
 *  Legacy square images (1024×1024) use object-cover at the same height — acceptable crop.
 *  The facing page already shows the title, so this page skips it. */
function SceneIllustrationText({ page, pageNumber }: SceneProps) {
  const blur = page.locked ? "blur-lg" : "";
  const tc = getTextConfig(page.characterAge);

  return (
    <div className={`absolute inset-0 flex flex-col bg-cream overflow-hidden ${page.locked ? "select-none" : ""}`}>
      <FrameBorder />
      {/* Secondary illustration — full width, landscape ratio (~56% of square page) */}
      <div className="relative shrink-0 w-full overflow-hidden" style={{ height: "56%" }}>
        {page.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={page.imageUrl} alt={page.scene.title}
            className={`h-full w-full object-cover ${blur}`} />
        ) : (
          <div className={`h-full w-full bg-cream ${blur}`} />
        )}
        {/* Soft fade from illustration into text area */}
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-linear-to-t from-cream to-transparent" />
      </div>
      {/* Body text — no title (already on facing page), centered editorial style */}
      <div className="relative flex-1 flex flex-col items-center overflow-hidden px-7 pb-1 pt-2">
        <div className="flex flex-col items-center max-w-[90%] h-full">
          <OrnamentalDivider width={60} />
          <p className={`${tc.body} text-text-soft text-center mt-2 overflow-hidden flex-1`}>
            {page.scene.text}
          </p>
          <div className="mt-1 shrink-0">
            <WavyDots />
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-linear-to-t from-cream to-transparent" />
      </div>
      <BookPageNumber num={pageNumber ?? page.scene.sceneNumber} />
    </div>
  );
}

/** Route scene page to the correct layout renderer */
function ScenePage({ page, templateId, pageNumber }: SceneProps) {
  switch (page.layout) {
    case "immersive":
      return <SceneImmersive page={page} templateId={templateId} pageNumber={pageNumber} />;
    case "split_top":
      return <SceneSplitTop page={page} templateId={templateId} pageNumber={pageNumber} />;
    case "split_bottom":
      return <SceneSplitBottom page={page} templateId={templateId} pageNumber={pageNumber} />;
    case "full_illustration":
      return <SceneFullIllustration page={page} templateId={templateId} pageNumber={pageNumber} />;
    case "illustration_text":
      return <SceneIllustrationText page={page} templateId={templateId} pageNumber={pageNumber} />;
    case "spread_left":
      return <SceneSpreadLeft page={page} templateId={templateId} pageNumber={pageNumber} />;
    case "spread_right":
      return <SceneSpreadRight page={page} templateId={templateId} pageNumber={pageNumber} />;
    case "text_only":
    default:
      return <SceneTextOnly page={page} templateId={templateId} pageNumber={pageNumber} />;
  }
}


// ── Page content dispatcher ───────────────────────────────────────────────────

function PageContent({ page, templateId, pageNumber }: { page: BookPage; templateId: string; pageNumber?: number }) {
  const t = useTranslations("crear.preview");
  const td = useTranslations("data");
  switch (page.type) {

    case "cover":
      return (
        <div className="absolute inset-0 overflow-hidden">
          {page.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={page.imageUrl} alt={page.title}
              className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom right, var(--bk-grad-start), var(--bk-grad-end))` }} />
          )}
          <div className="absolute inset-0 bg-linear-to-b from-black/20 via-transparent to-black/75" />
          <div className="absolute top-5 left-0 right-0 flex justify-center">
            <BrandLogo className="h-5 text-white drop-shadow-sm" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 px-6 pb-7 text-center">
            <p className="text-[11px] font-medium text-white/75 tracking-wide uppercase mb-1.5">
              {t("personalizedStory")}{" "}
              <span className="font-bold text-white">{page.characterName}</span>
            </p>
            <h2 className="font-display text-xl font-bold text-white leading-tight drop-shadow-sm">
              {page.title}
            </h2>
          </div>
        </div>
      );

    case "dedication":
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-cream p-8 text-center">
          <span className="material-symbols-outlined text-3xl text-create-gold mb-4">favorite</span>
          <p className="font-display text-base italic leading-relaxed max-w-xs" style={{ color: "var(--bk-title)" }}>
            &ldquo;{page.text}&rdquo;
          </p>
          {page.senderName && (
            <p className="mt-4 text-sm text-text-muted">— {page.senderName}</p>
          )}
        </div>
      );

    case "endpaper":
      return (
        <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom right, var(--bk-grad-start), var(--bk-grad-end))` }}>
          <div className="absolute inset-0 opacity-[0.06]" style={{
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }} />
        </div>
      );

    case "title_page":
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-cream p-8 text-center">
          <BrandLogo className="h-6 mb-8" style={{ color: "var(--bk-title)" }} />
          <h1 className="font-display text-2xl font-black leading-tight max-w-xs" style={{ color: "var(--bk-title)" }}>
            {page.title}
          </h1>
          <div className="mt-4 h-px w-12" style={{ backgroundColor: "var(--bk-ornament)" }} />
        </div>
      );

    case "title_dedication":
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-cream p-8 text-center">
          <FrameBorder />
          <BrandLogo className="h-4 mb-4" style={{ color: "var(--bk-ornament)" }} />
          <h1 className="font-display text-xl font-black leading-tight max-w-[85%]" style={{ color: "var(--bk-title)" }}>
            {page.title}
          </h1>
          <div className="mt-3 mb-1">
            <OrnamentalDivider width={60} />
          </div>
          <p className="text-[11px] text-text-muted mt-2">
            Una aventura personalizada para
          </p>
          <p className="font-display text-base font-bold mt-1" style={{ color: "var(--bk-accent)" }}>
            {page.characterName}
          </p>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-px w-8" style={{ backgroundColor: "#d4af37", opacity: 0.5 }} />
            <span className="text-[10px]" style={{ color: "#d4af37", opacity: 0.6 }}>{"\u2665"}</span>
            <div className="h-px w-8" style={{ backgroundColor: "#d4af37", opacity: 0.5 }} />
          </div>
          <p className="mt-3 font-display text-[12px] italic leading-relaxed max-w-[80%] opacity-80" style={{ color: "var(--bk-title)" }}>
            &ldquo;{page.dedicationText}&rdquo;
          </p>
          {page.senderName && (
            <p className="mt-2 text-[11px] text-text-muted">— {page.senderName}</p>
          )}
          <div className="mt-4">
            <StarCluster />
          </div>
        </div>
      );

    case "scene":
      return <ScenePage page={page} templateId={templateId} pageNumber={pageNumber} />;

    case "final":
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-cream p-8 text-center">
          <FrameBorder />
          <StarCluster size={36} />
          <div className="mt-4 mb-4">
            <OrnamentalDivider width={100} color="#d4af37" />
          </div>
          <p className="font-display text-lg font-bold leading-relaxed max-w-xs" style={{ color: "var(--bk-title)" }}>
            {page.message}
          </p>
          <div className="mt-4">
            <WavyDots color="var(--bk-ornament)" />
          </div>
          <p className="mt-4 text-[10px] text-text-muted">
            Una historia creada con cariño para {page.characterName}
          </p>
          <p className="mt-2 font-display text-base font-bold" style={{ color: "var(--bk-accent)" }}>{t("end")}</p>
        </div>
      );

    case "hero_card": {
      const pronounLabel =
        page.gender === "girl" ? t("heroine") : t("hero");
      const heroImage = page.portraitUrl || page.avatarUrl;
      return (
        <div className="absolute inset-0 overflow-hidden">
          {/* Full-bleed portrait background */}
          {heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroImage}
              alt={page.characterName}
              className="absolute inset-0 h-full w-full object-cover object-top"
            />
          ) : (
            <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom right, var(--bk-grad-start), var(--bk-grad-end))` }}>
              <span className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 material-symbols-outlined text-8xl text-white/15">person</span>
            </div>
          )}

          {/* Hero badge */}
          <div className="absolute top-3 left-3 z-10">
            <span className="inline-block rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-white shadow-sm" style={{ backgroundColor: "var(--bk-accent)" }}>
              {pronounLabel}
            </span>
          </div>

          {/* Gradient overlay for text readability */}
          <div className="absolute inset-0 bg-linear-to-t from-white via-white/70 to-transparent" style={{ top: "40%" }} />

          {/* Character details — translucent panel at bottom */}
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 pt-3 z-10">
            <h2 className="font-display text-lg font-black leading-tight" style={{ color: "var(--bk-title)" }}>
              {page.characterName}
            </h2>
            <p className="text-[10px] text-text-muted mt-0.5">
              {page.age} {t("years")}{page.city ? ` · ${page.city}` : ""}
            </p>

            <div className="mt-2.5 flex flex-col gap-1.5">
              {page.specialTrait && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm shrink-0" style={{ color: "var(--bk-accent)" }}>bolt</span>
                  <p className="text-[10px] font-medium leading-snug truncate" style={{ color: "var(--bk-title)" }}>{page.specialTrait}</p>
                </div>
              )}
              {page.favoriteCompanion && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm shrink-0" style={{ color: "var(--bk-accent)" }}>pets</span>
                  <p className="text-[10px] font-medium leading-snug truncate" style={{ color: "var(--bk-title)" }}>{page.favoriteCompanion}</p>
                </div>
              )}
              {page.favoriteFood && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm shrink-0" style={{ color: "var(--bk-accent)" }}>restaurant</span>
                  <p className="text-[10px] font-medium leading-snug truncate" style={{ color: "var(--bk-title)" }}>{page.favoriteFood}</p>
                </div>
              )}
              {page.futureDream && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm shrink-0" style={{ color: "var(--bk-accent)" }}>rocket_launch</span>
                  <p className="text-[10px] font-medium leading-snug truncate" style={{ color: "var(--bk-title)" }}>{page.futureDream}</p>
                </div>
              )}
              {page.interests.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {page.interests.map((interest) => (
                    <span key={interest} className="rounded-full border border-white/60 bg-white/70 px-2 py-0.5 text-[9px] font-medium text-text-soft backdrop-blur-sm">
                      {td(`interests.${interest}`)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    case "colophon": {
      const bookUrl = `https://meapica.com/book/${page.storyId}`;
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-cream p-8 text-center">
          <p className="text-[10px] leading-relaxed text-text-muted max-w-[80%]">
            {t("colophonText")}
          </p>
          <div className="mt-5 flex flex-col items-center gap-2">
            <QRCodeSVG
              value={bookUrl}
              size={72}
              level="M"
              fgColor={getBookColors(templateId).gradientStart}
              bgColor="transparent"
            />
            <p className="text-[8px] text-text-muted/60 tracking-wide">meapica.com</p>
          </div>
          <div className="mt-4 h-px w-12 bg-border-light" />
          <BrandLogo className="h-4 text-text-muted/40 mt-3" />
        </div>
      );
    }

    case "back": {
      return (
        <div className="absolute inset-0 overflow-hidden" style={{ background: `linear-gradient(to bottom, var(--bk-grad-start), var(--bk-grad-end))` }}>
          {/* Background illustration — large, faded, blended */}
          {page.coverImageUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={page.coverImageUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-40 blur-[2px]"
              />
              <div className="absolute inset-0 bg-black/50" />
            </>
          )}

          {/* Subtle texture */}
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: "radial-gradient(circle, white 0.5px, transparent 0.5px)",
            backgroundSize: "14px 14px",
          }} />

          {/* Content */}
          <div className="relative h-full flex flex-col items-center justify-between px-7 py-6">
            {/* Top: book title + character */}
            <div className="flex flex-col items-center gap-1 shrink-0 pt-2">
              <h3 className="font-display text-sm font-bold text-white/90 text-center leading-tight">
                {page.title}
              </h3>
              <p className="text-[9px] text-white/50 tracking-wide">
                {t("personalizedStory")} {page.characterName}
              </p>
            </div>

            {/* Center: synopsis */}
            <div className="flex flex-col items-center gap-3 max-w-[85%]">
              <p className="font-display text-[11px] italic leading-relaxed text-white/75 text-center">
                &ldquo;{page.synopsis}&rdquo;
              </p>
              {/* Decorative divider */}
              <div className="flex items-center gap-3">
                <div className="h-px w-8 bg-white/20" />
                <div className="h-1 w-1 rounded-full bg-white/25" />
                <div className="h-px w-8 bg-white/20" />
              </div>
            </div>

            {/* Bottom: logo */}
            <div className="flex flex-col items-center gap-2 shrink-0 pb-1">
              <BrandLogo className="h-4 text-white/30" />
              <p className="text-[7px] text-white/15 tracking-widest uppercase">
                meapica.com
              </p>
            </div>
          </div>
        </div>
      );
    }
  }
}
