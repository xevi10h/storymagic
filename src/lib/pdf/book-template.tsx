/* eslint-disable jsx-a11y/alt-text -- @react-pdf <Image> renders into a PDF and has no alt prop */
/**
 * PDF Book Template — Editorial children's book layout
 *
 * Page order, facing pages, image boxes and type sizes come from the page plan
 * in layout.ts (shared with validatePrintableBook). This file only draws.
 *
 * Interior (Gelato "inside" file = pastedown + these 30 pages + pastedown; page 1 = right-hand page):
 *   p1        Title + dedication (verbatim parent text)
 *   p2–p25    12 scenes — illustration LEFT ↔ text RIGHT; panoramas span p(even)+p(odd)
 *   p26 · p27 Final "The End" ↔ About the reader
 *   p28 · p29 Adventure map + search-and-find game (patterned endpaper when the book has no map)
 *   p30       Colophon
 *
 * Digital book (user download, 34 pages = the physical book in reading order):
 *   cover · endpaper · interior 1–30 · endpaper · back cover
 *
 * Editions — ONE template, two page boxes (BookEdition):
 * - "print":   208×208 mm pages (200 mm trim + 4 mm bleed on every side) — the Gelato files.
 * - "digital": 200×200 mm pages = the trim, what the reader holds and what the web viewer
 *              shows. Same pages, same planner, same drawing: each page is the print page
 *              seen through a trim-sized window (shifted by the bleed), so panorama halves
 *              meet exactly at the fold (no repeated gutter strip) and nothing is re-laid out.
 *
 * Rules that keep print output deterministic:
 * - every page is one fixed-size non-wrapping root box → overflow can never add pages
 * - images are placed with uniform cover-fit (never stretched)
 * - text is fitted with real font metrics → never truncated
 * - @react-pdf: full-page SVGs overflow → View-based borders; decorative SVGs stay small
 */

import { createElement, type JSX, type ReactNode } from "react";
import { Document, Page, View, Text, Image, Svg, Circle, Path, renderToBuffer } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { BOOK, COLORS, TYPE, FONTS, getTheme, type TemplateTheme } from "./theme";
import { OrnamentalDivider, StarCluster, WavyDots, HeartIcon } from "./decorations";
import type { GeneratedStory } from "@/lib/ai/story-generator";
import type { MapGame } from "@/lib/ai/adventure-map";
import { FAVORITE_COLORS } from "@/lib/create-store";
import { ensurePdfFontsLoaded } from "./fonts";
import {
  BRAND_LOGO_ASPECT,
  COVER_OVERLAY_STOPS,
  CREAM_FADE_STOPS,
  TEXT_OVERLAY_STOPS,
  TITLE_OVERLAY_STOPS,
  buildImageRegistry,
  generateQrDataUrl,
  getBrandLogoPng,
  getGradientPng,
  type ImageRegistry,
} from "./assets";
import {
  GEOMETRY,
  ILL_TEXT_WIDTH,
  MAP_PANEL,
  PANEL_PADDING,
  type MapPanel,
  planInteriorPages,
  type InteriorPlan,
  type PlannedPage,
} from "./layout";
import { BottomGradient, CornerDot, FrameBorder, PageNumber, Paragraphs, PlacedImage, rootBoxHeight } from "./primitives";
import { BackCoverDesign, FrontCoverDesign, fitCoverTexts, type CoverTexts, type PanelFrame } from "./cover-art";
import { joinName, printQuotes, sanitizePrintText } from "./text";
import { colorName, interestLabel, mapPanelStrings, pdfForName, pdfT } from "@/lib/book/print-text";
import { CREAM_FADE_RGB, spreadGradientHeight, type DropCapPlan } from "@/lib/book/print-spec";

// ── Input types ────────────────────────────────────────────────────────────

export interface BookPdfInput {
  story: GeneratedStory;
  templateId: string;
  characterName: string;
  characterAge: number;
  /**
   * Parent's dedication, printed VERBATIM (stories.dedication_text).
   * When empty, the generated story.dedication is printed instead.
   */
  dedicationText: string | null;
  senderName: string | null;
  storyId: string;
  /** Data URI (pre-fetched) — front cover artwork */
  coverImageUrl: string | null;
  /** Data URIs (pre-fetched). Scenes 1–12 primary, 13–24 secondary. */
  illustrations: { sceneNumber: number; imageUrl: string | null }[];
  locale?: string;
  // Hero card / back cover enrichment
  portraitUrl?: string | null;
  /** Data URI (pre-fetched) — adventure map spread (pp. 28–29); printed only together with `mapGame` */
  mapImageUrl?: string | null;
  /** The map's search-and-find game (imageAssets.mapGame) */
  mapGame?: MapGame | null;
  characterGender?: string;
  characterCity?: string | null;
  characterInterests?: string[];
  favoriteColor?: string | null;
  favoriteCompanion?: string | null;
  futureDream?: string | null;
}

// ── PDF i18n: pure copy shared with the web viewer (src/lib/book/print-text.ts) ──

export { pdfT, pdfForName } from "@/lib/book/print-text";

// ── Render context (everything pre-computed before drawing) ───────────────

export interface BookRenderContext {
  input: BookPdfInput;
  theme: TemplateTheme;
  plan: InteriorPlan;
  images: ImageRegistry;
  coverTexts: CoverTexts;
  qrDataUrl: string;
  logoWhite: string;
  logoOrnament: string;
  textGradient: string;
  titleGradient: string;
  coverGradient: string;
  creamFade: string;
  /** Page box being drawn — set by the renderer (renderBookPdf / renderInteriorPdf); "print" as prepared */
  edition: BookEdition;
}

/** Loads fonts, probes images and plans every page. Shared by all renderers + the validator. */
export async function prepareBookRender(input: BookPdfInput): Promise<BookRenderContext> {
  await ensurePdfFontsLoaded();
  const theme = getTheme(input.templateId, input.characterGender, input.favoriteColor ?? undefined);
  const images = await buildImageRegistry(input);
  const plan = planInteriorPages({
    story: input.story,
    characterAge: input.characterAge,
    dedicationText: input.dedicationText,
    senderName: input.senderName,
    availableImages: new Set(images.scenes.keys()),
    map:
      images.map?.dims && input.mapGame
        ? {
            game: input.mapGame,
            strings: mapPanelStrings(input.locale, input.mapGame.band, input.mapGame.items.length),
          }
        : null,
  });
  const { texts: coverTexts } = fitCoverTexts({
    title: input.story.bookTitle,
    subtitle: pdfForName(input.locale, "personalizedStory", input.characterName, input.characterGender),
    name: input.characterName,
    synopsis: input.story.synopsis || pdfT(input.locale, "defaultSynopsis").replace("{name}", input.characterName),
    locale: input.locale,
    visibleWidth: BOOK.trimWidth,
    safe: DIGITAL_COVER_SAFE,
  });
  const [qrDataUrl, logoWhite, logoOrnament, textGradient, titleGradient, coverGradient, creamFade] = await Promise.all([
    generateQrDataUrl(theme.coverGradientStart),
    getBrandLogoPng("#ffffff"),
    getBrandLogoPng(theme.ornamentColor),
    getGradientPng(TEXT_OVERLAY_STOPS),
    getGradientPng(TITLE_OVERLAY_STOPS),
    getGradientPng(COVER_OVERLAY_STOPS),
    getGradientPng(CREAM_FADE_STOPS, CREAM_FADE_RGB),
  ]);
  return { input, theme, plan, images, coverTexts, qrDataUrl, logoWhite, logoOrnament, textGradient, titleGradient, coverGradient, creamFade, edition: "print" };
}

const W = BOOK.pageWidth;
const H = BOOK.pageHeight;
const M = BOOK.contentMargin;
const DIGITAL_COVER_SAFE = BOOK.safeMargin; // 15 mm inside trim
const PAGE_SIZE: [number, number] = [W, H];
const TRIM_SIZE: [number, number] = [BOOK.trimWidth, BOOK.trimHeight];

/**
 * "print": bleed pages for Gelato (208 mm). "digital": trim pages for reading (200 mm) —
 * the customer download, e-mailed download link, dashboard and showcase sample.
 */
export type BookEdition = "print" | "digital";

/**
 * Every page is ONE fixed-size, non-wrapping, clipping root box. Pagination only
 * splits children that extend past the page, and this root is exactly page-sized,
 * so overflowing content is clipped instead of ever creating an extra page.
 * (Page-level wrap={false} is avoided: in @react-pdf 4.3 it skips the relayout
 * that sizes <Svg> nodes and crashes with "unsupported number: Infinity".)
 *
 * Digital edition: the page is the trim, and the unchanged 208 mm bleed page is placed
 * 4 mm up-left inside it — the root box clips the bleed away.
 */
function BookPage({ edition, children, background }: { edition: BookEdition; children: ReactNode; background?: string }) {
  if (edition === "digital") {
    return (
      <Page size={TRIM_SIZE}>
        <View wrap={false} style={{ width: "100%", height: rootBoxHeight(BOOK.trimHeight), position: "relative", overflow: "hidden", backgroundColor: background }}>
          <View style={{ position: "absolute", top: -BOOK.bleed, left: -BOOK.bleed, width: W, height: H }}>{children}</View>
        </View>
      </Page>
    );
  }
  return (
    <Page size={PAGE_SIZE}>
      <View wrap={false} style={{ width: "100%", height: rootBoxHeight(H), position: "relative", overflow: "hidden", backgroundColor: background }}>
        {children}
      </View>
    </Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// SCENE PAGES
// ══════════════════════════════════════════════════════════════════════════

type PageOf<K extends PlannedPage["kind"]> = Extract<PlannedPage, { kind: K }>;

function OverlayTitle({ text, fontSize, leading }: { text: string; fontSize: number; leading: number }) {
  return (
    <View style={{ position: "absolute", bottom: M + 6, left: M, width: GEOMETRY.overlayTextWidth }}>
      <Text style={{ fontFamily: FONTS.display, fontSize, fontWeight: 600, color: "#ffffff", lineHeight: leading }}>{text}</Text>
    </View>
  );
}

/**
 * Full-bleed illustration. The scene title is drawn over the art only when the planner
 * says so (the facing page has no heading); otherwise the art stands alone.
 */
function IllustrationPage({ page, ctx }: { page: PageOf<"illustration">; ctx: BookRenderContext }) {
  const image = ctx.images.scenes.get(page.image.sceneNumber);
  return (
    <BookPage edition={ctx.edition}>
      <PlacedImage image={image} boxWidth={page.image.boxWidth} boxHeight={page.image.boxHeight} />
      {page.title && <BottomGradient uri={ctx.titleGradient} width={W} height={H * 0.5} />}
      {page.title && <OverlayTitle text={sanitizePrintText(page.scene.title)} fontSize={page.title.fontSize} leading={page.title.leading} />}
      <PageNumber num={page.pageNumber} variant="art" />
    </BookPage>
  );
}

function panoramaGradientHeight(plan: InteriorPlan, sceneNumber: number): number {
  return spreadGradientHeight(plan.pages.flatMap((p) => (p.kind === "spread" && p.scene.sceneNumber === sceneNumber ? [p.overlay] : [])));
}

function SpreadPage({ page, ctx }: { page: PageOf<"spread">; ctx: BookRenderContext }) {
  const image = ctx.images.scenes.get(page.image.sceneNumber);
  const { overlay } = page;
  const panelWidth = GEOMETRY.overlayTextWidth;

  return (
    <BookPage edition={ctx.edition}>
      <PlacedImage image={image} boxWidth={page.image.boxWidth} boxHeight={page.image.boxHeight} windowLeft={page.image.windowLeft} viewWidth={W} viewHeight={H} />
      {/* Same gradient on both halves → continuous across the fold (no seam at the gutter) */}
      <BottomGradient uri={ctx.textGradient} width={W} height={panoramaGradientHeight(ctx.plan, page.scene.sceneNumber)} />
      {overlay.role === "title" ? (
        <OverlayTitle text={overlay.text} fontSize={overlay.type.fontSize} leading={overlay.type.leading} />
      ) : overlay.mode === "gradient" ? (
        <View style={{ position: "absolute", bottom: M + 6, left: M, width: panelWidth }}>
          <Paragraphs text={overlay.text} style={{ fontFamily: FONTS.body, fontSize: overlay.type.fontSize, color: "#ffffff", lineHeight: overlay.type.leading }} />
        </View>
      ) : (
        <View
          style={{
            position: "absolute",
            bottom: M,
            left: M,
            width: panelWidth,
            padding: PANEL_PADDING,
            backgroundColor: "rgba(255, 252, 247, 0.94)", // COLORS.paper — alpha on the fill only, text stays solid
            borderRadius: 10,
          }}
        >
          <Paragraphs text={overlay.text} style={{ fontFamily: FONTS.body, fontSize: overlay.type.fontSize, color: COLORS.textDark, lineHeight: overlay.type.leading }} />
        </View>
      )}
      <PageNumber num={page.pageNumber} variant="art" />
    </BookPage>
  );
}

function IllustrationTextPage({ page, ctx }: { page: PageOf<"illustration-text">; ctx: BookRenderContext }) {
  const { theme } = ctx;
  const image = ctx.images.scenes.get(page.image.sceneNumber);
  return (
    <BookPage edition={ctx.edition} background={COLORS.cream}>
      <PlacedImage image={image} boxWidth={page.image.boxWidth} boxHeight={page.image.boxHeight} />
      <View style={{ position: "absolute", top: page.image.boxHeight + 8, left: (W - ILL_TEXT_WIDTH) / 2, width: ILL_TEXT_WIDTH, bottom: M, alignItems: "center", justifyContent: "center" }}>
        <OrnamentalDivider color={theme.ornamentColor} width={60} />
        <View style={{ marginTop: 8, width: ILL_TEXT_WIDTH }}>
          <Paragraphs text={page.body} style={{ fontFamily: FONTS.body, fontSize: page.bodyType.fontSize, color: COLORS.textDark, lineHeight: page.bodyType.leading, textAlign: "center" }} />
        </View>
        <View style={{ marginTop: 6 }}>
          <WavyDots color={theme.ornamentColor} />
        </View>
      </View>
      <PageNumber num={page.pageNumber} />
    </BookPage>
  );
}

// ── Text pages (galeria / pergamino / ventana / puente) ───────────────────

/** Two-line drop cap as planned (layout.ts planDropCap); no plan → plain paragraphs. */
function DropCapParagraphs({ text, style, cap, color }: { text: string; style: Style & { fontSize: number; lineHeight: number }; cap: DropCapPlan | null | undefined; color: string }) {
  if (!cap) return <Paragraphs text={text} style={style} />;
  const pitch = style.fontSize * style.lineHeight;
  return (
    <>
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: cap.capWidth, height: 2 * pitch }}>
          <Text style={{ position: "absolute", top: cap.capTop, left: 0, fontFamily: FONTS.display, fontSize: cap.capSize, fontWeight: 600, color, lineHeight: 1 }}>{cap.initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Paragraphs text={cap.head} style={style} />
        </View>
      </View>
      {cap.tail ? <Paragraphs text={cap.tail} style={style} /> : null}
    </>
  );
}

function TextPage({ page, ctx }: { page: PageOf<"text">; ctx: BookRenderContext }) {
  const { theme } = ctx;
  const title = sanitizePrintText(page.scene.title);
  const colW = GEOMETRY.textColumnWidth;
  const bodyStyle = { fontFamily: FONTS.body, fontSize: page.bodyType.fontSize, color: COLORS.textDark, lineHeight: page.bodyType.leading };
  const titleStyle = { fontFamily: FONTS.display, fontSize: page.titleType.fontSize, fontWeight: 600 as const, color: theme.titleColor, lineHeight: page.titleType.leading };
  // Chrome (gaps, ornaments) grows with the body type (layout.ts growBodyType); the block sits
  // on the optical centre, a little above the geometric one (page.lift, from free space only).
  const k = page.scale;
  const column = { position: "absolute" as const, top: M, bottom: M, left: (W - colW) / 2, width: colW, justifyContent: "center" as const, paddingBottom: page.lift };

  switch (page.variant) {
    case "puente":
      return (
        <BookPage edition={ctx.edition} background={theme.accentLight}>
          <FrameBorder color={theme.ornamentColor} />
          <CornerDot color={theme.accent} top={M + 4} left={M + 4} />
          <CornerDot color={theme.accent} top={M + 4} right={M + 4} />
          <CornerDot color={theme.accent} bottom={M + 4} left={M + 4} />
          <CornerDot color={theme.accent} bottom={M + 4} right={M + 4} />
          <View style={{ ...column, alignItems: "center" }}>
            <OrnamentalDivider color={theme.ornamentColor} width={60 * k} />
            <View style={{ marginVertical: 28 * k, width: BOOK.trimWidth * 0.7 }}>
              <Paragraphs text={page.body} style={{ fontFamily: FONTS.display, fontSize: page.bodyType.fontSize, fontWeight: 600, color: theme.titleColor, textAlign: "center", lineHeight: page.bodyType.leading }} balance={{ width: BOOK.trimWidth * 0.7, variant: { role: "display", weight: 600 } }} />
            </View>
            <WavyDots color={theme.ornamentColor} size={4 * k} />
          </View>
          <PageNumber num={page.pageNumber} />
        </BookPage>
      );

    case "pergamino":
      return (
        <BookPage edition={ctx.edition} background={theme.accentLight}>
          <FrameBorder color={theme.ornamentColor} />
          <View style={column}>
            <Text style={{ ...titleStyle, marginBottom: 10 * k }}>{title}</Text>
            <View style={{ width: BOOK.trimWidth * 0.35, height: 1, backgroundColor: theme.accent, borderRadius: 1, marginBottom: 14 * k, opacity: 0.8 }} />
            <Paragraphs text={page.body} style={bodyStyle} />
            <View style={{ marginTop: 16 * k }}>
              <WavyDots color={theme.ornamentColor} size={4 * k} />
            </View>
          </View>
          <PageNumber num={page.pageNumber} />
        </BookPage>
      );

    case "ventana":
      return (
        <BookPage edition={ctx.edition} background={COLORS.cream}>
          <FrameBorder color={theme.ornamentColor} />
          <View style={column}>
            <Text style={{ ...titleStyle, marginBottom: 14 * k }}>{title}</Text>
            <DropCapParagraphs text={page.body} style={bodyStyle} cap={page.dropCap} color={theme.accent} />
            <View style={{ marginTop: 14 * k, alignItems: "center" }}>
              <OrnamentalDivider color={theme.ornamentColor} width={70 * k} />
            </View>
          </View>
          <PageNumber num={page.pageNumber} />
        </BookPage>
      );

    case "galeria":
    default:
      return (
        <BookPage edition={ctx.edition} background={COLORS.cream}>
          <FrameBorder color={theme.ornamentColor} />
          <View style={{ ...column, alignItems: "center" }}>
            <Text style={{ ...titleStyle, textAlign: "center", marginBottom: 12 * k }}>{title}</Text>
            <OrnamentalDivider color={theme.ornamentColor} width={80 * k} />
            <View style={{ marginTop: 12 * k, width: colW }}>
              <Paragraphs text={page.body} style={{ ...bodyStyle, textAlign: "center" }} balance={{ width: colW, variant: { role: "body" } }} />
            </View>
            <View style={{ marginTop: 14 * k }}>
              <StarCluster color={COLORS.gold} size={24 * k} />
            </View>
          </View>
          <PageNumber num={page.pageNumber} />
        </BookPage>
      );
  }
}

// ══════════════════════════════════════════════════════════════════════════
// STRUCTURAL PAGES
// ══════════════════════════════════════════════════════════════════════════

function TitleDedicationPage({ page, ctx }: { page: PageOf<"title-dedication">; ctx: BookRenderContext }) {
  const { theme, input } = ctx;
  const [quoteOpen, quoteClose] = printQuotes(input.locale);
  // Sizes + gaps scale with the book's body type (layout.ts planTitlePage)
  const { scale: k, kicker, display, sender, logo } = page.front;
  return (
    <BookPage edition={ctx.edition} background={COLORS.cream}>
      <FrameBorder color={theme.ornamentColor} />
      <View style={{ position: "absolute", top: M, bottom: M, left: M, right: M, justifyContent: "center", alignItems: "center" }}>
        <Image src={ctx.logoOrnament} style={{ height: logo, width: logo * BRAND_LOGO_ASPECT, marginBottom: 16 * k, opacity: 0.7 }} />

        <Text style={{ fontFamily: FONTS.display, fontSize: page.titleType.fontSize, fontWeight: 600, color: theme.titleColor, textAlign: "center", lineHeight: page.titleType.leading, maxWidth: GEOMETRY.textColumnWidth }}>
          {page.title}
        </Text>

        <View style={{ marginTop: 10 * k, marginBottom: 10 * k }}>
          <OrnamentalDivider color={theme.ornamentColor} width={60 * k} />
        </View>

        <Text style={{ fontFamily: FONTS.body, fontSize: kicker, lineHeight: 1.3, color: COLORS.textMedium, textAlign: "center", maxWidth: GEOMETRY.textColumnWidth }}>{pdfForName(input.locale, "personalizedAdventure", input.characterName, input.characterGender)}</Text>
        <Text style={{ fontFamily: FONTS.display, fontSize: display, lineHeight: 1.3, fontWeight: 600, color: theme.accent, marginTop: 4 * k, textAlign: "center", maxWidth: GEOMETRY.textColumnWidth }}>
          {sanitizePrintText(input.characterName)}
        </Text>

        {page.dedication ? (
          <>
            {/* Heart divider — vector heart (the text fonts have no ♥ glyph) */}
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 20 * k, marginBottom: 20 * k, gap: 8 * k }}>
              <View style={{ width: 30 * k, height: 0.5, backgroundColor: COLORS.gold, opacity: 0.5 }} />
              <HeartIcon color={COLORS.gold} size={9 * k} opacity={0.7} />
              <View style={{ width: 30 * k, height: 0.5, backgroundColor: COLORS.gold, opacity: 0.5 }} />
            </View>

            <View style={{ alignItems: "center", width: BOOK.trimWidth * 0.66 }}>
              <Paragraphs
                text={page.dedication}
                prefix={quoteOpen}
                suffix={quoteClose}
                style={{ fontFamily: FONTS.body, fontStyle: "italic", fontSize: page.dedicationType.fontSize, color: theme.titleColor, opacity: 0.85, textAlign: "center", lineHeight: page.dedicationType.leading }}
                balance={{ width: BOOK.trimWidth * 0.66, variant: { role: "body", italic: true } }}
              />
              {page.sender && (
                <Text style={{ fontFamily: FONTS.body, fontSize: sender, lineHeight: 1.3, color: COLORS.textMuted, marginTop: 8 * k, textAlign: "center" }}>
                  {"—"} {page.sender}
                </Text>
              )}
            </View>
          </>
        ) : null}

        <View style={{ marginTop: 20 * k }}>
          <StarCluster color={COLORS.gold} size={24 * k} />
        </View>
      </View>
    </BookPage>
  );
}

// ── Adventure map (pp. 28–29) ─────────────────────────────────────────────

/** Paper game card over the map's calm right quarter (image-prompts MAP_RULES keeps it free). */
function MapGamePanel({ panel, theme }: { panel: MapPanel; theme: TemplateTheme }) {
  const z = MAP_PANEL.sizes[panel.band];
  const s = panel.scale;
  const inner = GEOMETRY.mapPanelWidth - 2 * MAP_PANEL.padding;
  const dot = z.dot * s;
  const divider = <View style={{ width: 28, height: 1, borderRadius: 0.5, backgroundColor: theme.accent, opacity: 0.8, marginBottom: MAP_PANEL.dividerGap }} />;
  return (
    <View
      style={{
        position: "absolute",
        left: GEOMETRY.mapPanelLeft,
        top: (H - panel.height) / 2,
        width: GEOMETRY.mapPanelWidth,
        padding: MAP_PANEL.padding,
        backgroundColor: "rgba(255, 252, 247, 0.95)", // COLORS.paper — alpha on the fill only
        borderRadius: 10,
      }}
    >
      {/* Inner hairline, like a printed card */}
      <View style={{ position: "absolute", top: 4, left: 4, right: 4, bottom: 4, borderWidth: 0.75, borderColor: theme.ornamentColor, borderRadius: 7, opacity: 0.7 }} />
      <Text style={{ fontFamily: FONTS.body, fontSize: MAP_PANEL.kicker, fontWeight: 700, color: theme.accent, letterSpacing: 1.4, lineHeight: 1.3 }}>{panel.kicker.toUpperCase()}</Text>
      <Text style={{ marginTop: MAP_PANEL.kickerGap, marginBottom: MAP_PANEL.titleGap, fontFamily: FONTS.display, fontWeight: 600, fontSize: z.title * s, lineHeight: 1.2, color: theme.titleColor }}>
        {panel.title}
      </Text>
      {panel.howTo ? (
        <Text style={{ marginTop: -MAP_PANEL.titleGap / 2, marginBottom: MAP_PANEL.howTo.gap, fontFamily: FONTS.body, fontSize: MAP_PANEL.howTo.size * s, lineHeight: MAP_PANEL.howTo.leading, color: COLORS.textMedium }}>
          {panel.howTo}
        </Text>
      ) : null}
      {divider}
      {panel.items.map((item, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: z.itemGap * s }}>
          <View style={{ width: dot, height: dot, borderRadius: dot / 2, borderWidth: 1.1, borderColor: theme.accent, marginRight: 7 }} />
          <Text style={{ width: inner - dot - 7, fontFamily: FONTS.body, fontWeight: 600, fontSize: z.item * s, lineHeight: MAP_PANEL.itemLeading, color: COLORS.textDark }}>{item}</Text>
        </View>
      ))}
      {panel.trail ? (
        <View style={{ marginTop: MAP_PANEL.sectionGap, flexDirection: "row", alignItems: "flex-start" }}>
          {/* The trail's own mark: three dashes */}
          <View style={{ width: 18, flexDirection: "row", gap: 2, paddingTop: z.note * s * 0.62 }}>
            {[0, 1, 2].map((d) => (
              <View key={d} style={{ width: 3.5, height: 1.4, borderRadius: 0.7, backgroundColor: theme.accent }} />
            ))}
          </View>
          <Text style={{ width: inner - 18, fontFamily: FONTS.body, fontStyle: "italic", fontSize: z.note * s, lineHeight: MAP_PANEL.noteLeading, color: COLORS.textMedium }}>{panel.trail}</Text>
        </View>
      ) : null}
      {panel.questions.length ? (
        <View style={{ marginTop: MAP_PANEL.sectionGap }}>
          {divider}
          <Text style={{ marginBottom: 6, fontFamily: FONTS.display, fontWeight: 600, fontSize: z.qTitle * s, lineHeight: 1.2, color: theme.titleColor }}>{panel.questionsTitle}</Text>
          {panel.questions.map((q, i) => (
            <View key={i} style={{ flexDirection: "row", marginBottom: 4 }}>
              <Text style={{ width: 14 * s, fontFamily: FONTS.body, fontWeight: 700, fontSize: z.question * s, lineHeight: MAP_PANEL.noteLeading, color: theme.accent }}>{i + 1}.</Text>
              <Text style={{ width: inner - 14 * s, fontFamily: FONTS.body, fontSize: z.question * s, lineHeight: MAP_PANEL.noteLeading, color: COLORS.textDark }}>{q}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {panel.answers ? (
        // Upside down, the classic puzzle-book convention
        <View style={{ marginTop: MAP_PANEL.sectionGap, transform: "rotate(180deg)" }}>
          <Text style={{ width: inner, fontFamily: FONTS.body, fontSize: z.answer * s, lineHeight: MAP_PANEL.noteLeading, color: COLORS.textMuted, textAlign: "center" }}>{panel.answers}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** One half of the map spread (no folio: back-matter art). */
function MapPage({ page, ctx }: { page: PageOf<"map">; ctx: BookRenderContext }) {
  return (
    <BookPage edition={ctx.edition} background={COLORS.cream}>
      <PlacedImage
        image={ctx.images.map}
        boxWidth={GEOMETRY.spreadWidth}
        boxHeight={H}
        windowLeft={page.half === "right" ? GEOMETRY.spreadRightOffset : 0}
        viewWidth={W}
        viewHeight={H}
      />
      {page.panel ? <MapGamePanel panel={page.panel} theme={ctx.theme} /> : null}
    </BookPage>
  );
}

/** Solid mix of two #rrggbb colours (t = 0 → a, 1 → b). Solid inks print predictably; no transparency. */
function mixHex(a: string, b: string, t: number): string {
  const parse = (h: string) => {
    const n = /^#[0-9a-f]{6}$/i.test(h) ? parseInt(h.slice(1), 16) : 0xfdf8f0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [x, y] = [parse(a), parse(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Meapica endpaper — the pastedowns of the printed book (first and last page of the Gelato
 * inside file), the digital book's endpapers, and pp. 28–29 of books without a map.
 * Light paper in the theme's tint with a calm, gently scattered half-drop lattice of our ornament
 * vocabulary (four-point sparkles, crescent moons, small stars, dots), in solid inks mixed toward
 * the ground so it reads clearly in print but never competes with the facing page (< 5 % coverage).
 * Continuous across a fold: `offsetX` = this page's x in spread coordinates.
 */
function EndpaperPage({ theme, offsetX, edition }: { theme: TemplateTheme; offsetX: number; edition: BookEdition }) {
  const STEP = 50; // half-drop lattice: neighbours ≈ 35 pt (12 mm) apart
  const ground = mixHex(theme.pageTint, theme.accentLight, 0.7);
  const ink = {
    sparkle: mixHex(ground, theme.ornamentColor, 0.85),
    moon: mixHex(ground, theme.accent, 0.38),
    star: mixHex(ground, COLORS.gold, 0.62),
    dot: mixHex(ground, theme.ornamentColor, 0.6),
  };
  // Deterministic scatter in SPREAD coordinates → identical on both sides of a fold
  const hash = (r: number, c: number, salt: number) => {
    let h = (Math.imul(r, 374761393) + Math.imul(c, 668265263) + Math.imul(salt, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  // Crescent: outer circle minus an offset inner one (opening to the upper right)
  const moon = (x: number, y: number, R: number) => {
    const r2 = R * 0.85;
    const [dx, dy] = [R * 0.45, -R * 0.35];
    const d = Math.hypot(dx, dy);
    const [ux, uy] = [dx / d, dy / d];
    const a = (R * R - r2 * r2 + d * d) / (2 * d);
    const h = Math.sqrt(R * R - a * a);
    const p1 = [x + a * ux - h * uy, y + a * uy + h * ux].map((v) => v.toFixed(2)).join(" ");
    const p2 = [x + a * ux + h * uy, y + a * uy - h * ux].map((v) => v.toFixed(2)).join(" ");
    return `M${p1} A${R} ${R} 0 1 1 ${p2} A${r2} ${r2} 0 0 0 ${p1} Z`;
  };
  const first = Math.floor(offsetX / STEP) - 1;
  const cols = Math.ceil(W / STEP) + 3;
  const rows = Math.ceil(H / (STEP / 2)) + 2;
  const marks: JSX.Element[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = first; c < first + cols; c++) {
      const x = c * STEP + (r % 2 ? STEP / 2 : 0) - offsetX + (hash(r, c, 1) - 0.5) * 7;
      const y = r * (STEP / 2) - 8 + (hash(r, c, 2) - 0.5) * 7;
      if (x < -10 || x > W + 10) continue;
      const key = `${r}:${c}`;
      const pick = hash(r, c, 3);
      if (pick < 0.34) {
        const k = 4.2; // four-point sparkle (same curve as the patterned spread before)
        marks.push(<Path key={key} d={`M${x} ${y - k} Q${x} ${y} ${x + k} ${y} Q${x} ${y} ${x} ${y + k} Q${x} ${y} ${x - k} ${y} Q${x} ${y} ${x} ${y - k} Z`} fill={ink.sparkle} />);
      } else if (pick < 0.5) {
        marks.push(<Path key={key} d={moon(x, y, 3.9)} fill={ink.moon} />);
      } else if (pick < 0.78) {
        const o = 2.5; // small five-point star (StarCluster's star)
        const pts = Array.from({ length: 10 }, (_, i) => {
          const ang = (Math.PI / 5) * i - Math.PI / 2;
          const rr = i % 2 ? o * 0.45 : o;
          return `${(x + rr * Math.cos(ang)).toFixed(2)} ${(y + rr * Math.sin(ang)).toFixed(2)}`;
        });
        marks.push(<Path key={key} d={`M${pts.join(" L")} Z`} fill={ink.star} />);
      } else {
        marks.push(<Circle key={key} cx={x} cy={y} r={1.2} fill={ink.dot} />);
      }
    }
  }
  return (
    <BookPage edition={edition} background={ground}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          {marks}
        </Svg>
      </View>
    </BookPage>
  );
}

function FinalPage({ page, ctx }: { page: PageOf<"final">; ctx: BookRenderContext }) {
  const { theme, input } = ctx;
  const { scale: k, kicker, display } = page.front; // layout.ts planFinalPage
  return (
    <BookPage edition={ctx.edition} background={COLORS.cream}>
      <FrameBorder color={theme.ornamentColor} />
      <View style={{ position: "absolute", top: M, bottom: M, left: M, right: M, justifyContent: "center", alignItems: "center" }}>
        <View style={{ alignItems: "center", width: BOOK.trimWidth * 0.7 }}>
          <StarCluster color={COLORS.gold} size={Math.min(56, 40 * k)} />
          <View style={{ marginTop: 20 * k, marginBottom: 20 * k }}>
            <OrnamentalDivider color={COLORS.gold} width={100 * k} />
          </View>
          <Paragraphs text={page.message} style={{ ...TYPE.finalMessage, textAlign: "center", fontSize: page.messageType.fontSize, lineHeight: page.messageType.leading }} balance={{ width: BOOK.trimWidth * 0.7, variant: { role: "display", weight: 600 } }} />
          <View style={{ marginTop: 20 * k }}>
            <WavyDots color={theme.ornamentColor} size={4 * k} />
          </View>
          <Text style={{ fontFamily: FONTS.body, fontSize: kicker, lineHeight: 1.3, color: COLORS.textMuted, marginTop: 28 * k, textAlign: "center" }}>
            {joinName(pdfForName(input.locale, "createdFor", input.characterName, input.characterGender), sanitizePrintText(input.characterName))}
          </Text>
          <Text style={{ fontFamily: FONTS.display, fontSize: display, lineHeight: 1.2, fontWeight: 600, color: theme.accent, marginTop: 8 * k }}>{pdfT(input.locale, "end")}</Text>
        </View>
      </View>
      <PageNumber num={page.pageNumber} />
    </BookPage>
  );
}

// ── Trait SVG icons (matching web Material Symbols) ─────────────────────────

function PetsIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="4.5" cy="9.5" r="2.5" fill={color} />
      <Circle cx="9" cy="5.5" r="2.5" fill={color} />
      <Circle cx="15" cy="5.5" r="2.5" fill={color} />
      <Circle cx="19.5" cy="9.5" r="2.5" fill={color} />
      <Path d="M17.34 14.86c-.87-1.02-1.6-1.89-2.48-2.91-.46-.54-1.17-.86-1.86-.86-.69 0-1.39.32-1.85.86-.87 1.02-1.61 1.89-2.48 2.91-1.31 1.31-2.92 2.76-2.62 4.79.29 1.02 1.02 2.0 2.09 2.35.75.29 1.57.0 2.36-.23.56-.16 1.14-.34 1.64-.34.49 0 1.09.19 1.65.35.79.23 1.61.52 2.36.23 1.07-.35 1.8-1.32 2.09-2.35.3-2.03-1.31-3.48-2.62-4.79z" fill={color} />
    </Svg>
  );
}

function PaletteIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.61-.23-1.2-.64-1.67-.08-.1-.13-.21-.13-.33 0-.28.22-.5.5-.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 8 6.5 8 8 8.67 8 9.5 7.33 11 6.5 11zm3-4C8.67 7 8 6.33 8 5.5S8.67 4 9.5 4s1.5.67 1.5 1.5S10.33 7 9.5 7zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 4 14.5 4s1.5.67 1.5 1.5S15.33 7 14.5 7zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 8 17.5 8s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" fill={color} />
    </Svg>
  );
}

function AboutReaderPage({ ctx }: { ctx: BookRenderContext }) {
  const { theme, input, images } = ctx;
  const { characterAge, characterCity, characterInterests, favoriteColor, favoriteCompanion, futureDream, characterGender } = input;
  const heroLabel = characterGender === "girl" ? pdfT(input.locale, "heroine") : pdfT(input.locale, "hero");
  const locale = input.locale ?? "es";

  const traits: { label: string; icon: "pets" | "palette" | "color"; color?: string }[] = [];
  if (favoriteColor) {
    const colorId = FAVORITE_COLORS.find((c) => c.color === favoriteColor)?.id;
    const label = colorId ? colorName(locale, colorId) : null;
    if (label) traits.push({ label, icon: "color", color: favoriteColor });
  }
  if (favoriteCompanion) traits.push({ label: sanitizePrintText(favoriteCompanion), icon: "pets" });
  if (futureDream) traits.push({ label: sanitizePrintText(futureDream), icon: "palette" });

  return (
    <BookPage edition={ctx.edition} background="#ffffff">
      {images.portrait ? (
        <PlacedImage image={images.portrait} boxWidth={W} boxHeight={H} focusY={0} style={{ position: "absolute", top: 0, left: 0 }} />
      ) : (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.coverGradientStart }}>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.coverGradientEnd, opacity: 0.3 }} />
        </View>
      )}

      <View style={{ position: "absolute", top: M, left: M, backgroundColor: theme.accent, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 }}>
        <Text style={{ fontFamily: FONTS.body, fontSize: 6.5, fontWeight: 700, color: "#ffffff", letterSpacing: 2 }}>{heroLabel.toUpperCase()}</Text>
      </View>

      <BottomGradient uri={ctx.creamFade} width={W} height={H * 0.6} />

      <View style={{ position: "absolute", bottom: M, left: M, right: M }}>
        <Text style={{ fontFamily: FONTS.display, fontSize: 28, fontWeight: 600, color: theme.titleColor, lineHeight: 1.15 }}>
          {sanitizePrintText(input.characterName)}
        </Text>
        <View style={{ width: 32, height: 2.5, borderRadius: 1.25, backgroundColor: theme.accent, marginTop: 6, opacity: 0.8 }} />
        <Text style={{ fontFamily: FONTS.body, fontSize: 9, color: COLORS.textMedium, marginTop: 8, letterSpacing: 0.3 }}>
          {characterAge} {pdfT(input.locale, "years")}
          {characterCity ? `  ·  ${sanitizePrintText(characterCity)}` : ""}
        </Text>

        {traits.length > 0 && (
          <View style={{ marginTop: 12, gap: 7 }}>
            {traits.map((trait, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                {trait.icon === "color" && (
                  <Svg width={13} height={13} viewBox="0 0 13 13">
                    {/* Opaque light edge — SVG stroke alpha ("#00000015") is dropped and printed solid black */}
                    <Circle cx={6.5} cy={6.5} r={6} fill={trait.color ?? theme.accent} stroke={COLORS.textLight} strokeWidth={0.5} />
                  </Svg>
                )}
                {trait.icon === "pets" && <PetsIcon color={theme.accent} size={13} />}
                {trait.icon === "palette" && <PaletteIcon color={theme.accent} size={13} />}
                <Text style={{ fontFamily: FONTS.body, fontSize: 9, fontWeight: 600, color: theme.titleColor, letterSpacing: 0.2, maxWidth: W - 2 * M - 20 }}>
                  {trait.label}
                </Text>
              </View>
            ))}
          </View>
        )}

        {characterInterests && characterInterests.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 12 }}>
            {characterInterests.slice(0, 8).map((interest) => (
              <View key={interest} style={{ backgroundColor: theme.accentLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontFamily: FONTS.body, fontSize: 7, fontWeight: 600, color: theme.accent, letterSpacing: 0.3 }}>{sanitizePrintText(interestLabel(locale, interest))}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </BookPage>
  );
}

function ColophonPage({ ctx }: { ctx: BookRenderContext }) {
  const { input, qrDataUrl } = ctx;
  return (
    <BookPage edition={ctx.edition} background={COLORS.cream}>
      <View style={{ position: "absolute", top: M, bottom: M, left: M, right: M, justifyContent: "center", alignItems: "center" }}>
        <View style={{ alignItems: "center", maxWidth: BOOK.trimWidth * 0.65 }}>
          <Paragraphs text={pdfT(input.locale, "colophonText")} style={{ fontFamily: FONTS.body, fontSize: 10, color: COLORS.textMuted, textAlign: "center", lineHeight: 1.8 }} />
          {qrDataUrl ? (
            <View style={{ marginTop: 20, alignItems: "center", gap: 6 }}>
              <Image src={qrDataUrl} style={{ width: 72, height: 72 }} />
              <Text style={{ fontFamily: FONTS.body, fontSize: 7, color: COLORS.textMuted, letterSpacing: 0.5 }}>meapica.shop</Text>
            </View>
          ) : null}
          <View style={{ width: 48, height: 0.5, backgroundColor: COLORS.textLight, marginTop: 16 }} />
          <Text style={{ fontFamily: FONTS.display, fontSize: 12, color: COLORS.textMuted, opacity: 0.6, letterSpacing: 1, marginTop: 12 }}>Meapica</Text>
        </View>
      </View>
    </BookPage>
  );
}

// ── Digital cover / back cover (single pages; drawn on the bleed page, shown at trim) ──

const DIGITAL_FRAME: PanelFrame = {
  art: { left: 0, top: 0, width: W, height: H },
  visible: { left: BOOK.bleed, top: BOOK.bleed, width: BOOK.trimWidth, height: BOOK.trimHeight },
  safe: DIGITAL_COVER_SAFE,
};

function CoverPage({ ctx }: { ctx: BookRenderContext }) {
  return (
    <BookPage edition={ctx.edition} background={ctx.theme.coverGradientStart}>
      <FrontCoverDesign frame={DIGITAL_FRAME} theme={ctx.theme} texts={ctx.coverTexts} image={ctx.images.cover} overlayUri={ctx.coverGradient} />
    </BookPage>
  );
}

/** Back cover artwork: last scene illustration, falling back to the cover art. */
export function backCoverImage(ctx: Pick<BookRenderContext, "images" | "input">) {
  const last = ctx.input.story.scenes.length;
  return ctx.images.scenes.get(last) ?? ctx.images.cover;
}

function BackCoverPage({ ctx }: { ctx: BookRenderContext }) {
  return (
    <BookPage edition={ctx.edition} background={ctx.theme.coverGradientStart}>
      <BackCoverDesign frame={DIGITAL_FRAME} theme={ctx.theme} texts={ctx.coverTexts} image={backCoverImage(ctx)} logoUri={ctx.logoOrnament} />
    </BookPage>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// DOCUMENTS
// ══════════════════════════════════════════════════════════════════════════

function renderPlannedPage(page: PlannedPage, ctx: BookRenderContext): JSX.Element {
  const key = `p${page.pageNumber}`;
  switch (page.kind) {
    case "title-dedication":
      return <TitleDedicationPage key={key} page={page} ctx={ctx} />;
    case "illustration":
      return <IllustrationPage key={key} page={page} ctx={ctx} />;
    case "spread":
      return <SpreadPage key={key} page={page} ctx={ctx} />;
    case "text":
      return <TextPage key={key} page={page} ctx={ctx} />;
    case "illustration-text":
      return <IllustrationTextPage key={key} page={page} ctx={ctx} />;
    case "final":
      return <FinalPage key={key} page={page} ctx={ctx} />;
    case "about-reader":
      return <AboutReaderPage key={key} ctx={ctx} />;
    case "map":
      return <MapPage key={key} page={page} ctx={ctx} />;
    case "endpaper":
      return <EndpaperPage key={key} theme={ctx.theme} edition={ctx.edition} offsetX={page.side === "right" ? GEOMETRY.spreadRightOffset : 0} />;
    case "colophon":
      return <ColophonPage key={key} ctx={ctx} />;
  }
}

/** Interior-only PDF for Gelato — exactly the 30 planned inner pages. */
export function InteriorOnlyPdf({ ctx }: { ctx: BookRenderContext }) {
  // Pastedowns first and last (glued to the boards), as in Teo's printed book (layout.ts).
  return (
    <Document title={ctx.input.story.bookTitle} author="Meapica" creator="Meapica — meapica.shop" producer="Meapica">
      <EndpaperPage theme={ctx.theme} edition={ctx.edition} offsetX={0} />
      {ctx.plan.pages.map((p) => renderPlannedPage(p, ctx))}
      <EndpaperPage theme={ctx.theme} edition={ctx.edition} offsetX={GEOMETRY.spreadRightOffset} />
    </Document>
  );
}

/** Full book (34 pages, same reading order as the printed book), in ctx.edition. */
export function BookPdf({ ctx }: { ctx: BookRenderContext }) {
  const { input, theme, edition } = ctx;
  return (
    <Document
      title={input.story.bookTitle}
      author="Meapica"
      subject={joinName(pdfForName(input.locale, "personalizedStory", input.characterName, input.characterGender), input.characterName)}
      creator="Meapica — meapica.shop"
      producer="Meapica"
    >
      <CoverPage ctx={ctx} />
      <EndpaperPage theme={theme} edition={edition} offsetX={0} />
      {ctx.plan.pages.map((p) => renderPlannedPage(p, ctx))}
      <EndpaperPage theme={theme} edition={edition} offsetX={GEOMETRY.spreadRightOffset} />
      <BackCoverPage ctx={ctx} />
    </Document>
  );
}

async function renderDocument(element: JSX.Element): Promise<Buffer> {
  // renderToBuffer is typed for <Document> elements only
  return renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);
}

/**
 * Full 34-page book. Default "digital" (trim-size reader edition): the customer download,
 * e-mail download link, dashboard and showcase sample. "print" keeps the bleed (proofing only —
 * Gelato gets renderInteriorPdf + renderCoverSpreadPdf).
 */
export async function renderBookPdf(input: BookPdfInput, prepared?: BookRenderContext, options: { edition?: BookEdition } = {}): Promise<Buffer> {
  const ctx = prepared ?? (await prepareBookRender(input));
  // Shallow copy: the prepared context is shared with the print renders (renderPrintFiles runs them in parallel)
  return renderDocument(createElement(BookPdf, { ctx: { ...ctx, edition: options.edition ?? "digital" } }));
}

/**
 * Gelato "inside" PDF (32 pages: pastedown + 30 inner + pastedown), always the print edition
 * (bleed pages). Call validatePrintableBook first —
 * this renderer draws whatever it is given.
 */
export async function renderInteriorPdf(input: BookPdfInput, prepared?: BookRenderContext): Promise<Buffer> {
  const ctx = prepared ?? (await prepareBookRender(input));
  return renderDocument(createElement(InteriorOnlyPdf, { ctx: { ...ctx, edition: "print" } }));
}
