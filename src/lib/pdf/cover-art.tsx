/* eslint-disable jsx-a11y/alt-text -- @react-pdf <Image> renders into a PDF and has no alt prop */
/**
 * Front / back cover designs, drawn into an arbitrary panel frame so the same
 * design serves the digital book (208 mm page) and the Gelato cover file
 * (softcover bleed or hardcover wrap-around + joints).
 */

import { View, Text, Image } from "@react-pdf/renderer";
import { FONTS, type TemplateTheme } from "./theme";
import { coverFit } from "./images";
import { fitText, sanitizePrintText } from "./text";
import { BRAND_LOGO_ASPECT, COVER_OVERLAY_STOPS, type PrintImage } from "./assets";
import { Paragraphs, PlacedImage } from "./primitives";
import type { FittedType } from "./layout";

const COVER_OVERLAY_BOTTOM_ALPHA = COVER_OVERLAY_STOPS[COVER_OVERLAY_STOPS.length - 1][1];

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
  titleType: FittedType;
  subtitle: string;
  name: string;
  synopsis: string;
  synopsisType: FittedType;
  backTitleType: FittedType;
}

/** Fits the cover copy for a panel of the given visible width. Fonts must be loaded. */
export function fitCoverTexts(args: {
  title: string;
  subtitle: string;
  name: string;
  synopsis: string;
  visibleWidth: number;
  safe: number;
}): { texts: CoverTexts; overflow: string[] } {
  const title = sanitizePrintText(args.title);
  const synopsis = sanitizePrintText(args.synopsis);
  const inner = args.visibleWidth - 2 * args.safe;
  const overflow: string[] = [];
  const titleFit = fitText({ text: title, variant: { role: "display", weight: 600 }, width: inner, height: 3 * 28 * 1.2 + 1, maxSize: 28, minSize: 18, leading: 1.2, minLeading: 1.12 });
  if (!titleFit.fits) overflow.push("front cover title");
  const backTitleFit = fitText({ text: title, variant: { role: "display", weight: 600 }, width: inner, height: 2 * 14 * 1.3 + 1, maxSize: 14, minSize: 10, leading: 1.3, minLeading: 1.2 });
  if (!backTitleFit.fits) overflow.push("back cover title");
  const synopsisFit = fitText({ text: `“${synopsis}”`, variant: { role: "display" }, width: inner * 0.86, height: args.visibleWidth * 0.4, maxSize: 11, minSize: 8, leading: 1.6, minLeading: 1.4 });
  if (!synopsisFit.fits) overflow.push("back cover synopsis");
  return {
    texts: {
      title,
      titleType: { fontSize: titleFit.fontSize, leading: titleFit.leading },
      subtitle: sanitizePrintText(args.subtitle),
      name: sanitizePrintText(args.name),
      synopsis,
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
  logoUri,
}: {
  frame: PanelFrame;
  theme: TemplateTheme;
  texts: CoverTexts;
  image: PrintImage | null;
  overlayUri?: string;
  logoUri?: string;
}) {
  const { art, visible, safe } = frame;
  const { fx, fy } = focusOnVisible(image, frame);
  const logoH = 26;
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
          // Gradient ends at the bottom of the VISIBLE panel (so the title sits on its darkest part);
          // the wrap/bleed below keeps the final opacity
          <>
            <Image src={overlayUri} style={{ position: "absolute", left: 0, top: 0, width: art.width, height: visible.top + visible.height - art.top }} />
            <View style={{ position: "absolute", left: 0, right: 0, top: visible.top + visible.height - art.top, bottom: 0, backgroundColor: "#000000", opacity: COVER_OVERLAY_BOTTOM_ALPHA }} />
          </>
        )}
      </View>

      {/* Brand logo — top of the visible panel */}
      {logoUri && (
        <View style={{ position: "absolute", left: visible.left, top: visible.top + safe, width: visible.width, alignItems: "center" }}>
          <Image src={logoUri} style={{ height: logoH, width: logoH * BRAND_LOGO_ASPECT, opacity: 0.85 }} />
        </View>
      )}

      {/* Subtitle + title — bottom of the visible panel, inside the safe area */}
      <View
        style={{
          position: "absolute",
          left: visible.left + safe,
          width: visible.width - 2 * safe,
          top: visible.top + visible.height - safe - 190,
          height: 190,
          justifyContent: "flex-end",
          alignItems: "center",
        }}
      >
        <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: "#ffffffcc", marginBottom: 6, letterSpacing: 0.5, textAlign: "center" }}>
          {texts.subtitle}{" "}
          <Text style={{ fontWeight: 600, color: "#ffffff" }}>{texts.name}</Text>
        </Text>
        <Text style={{ fontFamily: FONTS.display, fontSize: texts.titleType.fontSize, fontWeight: 600, color: "#ffffff", lineHeight: texts.titleType.leading, textAlign: "center" }}>
          {texts.title}
        </Text>
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
            {texts.subtitle} {texts.name}
          </Text>
        </View>

        <View style={{ alignItems: "center", maxWidth: (visible.width - 2 * safe) * 0.86 }}>
          <Paragraphs
            text={texts.synopsis}
            prefix={"\u201C"}
            suffix={"\u201D"}
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
