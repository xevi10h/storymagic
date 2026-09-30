/* eslint-disable jsx-a11y/alt-text -- @react-pdf <Image> renders into a PDF and has no alt prop */
/**
 * Front / back cover designs, drawn into an arbitrary panel frame so the same
 * design serves the digital book (208 mm page) and the Gelato cover file
 * (softcover bleed or hardcover wrap-around + joints).
 */

import { View, Text, Image } from "@react-pdf/renderer";
import { COLORS, FONTS, TYPE, type TemplateTheme } from "./theme";
import { MM_TO_PT, coverFit } from "./images";
import { countLines, fitText, joinName, printQuotes, sanitizePrintText } from "./text";
import { BRAND_LOGO_ASPECT, COVER_OVERLAY_STOPS, type PrintImage } from "./assets";
import { Paragraphs, PlacedImage } from "./primitives";
import { OrnamentalDivider } from "./decorations";
import {
  BACK,
  COVER_SUBTITLE,
  splitTitleOnName,
  vignetteBoxFor,
  type BackCoverLayout,
  type CoverTitleLockup,
  type CoverTitleSegment,
} from "@/lib/book/print-spec";

// Shared with the web viewer (src/lib/book/print-spec.ts)
export { COVER_SUBTITLE, splitTitleOnName, type BackCoverLayout, type CoverTitleLockup, type CoverTitleSegment } from "@/lib/book/print-spec";

/** Scrim opacity above the visible panel (wrap / bleed), continuing the gradient's first stop. */
const COVER_OVERLAY_TOP_ALPHA = COVER_OVERLAY_STOPS[0][1];

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PanelFrame {
  /** Area to paint (visible panel + bleed/wrap/joint), relative to the page */
  art: Rect;
  /** Visible panel (trim or board face), relative to the page */
  visible: Rect;
  /** Minimum distance between text and the visible edges, pt */
  safe: number;
  /** Extra keep-out at the bottom of the visible panel (printer barcode), pt */
  bottomReserve?: number;
}

export interface CoverTexts {
  title: string;
  titleLockup: CoverTitleLockup;
  subtitle: string;
  name: string;
  synopsis: string;
  /** Locale-appropriate quotation marks around the synopsis */
  synopsisQuotes: [open: string, close: string];
  /** Back-cover sizes (title, synopsis, vignette) for the panel they were fitted to */
  back: BackCoverLayout;
}

// ── Front-cover title lockup ─────────────────────────────────────────────

const TITLE_VARIANT = { role: "display", weight: 600 } as const;
/** The child's name line (single line) */
const TITLE_HERO = { max: 62, min: 32, leading: 1.05 };
/** The rest of the title around the name; kept at 38–50% of the name size */
const TITLE_REST = { max: 28, min: 16, leading: 1.15 };
/** Whole title at one size (name not found, or the lockup does not fit) */
const TITLE_UNIFORM = { max: 36, min: 18, leading: 1.15 };
const MAX_TITLE_LINES = 3;
/** The title block (plus subtitle) lives in the top ~third of the panel, from the safe line down */
const TITLE_ZONE_RATIO = 0.36;

/**
 * Largest title lockup that fits `width` × `maxHeight` in at most three lines.
 * `subtitleReserve` is kept free under the title when it does not name the child (subtitle shown).
 */
export function fitTitleLockup(title: string, name: string, width: number, maxHeight: number, subtitleReserve = 0): CoverTitleLockup & { fits: boolean } {
  const split = splitTitleOnName(title, name);
  if (split) {
    const rest = [split.pre, split.post].filter(Boolean);
    for (let heroSize = TITLE_HERO.max; heroSize >= TITLE_HERO.min; heroSize -= 1) {
      if (countLines(split.hero, heroSize, width, TITLE_VARIANT) > 1) continue;
      const restMax = Math.min(TITLE_REST.max, heroSize * 0.5);
      const restMin = Math.max(TITLE_REST.min, heroSize * 0.38);
      for (let restSize = Math.floor(restMax * 2) / 2; restSize >= restMin - 1e-6; restSize -= 0.5) {
        const restLines = rest.reduce((sum, t) => sum + countLines(t, restSize, width, TITLE_VARIANT), 0);
        const height = heroSize * TITLE_HERO.leading + restLines * restSize * TITLE_REST.leading;
        if (1 + restLines > MAX_TITLE_LINES || height > maxHeight) continue;
        const restType = { fontSize: restSize, leading: TITLE_REST.leading };
        const segments: CoverTitleSegment[] = [
          ...(split.pre ? [{ text: split.pre, type: restType, hero: false }] : []),
          { text: split.hero, type: { fontSize: heroSize, leading: TITLE_HERO.leading }, hero: true },
          ...(split.post ? [{ text: split.post, type: restType, hero: false }] : []),
        ];
        return { segments, height, showSubtitle: false, fits: true };
      }
    }
  }
  let last: CoverTitleLockup | null = null;
  for (let size = TITLE_UNIFORM.max; size >= TITLE_UNIFORM.min - 1e-6; size -= 0.5) {
    const lines = countLines(title, size, width, TITLE_VARIANT);
    const height = lines * size * TITLE_UNIFORM.leading;
    last = { segments: [{ text: title, type: { fontSize: size, leading: TITLE_UNIFORM.leading }, hero: false }], height, showSubtitle: !split };
    if (lines <= MAX_TITLE_LINES && height <= maxHeight - (split ? 0 : subtitleReserve)) return { ...last, fits: true };
  }
  return { ...last!, fits: false };
}

// ── Back cover (paper back: arch vignette, title, "for {name}", synopsis, brand) ──

/**
 * Arch vignette box for an image within the fitted height budget: the window takes the
 * image's own proportions (clamped to BACK.aspectRange) so the whole scene shows — a
 * centred square crop could cut off a face near the sides of a landscape scene.
 */
export function vignetteBox(image: PrintImage | null, budget: number): { width: number; height: number } | null {
  if (!image) return null;
  return vignetteBoxFor(image.dims ? image.dims.widthPx / image.dims.heightPx : null, budget);
}

function backBrandHeight(): number {
  return BACK.brand.logo + 3 + BACK.brand.urlSize * 1.3;
}

/**
 * Sizes the back-cover stack for a text column `inner` × `height` (inside the safe
 * area, above any barcode keep-out). The synopsis gets the largest comfortable size first;
 * the vignette takes what is left (capped), and only shrinks to its minimum for very long copy.
 */
function fitBackCover(args: { title: string; forLine: string; quotedSynopsis: string; inner: number; height: number }): { layout: BackCoverLayout; overflow: string[] } {
  const overflow: string[] = [];
  const { inner, height } = args;
  const titleFit = fitText({
    text: args.title,
    variant: { role: "display", weight: 600 },
    width: inner * 0.9,
    height: BACK.title.maxLines * BACK.title.max * BACK.title.leading + 1,
    maxSize: BACK.title.max,
    minSize: BACK.title.min,
    leading: BACK.title.leading,
    minLeading: BACK.title.minLeading,
  });
  if (!titleFit.fits || titleFit.lines > BACK.title.maxLines) overflow.push("back cover title");
  const forLines = countLines(args.forLine, BACK.forLine.fontSize, inner, { role: "body", weight: 600 });
  const measure = Math.min(inner * BACK.measureRatio, BACK.measureMaxMm * MM_TO_PT);
  const artHeight = BACK.ring * 2 + BACK.vignetteGap;
  const textFixed =
    titleFit.height +
    BACK.forLine.gap +
    forLines * BACK.forLine.fontSize * BACK.forLine.leading +
    2 * BACK.divider.gap +
    BACK.divider.width * 0.15 +
    BACK.brand.gapAboveMin +
    backBrandHeight() +
    BACK.slack;

  const s = BACK.synopsis;
  const titleType = { fontSize: titleFit.fontSize, leading: titleFit.leading };
  /** Largest synopsis size ≥ minSize leaving a vignette ≥ minVignette (minVignette 0: no art). */
  const trySizes = (minSize: number, minVignette: number): BackCoverLayout | null => {
    for (let size = s.max; size >= minSize - 1e-6; size -= 0.25) {
      const t = (s.max - size) / (s.max - s.min);
      const leading = Math.floor((s.leading - (s.leading - s.minLeading) * t) * 100) / 100;
      const textHeight = countLines(args.quotedSynopsis, size, measure, { role: "body" }) * size * leading;
      const free = height - textFixed - textHeight;
      const vignette = minVignette > 0 ? Math.floor(Math.min(BACK.vignetteMaxMm * MM_TO_PT, free - artHeight)) : 0;
      if (minVignette > 0 ? vignette >= minVignette : free >= 0) return { titleType, synopsisType: { fontSize: size, leading }, measure, vignette };
    }
    return null;
  };
  // 1) comfortable type + a generous vignette, 2) smaller type + small vignette, 3) no vignette
  let layout = trySizes(s.comfortableMin, BACK.vignetteComfortableMm * MM_TO_PT) ?? trySizes(s.min, BACK.vignetteMinMm * MM_TO_PT) ?? trySizes(s.min, 0);
  if (!layout) {
    overflow.push("back cover synopsis");
    layout = { titleType, synopsisType: { fontSize: s.min, leading: s.minLeading }, measure, vignette: 0 };
  }
  return { layout, overflow };
}

/** Fits the cover copy for a panel of the given visible width. Fonts must be loaded. */
export function fitCoverTexts(args: {
  title: string;
  subtitle: string;
  name: string;
  synopsis: string;
  locale: string | undefined;
  visibleWidth: number;
  safe: number;
  /** Height of the back-cover text column (inside the safe area, above the barcode keep-out). Default: square panel, no keep-out. */
  backHeight?: number;
}): { texts: CoverTexts; overflow: string[] } {
  const title = sanitizePrintText(args.title);
  const synopsis = sanitizePrintText(args.synopsis);
  const inner = args.visibleWidth - 2 * args.safe;
  const overflow: string[] = [];
  const subtitle = sanitizePrintText(args.subtitle);
  const name = sanitizePrintText(args.name);
  // Subtitle (only printed when the title does not name the child): body 11 pt, up to 2 lines
  const subtitleLines = countLines(joinName(subtitle, name), COVER_SUBTITLE.fontSize, inner, { role: "body", weight: 600 });
  const subtitleReserve = COVER_SUBTITLE.gap + subtitleLines * COVER_SUBTITLE.fontSize * COVER_SUBTITLE.leading;
  // Square panels: the zone height derives from the width
  const { fits: titleFits, ...titleLockup } = fitTitleLockup(title, name, inner, args.visibleWidth * TITLE_ZONE_RATIO - args.safe, subtitleReserve);
  if (!titleFits) overflow.push("front cover title");
  const synopsisQuotes = printQuotes(args.locale);
  const back = fitBackCover({
    title,
    forLine: joinName(subtitle, name),
    quotedSynopsis: `${synopsisQuotes[0]}${synopsis}${synopsisQuotes[1]}`,
    inner,
    height: args.backHeight ?? inner,
  });
  overflow.push(...back.overflow);
  return {
    texts: { title, titleLockup, subtitle, name, synopsis, synopsisQuotes, back: back.layout },
    overflow,
  };
}

/** Focus (0..1) that keeps the image centred on the visible panel while covering the art box. */
function focusOnVisible(image: PrintImage | null, frame: PanelFrame): { fx: number; fy: number } {
  if (!image?.dims) return { fx: 0.5, fy: 0.5 };
  const p = coverFit(image.dims, frame.art.width, frame.art.height);
  const cx = frame.visible.left - frame.art.left + frame.visible.width / 2;
  const cy = frame.visible.top - frame.art.top + frame.visible.height / 2;
  const fx = p.width > frame.art.width ? (p.width / 2 - cx) / (p.width - frame.art.width) : 0.5;
  const fy = p.height > frame.art.height ? (p.height / 2 - cy) / (p.height - frame.art.height) : 0.5;
  // coverFit: left = -(w - boxW)·f  ⇒ image centre at cx when f = (w/2 - cx) / (w - boxW)
  return { fx: clamp01(fx), fy: clamp01(fy) };
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function FrontCoverDesign({
  frame,
  theme,
  texts,
  image,
  overlayUri,
}: {
  frame: PanelFrame;
  theme: TemplateTheme;
  texts: CoverTexts;
  image: PrintImage | null;
  overlayUri?: string;
}) {
  const { art, visible, safe } = frame;
  const { fx, fy } = focusOnVisible(image, frame);
  const { titleLockup } = texts;
  const blockHeight = titleLockup.height + (titleLockup.showSubtitle ? COVER_SUBTITLE.gap + 2 * COVER_SUBTITLE.fontSize * COVER_SUBTITLE.leading : 0);
  // Scrim from the visible top edge, fading out well below the title (≥ half the panel, so the
  // fade is gentle and never reads as a box); the wrap / bleed above keeps the first-stop opacity
  const scrimHeight = Math.min(visible.height, Math.max(visible.height * 0.5, (safe + blockHeight) * 1.9));
  return (
    <>
      {/* Background: artwork (or theme colour) over the whole art box */}
      <View style={{ position: "absolute", left: art.left, top: art.top, width: art.width, height: art.height, backgroundColor: theme.coverGradientStart }}>
        {image ? (
          <PlacedImage image={image} boxWidth={art.width} boxHeight={art.height} focusX={fx} focusY={fy} />
        ) : (
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.coverGradientEnd, opacity: 0.4 }} />
        )}
        {image && overlayUri && (
          <>
            <View style={{ position: "absolute", left: 0, right: 0, top: 0, height: visible.top - art.top, backgroundColor: "#000000", opacity: COVER_OVERLAY_TOP_ALPHA }} />
            <Image src={overlayUri} style={{ position: "absolute", left: 0, top: visible.top - art.top, width: art.width, height: scrimHeight }} />
          </>
        )}
      </View>

      {/* Title lockup — top of the visible panel, inside the safe area. The brand lives on the back cover and spine. */}
      {/* Children stretch to the full width (not alignItems:center): a shrink-wrapped Text can be laid out wider than the box */}
      <View style={{ position: "absolute", left: visible.left + safe, width: visible.width - 2 * safe, top: visible.top + safe }}>
        {titleLockup.segments.map((seg, i) => (
          <Text
            key={i}
            style={{ fontFamily: FONTS.display, fontSize: seg.type.fontSize, fontWeight: 600, color: seg.hero ? "#ffffff" : "#fffffff0", lineHeight: seg.type.leading, textAlign: "center" }}
          >
            {seg.text}
          </Text>
        ))}
        {titleLockup.showSubtitle && (
          <Text style={{ fontFamily: FONTS.body, fontSize: COVER_SUBTITLE.fontSize, color: "#ffffffd9", marginTop: COVER_SUBTITLE.gap, letterSpacing: 0.5, lineHeight: COVER_SUBTITLE.leading, textAlign: "center" }}>
            {texts.subtitle}{texts.subtitle.endsWith("'") ? "" : " "}
            <Text style={{ fontWeight: 600, color: "#ffffff" }}>{texts.name}</Text>
          </Text>
        )}
      </View>
    </>
  );
}

/**
 * Back cover on the book's cream paper (same stock as the title page), not a veiled scene:
 * an arch-window vignette of the closing illustration (whole image, nothing printed over it),
 * the title and "A personalised story for {name}", the synopsis in the body face at reading
 * size, and the brand signature at the foot of the column. The column ends above
 * `frame.bottomReserve`, so the printer's barcode band stays empty.
 */
export function BackCoverDesign({
  frame,
  theme,
  texts,
  image,
  logoUri,
}: {
  frame: PanelFrame;
  theme: TemplateTheme;
  texts: CoverTexts;
  image: PrintImage | null;
  /** Brand logo tinted in theme.ornamentColor (as on the title page) */
  logoUri?: string;
}) {
  const { art, visible, safe } = frame;
  const reserve = frame.bottomReserve ?? 0;
  const { back } = texts;
  const box = vignetteBox(image, back.vignette);
  const ring = BACK.ring;
  return (
    <>
      <View style={{ position: "absolute", left: art.left, top: art.top, width: art.width, height: art.height, backgroundColor: COLORS.cream }} />

      <View
        style={{
          position: "absolute",
          left: visible.left + safe,
          top: visible.top + safe,
          width: visible.width - 2 * safe,
          height: visible.height - 2 * safe - reserve,
          alignItems: "center",
        }}
      >
        <View style={{ flexGrow: 1, width: "100%", alignItems: "center", justifyContent: "center" }}>
          {box && image && (
            <View style={{ width: box.width + 2 * ring, height: box.height + 2 * ring, marginBottom: BACK.vignetteGap }}>
              {/* Arch window: the whole scene, round top — the hairline echoes the interior page frame */}
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: box.width + 2 * ring,
                  height: box.height + 2 * ring,
                  borderWidth: 0.75,
                  borderColor: theme.ornamentColor,
                  borderTopLeftRadius: box.width / 2 + ring,
                  borderTopRightRadius: box.width / 2 + ring,
                  borderBottomLeftRadius: 4 + ring,
                  borderBottomRightRadius: 4 + ring,
                }}
              />
              <PlacedImage
                image={image}
                boxWidth={box.width}
                boxHeight={box.height}
                style={{ position: "absolute", left: ring, top: ring, borderTopLeftRadius: box.width / 2, borderTopRightRadius: box.width / 2, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }}
              />
            </View>
          )}

          <Text style={{ fontFamily: FONTS.display, fontSize: back.titleType.fontSize, fontWeight: 600, color: theme.titleColor, textAlign: "center", lineHeight: back.titleType.leading, width: "90%" }}>
            {texts.title}
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: BACK.forLine.fontSize, color: COLORS.textMedium, marginTop: BACK.forLine.gap, lineHeight: BACK.forLine.leading, textAlign: "center", width: "100%" }}>
            {texts.subtitle}
            {texts.subtitle.endsWith("'") ? "" : " "}
            <Text style={{ fontWeight: 600, color: theme.accent }}>{texts.name}</Text>
          </Text>

          <View style={{ marginVertical: BACK.divider.gap }}>
            <OrnamentalDivider color={theme.ornamentColor} width={BACK.divider.width} />
          </View>

          <View style={{ width: back.measure }}>
            <Paragraphs
              text={texts.synopsis}
              prefix={texts.synopsisQuotes[0]}
              suffix={texts.synopsisQuotes[1]}
              style={{ fontFamily: FONTS.body, fontSize: back.synopsisType.fontSize, color: TYPE.sceneText.color, textAlign: "center", lineHeight: back.synopsisType.leading }}
            />
          </View>
        </View>

        {/* Brand signature — discreet, above the barcode band */}
        <View style={{ alignItems: "center", marginTop: BACK.brand.gapAboveMin }}>
          {logoUri ? (
            <Image src={logoUri} style={{ height: BACK.brand.logo, width: BACK.brand.logo * BRAND_LOGO_ASPECT }} />
          ) : (
            <Text style={{ fontFamily: FONTS.display, fontSize: BACK.brand.logo, color: theme.ornamentColor, lineHeight: 1 }}>Meapica</Text>
          )}
          <Text style={{ fontFamily: FONTS.body, fontSize: BACK.brand.urlSize, color: COLORS.textMuted, marginTop: 3, letterSpacing: 1.5, lineHeight: 1.3 }}>meapica.com</Text>
        </View>
      </View>
    </>
  );
}
