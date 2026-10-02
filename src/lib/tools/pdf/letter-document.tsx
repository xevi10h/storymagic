/* eslint-disable jsx-a11y/alt-text -- @react-pdf <Image> renders into a PDF and has no alt prop */
// "Carta a los Reyes Magos": one A4 page the child fills in by hand, with their
// name and watercolour portrait printed. Two layouts: "write" (lines) for children
// who write, "draw" (boxes) for the youngest. Light ink: white ground, hairlines.

import { Document, Page, View, Text, Image } from "@react-pdf/renderer";
import { FONT_FAMILY, measureTextWidth } from "@/lib/pdf/fonts";
import type { LetterCopy } from "../letter-copy";
import { INK, Star, ThreeCrowns } from "./ornaments";

const DISPLAY = [FONT_FAMILY.display, FONT_FAMILY.body, FONT_FAMILY.symbols];
const BODY = [FONT_FAMILY.body, FONT_FAMILY.symbols];

const A4 = { width: 595.28, height: 841.89 };
const FRAME_INSET = 22;
const PAD_X = 50;
const CONTENT_W = A4.width - PAD_X * 2;
const LINE_GAP = 30;

export interface LetterDocumentProps {
  copy: LetterCopy;
  name: string;
  age: number | null;
  layout: "write" | "draw";
  portraitPng: string;
  logoPng: string;
  logoAspect: number;
}

/** Largest size ≤ `max` at which `text` fits `width` on one line (Fredoka 600). */
export function fitDisplaySize(text: string, width: number, max: number, min: number): number {
  const w = measureTextWidth(text, max, { role: "display", weight: 600 });
  if (w <= width) return max;
  return Math.max(min, Math.floor((max * width) / w));
}

function Heading({ children }: { children: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
      <Star size={9} />
      <Text style={{ marginLeft: 6, fontFamily: DISPLAY, fontWeight: 600, fontSize: 15, color: INK.ink }}>{children}</Text>
    </View>
  );
}

function WritingLines({ count, numbered = false }: { count: number; numbered?: boolean }) {
  return (
    <View>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ height: LINE_GAP, flexDirection: "row", alignItems: "flex-end" }}>
          {numbered && (
            <Text style={{ width: 16, marginBottom: 3, fontFamily: DISPLAY, fontWeight: 600, fontSize: 11, color: INK.brandText }}>
              {i + 1}
            </Text>
          )}
          <View style={{ flex: 1, borderBottomWidth: 0.7, borderBottomColor: INK.rule }} />
        </View>
      ))}
    </View>
  );
}

function Checkbox({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginRight: 22 }}>
      <View style={{ width: 13, height: 13, borderWidth: 1, borderColor: INK.deep, borderRadius: 3, marginRight: 6 }} />
      <Text style={{ fontFamily: BODY, fontSize: 11.5, color: INK.soft }}>{label}</Text>
    </View>
  );
}

function DashedBox({ children, height, flex }: { children?: React.ReactNode; height?: number; flex?: number }) {
  return (
    <View
      style={{
        ...(height ? { height } : {}),
        ...(flex ? { flexGrow: flex } : {}),
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: INK.warm,
        borderRadius: 12,
        padding: 8,
      }}
    >
      {children}
    </View>
  );
}

export function LetterDocument({ copy, name, age, layout, portraitPng, logoPng, logoAspect }: LetterDocumentProps) {
  const nameSize = fitDisplaySize(name, CONTENT_W - 190, 22, 12);
  const salutationSize = fitDisplaySize(copy.salutation, CONTENT_W - 120, 30, 20);
  const draw = layout === "draw";

  return (
    <Document title={`${copy.salutation} ${name}`} author="Meapica" creator="Meapica" producer="Meapica">
      <Page size="A4" style={{ backgroundColor: "#ffffff", paddingTop: 44, paddingBottom: 40, paddingHorizontal: PAD_X }}>
        {/* Hairline frame */}
        <View
          fixed
          style={{
            position: "absolute",
            top: FRAME_INSET,
            left: FRAME_INSET,
            right: FRAME_INSET,
            bottom: FRAME_INSET,
            borderWidth: 0.8,
            borderColor: INK.warm,
            borderRadius: 16,
          }}
        />

        {/* Header: kicker + salutation, portrait on the right */}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <ThreeCrowns width={92} />
            <Text
              style={{
                marginTop: 8,
                fontFamily: BODY,
                fontWeight: 700,
                fontSize: 8.5,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                color: INK.brandText,
              }}
            >
              {copy.kicker}
            </Text>
            <Text style={{ marginTop: 4, fontFamily: DISPLAY, fontWeight: 600, fontSize: salutationSize, lineHeight: 1.15, color: INK.ink }}>
              {copy.salutation}
            </Text>
          </View>
          <View style={{ width: 104, height: 104, borderRadius: 52, borderWidth: 2.5, borderColor: INK.warm, padding: 3 }}>
            <Image src={portraitPng} style={{ width: 93, height: 93, borderRadius: 46.5 }} />
          </View>
        </View>

        {/* "Me llamo Lucía y tengo __ años." */}
        <View style={{ marginTop: 18, flexDirection: "row", alignItems: "flex-end", flexWrap: "nowrap" }}>
          <Text style={{ fontFamily: BODY, fontSize: 13, color: INK.soft, marginBottom: 2 }}>{copy.introName} </Text>
          <Text style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: nameSize, lineHeight: 1.1, color: INK.deep }}>{name}</Text>
          <Text style={{ fontFamily: BODY, fontSize: 13, color: INK.soft, marginBottom: 2 }}> {copy.introAge} </Text>
          {age !== null ? (
            <Text style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 20, lineHeight: 1.1, color: INK.deep }}>{age}</Text>
          ) : (
            <View style={{ width: 34, borderBottomWidth: 0.7, borderBottomColor: INK.deep, marginBottom: 3 }} />
          )}
          <Text style={{ fontFamily: BODY, fontSize: 13, color: INK.soft, marginBottom: 2 }}> {copy.years}</Text>
        </View>

        {/* Behaviour */}
        <View style={{ marginTop: 18 }}>
          <Heading>{copy.behavedHeading}</Heading>
          <View style={{ flexDirection: "row", marginTop: 6 }}>
            {copy.behavedOptions.map((o) => (
              <Checkbox key={o} label={o} />
            ))}
          </View>
          {!draw && (
            <View style={{ marginTop: 8 }}>
              <Text style={{ fontFamily: BODY, fontSize: 10.5, color: INK.muted }}>{copy.bestThing}</Text>
              <WritingLines count={2} />
            </View>
          )}
        </View>

        {/* Wishes */}
        <View style={{ marginTop: 16 }}>
          <Heading>{copy.wishesHeading}</Heading>
          {draw ? (
            <View style={{ flexDirection: "row", marginTop: 6 }}>
              {[1, 2, 3].map((n) => (
                <View key={n} style={{ flex: 1, marginLeft: n === 1 ? 0 : 10 }}>
                  <DashedBox height={124}>
                    <Text style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, color: INK.brandText }}>{n}</Text>
                  </DashedBox>
                </View>
              ))}
            </View>
          ) : (
            <WritingLines count={3} numbered />
          )}
          {draw && <Text style={{ marginTop: 4, fontFamily: BODY, fontSize: 9.5, color: INK.muted }}>{copy.wishesDrawHint}</Text>}
        </View>

        {/* Kindness */}
        <View style={{ marginTop: 16 }}>
          <Heading>{copy.kindnessHeading}</Heading>
          <WritingLines count={draw ? 1 : 2} />
        </View>

        {/* Drawing: takes the rest of the page */}
        <View style={{ marginTop: 16, flexGrow: 1 }}>
          <DashedBox flex={1}>
            <Text style={{ fontFamily: BODY, fontWeight: 600, fontSize: 10, color: INK.muted }}>{copy.drawingHeading}</Text>
          </DashedBox>
        </View>

        {/* Sign-off */}
        <View style={{ marginTop: 14, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <View style={{ maxWidth: CONTENT_W - 200 }}>
            <Text style={{ fontFamily: BODY, fontSize: 12, color: INK.soft }}>{copy.signOff}</Text>
            <Text style={{ marginTop: 2, fontFamily: DISPLAY, fontWeight: 600, fontSize: Math.min(nameSize, 20), color: INK.deep }}>{name}</Text>
          </View>
          <View style={{ width: 170 }}>
            <View style={{ height: 30, borderBottomWidth: 0.7, borderBottomColor: INK.deep }} />
            <Text style={{ marginTop: 3, fontFamily: BODY, fontSize: 8.5, color: INK.muted, textAlign: "center" }}>{copy.signatureLabel}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={{ marginTop: 12, flexDirection: "row", justifyContent: "center", alignItems: "center", opacity: 0.75 }}>
          <Image src={logoPng} style={{ width: 9 * logoAspect, height: 9 }} />
          <Text style={{ marginLeft: 8, fontFamily: BODY, fontSize: 7.5, color: INK.muted }}>{copy.footer}</Text>
        </View>
      </Page>
    </Document>
  );
}
