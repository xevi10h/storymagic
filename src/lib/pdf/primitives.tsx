/* eslint-disable jsx-a11y/alt-text -- @react-pdf <Image> renders into a PDF and has no alt prop */
/**
 * Shared PDF building blocks (book interior + cover spread).
 */

import { View, Text, Image } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { BOOK, COLORS, TYPE } from "./theme";
import { coverFit } from "./images";
import type { PrintImage } from "./assets";
import { countLines } from "./text";
import type { FontVariant } from "./fonts";

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

/** Hairline page frame, drawn safely inside the trim (BOOK.frameInset). */
export function FrameBorder({ color }: { color: string }) {
  return (
    <View
      style={{
        position: "absolute",
        top: BOOK.frameInset,
        left: BOOK.frameInset,
        right: BOOK.frameInset,
        bottom: BOOK.frameInset,
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

/**
 * Small paper plate behind folios printed over artwork (react-pdf has no text-shadow):
 * same paper tint as the spread text panel, so dark ink stays legible over light AND dark art.
 */
const ART_PLATE: Style = { backgroundColor: "rgba(255, 252, 247, 0.8)", borderRadius: 5 };

/**
 * Folio centred at the bottom, BOOK.folioInset from the page edge (10 mm inside trim).
 * `paper`: muted ink with hairlines; `art`: on a paper plate, legible over any illustration.
 */
export function PageNumber({ num, variant = "paper" }: { num: number; variant?: "paper" | "art" }) {
  return (
    <View style={{ position: "absolute", bottom: BOOK.folioInset, left: 0, right: 0, alignItems: "center" }}>
      {variant === "art" ? (
        <View style={{ ...ART_PLATE, paddingHorizontal: 4, paddingVertical: 1 }}>
          <Text style={[TYPE.pageNumber, { fontSize: 7, color: COLORS.textMedium }]}>{num}</Text>
        </View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 12, height: 0.5, backgroundColor: COLORS.textLight }} />
          <Text style={TYPE.pageNumber}>{num}</Text>
          <View style={{ width: 12, height: 0.5, backgroundColor: COLORS.textLight }} />
        </View>
      )}
    </View>
  );
}

/**
 * Multi-paragraph text. Each line of `text` becomes its own <Text> (a blank
 * line becomes a one-line spacer): a literal "\n" inside a react-pdf <Text>
 * pulls a NON-embedded Helvetica into the PDF, which print preflight rejects.
 * Line accounting matches countLines() in text.ts.
 *
 * `balance`: a paragraph that wraps is set in the narrowest measure that keeps its line
 * count (same breaker as the planner, so the block height never changes) — no lone word
 * left on a last line ("…junto a la / ventana.").
 */
export function Paragraphs({
  text,
  style,
  prefix = "",
  suffix = "",
  balance,
}: {
  text: string;
  style: Style & { fontSize: number; lineHeight: number };
  prefix?: string;
  suffix?: string;
  /** Column width + font the text is set in — enables balanced wrapping */
  balance?: { width: number; variant: FontVariant };
}) {
  const lines = text.split("\n");
  const measure = (line: string): Style => {
    if (!balance) return {};
    const n = countLines(line, style.fontSize, balance.width, balance.variant);
    if (n < 2) return {};
    let lo = balance.width / n;
    let hi = balance.width;
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      if (countLines(line, style.fontSize, mid, balance.variant) <= n) hi = mid;
      else lo = mid;
    }
    return { width: Math.ceil(hi), alignSelf: style.textAlign === "center" ? "center" : "flex-start" };
  };
  return (
    <>
      {lines.map((line, i) =>
        line.trim() === "" ? (
          <View key={i} style={{ height: style.fontSize * style.lineHeight }} />
        ) : (
          <Text key={i} style={{ ...style, ...measure(line) }}>
            {i === 0 ? prefix : ""}
            {line}
            {i === lines.length - 1 ? suffix : ""}
          </Text>
        ),
      )}
    </>
  );
}
