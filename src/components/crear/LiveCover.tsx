"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import BrandLogo from "@/components/BrandLogo";
import { getTemplateConfig } from "@/lib/create-store";
import { DEFAULT_COVER_TEMPLATE, coverNameFontSize, elidesDe } from "@/lib/creation-flow";

interface LiveCoverProps {
  /** Child's name exactly as typed (any Unicode letters, accents, l·l, apostrophes). */
  name: string;
  /** Chosen world; null = default art, no world kicker. */
  templateId: string | null;
  /** Real painted cover (replaces the template art once it exists). */
  imageUrl?: string | null;
  /** Load the art eagerly (above-the-fold hero cover). */
  priority?: boolean;
  /** `sizes` hint for the art image. */
  sizes?: string;
  className?: string;
}

/**
 * The book cover rendered live from the template art + the child's name.
 * Pure client render (no network) so it updates on every keystroke.
 */
export default function LiveCover({
  name,
  templateId,
  imageUrl,
  priority,
  sizes = "(max-width: 640px) 70vw, 420px",
  className = "",
}: LiveCoverProps) {
  const t = useTranslations("crear.cover");
  const td = useTranslations("data");
  const locale = useLocale();
  const template = getTemplateConfig(templateId ?? DEFAULT_COVER_TEMPLATE);
  const painted = !!imageUrl;
  const art = imageUrl || template?.image || "/images/templates/space.jpg";
  const trimmed = name.trim();
  const displayName = trimmed || t("namePlaceholder");
  const prefix = elidesDe(trimmed, locale) ? t("titlePrefixElided") : t("titlePrefix");
  const kicker = templateId ? td(`templates.${templateId}.title`) : null;
  const accent = templateId && template ? template.themeColor : "#3a2418";

  // Measure the cover so the name scales with it (no layout shift: the box is
  // a fixed aspect-square; only the font size inside it changes).
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const measure = useCallback(() => {
    if (boxRef.current) setWidth(boxRef.current.getBoundingClientRect().width);
  }, []);
  useLayoutEffect(() => {
    measure();
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  const w = width || 300;
  const nameSize = coverNameFontSize(displayName, w);
  const joiner = prefix.endsWith("'") || prefix.endsWith("’") ? "" : " ";
  const fullTitle = `${prefix}${joiner}${displayName}`;

  return (
    <div
      ref={boxRef}
      role="img"
      aria-label={kicker ? `${fullTitle} · ${kicker}` : fullTitle}
      data-testid="live-cover"
      className={`relative aspect-square w-full select-none overflow-hidden rounded-[4px_14px_14px_4px] bg-create-neutral shadow-[0_22px_40px_-22px_rgba(58,36,24,.55),0_2px_6px_rgba(58,36,24,.12)] ${className}`}
    >
      <Image
        key={art}
        src={art}
        alt=""
        fill
        priority={priority}
        sizes={sizes}
        className="cover-art-in object-cover"
      />
      {painted ? (
        // Real painted cover: same treatment as the book viewer's cover page
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/70" />
      ) : (
        // Paper wash behind the title so it stays legible on any template art
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[62%]"
          style={{
            background:
              "linear-gradient(to bottom, rgba(255,250,243,.94) 0%, rgba(255,250,243,.82) 55%, rgba(255,250,243,0) 100%)",
          }}
        />
      )}
      {/* Spine + page-edge shading */}
      <div aria-hidden className="absolute inset-y-0 left-0 w-[4.5%] bg-gradient-to-r from-black/20 via-black/5 to-transparent" />
      <div aria-hidden className="absolute inset-y-0 left-[4.5%] w-px bg-white/40" />

      <div
        className={`absolute inset-x-0 flex flex-col items-center px-[9%] text-center ${painted ? "bottom-0" : "top-0"}`}
        style={painted ? { paddingBottom: w * 0.08 } : { paddingTop: w * 0.075 }}
      >
        {kicker && w >= 180 && (
          <span
            className="mb-[0.6em] font-sans font-bold uppercase leading-tight"
            style={{
              fontSize: Math.max(9, w * 0.034),
              letterSpacing: "0.14em",
              color: painted ? "#fff" : accent,
              opacity: painted ? 0.85 : 0.8,
            }}
          >
            {kicker}
          </span>
        )}
        <span
          className={`font-display font-medium leading-tight ${painted ? "text-white/90" : "text-create-text"}`}
          style={{ fontSize: Math.max(12, w * 0.062) }}
        >
          {prefix}
        </span>
        <span
          data-testid="live-cover-name"
          lang={locale}
          className={`font-display font-bold leading-[1.02] [overflow-wrap:normal] [text-wrap:balance] [word-break:keep-all] ${
            trimmed ? "" : "opacity-35"
          } ${painted ? "drop-shadow-[0_2px_6px_rgba(0,0,0,.45)]" : ""}`}
          style={{ fontSize: painted ? nameSize * 0.8 : nameSize, color: painted ? "#fff" : accent, marginTop: w * 0.012 }}
        >
          {displayName}
        </span>
      </div>

      {painted ? (
        <BrandLogo className="absolute left-1/2 top-[5%] h-[5.5%] -translate-x-1/2 text-white/90" />
      ) : (
        <BrandLogo className="absolute bottom-[5%] right-[6%] h-[5.5%] text-create-text/55" />
      )}
    </div>
  );
}
