/* eslint-disable jsx-a11y/alt-text -- @react-pdf <Image> renders into a PDF and has no alt prop */
// "Respuesta de los Reyes Magos": a royal letter on one A4 page. Double frame,
// three crowns, the child's portrait as a medallion, the composed text
// (reply-templates.ts) and the three seals with their signatures.

import { Document, Page, View, Text, Image } from "@react-pdf/renderer";
import { FONT_FAMILY } from "@/lib/pdf/fonts";
import type { ComposedReply } from "../reply-templates";
import { fitDisplaySize } from "./letter-document";
import { Flourish, INK, RoyalSeal, Star, StarRule, ThreeCrowns } from "./ornaments";

const DISPLAY = [FONT_FAMILY.display, FONT_FAMILY.body, FONT_FAMILY.symbols];
const BODY = [FONT_FAMILY.body, FONT_FAMILY.symbols];

const A4 = { width: 595.28, height: 841.89 };
const PAD_X = 64;
const CONTENT_W = A4.width - PAD_X * 2;

export interface ReplyDocumentProps {
  reply: ComposedReply;
  portraitPng: string;
  logoPng: string;
  logoAspect: number;
}

/** Body size by text length, so the longest combination still fits one page. */
export function replyBodySize(reply: ComposedReply): number {
  const chars = reply.paragraphs.join(" ").length + (reply.postscript?.length ?? 0);
  if (chars > 1750) return 10.5;
  if (chars > 1450) return 11;
  if (chars > 1200) return 11.5;
  return 12;
}

function Corner({ style }: { style: Record<string, number> }) {
  return (
    <View style={{ position: "absolute", ...style }}>
      <Star size={8} />
    </View>
  );
}

export function ReplyDocument({ reply, portraitPng, logoPng, logoAspect }: ReplyDocumentProps) {
  const bodySize = replyBodySize(reply);
  const salutationSize = fitDisplaySize(reply.salutation, CONTENT_W - 100, 26, 15);
  const body = { fontFamily: BODY, fontSize: bodySize, lineHeight: 1.62, color: INK.soft };

  return (
    <Document title={reply.eyebrow} author="Meapica" creator="Meapica" producer="Meapica">
      <Page size="A4" style={{ backgroundColor: "#ffffff", paddingTop: 48, paddingBottom: 40, paddingHorizontal: PAD_X }}>
        {/* Double frame: brand-deep hairline outside, gold inside */}
        <View fixed style={{ position: "absolute", top: 20, left: 20, right: 20, bottom: 20, borderWidth: 0.9, borderColor: INK.deep }} />
        <View fixed style={{ position: "absolute", top: 25, left: 25, right: 25, bottom: 25, borderWidth: 0.5, borderColor: INK.gold }} />
        <Corner style={{ top: 30, left: 30 }} />
        <Corner style={{ top: 30, right: 30 }} />
        <Corner style={{ bottom: 30, left: 30 }} />
        <Corner style={{ bottom: 30, right: 30 }} />

        {/* Crest */}
        <View style={{ alignItems: "center" }}>
          <ThreeCrowns width={104} />
          <Text
            style={{
              marginTop: 8,
              fontFamily: BODY,
              fontWeight: 700,
              fontSize: 8.5,
              letterSpacing: 1.6,
              textTransform: "uppercase",
              color: INK.brandText,
              textAlign: "center",
            }}
          >
            {reply.eyebrow}
          </Text>
          <View style={{ marginTop: 8 }}>
            <StarRule width={170} />
          </View>
        </View>

        {/* Date (right) */}
        <Text style={{ marginTop: 14, fontFamily: BODY, fontStyle: "italic", fontSize: 10, color: INK.muted, textAlign: "right" }}>
          {reply.dateLine}
        </Text>

        {/* Salutation + portrait medallion */}
        <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ flex: 1, paddingRight: 12, fontFamily: DISPLAY, fontWeight: 600, fontSize: salutationSize, lineHeight: 1.15, color: INK.ink }}>
            {reply.salutation}
          </Text>
          <View style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 1.4, borderColor: INK.gold, padding: 3 }}>
            <Image src={portraitPng} style={{ width: 71.2, height: 71.2, borderRadius: 35.6 }} />
          </View>
        </View>

        {/* Body */}
        <View style={{ marginTop: 10 }}>
          {reply.paragraphs.map((p, i) => (
            <Text key={i} style={{ ...body, marginTop: i === 0 ? 0 : bodySize * 0.75 }}>
              {p}
            </Text>
          ))}
          {reply.postscript && (
            <Text style={{ ...body, marginTop: bodySize * 0.9, fontStyle: "italic", color: INK.body }}>{reply.postscript}</Text>
          )}
        </View>

        <Text style={{ marginTop: bodySize * 1.1, fontFamily: BODY, fontSize: bodySize, color: INK.soft }}>{reply.signOff}</Text>

        <View style={{ flexGrow: 1, minHeight: 12 }} />

        {/* Three seals with their signatures */}
        <View style={{ flexDirection: "row", justifyContent: "space-between" }} wrap={false}>
          {reply.kings.map((king) => (
            <View key={king} style={{ width: CONTENT_W / 3, alignItems: "center" }}>
              <RoyalSeal initial={king.charAt(0)} size={48} />
              <Text style={{ marginTop: 6, fontFamily: DISPLAY, fontWeight: 600, fontSize: 17, color: INK.deep }}>{king}</Text>
              <Flourish width={86} />
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={{ marginTop: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", opacity: 0.7 }}>
          <Image src={logoPng} style={{ width: 8 * logoAspect, height: 8 }} />
          <Text style={{ marginLeft: 7, fontFamily: BODY, fontSize: 7, color: INK.muted }}>meapica.shop</Text>
        </View>
      </Page>
    </Document>
  );
}
