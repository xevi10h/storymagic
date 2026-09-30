"use client";

/**
 * The printed page, drawn for the screen. HTML twin of src/lib/pdf/book-template.tsx and
 * cover-art.tsx: same geometry (pt), same fitted type (from the print plan), same colours,
 * ornaments, gradients and crops — so the web viewer shows what the printer prints.
 *
 * Coordinates: the PDF draws on a 208 mm bleed page; the viewer shows the 200 mm TRIM (what
 * the reader holds), so every page-edge coordinate is shifted by the 4 mm bleed (`at`).
 * Sizes use container units: 100cqi = the trim width, whatever size the page is shown at.
 * Drawn only when something here changes in the PDF template — keep the two in step.
 */

import { useState, type CSSProperties, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import BrandLogo from "@/components/BrandLogo";
import type { BookColors } from "@/lib/template-colors";
import {
  BACK,
  BOOK,
  COLORS,
  COVER_OVERLAY_STOPS,
  COVER_SUBTITLE,
  CREAM_FADE_RGB,
  CREAM_FADE_STOPS,
  GEOMETRY,
  ILL_TEXT_WIDTH,
  MAP_PANEL,
  PANEL_PADDING,
  SCENE_TEXT_INK,
  TEXT_OVERLAY_STOPS,
  TITLE_OVERLAY_STOPS,
  cssGradient,
  vignetteBoxFor,
  type MapPanel,
} from "@/lib/book/print-spec";
import { sanitizePrintText } from "@/lib/book/print-text";
import type { BookPage } from "./types";
import EndpaperPattern from "./EndpaperPattern";
import { HeartIcon, OrnamentalDivider, PaletteIcon, PetsIcon, StarCluster, WavyDots } from "./print-ornaments";

// ── Units ─────────────────────────────────────────────────────────────────

const W = BOOK.pageWidth;
const H = BOOK.pageHeight;
const M = BOOK.contentMargin;
const TRIM = BOOK.trimWidth;
const BLEED = BOOK.bleed;
const SAFE = BOOK.safeMargin;

/** A length in pt → container units (100cqi = trim width). */
export const u = (pt: number) => `${((pt * 100) / TRIM).toFixed(4)}cqi`;
/** A distance from the bleed page's edge → from the trim edge. */
const at = (pt: number) => u(pt - BLEED);

const DISPLAY = "var(--font-fredoka), Fredoka, sans-serif";
const BODY = "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif";

interface FittedType {
  fontSize: number;
  leading: number;
}
const type = (t: FittedType): CSSProperties => ({ fontSize: u(t.fontSize), lineHeight: t.leading });

// ── Primitives (primitives.tsx) ───────────────────────────────────────────

function Page({ background, children }: { background?: string; children: ReactNode }) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ backgroundColor: background }}>
      {children}
    </div>
  );
}

/**
 * Image uniformly scaled to COVER a box (never stretched) — PlacedImage. The box is given in
 * bleed-page coordinates; `windowLeft` shifts a wider box (panorama halves, the map).
 */
function PlacedImage({
  src,
  alt = "",
  box,
  windowLeft = 0,
  focusY = 0.5,
  blur = false,
}: {
  src: string | null;
  alt?: string;
  box: { left?: number; top?: number; width: number; height: number };
  windowLeft?: number;
  focusY?: number;
  blur?: boolean;
}) {
  const style: CSSProperties = {
    position: "absolute",
    left: at((box.left ?? 0) - windowLeft),
    top: at(box.top ?? 0),
    width: u(box.width),
    height: u(box.height),
    overflow: "hidden",
    backgroundColor: COLORS.cream,
  };
  return (
    <div style={style}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          draggable={false}
          className={`absolute inset-0 h-full w-full object-cover ${blur ? "scale-105 blur-lg" : ""}`}
          style={{ objectPosition: `50% ${focusY * 100}%` }}
        />
      ) : null}
    </div>
  );
}

/** Vertical gradient over the bottom part of the page (full bleed width). */
function BottomGradient({ stops, height, rgb }: { stops: typeof TEXT_OVERLAY_STOPS; height: number; rgb?: [number, number, number] }) {
  return <div className="absolute" style={{ left: at(0), bottom: at(0), width: u(W), height: u(height), backgroundImage: cssGradient(stops, rgb) }} />;
}

function FrameBorder({ color }: { color: string }) {
  const inset = at(BOOK.frameInset);
  return (
    <div
      className="pointer-events-none absolute"
      style={{ top: inset, left: inset, right: inset, bottom: inset, border: `${u(0.75)} solid ${color}`, borderRadius: u(6), opacity: 0.35 }}
    />
  );
}

function CornerDot({ color, top, left, right, bottom }: { color: string; top?: number; left?: number; right?: number; bottom?: number }) {
  const pos = (v?: number) => (v === undefined ? undefined : at(v));
  return (
    <div
      className="absolute"
      style={{ top: pos(top), left: pos(left), right: pos(right), bottom: pos(bottom), width: u(6), height: u(6), borderRadius: "50%", backgroundColor: color, opacity: 0.3 }}
    />
  );
}

/** Folio, BOOK.folioInset from the page edge; `art`: on a paper plate over illustrations. */
function PageNumber({ num, variant = "paper" }: { num: number; variant?: "paper" | "art" }) {
  return (
    <div className="absolute flex justify-center" style={{ bottom: at(BOOK.folioInset), left: 0, right: 0 }}>
      {variant === "art" ? (
        <span
          style={{ backgroundColor: "rgba(255, 252, 247, 0.8)", borderRadius: u(5), padding: `${u(1)} ${u(4)}`, fontFamily: BODY, fontSize: u(7), lineHeight: 1.2, color: COLORS.textMedium }}
        >
          {num}
        </span>
      ) : (
        <span className="flex items-center" style={{ gap: u(6) }}>
          <span style={{ width: u(12), height: u(0.5), backgroundColor: COLORS.textLight }} />
          <span style={{ fontFamily: BODY, fontSize: u(8), lineHeight: 1.2, color: COLORS.textMuted }}>{num}</span>
          <span style={{ width: u(12), height: u(0.5), backgroundColor: COLORS.textLight }} />
        </span>
      )}
    </div>
  );
}

/** Multi-paragraph text: one block per line, a blank line is a one-line spacer (Paragraphs). */
function Paragraphs({ text, style, balance, prefix = "", suffix = "" }: { text: string; style: CSSProperties; balance?: boolean; prefix?: string; suffix?: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) =>
        line.trim() === "" ? (
          <div key={i} aria-hidden style={{ height: `calc(${style.fontSize} * ${style.lineHeight})` }} />
        ) : (
          <p
            key={i}
            // Balanced lines (Paragraphs `balance`): the PDF keeps the line count its planner measured
            // with a 5 % safety margin (text.ts WIDTH_SAFETY), then sets the narrowest measure for it.
            style={{ ...style, margin: 0, ...(balance ? { textWrap: "balance", maxWidth: "95%", marginInline: style.textAlign === "center" ? "auto" : undefined } : null) }}
          >
            {i === 0 ? prefix : ""}
            {line}
            {i === lines.length - 1 ? suffix : ""}
          </p>
        ),
      )}
    </>
  );
}

// ── Pages ─────────────────────────────────────────────────────────────────

type Props = { page: BookPage; colors: BookColors };
type PageOf<T extends BookPage["type"]> = Extract<BookPage, { type: T }>;

function OverlayTitle({ text, t }: { text: string; t: FittedType }) {
  return (
    <div className="absolute" style={{ bottom: at(M + 6), left: at(M), width: u(GEOMETRY.overlayTextWidth) }}>
      <p style={{ margin: 0, fontFamily: DISPLAY, fontWeight: 600, color: "#ffffff", ...type(t) }}>{text}</p>
    </div>
  );
}

function ScenePage({ page, colors }: { page: PageOf<"scene">; colors: BookColors }) {
  const p = page.print;
  const title = sanitizePrintText(page.scene.title);
  const blur = page.locked;

  if (p.kind === "illustration") {
    return (
      <Page>
        <PlacedImage src={page.imageUrl} alt={title} box={{ width: p.image.boxWidth, height: p.image.boxHeight }} blur={blur} />
        {p.title && <BottomGradient stops={TITLE_OVERLAY_STOPS} height={H * 0.5} />}
        {p.title && <OverlayTitle text={title} t={p.title} />}
        <PageNumber num={p.pageNumber} variant="art" />
      </Page>
    );
  }

  if (p.kind === "spread") {
    const { overlay } = p;
    return (
      <Page>
        <PlacedImage src={page.imageUrl} alt={title} box={{ width: p.image.boxWidth, height: p.image.boxHeight }} windowLeft={p.image.windowLeft} blur={blur} />
        <BottomGradient stops={TEXT_OVERLAY_STOPS} height={page.spreadGradient ?? H * 0.5} />
        {overlay.role === "title" ? (
          <OverlayTitle text={overlay.text} t={overlay.type} />
        ) : overlay.mode === "gradient" ? (
          <div className="absolute" style={{ bottom: at(M + 6), left: at(M), width: u(GEOMETRY.overlayTextWidth) }}>
            <Paragraphs text={overlay.text} style={{ fontFamily: BODY, color: "#ffffff", ...type(overlay.type) }} />
          </div>
        ) : (
          <div
            className="absolute"
            style={{ bottom: at(M), left: at(M), width: u(GEOMETRY.overlayTextWidth), padding: u(PANEL_PADDING), backgroundColor: "rgba(255, 252, 247, 0.94)", borderRadius: u(10) }}
          >
            <Paragraphs text={overlay.text} style={{ fontFamily: BODY, color: COLORS.textDark, ...type(overlay.type) }} />
          </div>
        )}
        <PageNumber num={p.pageNumber} variant="art" />
      </Page>
    );
  }

  if (p.kind === "illustration-text") {
    return (
      <Page background={COLORS.cream}>
        <PlacedImage src={page.imageUrl} alt={title} box={{ width: p.image.boxWidth, height: p.image.boxHeight }} blur={blur} />
        <div
          className="absolute flex flex-col items-center justify-center"
          style={{ top: at(p.image.boxHeight + 8), bottom: at(M), left: at((W - ILL_TEXT_WIDTH) / 2), width: u(ILL_TEXT_WIDTH) }}
        >
          <OrnamentalDivider color={colors.ornamentColor} width={60} />
          <div style={{ marginTop: u(8), width: u(ILL_TEXT_WIDTH) }}>
            <Paragraphs text={p.body} style={{ fontFamily: BODY, color: COLORS.textDark, textAlign: "center", ...type(p.bodyType) }} />
          </div>
          <div style={{ marginTop: u(6) }}>
            <WavyDots color={colors.ornamentColor} />
          </div>
        </div>
        <PageNumber num={p.pageNumber} />
      </Page>
    );
  }

  // Text pages: galeria / pergamino / ventana / puente (TextPage)
  const k = p.scale;
  const colW = GEOMETRY.textColumnWidth;
  const bodyStyle: CSSProperties = { fontFamily: BODY, color: COLORS.textDark, ...type(p.bodyType) };
  const titleStyle: CSSProperties = { margin: 0, fontFamily: DISPLAY, fontWeight: 600, color: colors.titleColor, ...type(p.titleType) };
  const column: CSSProperties = { position: "absolute", top: at(M), bottom: at(M), left: at((W - colW) / 2), width: u(colW), display: "flex", flexDirection: "column", justifyContent: "center", paddingBottom: u(p.lift) };
  const content = (node: ReactNode) => <div className={blur ? "select-none blur-md" : undefined}>{node}</div>;

  switch (p.variant) {
    case "puente":
      return (
        <Page background={colors.accentLight}>
          <FrameBorder color={colors.ornamentColor} />
          <CornerDot color={colors.accent} top={M + 4} left={M + 4} />
          <CornerDot color={colors.accent} top={M + 4} right={M + 4} />
          <CornerDot color={colors.accent} bottom={M + 4} left={M + 4} />
          <CornerDot color={colors.accent} bottom={M + 4} right={M + 4} />
          <div style={{ ...column, alignItems: "center" }}>
            {content(
              <div className="flex flex-col items-center">
                <OrnamentalDivider color={colors.ornamentColor} width={60 * k} />
                <div style={{ margin: `${u(28 * k)} 0`, width: u(TRIM * 0.7) }}>
                  <Paragraphs text={p.body} balance style={{ fontFamily: DISPLAY, fontWeight: 600, color: colors.titleColor, textAlign: "center", ...type(p.bodyType) }} />
                </div>
                <WavyDots color={colors.ornamentColor} size={4 * k} />
              </div>,
            )}
          </div>
          <PageNumber num={p.pageNumber} />
        </Page>
      );
    case "pergamino":
      return (
        <Page background={colors.accentLight}>
          <FrameBorder color={colors.ornamentColor} />
          <div style={column}>
            {content(
              <>
                <h3 style={{ ...titleStyle, marginBottom: u(10 * k) }}>{title}</h3>
                <div style={{ width: u(TRIM * 0.35), height: u(1), backgroundColor: colors.accent, borderRadius: u(1), marginBottom: u(14 * k), opacity: 0.8 }} />
                <Paragraphs text={p.body} style={bodyStyle} />
                <div style={{ marginTop: u(16 * k) }}>
                  <WavyDots color={colors.ornamentColor} size={4 * k} />
                </div>
              </>,
            )}
          </div>
          <PageNumber num={p.pageNumber} />
        </Page>
      );
    case "ventana": {
      const cap = p.dropCap;
      const pitch = `calc(${u(p.bodyType.fontSize)} * ${p.bodyType.leading})`;
      return (
        <Page background={COLORS.cream}>
          <FrameBorder color={colors.ornamentColor} />
          <div style={column}>
            {content(
              <>
                <h3 style={{ ...titleStyle, marginBottom: u(14 * k) }}>{title}</h3>
                {cap ? (
                  <>
                    <div className="flex">
                      <div className="relative shrink-0" style={{ width: u(cap.capWidth), height: `calc(2 * ${pitch})` }}>
                        <span className="absolute left-0" style={{ top: u(cap.capTop), fontFamily: DISPLAY, fontWeight: 600, fontSize: u(cap.capSize), lineHeight: 1, color: colors.accent }}>
                          {cap.initial}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <Paragraphs text={cap.head} style={bodyStyle} />
                      </div>
                    </div>
                    {cap.tail ? <Paragraphs text={cap.tail} style={bodyStyle} /> : null}
                  </>
                ) : (
                  <Paragraphs text={p.body} style={bodyStyle} />
                )}
                <div className="flex justify-center" style={{ marginTop: u(14 * k) }}>
                  <OrnamentalDivider color={colors.ornamentColor} width={70 * k} />
                </div>
              </>,
            )}
          </div>
          <PageNumber num={p.pageNumber} />
        </Page>
      );
    }
    case "galeria":
    default:
      return (
        <Page background={COLORS.cream}>
          <FrameBorder color={colors.ornamentColor} />
          <div style={{ ...column, alignItems: "center" }}>
            {content(
              <div className="flex flex-col items-center">
                <h3 style={{ ...titleStyle, textAlign: "center", marginBottom: u(12 * k) }}>{title}</h3>
                <OrnamentalDivider color={colors.ornamentColor} width={80 * k} />
                <div style={{ marginTop: u(12 * k), width: u(colW) }}>
                  <Paragraphs text={p.body} balance style={{ ...bodyStyle, textAlign: "center" }} />
                </div>
                <div style={{ marginTop: u(14 * k) }}>
                  <StarCluster color={COLORS.gold} size={24 * k} />
                </div>
              </div>,
            )}
          </div>
          <PageNumber num={p.pageNumber} />
        </Page>
      );
  }
}

function TitleDedicationPage({ page, colors }: { page: PageOf<"title_dedication">; colors: BookColors }) {
  const p = page.print;
  const { scale: k, kicker, display, sender, logo } = p.front;
  const col = u(GEOMETRY.textColumnWidth);
  return (
    <Page background={COLORS.cream}>
      <FrameBorder color={colors.ornamentColor} />
      <div className="absolute flex flex-col items-center justify-center text-center" style={{ top: at(M), bottom: at(M), left: at(M), right: at(M) }}>
        <BrandLogo style={{ height: u(logo), marginBottom: u(16 * k), opacity: 0.7, color: colors.ornamentColor }} />
        <h2 style={{ margin: 0, maxWidth: col, fontFamily: DISPLAY, fontWeight: 600, color: colors.titleColor, ...type(p.titleType) }}>{p.title}</h2>
        <div style={{ margin: `${u(10 * k)} 0` }}>
          <OrnamentalDivider color={colors.ornamentColor} width={60 * k} />
        </div>
        <p style={{ margin: 0, maxWidth: col, fontFamily: BODY, fontSize: u(kicker), lineHeight: 1.3, color: COLORS.textMedium }}>{page.kicker}</p>
        <p style={{ margin: 0, marginTop: u(4 * k), maxWidth: col, fontFamily: DISPLAY, fontWeight: 600, fontSize: u(display), lineHeight: 1.3, color: colors.accent }}>{page.characterName}</p>
        {p.dedication ? (
          <>
            <div className="flex items-center" style={{ margin: `${u(20 * k)} 0`, gap: u(8 * k) }}>
              <div style={{ width: u(30 * k), height: u(0.5), backgroundColor: COLORS.gold, opacity: 0.5 }} />
              <HeartIcon color={COLORS.gold} size={9 * k} opacity={0.7} />
              <div style={{ width: u(30 * k), height: u(0.5), backgroundColor: COLORS.gold, opacity: 0.5 }} />
            </div>
            <div className="flex flex-col items-center" style={{ width: u(TRIM * 0.66) }}>
              <Paragraphs
                text={p.dedication}
                prefix={page.quotes[0]}
                suffix={page.quotes[1]}
                balance
                style={{ fontFamily: BODY, fontStyle: "italic", color: colors.titleColor, opacity: 0.85, textAlign: "center", ...type(p.dedicationType) }}
              />
              {p.sender && (
                <p style={{ margin: 0, marginTop: u(8 * k), fontFamily: BODY, fontSize: u(sender), lineHeight: 1.3, color: COLORS.textMuted }}>— {p.sender}</p>
              )}
            </div>
          </>
        ) : null}
        <div style={{ marginTop: u(20 * k) }}>
          <StarCluster color={COLORS.gold} size={24 * k} />
        </div>
      </div>
    </Page>
  );
}

function FinalPage({ page, colors }: { page: PageOf<"final">; colors: BookColors }) {
  const p = page.print;
  const { scale: k, kicker, display } = p.front;
  return (
    <Page background={COLORS.cream}>
      <FrameBorder color={colors.ornamentColor} />
      <div className="absolute flex flex-col items-center justify-center text-center" style={{ top: at(M), bottom: at(M), left: at(M), right: at(M) }}>
        <div className="flex flex-col items-center" style={{ width: u(TRIM * 0.7) }}>
          <StarCluster color={COLORS.gold} size={Math.min(56, 40 * k)} />
          <div style={{ margin: `${u(20 * k)} 0` }}>
            <OrnamentalDivider color={COLORS.gold} width={100 * k} />
          </div>
          <Paragraphs text={p.message} balance style={{ fontFamily: DISPLAY, fontWeight: 600, color: COLORS.textMedium, textAlign: "center", ...type(p.messageType) }} />
          <div style={{ marginTop: u(20 * k) }}>
            <WavyDots color={colors.ornamentColor} size={4 * k} />
          </div>
          <p style={{ margin: 0, marginTop: u(28 * k), fontFamily: BODY, fontSize: u(kicker), lineHeight: 1.3, color: COLORS.textMuted }}>{page.kicker}</p>
          <p style={{ margin: 0, marginTop: u(8 * k), fontFamily: DISPLAY, fontWeight: 600, fontSize: u(display), lineHeight: 1.2, color: colors.accent }}>{page.end}</p>
        </div>
      </div>
      <PageNumber num={p.pageNumber} />
    </Page>
  );
}

function AboutReaderPage({ page, colors }: { page: PageOf<"hero_card">; colors: BookColors }) {
  return (
    <Page background="#ffffff">
      {page.portraitUrl ? (
        <PlacedImage src={page.portraitUrl} alt={page.characterName} box={{ width: W, height: H }} focusY={0} />
      ) : (
        <div className="absolute inset-0" style={{ backgroundColor: colors.gradientStart }}>
          <div className="absolute inset-0" style={{ backgroundColor: colors.gradientEnd, opacity: 0.3 }} />
        </div>
      )}
      <div className="absolute" style={{ top: at(M), left: at(M), backgroundColor: colors.accent, borderRadius: u(12), padding: `${u(5)} ${u(12)}` }}>
        <span className="block" style={{ fontFamily: BODY, fontSize: u(6.5), fontWeight: 700, lineHeight: 1.2, color: "#ffffff", letterSpacing: u(2) }}>{page.heroLabel.toUpperCase()}</span>
      </div>
      <BottomGradient stops={CREAM_FADE_STOPS} rgb={CREAM_FADE_RGB} height={H * 0.6} />
      <div className="absolute" style={{ bottom: at(M), left: at(M), right: at(M) }}>
        <p style={{ margin: 0, fontFamily: DISPLAY, fontWeight: 600, fontSize: u(28), lineHeight: 1.15, color: colors.titleColor }}>{page.characterName}</p>
        <div style={{ width: u(32), height: u(2.5), borderRadius: u(1.25), backgroundColor: colors.accent, marginTop: u(6), opacity: 0.8 }} />
        <p style={{ margin: 0, marginTop: u(8), fontFamily: BODY, fontSize: u(9), lineHeight: 1.2, color: COLORS.textMedium, letterSpacing: u(0.3), whiteSpace: "pre" }}>{page.ageLine}</p>
        {page.traits.length > 0 && (
          <div className="flex flex-col" style={{ marginTop: u(12), gap: u(7) }}>
            {page.traits.map((trait, i) => (
              <div key={i} className="flex items-center" style={{ gap: u(7) }}>
                {trait.icon === "color" && (
                  <span className="shrink-0 rounded-full" style={{ width: u(12), height: u(12), backgroundColor: trait.color ?? colors.accent, border: `${u(0.5)} solid ${COLORS.textLight}` }} />
                )}
                {trait.icon === "pets" && <PetsIcon color={colors.accent} size={13} />}
                {trait.icon === "palette" && <PaletteIcon color={colors.accent} size={13} />}
                <span style={{ fontFamily: BODY, fontSize: u(9), fontWeight: 600, lineHeight: 1.2, color: colors.titleColor, letterSpacing: u(0.2) }}>{trait.label}</span>
              </div>
            ))}
          </div>
        )}
        {page.interests.length > 0 && (
          <div className="flex flex-wrap" style={{ gap: u(5), marginTop: u(12) }}>
            {page.interests.map((interest) => (
              <span key={interest} style={{ backgroundColor: colors.accentLight, borderRadius: u(10), padding: `${u(4)} ${u(10)}`, fontFamily: BODY, fontSize: u(7), fontWeight: 600, lineHeight: 1.2, color: colors.accent, letterSpacing: u(0.3) }}>
                {interest}
              </span>
            ))}
          </div>
        )}
      </div>
    </Page>
  );
}

/** Adventure map spread (pp. 28–29): one half of the map; the game card on the right half. */
function MapPage({ page, colors, interactive }: { page: PageOf<"map">; colors: BookColors; interactive: boolean }) {
  return (
    <Page background={COLORS.cream}>
      <PlacedImage src={page.imageUrl} box={{ width: GEOMETRY.spreadWidth, height: H }} windowLeft={page.half === "right" ? GEOMETRY.spreadRightOffset : 0} />
      {page.panel ? (
        // Vertically centred like print ((H − panel height) / 2)
        <div className="absolute flex flex-col justify-center" style={{ top: at(M), bottom: at(M), left: at(GEOMETRY.mapPanelLeft), width: u(GEOMETRY.mapPanelWidth) }}>
          <MapGamePanel panel={page.panel} colors={colors} interactive={interactive} />
        </div>
      ) : null}
    </Page>
  );
}

/**
 * The search-and-find card (MapGamePanel). On screen the item circles can be ticked — the same
 * mark a child makes with a finger on paper; the card's composition does not change.
 */
function MapGamePanel({ panel, colors, interactive }: { panel: MapPanel; colors: BookColors; interactive: boolean }) {
  const [found, setFound] = useState<ReadonlySet<number>>(new Set());
  const z = MAP_PANEL.sizes[panel.band];
  const s = panel.scale;
  const inner = GEOMETRY.mapPanelWidth - 2 * MAP_PANEL.padding;
  const dot = z.dot * s;
  const divider = <div style={{ width: u(28), height: u(1), borderRadius: u(0.5), backgroundColor: colors.accent, opacity: 0.8, marginBottom: u(MAP_PANEL.dividerGap) }} />;
  const toggle = (i: number) =>
    setFound((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  return (
    <div className="relative" style={{ padding: u(MAP_PANEL.padding), backgroundColor: "rgba(255, 252, 247, 0.95)", borderRadius: u(10) }} data-testid="map-game">
      <div className="pointer-events-none absolute" style={{ top: u(4), left: u(4), right: u(4), bottom: u(4), border: `${u(0.75)} solid ${colors.ornamentColor}`, borderRadius: u(7), opacity: 0.7 }} />
      <p style={{ margin: 0, fontFamily: BODY, fontSize: u(MAP_PANEL.kicker), fontWeight: 700, color: colors.accent, letterSpacing: u(1.4), lineHeight: 1.3 }}>{panel.kicker.toUpperCase()}</p>
      <p style={{ margin: 0, marginTop: u(MAP_PANEL.kickerGap), marginBottom: u(MAP_PANEL.titleGap), fontFamily: DISPLAY, fontWeight: 600, fontSize: u(z.title * s), lineHeight: 1.2, color: colors.titleColor }}>{panel.title}</p>
      {panel.howTo ? (
        <p style={{ margin: 0, marginTop: u(-MAP_PANEL.titleGap / 2), marginBottom: u(MAP_PANEL.howTo.gap), fontFamily: BODY, fontSize: u(MAP_PANEL.howTo.size * s), lineHeight: MAP_PANEL.howTo.leading, color: COLORS.textMedium }}>{panel.howTo}</p>
      ) : null}
      {divider}
      <ul className="m-0 list-none p-0">
        {panel.items.map((item, i) => {
          const done = found.has(i);
          const mark = (
            <span
              className="pointer-events-none relative flex shrink-0 items-center justify-center rounded-full"
              style={{ width: u(dot), height: u(dot), border: `${u(1.1)} solid ${colors.accent}`, marginRight: u(7), backgroundColor: done ? colors.accent : undefined, transition: "background-color 150ms" }}
            >
              {done ? (
                <svg viewBox="0 0 12 12" style={{ width: "70%", height: "70%" }} aria-hidden>
                  <path d="M2.5 6.2 5 8.6 9.5 3.6" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
            </span>
          );
          const label = (
            <span className="pointer-events-none" style={{ width: u(inner - dot - 7), fontFamily: BODY, fontWeight: 600, fontSize: u(z.item * s), lineHeight: MAP_PANEL.itemLeading, color: COLORS.textDark, textAlign: "left" }}>{item}</span>
          );
          return (
            <li key={i} style={{ marginBottom: u(z.itemGap * s) }}>
              {interactive ? (
                <button type="button" onClick={() => toggle(i)} aria-pressed={done} className="flex w-full cursor-pointer items-center rounded-sm bg-transparent p-0 text-left focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-create-primary">
                  {mark}
                  {label}
                </button>
              ) : (
                <div className="flex items-center">
                  {mark}
                  {label}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {panel.trail ? (
        <div className="flex items-start" style={{ marginTop: u(MAP_PANEL.sectionGap) }}>
          <div className="flex shrink-0" style={{ width: u(18), gap: u(2), paddingTop: u(z.note * s * 0.62) }}>
            {[0, 1, 2].map((d) => (
              <span key={d} style={{ width: u(3.5), height: u(1.4), borderRadius: u(0.7), backgroundColor: colors.accent }} />
            ))}
          </div>
          <p style={{ margin: 0, width: u(inner - 18), fontFamily: BODY, fontStyle: "italic", fontSize: u(z.note * s), lineHeight: MAP_PANEL.noteLeading, color: COLORS.textMedium }}>{panel.trail}</p>
        </div>
      ) : null}
      {panel.questions.length ? (
        <div style={{ marginTop: u(MAP_PANEL.sectionGap) }}>
          {divider}
          <p style={{ margin: 0, marginBottom: u(6), fontFamily: DISPLAY, fontWeight: 600, fontSize: u(z.qTitle * s), lineHeight: 1.2, color: colors.titleColor }}>{panel.questionsTitle}</p>
          {panel.questions.map((q, i) => (
            <div key={i} className="flex" style={{ marginBottom: u(4) }}>
              <span style={{ width: u(14 * s), flexShrink: 0, fontFamily: BODY, fontWeight: 700, fontSize: u(z.question * s), lineHeight: MAP_PANEL.noteLeading, color: colors.accent }}>{i + 1}.</span>
              <span style={{ fontFamily: BODY, fontSize: u(z.question * s), lineHeight: MAP_PANEL.noteLeading, color: COLORS.textDark }}>{q}</span>
            </div>
          ))}
        </div>
      ) : null}
      {panel.answers ? (
        // Upside down, the classic puzzle-book convention
        <p style={{ margin: 0, marginTop: u(MAP_PANEL.sectionGap), transform: "rotate(180deg)", fontFamily: BODY, fontSize: u(z.answer * s), lineHeight: MAP_PANEL.noteLeading, color: COLORS.textMuted, textAlign: "center" }}>{panel.answers}</p>
      ) : null}
    </div>
  );
}

function ColophonPage({ page, colors }: { page: PageOf<"colophon">; colors: BookColors }) {
  return (
    <Page background={COLORS.cream}>
      <div className="absolute flex flex-col items-center justify-center" style={{ top: at(M), bottom: at(M), left: at(M), right: at(M) }}>
        <div className="flex flex-col items-center" style={{ maxWidth: u(TRIM * 0.65) }}>
          <Paragraphs text={page.text} style={{ fontFamily: BODY, fontSize: u(10), color: COLORS.textMuted, textAlign: "center", lineHeight: 1.8 }} />
          <div className="flex flex-col items-center" style={{ marginTop: u(20), gap: u(6) }}>
            {/* The home page, never a per-book URL (matches the printed QR) */}
            <QRCodeSVG value="https://meapica.com" level="M" marginSize={0} fgColor={colors.gradientStart} bgColor="transparent" style={{ width: u(72), height: u(72) }} />
            <span style={{ fontFamily: BODY, fontSize: u(7), lineHeight: 1.2, color: COLORS.textMuted, letterSpacing: u(0.5) }}>meapica.com</span>
          </div>
          <div style={{ width: u(48), height: u(0.5), backgroundColor: COLORS.textLight, marginTop: u(16) }} />
          <span style={{ fontFamily: DISPLAY, fontSize: u(12), lineHeight: 1.2, color: COLORS.textMuted, opacity: 0.6, letterSpacing: u(1), marginTop: u(12) }}>Meapica</span>
        </div>
      </div>
    </Page>
  );
}

// ── Covers (cover-art.tsx, digital-book frame: art = bleed page, visible = trim) ──

function CoverPage({ page, colors }: { page: PageOf<"cover">; colors: BookColors }) {
  const { titleLockup } = page.cover;
  const blockHeight = titleLockup.height + (titleLockup.showSubtitle ? COVER_SUBTITLE.gap + 2 * COVER_SUBTITLE.fontSize * COVER_SUBTITLE.leading : 0);
  const scrim = Math.min(TRIM, Math.max(TRIM * 0.5, (SAFE + blockHeight) * 1.9));
  return (
    <Page background={colors.gradientStart}>
      {page.imageUrl ? (
        <>
          <PlacedImage src={page.imageUrl} alt={page.title} box={{ width: W, height: H }} />
          <div className="absolute inset-x-0 top-0" style={{ height: u(scrim), backgroundImage: cssGradient(COVER_OVERLAY_STOPS) }} />
        </>
      ) : (
        <div className="absolute inset-0" style={{ backgroundColor: colors.gradientEnd, opacity: 0.4 }} />
      )}
      <div className="absolute text-center" style={{ left: u(SAFE), right: u(SAFE), top: u(SAFE) }}>
        {titleLockup.segments.map((seg, i) => (
          <p key={i} style={{ margin: 0, fontFamily: DISPLAY, fontWeight: 600, color: seg.hero ? "#ffffff" : "rgba(255,255,255,0.94)", ...type(seg.type) }}>
            {seg.text}
          </p>
        ))}
        {titleLockup.showSubtitle && (
          <p style={{ margin: 0, marginTop: u(COVER_SUBTITLE.gap), fontFamily: BODY, fontSize: u(COVER_SUBTITLE.fontSize), lineHeight: COVER_SUBTITLE.leading, letterSpacing: u(0.5), color: "rgba(255,255,255,0.85)" }}>
            {page.cover.subtitle}
            {page.cover.subtitle.endsWith("'") ? "" : " "}
            <span style={{ fontWeight: 600, color: "#ffffff" }}>{page.cover.name}</span>
          </p>
        )}
      </div>
    </Page>
  );
}

function BackCoverPage({ page, colors }: { page: PageOf<"back">; colors: BookColors }) {
  const { back, synopsisQuotes } = page.cover;
  // The arch window takes the image's own proportions (vignetteBox) — read once it loads
  const [aspect, setAspect] = useState<number | null>(null);
  const box = page.coverImageUrl ? vignetteBoxFor(aspect, back.vignette) : null;
  const ring = BACK.ring;
  return (
    <Page background={COLORS.cream}>
      <div className="absolute flex flex-col items-center" style={{ left: u(SAFE), top: u(SAFE), right: u(SAFE), bottom: u(SAFE) }}>
        <div className="flex w-full grow flex-col items-center justify-center text-center">
          {box && page.coverImageUrl && (
            <div className="relative shrink-0" style={{ width: u(box.width + 2 * ring), height: u(box.height + 2 * ring), marginBottom: u(BACK.vignetteGap) }}>
              <div
                className="absolute inset-0"
                style={{
                  border: `${u(0.75)} solid ${colors.ornamentColor}`,
                  borderTopLeftRadius: u(box.width / 2 + ring),
                  borderTopRightRadius: u(box.width / 2 + ring),
                  borderBottomLeftRadius: u(4 + ring),
                  borderBottomRightRadius: u(4 + ring),
                }}
              />
              <div
                className="absolute overflow-hidden"
                style={{
                  left: u(ring),
                  top: u(ring),
                  width: u(box.width),
                  height: u(box.height),
                  borderTopLeftRadius: u(box.width / 2),
                  borderTopRightRadius: u(box.width / 2),
                  borderBottomLeftRadius: u(4),
                  borderBottomRightRadius: u(4),
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={page.coverImageUrl}
                  alt=""
                  draggable={false}
                  className="h-full w-full object-cover"
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    if (img.naturalWidth && img.naturalHeight) setAspect(img.naturalWidth / img.naturalHeight);
                  }}
                />
              </div>
            </div>
          )}
          <p style={{ margin: 0, width: "90%", fontFamily: DISPLAY, fontWeight: 600, color: colors.titleColor, ...type(back.titleType) }}>{page.cover.title}</p>
          <p style={{ margin: 0, marginTop: u(BACK.forLine.gap), width: "100%", fontFamily: BODY, fontSize: u(BACK.forLine.fontSize), lineHeight: BACK.forLine.leading, color: COLORS.textMedium }}>
            {page.cover.subtitle}
            {page.cover.subtitle.endsWith("'") ? "" : " "}
            <span style={{ fontWeight: 600, color: colors.accent }}>{page.cover.name}</span>
          </p>
          <div style={{ margin: `${u(BACK.divider.gap)} 0` }}>
            <OrnamentalDivider color={colors.ornamentColor} width={BACK.divider.width} />
          </div>
          <div style={{ width: u(back.measure) }}>
            <Paragraphs text={page.cover.synopsis} prefix={synopsisQuotes[0]} suffix={synopsisQuotes[1]} style={{ fontFamily: BODY, color: SCENE_TEXT_INK, textAlign: "center", ...type(back.synopsisType) }} />
          </div>
        </div>
        <div className="flex flex-col items-center" style={{ marginTop: u(BACK.brand.gapAboveMin) }}>
          <BrandLogo style={{ height: u(BACK.brand.logo), color: colors.ornamentColor }} />
          <span style={{ marginTop: u(3), fontFamily: BODY, fontSize: u(BACK.brand.urlSize), lineHeight: 1.3, letterSpacing: u(1.5), color: COLORS.textMuted }}>meapica.com</span>
        </div>
      </div>
    </Page>
  );
}

/** Draws a printed page; null for viewer-only pages (the preview's teaser pages). */
export default function BookPrintPage({ page, colors, interactive = true }: Props & { interactive?: boolean }) {
  switch (page.type) {
    case "cover":
      return <CoverPage page={page} colors={colors} />;
    case "endpaper":
      return <EndpaperPattern colors={colors} offsetX={page.offset === "right" ? GEOMETRY.spreadRightOffset : 0} />;
    case "title_dedication":
      return <TitleDedicationPage page={page} colors={colors} />;
    case "scene":
      return <ScenePage page={page} colors={colors} />;
    case "final":
      return <FinalPage page={page} colors={colors} />;
    case "hero_card":
      return <AboutReaderPage page={page} colors={colors} />;
    case "map":
      return <MapPage page={page} colors={colors} interactive={interactive} />;
    case "colophon":
      return <ColophonPage page={page} colors={colors} />;
    case "back":
      return <BackCoverPage page={page} colors={colors} />;
    default:
      return null;
  }
}
