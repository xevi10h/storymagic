/* eslint-disable jsx-a11y/alt-text -- @react-pdf <Image> renders into a PDF and has no alt prop */
// Server-only: the Advent calendar PDFs (20×20 cm, the book's square format).
//  - one door: a single page (approved design Pdf.dc.html): the door's art on top, the
//    child's round portrait overlapping it (portrait PDFs only), the door number, title,
//    story, the bedtime question in italics and a footer with the brand;
//  - "Su libro de Adviento" (24 December): a cover + the 24 door pages.
// Body type is fitted per door (measured with the embedded fonts) so the longest story
// still fits one page.

import { Document, Image, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { FONT_FAMILY, ensurePdfFontsLoaded, measureTextWidth, type FontVariant } from "@/lib/pdf/fonts";
import { BRAND_LOGO_ASPECT, getBrandLogoPng } from "@/lib/pdf/assets";
import { ADVENT_COPY } from "./copy";
import { ADVENT_DOORS_COUNT } from "./calendar";
import { doorArtDataUri } from "./assets";
import type { AdventLocale, RenderedStory } from "./render";

const DISPLAY = [FONT_FAMILY.display, FONT_FAMILY.body, FONT_FAMILY.symbols];
const BODY = [FONT_FAMILY.body, FONT_FAMILY.symbols];

/** 200 mm square. */
const S = 566.93;
const ART_H = 214;
const PAD_X = 38;
const CONTENT_W = S - PAD_X * 2;
const PORTRAIT = 74;
const PORTRAIT_BORDER = 5;
const FOOTER_H = 40;

const C = {
  paper: "#FFF8F0",
  ink: "#1b120e",
  soft: "#4a3b32",
  body: "#6b5850",
  muted: "#7a6963",
  deep: "#5D4037",
  warm: "#E6C9A8",
};

/** Greedy word wrap with the embedded font metrics → line count. */
function lineCount(text: string, size: number, width: number, variant: FontVariant): number {
  const words = text.split(/\s+/).filter(Boolean);
  let lines = 1;
  let current = "";
  for (const w of words) {
    const next = current ? `${current} ${w}` : w;
    if (current && measureTextWidth(next, size, variant) > width) {
      lines++;
      current = w;
    } else {
      current = next;
    }
  }
  return lines;
}

interface DoorLayout {
  titleSize: number;
  titleLines: number;
  bodySize: number;
}

const TITLE_SIZES = [21, 19, 17, 15.5];
const BODY_SIZES = [11.5, 11.25, 11, 10.75, 10.5, 10.25, 10, 9.75, 9.5, 9.25, 9];
const BODY_LEADING = 1.5;
const PARA_GAP = 3;
const TITLE_LEADING = 1.18;

/** Largest title + body sizes that fit the page below the art. */
export function fitDoorLayout(story: RenderedStory, hasPortrait: boolean): DoorLayout {
  const titleWidth = CONTENT_W - (hasPortrait ? PORTRAIT + 4 : 0);
  const titleVariant: FontVariant = { role: "display", weight: 600 };
  let titleSize = TITLE_SIZES[TITLE_SIZES.length - 1];
  let titleLines = lineCount(story.title, titleSize, titleWidth, titleVariant);
  for (const size of TITLE_SIZES) {
    const n = lineCount(story.title, size, titleWidth, titleVariant);
    if (n <= 2) {
      titleSize = size;
      titleLines = n;
      break;
    }
  }
  const available = S - ART_H - 20 /* top pad */ - titleLines * titleSize * TITLE_LEADING - 10 /* gap */ - FOOTER_H - 10;
  const bodyVariant: FontVariant = { role: "body", weight: 400 };
  const italic: FontVariant = { role: "body", weight: 400, italic: true };
  for (const size of BODY_SIZES) {
    const line = size * BODY_LEADING;
    let h = 0;
    for (const p of story.paragraphs) h += lineCount(p, size, CONTENT_W, bodyVariant) * line + PARA_GAP;
    h += 4 + lineCount(story.question, size, CONTENT_W, italic) * line;
    if (h <= available) return { titleSize, titleLines, bodySize: size };
  }
  return { titleSize, titleLines, bodySize: BODY_SIZES[BODY_SIZES.length - 1] };
}

interface DoorPageProps {
  story: RenderedStory;
  artUri: string;
  portraitUri: string | null;
  logoUri: string;
  footer: string;
}

function DoorPage({ story, artUri, portraitUri, logoUri, footer }: DoorPageProps) {
  const layout = fitDoorLayout(story, !!portraitUri);
  const body = { fontFamily: BODY, fontSize: layout.bodySize, lineHeight: BODY_LEADING, color: C.soft };
  const ring = PORTRAIT + PORTRAIT_BORDER * 2;
  return (
    <Page size={[S, S]} style={{ backgroundColor: C.paper, position: "relative" }}>
      <Image src={artUri} style={{ width: S, height: ART_H, objectFit: "cover" }} />
      <View
        style={{
          position: "absolute",
          left: 22,
          top: 19,
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: C.paper,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 20, color: C.deep, marginTop: 1 }}>{story.door}</Text>
      </View>
      {portraitUri && (
        <View
          style={{
            position: "absolute",
            right: 30,
            top: ART_H - ring / 2 - 2,
            width: ring,
            height: ring,
            borderRadius: ring / 2,
            backgroundColor: C.paper,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image src={portraitUri} style={{ width: PORTRAIT, height: PORTRAIT, borderRadius: PORTRAIT / 2 }} />
        </View>
      )}
      <View style={{ paddingTop: 20, paddingHorizontal: PAD_X }}>
        <Text
          style={{
            fontFamily: DISPLAY,
            fontWeight: 600,
            fontSize: layout.titleSize,
            lineHeight: TITLE_LEADING,
            color: C.ink,
            paddingRight: portraitUri ? PORTRAIT + 4 : 0,
          }}
        >
          {story.title}
        </Text>
        <View style={{ marginTop: 10 }}>
          {story.paragraphs.map((p, i) => (
            <Text key={i} style={{ ...body, marginBottom: PARA_GAP }}>
              {p}
            </Text>
          ))}
          <Text style={{ ...body, fontStyle: "italic", color: C.body, marginTop: 4 }}>{story.question}</Text>
        </View>
      </View>
      <View
        style={{
          position: "absolute",
          left: PAD_X,
          right: PAD_X,
          bottom: 0,
          height: FOOTER_H,
          borderTopWidth: 0.75,
          borderTopColor: C.warm,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ fontFamily: BODY, fontSize: 8.5, color: C.muted, maxWidth: CONTENT_W - 80 }}>{footer}</Text>
        <Image src={logoUri} style={{ height: 11, width: 11 * BRAND_LOGO_ASPECT }} />
      </View>
    </Page>
  );
}

export interface AdventPdfChild {
  /** Display name, already mail-safe; empty = no name (never happens in practice). */
  name: string;
  /** "de Noa" / "de la Noa" for the footer and cover. */
  deName: string;
  /** Round PNG data URI, only for the signed-in owner's own verified email / download. */
  portraitUri: string | null;
}

function footerFor(locale: AdventLocale, child: AdventPdfChild, door: number) {
  const c = ADVENT_COPY[locale].pdf;
  return child.name ? c.footer({ deName: child.deName, door, total: ADVENT_DOORS_COUNT }) : c.footerNoName({ door, total: ADVENT_DOORS_COUNT });
}

/** One door, one page. */
export async function renderDoorPdf(locale: AdventLocale, story: RenderedStory, child: AdventPdfChild): Promise<Buffer> {
  await ensurePdfFontsLoaded();
  const [artUri, logoUri] = await Promise.all([doorArtDataUri(story.door), getBrandLogoPng(C.deep)]);
  const doc = (
    <Document title={ADVENT_COPY[locale].pdf.docTitle({ door: story.door, title: story.title })} author="Meapica" creator="Meapica" producer="Meapica">
      <DoorPage story={story} artUri={artUri} portraitUri={child.portraitUri} logoUri={logoUri} footer={footerFor(locale, child, story.door)} />
    </Document>
  );
  return renderToBuffer(doc);
}

/** "Su libro de Adviento": cover + the 24 doors. */
export async function renderCompilationPdf(locale: AdventLocale, stories: RenderedStory[], child: AdventPdfChild): Promise<Buffer> {
  await ensurePdfFontsLoaded();
  const copy = ADVENT_COPY[locale].pdf;
  const [logoUri, coverArt, ...arts] = await Promise.all([
    getBrandLogoPng(C.deep),
    doorArtDataUri(ADVENT_DOORS_COUNT),
    ...stories.map((s) => doorArtDataUri(s.door)),
  ]);
  const ring = 120;
  const doc = (
    <Document title={`${copy.compilationTitle} ${child.deName}`.trim()} author="Meapica" creator="Meapica" producer="Meapica">
      <Page size={[S, S]} style={{ backgroundColor: C.paper, position: "relative" }}>
        <Image src={coverArt} style={{ width: S, height: 250, objectFit: "cover" }} />
        {child.portraitUri && (
          <View
            style={{
              position: "absolute",
              left: (S - ring) / 2,
              top: 250 - ring / 2,
              width: ring,
              height: ring,
              borderRadius: ring / 2,
              backgroundColor: C.paper,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Image src={child.portraitUri} style={{ width: ring - 12, height: ring - 12, borderRadius: (ring - 12) / 2 }} />
          </View>
        )}
        <View style={{ paddingTop: child.portraitUri ? 78 : 40, paddingHorizontal: 60, alignItems: "center" }}>
          <Text style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 32, color: C.ink, textAlign: "center" }}>{copy.compilationTitle}</Text>
          {child.name ? (
            <Text style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 26, color: C.deep, textAlign: "center", marginTop: 4 }}>
              {copy.compilationFor(child.deName)}
            </Text>
          ) : null}
          <Text style={{ fontFamily: BODY, fontSize: 12, lineHeight: 1.5, color: C.body, textAlign: "center", marginTop: 14, maxWidth: 380 }}>
            {copy.compilationSub}
          </Text>
        </View>
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 30, alignItems: "center" }}>
          <Image src={logoUri} style={{ height: 16, width: 16 * BRAND_LOGO_ASPECT }} />
          <Text style={{ fontFamily: BODY, fontSize: 8.5, color: C.muted, marginTop: 8 }}>{copy.compilationColophon}</Text>
        </View>
      </Page>
      {stories.map((story, i) => (
        <DoorPage
          key={story.door}
          story={story}
          artUri={arts[i]}
          portraitUri={child.portraitUri}
          logoUri={logoUri}
          footer={footerFor(locale, child, story.door)}
        />
      ))}
    </Document>
  );
  return renderToBuffer(doc);
}

/** ASCII file slug of the name ("María José" → "maria-jose"). */
export function adventFileSlug(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/·/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "meapica";
}
