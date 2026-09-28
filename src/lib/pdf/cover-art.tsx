/* eslint-disable jsx-a11y/alt-text -- @react-pdf <Image> renders into a PDF and has no alt prop */
/**
 * Front / back cover designs, drawn into an arbitrary panel frame so the same
 * design serves the digital book (208 mm page) and the Gelato cover file
 * (softcover bleed or hardcover wrap-around + joints).
 */

import { View, Text, Image } from "@react-pdf/renderer";
import { FONTS, type TemplateTheme } from "./theme";
import { coverFit } from "./images";
import { countLines, fitText, joinName, printQuotes, sanitizePrintText } from "./text";
import { BRAND_LOGO_ASPECT, COVER_OVERLAY_STOPS, type PrintImage } from "./assets";
import { Paragraphs, PlacedImage } from "./primitives";
import type { FittedType } from "./layout";

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

/** One stacked line group of the front-cover title; `hero` is the child's name. */
export interface CoverTitleSegment {
  text: string;
  type: FittedType;
  hero: boolean;
}

/**
 * Front-cover title lockup, set at the top of the panel (Wonderbly / Hooray Heroes
 * hierarchy): when the title contains the child's name, the name gets its own
 * large line and the rest of the title sits above / below it at a smaller size.
 */
export interface CoverTitleLockup {
  segments: CoverTitleSegment[];
  /** Height of the stacked segments, pt */
  height: number;
  /** The title does not name the child: print "A personalised story for {name}" under it */
  showSubtitle: boolean;
}

export interface CoverTexts {
  title: string;
  titleLockup: CoverTitleLockup;
  subtitle: string;
  name: string;
  synopsis: string;
  /** Locale-appropriate quotation marks around the synopsis */
  synopsisQuotes: [open: string, close: string];
  synopsisType: FittedType;
  backTitleType: FittedType;
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
export const COVER_SUBTITLE = { fontSize: 11, leading: 1.3, gap: 8 };

/**
 * Splits the title around the child's name (whole word, case-insensitive). A possessive,
 * trailing punctuation, opening marks and an elided article stay on the name's line:
 * "Martina's", "Núria,", "¡Leo", "d’Émile".
 */
export function splitTitleOnName(title: string, name: string): { pre: string; hero: string; post: string } | null {
  const n = name.trim();
  if (!n) return null;
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${escaped}(?![\\p{L}\\p{M}\\p{N}])`, "iu").exec(title);
  if (!match) return null;
  let pre = title.slice(0, match.index);
  let post = title.slice(match.index + match[0].length);
  const tail = /^(?:['’]s)?[,;:!?.…»”"')]*/u.exec(post)?.[0] ?? "";
  post = post.slice(tail.length);
  const lead = /(?<!\p{L})(?:\p{L}{1,2}['’]|[¡¿«“"(]+)$/u.exec(pre)?.[0] ?? "";
  pre = pre.slice(0, pre.length - lead.length);
  return { pre: pre.trim(), hero: `${lead}${match[0]}${tail}`, post: post.trim() };
}

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

/** Fits the cover copy for a panel of the given visible width. Fonts must be loaded. */
export function fitCoverTexts(args: {
  title: string;
  subtitle: string;
  name: string;
  synopsis: string;
  locale: string | undefined;
  visibleWidth: number;
  safe: number;
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
  const backTitleFit = fitText({ text: title, variant: { role: "display", weight: 600 }, width: inner, height: 2 * 14 * 1.3 + 1, maxSize: 14, minSize: 10, leading: 1.3, minLeading: 1.2 });
  if (!backTitleFit.fits) overflow.push("back cover title");
  const synopsisQuotes = printQuotes(args.locale);
  const synopsisFit = fitText({ text: `${synopsisQuotes[0]}${synopsis}${synopsisQuotes[1]}`, variant: { role: "display" }, width: inner * 0.86, height: args.visibleWidth * 0.4, maxSize: 11, minSize: 8, leading: 1.6, minLeading: 1.4 });
  if (!synopsisFit.fits) overflow.push("back cover synopsis");
  return {
    texts: {
      title,
      titleLockup,
      subtitle,
      name,
      synopsis,
      synopsisQuotes,
      synopsisType: { fontSize: synopsisFit.fontSize, leading: synopsisFit.leading },
      backTitleType: { fontSize: backTitleFit.fontSize, leading: backTitleFit.leading },
    },
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
  logoUri?: string;
}) {
  const { art, visible, safe } = frame;
  const reserve = frame.bottomReserve ?? 0;
  const { fx, fy } = focusOnVisible(image, frame);
  return (
    <>
      <View style={{ position: "absolute", left: art.left, top: art.top, width: art.width, height: art.height, backgroundColor: theme.coverGradientStart }}>
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.coverGradientEnd, opacity: 0.3 }} />
        {image && (
          <>
            <PlacedImage image={image} boxWidth={art.width} boxHeight={art.height} focusX={fx} focusY={fy} opacity={0.35} style={{ position: "absolute", left: 0, top: 0 }} />
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#000000", opacity: 0.45 }} />
          </>
        )}
      </View>

      <View
        style={{
          position: "absolute",
          left: visible.left + safe,
          top: visible.top + safe,
          width: visible.width - 2 * safe,
          height: visible.height - 2 * safe - reserve,
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontFamily: FONTS.display, fontSize: texts.backTitleType.fontSize, fontWeight: 600, color: "#ffffffdd", textAlign: "center", lineHeight: texts.backTitleType.leading }}>
            {texts.title}
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 9, color: "#ffffff99", marginTop: 4, letterSpacing: 0.5, textAlign: "center" }}>
            {joinName(texts.subtitle, texts.name)}
          </Text>
        </View>

        <View style={{ alignItems: "center", maxWidth: (visible.width - 2 * safe) * 0.86 }}>
          <Paragraphs
            text={texts.synopsis}
            prefix={texts.synopsisQuotes[0]}
            suffix={texts.synopsisQuotes[1]}
            style={{ fontFamily: FONTS.display, fontSize: texts.synopsisType.fontSize, color: "#ffffffcc", textAlign: "center", lineHeight: texts.synopsisType.leading }}
          />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 }}>
            <View style={{ width: 24, height: 0.5, backgroundColor: "#ffffff33" }} />
            <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: "#ffffff44" }} />
            <View style={{ width: 24, height: 0.5, backgroundColor: "#ffffff33" }} />
          </View>
        </View>

        <View style={{ alignItems: "center" }}>
          {logoUri ? (
            <Image src={logoUri} style={{ height: 16, width: 16 * BRAND_LOGO_ASPECT, opacity: 0.5 }} />
          ) : (
            <Text style={{ fontFamily: FONTS.display, fontSize: 12, color: "#ffffff66", letterSpacing: 1 }}>Meapica</Text>
          )}
          <Text style={{ fontFamily: FONTS.body, fontSize: 6.5, color: "#ffffff66", marginTop: 3, letterSpacing: 2 }}>meapica.com</Text>
        </View>
      </View>
    </>
  );
}
