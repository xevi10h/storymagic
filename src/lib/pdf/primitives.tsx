/* eslint-disable jsx-a11y/alt-text -- @react-pdf <Image> renders into a PDF and has no alt prop */
/**
 * Shared PDF building blocks (book interior + cover spread).
 */

import { View, Text, Image } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { BOOK, COLORS, FONTS, TYPE } from "./theme";
import { coverFit } from "./images";
import type { PrintImage } from "./assets";

/**
 * Height for a page's root box. Yoga lays out in float32: a box exactly as tall
 * as the page can come out a hair taller (583.937 → 583.93701) and react-pdf then
 * logs "can't wrap between pages". 0.01 pt (0.004 mm) less is invisible.
 */
export function rootBoxHeight(pageHeight: number): number {
  return pageHeight - 0.01;
}

/**
 * Draws an image uniformly scaled to COVER a box (never stretched).
 * The visible view can be a window into a wider box (panorama halves):
 * `windowLeft` is the view's x offset inside the box.
 */
export function PlacedImage({
  image,
  boxWidth,
  boxHeight,
  windowLeft = 0,
  viewWidth = boxWidth,
  viewHeight = boxHeight,
  focusX = 0.5,
  focusY = 0.5,
  opacity,
  fallbackColor = COLORS.cream,
  style,
}: {
  image: PrintImage | null | undefined;
  boxWidth: number;
  boxHeight: number;
  windowLeft?: number;
  viewWidth?: number;
  viewHeight?: number;
  focusX?: number;
  focusY?: number;
  opacity?: number;
  fallbackColor?: string;
  style?: Style;
}) {
  const frame: Style = { width: viewWidth, height: viewHeight, overflow: "hidden", position: "relative", ...style };
  if (!image) {
    // Only reachable when validation was skipped — validatePrintableBook rejects missing art
    return <View style={{ ...frame, backgroundColor: fallbackColor }} />;
  }
  if (!image.dims) {
    return (
      <View style={frame}>
        <Image src={image.src} style={{ width: viewWidth, height: viewHeight, objectFit: "cover", opacity }} />
      </View>
    );
  }
  const p = coverFit(image.dims, boxWidth, boxHeight, focusX, focusY);
  return (
    <View style={frame}>
      <Image
        src={image.src}
        style={{ position: "absolute", left: p.left - windowLeft, top: p.top, width: p.width, height: p.height, opacity }}
      />
    </View>
  );
}

/** Vertical gradient PNG stretched over the bottom part of a box. */
export function BottomGradient({ uri, width, height }: { uri?: string; width: number; height: number }) {
  if (!uri) return null;
  return (
    <View style={{ position: "absolute", bottom: 0, left: 0, width, height }}>
      <Image src={uri} style={{ width, height }} />
    </View>
  );
}

export function FrameBorder({ color }: { color: string }) {
  return (
    <View
      style={{
        position: "absolute",
        top: 10,
        left: 10,
        right: 10,
        bottom: 10,
        borderWidth: 0.75,
        borderColor: color,
        borderRadius: 6,
        opacity: 0.35,
      }}
    />
  );
}

export function CornerDot({ color, top, left, right, bottom }: { color: string; top?: number; left?: number; right?: number; bottom?: number }) {
  return (
    <View
      style={{ position: "absolute", top, left, right, bottom, width: 6, height: 6, borderRadius: 3, backgroundColor: color, opacity: 0.3 }}
    />
  );
}

export function PageNumber({ num, color }: { num: number; color?: string }) {
  return (
    <View style={{ position: "absolute", bottom: BOOK.bleed + 10, left: 0, right: 0, alignItems: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 12, height: 0.5, backgroundColor: color || COLORS.textLight }} />
        <Text style={[TYPE.pageNumber, color ? { color } : {}]}>{num}</Text>
        <View style={{ width: 12, height: 0.5, backgroundColor: color || COLORS.textLight }} />
      </View>
    </View>
  );
}

/** Act label overlay — decorative "I", "II", "III" at the top of illustration pages. */
export function ActLabel({ label, variant }: { label: string; variant: "light" | "dark" }) {
  const isLight = variant === "light";
  const lineColor = isLight ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.15)";
  const textColor = isLight ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.3)";
  return (
    <View style={{ position: "absolute", top: BOOK.bleed + 14, left: 0, right: 0, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 }}>
      <View style={{ width: 18, height: 0.5, backgroundColor: lineColor }} />
      <Text style={{ fontFamily: FONTS.display, fontSize: 8, fontWeight: 600, color: textColor, letterSpacing: 3 }}>{label}</Text>
      <View style={{ width: 18, height: 0.5, backgroundColor: lineColor }} />
    </View>
  );
}

/**
 * Multi-paragraph text. Each line of `text` becomes its own <Text> (a blank
 * line becomes a one-line spacer): a literal "\n" inside a react-pdf <Text>
 * pulls a NON-embedded Helvetica into the PDF, which print preflight rejects.
 * Line accounting matches countLines() in text.ts.
 */
export function Paragraphs({
  text,
  style,
  prefix = "",
  suffix = "",
}: {
  text: string;
  style: Style & { fontSize: number; lineHeight: number };
  prefix?: string;
  suffix?: string;
}) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) =>
        line.trim() === "" ? (
          <View key={i} style={{ height: style.fontSize * style.lineHeight }} />
        ) : (
          <Text key={i} style={style}>
            {i === 0 ? prefix : ""}
            {line}
            {i === lines.length - 1 ? suffix : ""}
          </Text>
        ),
      )}
    </>
  );
}
