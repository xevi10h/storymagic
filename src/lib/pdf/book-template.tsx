/* eslint-disable jsx-a11y/alt-text -- @react-pdf <Image> renders into a PDF and has no alt prop */
/**
 * PDF Book Template — Editorial children's book layout
 *
 * Page order, facing pages, image boxes and type sizes come from the page plan
 * in layout.ts (shared with validatePrintableBook). This file only draws.
 *
 * Interior (Gelato "inside" file, 30 pages, page 1 = right-hand page):
 *   p1        Title + dedication (verbatim parent text)
 *   p2–p25    12 scenes — illustration LEFT ↔ text RIGHT; panoramas span p(even)+p(odd)
 *   p26 · p27 Final "The End" ↔ About the reader
 *   p28 · p29 Adventure map + search-and-find game (patterned endpaper when the book has no map)
 *   p30       Colophon
 *
 * Digital book (user download, 34 pages = the physical book in reading order):
 *   cover · endpaper · interior 1–30 · endpaper · back cover
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
import { ensurePdfFontsLoaded, fontMetrics, measureTextWidth } from "./fonts";
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
import { joinName, printQuotes, sanitizePrintText, splitLeadingLines } from "./text";

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

// ── PDF i18n (server-side, no hooks) ──────────────────────────────────────

const PDF_STRINGS: Record<string, Record<string, string>> = {
  es: {
    personalizedStory: "Una historia personalizada para",
    personalizedAdventure: "Una aventura personalizada para",
    createdFor: "Una historia creada especialmente para",
    end: "Fin",
    hero: "El héroe",
    heroine: "La heroína",
    years: "años",
    colophonText: "Ilustraciones creadas exclusivamente para este libro.\nDiseño editorial por Meapica.",
    defaultSynopsis: "{name} está a punto de vivir la aventura más extraordinaria de su vida.",
    mapKicker: "El mapa de la aventura",
    mapWhereIs: "¿Dónde está…?",
    mapSeekFind: "Busca y encuentra",
    mapTrail: "Sigue con el dedo el camino de puntos.",
    mapQuestions: "Preguntas",
    mapAnswers: "Respuestas",
  },
  ca: {
    personalizedStory: "Una història personalitzada per a",
    personalizedAdventure: "Una aventura personalitzada per a",
    createdFor: "Una història creada especialment per a",
    end: "Fi",
    hero: "L'heroi",
    heroine: "L'heroïna",
    years: "anys",
    colophonText: "Il·lustracions creades exclusivament per a aquest llibre.\nDisseny editorial per Meapica.",
    defaultSynopsis: "{name} està a punt de viure l'aventura més extraordinària de la seva vida.",
    mapKicker: "El mapa de l'aventura",
    mapWhereIs: "On és…?",
    mapSeekFind: "Busca i troba",
    mapTrail: "Segueix amb el dit el camí de punts.",
    mapQuestions: "Preguntes",
    mapAnswers: "Respostes",
  },
  en: {
    personalizedStory: "A personalized story for",
    personalizedAdventure: "A personalized adventure for",
    createdFor: "A story created especially for",
    end: "The End",
    hero: "The hero",
    heroine: "The heroine",
    years: "years old",
    colophonText: "Illustrations created exclusively for this book.\nEditorial design by Meapica.",
    defaultSynopsis: "{name} is about to live the most extraordinary adventure of their life.",
    mapKicker: "The adventure map",
    mapWhereIs: "Where is…?",
    mapSeekFind: "Seek and find",
    mapTrail: "Follow the dotted trail with your finger.",
    mapQuestions: "Questions",
    mapAnswers: "Answers",
  },
  fr: {
    personalizedStory: "Une histoire personnalisée pour",
    personalizedAdventure: "Une aventure personnalisée pour",
    createdFor: "Une histoire créée spécialement pour",
    end: "Fin",
    hero: "Le héros",
    heroine: "L'héroïne",
    years: "ans",
    colophonText: "Illustrations créées exclusivement pour ce livre.\nDesign éditorial par Meapica.",
    defaultSynopsis: "{name} est sur le point de vivre l'aventure la plus extraordinaire de sa vie.",
    mapKicker: "La carte de l'aventure",
    mapWhereIs: "Où est… ?",
    mapSeekFind: "Cherche et trouve",
    mapTrail: "Suis du doigt le chemin en pointillés.",
    mapQuestions: "Questions",
    mapAnswers: "Réponses",
  },
};

export function pdfT(locale: string | undefined, key: string): string {
  const loc = locale && PDF_STRINGS[locale] ? locale : "es";
  return PDF_STRINGS[loc][key] || PDF_STRINGS.es[key] || key;
}

/**
 * A "…for" phrase ready to be followed by the child's name. Catalan needs the
 * personal article: "per a la Núria", "per a en Pau", "per a l'Anna".
 * Join with `joinName` (no space after an elided "l'").
 */
export function pdfForName(locale: string | undefined, key: string, name: string, gender?: string): string {
  const phrase = pdfT(locale, key);
  if (locale !== "ca") return phrase;
  // ponytail: vowel/h+vowel → l'; ignores the unstressed i/u exceptions ("la Irene").
  if (/^h?[aeiouàèéíòóúï]/i.test(name.trim())) return `${phrase} l'`;
  return `${phrase} ${gender === "boy" ? "en" : "la"}`;
}

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
            strings: {
              kicker: pdfT(input.locale, "mapKicker"),
              title: pdfT(input.locale, input.mapGame.band === "little" ? "mapWhereIs" : "mapSeekFind"),
              trail: pdfT(input.locale, "mapTrail"),
              questions: pdfT(input.locale, "mapQuestions"),
              answers: pdfT(input.locale, "mapAnswers"),
            },
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
    getGradientPng(CREAM_FADE_STOPS, [250, 248, 245]),
  ]);
  return { input, theme, plan, images, coverTexts, qrDataUrl, logoWhite, logoOrnament, textGradient, titleGradient, coverGradient, creamFade };
}

const W = BOOK.pageWidth;
const H = BOOK.pageHeight;
const M = BOOK.contentMargin;
const DIGITAL_COVER_SAFE = BOOK.safeMargin; // 15 mm inside trim
const PAGE_SIZE: [number, number] = [W, H];

/**
 * Every page is ONE fixed-size, non-wrapping, clipping root box. Pagination only
 * splits children that extend past the page, and this root is exactly page-sized,
 * so overflowing content is clipped instead of ever creating an extra page.
 * (Page-level wrap={false} is avoided: in @react-pdf 4.3 it skips the relayout
 * that sizes <Svg> nodes and crashes with "unsupported number: Infinity".)
 */
function BookPage({ children, background }: { children: ReactNode; background?: string }) {
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

function TitleStrip({ theme, text, height }: { theme: TemplateTheme; text: string; height: number }) {
  return (
    <View style={{ height, justifyContent: "center", paddingHorizontal: M }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 2, height: 28, borderRadius: 1, backgroundColor: theme.accent }} />
        <Text style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: theme.titleColor, lineHeight: 1.3, maxWidth: W - 2 * M - 12 }}>
          {text}
        </Text>
      </View>
    </View>
  );
}

function IllustrationPage({ page, ctx }: { page: PageOf<"illustration">; ctx: BookRenderContext }) {
  const { theme, images } = ctx;
  const image = images.scenes.get(page.image.sceneNumber);
  const title = sanitizePrintText(page.scene.title);
  const box = page.image;

  if (page.layout === "split_top" || page.layout === "split_bottom") {
    const strip = H - box.boxHeight;
    const img = <PlacedImage image={image} boxWidth={box.boxWidth} boxHeight={box.boxHeight} />;
    return (
      <BookPage background={COLORS.cream}>
        {page.layout === "split_top" ? (
          <>
            {img}
            <TitleStrip theme={theme} text={title} height={strip} />
          </>
        ) : (
          <>
            <TitleStrip theme={theme} text={title} height={strip} />
            {img}
          </>
        )}
        {/* split_bottom: the folio falls on the illustration */}
        <PageNumber num={page.pageNumber} variant={page.layout === "split_bottom" ? "art" : "paper"} />
      </BookPage>
    );
  }

  // immersive (title over art) / full_illustration (art only)
  return (
    <BookPage>
      <PlacedImage image={image} boxWidth={W} boxHeight={H} />
      {page.layout === "immersive" && <BottomGradient uri={ctx.titleGradient} width={W} height={H * 0.5} />}
      {page.layout === "immersive" && <OverlayTitle text={title} fontSize={page.titleType.fontSize} leading={page.titleType.leading} />}
      <PageNumber num={page.pageNumber} variant="art" />
    </BookPage>
  );
}

/**
 * Bottom gradient height shared by BOTH halves of a panorama, so the darkening is
 * identical on each side of the fold. Uses TEXT_OVERLAY_STOPS on both pages: body text
 * occupies the bottom 55% of it, where it is ≥ 45% black; the title needs half the page.
 */
function spreadGradientHeight(plan: InteriorPlan, sceneNumber: number): number {
  let height = H * 0.5;
  for (const p of plan.pages) {
    if (p.kind === "spread" && p.scene.sceneNumber === sceneNumber && p.overlay.role === "body" && p.overlay.mode === "gradient") {
      height = Math.max(height, (p.overlay.blockHeight + M + 6) / 0.55);
    }
  }
  return Math.min(H, height);
}

function SpreadPage({ page, ctx }: { page: PageOf<"spread">; ctx: BookRenderContext }) {
  const image = ctx.images.scenes.get(page.image.sceneNumber);
  const { overlay } = page;
  const panelWidth = GEOMETRY.overlayTextWidth;

  return (
    <BookPage>
      <PlacedImage image={image} boxWidth={page.image.boxWidth} boxHeight={page.image.boxHeight} windowLeft={page.image.windowLeft} viewWidth={W} viewHeight={H} />
      {/* Same gradient on both halves → continuous across the fold (no seam at the gutter) */}
      <BottomGradient uri={ctx.textGradient} width={W} height={spreadGradientHeight(ctx.plan, page.scene.sceneNumber)} />
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
    <BookPage background={COLORS.cream}>
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

/** Opening punctuation that travels with the initial ("¿Qué", "«Hola"); dashes (dialogue) get no drop cap. */
const DROP_CAP_INITIAL = /^[¿¡«"“'‘]?[\p{L}\p{N}]/u;

/**
 * Two-line drop cap. react-pdf cannot float text around a box, so the first two
 * lines are measured off (same breaker as the planner) and set beside the initial;
 * the rest continues at full width. The initial's cap height spans from line 1's
 * cap line to line 2's baseline, its baseline sitting exactly on line 2's.
 * The planner fits ventana bodies at a narrower width, so this never grows the block.
 * Falls back to plain paragraphs when the first paragraph is a single line.
 */
function DropCapParagraphs({ text, style, width, color }: { text: string; style: Style & { fontSize: number; lineHeight: number }; width: number; color: string }) {
  const initial = DROP_CAP_INITIAL.exec(text)?.[0];
  if (!initial) return <Paragraphs text={text} style={style} />;
  const fs = style.fontSize;
  const pitch = fs * style.lineHeight;
  const bodyFont = fontMetrics({ role: "body" });
  const capVariant = { role: "display" as const, weight: 600 as const };
  const capFont = fontMetrics(capVariant);
  const capSize = (pitch + bodyFont.capHeight * fs) / capFont.capHeight;
  // react-pdf baseline = line top + ascent·size → offset that puts the initial's baseline on line 2's
  const capTop = pitch + bodyFont.ascent * fs - capFont.ascent * capSize;
  const capWidth = measureTextWidth(initial, capSize, capVariant) + fs * 0.35;
  const lineWidth = width - capWidth;
  const { head, tail } = splitLeadingLines(text.slice(initial.length), 2, fs, lineWidth, { role: "body" });
  // Only when the first paragraph itself fills both lines beside the initial: a one-line
  // opening paragraph would leave the initial hanging into the blank gap below it.
  // splitLeadingLines breaks early (safety margin), so a head it spreads over 2 lines can
  // still render on ONE — require the head to overflow the REAL line width by a margin;
  // borderline cases fall back to plain paragraphs (no drop cap beats an empty line).
  const headOverflows = measureTextWidth(head, fs, { role: "body" }) > lineWidth * 1.04;
  if (!head || head.includes("\n") || !headOverflows) return <Paragraphs text={text} style={style} />;
  return (
    <>
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: capWidth, height: 2 * pitch }}>
          <Text style={{ position: "absolute", top: capTop, left: 0, fontFamily: FONTS.display, fontSize: capSize, fontWeight: 600, color, lineHeight: 1 }}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Paragraphs text={head} style={style} />
        </View>
      </View>
      {tail ? <Paragraphs text={tail} style={style} /> : null}
    </>
  );
}


function TextPage({ page, ctx }: { page: PageOf<"text">; ctx: BookRenderContext }) {
  const { theme } = ctx;
  const title = sanitizePrintText(page.scene.title);
  const colW = GEOMETRY.textColumnWidth;
  const bodyStyle = { fontFamily: FONTS.body, fontSize: page.bodyType.fontSize, color: COLORS.textDark, lineHeight: page.bodyType.leading };
  const titleStyle = { fontFamily: FONTS.display, fontSize: page.titleType.fontSize, fontWeight: 600 as const, color: theme.titleColor, lineHeight: page.titleType.leading };
  const column = { position: "absolute" as const, top: M, bottom: M, left: (W - colW) / 2, width: colW, justifyContent: "center" as const };

  switch (page.variant) {
    case "puente":
      return (
        <BookPage background={theme.accentLight}>
          <FrameBorder color={theme.ornamentColor} />
          <CornerDot color={theme.accent} top={M + 4} left={M + 4} />
          <CornerDot color={theme.accent} top={M + 4} right={M + 4} />
          <CornerDot color={theme.accent} bottom={M + 4} left={M + 4} />
          <CornerDot color={theme.accent} bottom={M + 4} right={M + 4} />
          <View style={{ ...column, alignItems: "center" }}>
            <OrnamentalDivider color={theme.ornamentColor} width={60} />
            <View style={{ marginVertical: 28, width: BOOK.trimWidth * 0.7 }}>
              <Paragraphs text={page.body} style={{ fontFamily: FONTS.display, fontSize: page.bodyType.fontSize, fontWeight: 600, color: theme.titleColor, textAlign: "center", lineHeight: page.bodyType.leading }} />
            </View>
            <WavyDots color={theme.ornamentColor} />
          </View>
          <PageNumber num={page.pageNumber} />
        </BookPage>
      );

    case "pergamino":
      return (
        <BookPage background={theme.accentLight}>
          <FrameBorder color={theme.ornamentColor} />
          <View style={column}>
            <Text style={{ ...titleStyle, marginBottom: 10 }}>{title}</Text>
            <View style={{ width: BOOK.trimWidth * 0.35, height: 1, backgroundColor: theme.accent, borderRadius: 1, marginBottom: 14, opacity: 0.8 }} />
            <Paragraphs text={page.body} style={bodyStyle} />
            <View style={{ marginTop: 16 }}>
              <WavyDots color={theme.ornamentColor} />
            </View>
          </View>
          <PageNumber num={page.pageNumber} />
        </BookPage>
      );

    case "ventana":
      return (
        <BookPage background={COLORS.cream}>
          <FrameBorder color={theme.ornamentColor} />
          <View style={column}>
            <Text style={{ ...titleStyle, marginBottom: 14 }}>{title}</Text>
            <DropCapParagraphs text={page.body} style={bodyStyle} width={colW} color={theme.accent} />
            <View style={{ marginTop: 14, alignItems: "center" }}>
              <OrnamentalDivider color={theme.ornamentColor} width={70} />
            </View>
          </View>
          <PageNumber num={page.pageNumber} />
        </BookPage>
      );

    case "galeria":
    default:
      return (
        <BookPage background={COLORS.cream}>
          <FrameBorder color={theme.ornamentColor} />
          <View style={{ ...column, alignItems: "center" }}>
            <Text style={{ ...titleStyle, textAlign: "center", marginBottom: 12 }}>{title}</Text>
            <OrnamentalDivider color={theme.ornamentColor} width={80} />
            <View style={{ marginTop: 12, width: colW }}>
              <Paragraphs text={page.body} style={{ ...bodyStyle, textAlign: "center" }} />
            </View>
            <View style={{ marginTop: 14 }}>
              <StarCluster color={COLORS.gold} size={24} />
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
  return (
    <BookPage background={COLORS.cream}>
      <FrameBorder color={theme.ornamentColor} />
      <View style={{ position: "absolute", top: M, bottom: M, left: M, right: M, justifyContent: "center", alignItems: "center" }}>
        <Image src={ctx.logoOrnament} style={{ height: 14, width: 14 * BRAND_LOGO_ASPECT, marginBottom: 16, opacity: 0.7 }} />

        <Text style={{ fontFamily: FONTS.display, fontSize: page.titleType.fontSize, fontWeight: 600, color: theme.titleColor, textAlign: "center", lineHeight: page.titleType.leading, maxWidth: GEOMETRY.textColumnWidth }}>
          {page.title}
        </Text>

        <View style={{ marginTop: 10, marginBottom: 10 }}>
          <OrnamentalDivider color={theme.ornamentColor} width={60} />
        </View>

        <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.textMedium, textAlign: "center" }}>{pdfForName(input.locale, "personalizedAdventure", input.characterName, input.characterGender)}</Text>
        <Text style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 600, color: theme.accent, marginTop: 4, textAlign: "center" }}>
          {sanitizePrintText(input.characterName)}
        </Text>

        {page.dedication ? (
          <>
            {/* Heart divider — vector heart (the text fonts have no ♥ glyph) */}
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 20, marginBottom: 20, gap: 8 }}>
              <View style={{ width: 30, height: 0.5, backgroundColor: COLORS.gold, opacity: 0.5 }} />
              <HeartIcon color={COLORS.gold} size={9} opacity={0.7} />
              <View style={{ width: 30, height: 0.5, backgroundColor: COLORS.gold, opacity: 0.5 }} />
            </View>

            <View style={{ alignItems: "center", width: BOOK.trimWidth * 0.62 }}>
              <Paragraphs
                text={page.dedication}
                prefix={quoteOpen}
                suffix={quoteClose}
                style={{ fontFamily: FONTS.body, fontStyle: "italic", fontSize: page.dedicationType.fontSize, color: theme.titleColor, opacity: 0.85, textAlign: "center", lineHeight: page.dedicationType.leading }}
              />
              {page.sender && (
                <Text style={{ fontFamily: FONTS.body, fontSize: 10, color: COLORS.textMuted, marginTop: 8, textAlign: "center" }}>
                  {"—"} {page.sender}
                </Text>
              )}
            </View>
          </>
        ) : null}

        <View style={{ marginTop: 20 }}>
          <StarCluster color={COLORS.gold} size={24} />
        </View>
      </View>
    </BookPage>
  );
}

function EndpapersPage({ theme }: { theme: TemplateTheme }) {
  const SPACING = 20;
  const cols = Math.ceil(W / SPACING) + 1;
  const rows = Math.ceil(H / SPACING) + 1;
  return (
    <BookPage background={theme.coverGradientStart}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.coverGradientEnd, opacity: 0.3 }} />
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          {Array.from({ length: rows }).map((_, r) =>
            Array.from({ length: cols }).map((_, c) => (
              <Circle key={`${r}-${c}`} cx={c * SPACING} cy={r * SPACING} r={0.75} fill="#ffffff" fillOpacity={0.08} />
            )),
          )}
        </Svg>
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
    <BookPage background={COLORS.cream}>
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

/**
 * pp. 28–29 of books without a map: light paper in the theme's tint with a sparse
 * lattice of tiny stars and dots, continuous across the fold (`offsetX` = this
 * page's x in spread coordinates).
 */
function PatternEndpaperPage({ theme, offsetX }: { theme: TemplateTheme; offsetX: number }) {
  const STEP = 38;
  const first = Math.floor(offsetX / STEP) - 1;
  const cols = Math.ceil(W / STEP) + 3;
  const rows = Math.ceil(H / (STEP / 2)) + 2;
  const marks: JSX.Element[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = first; c < first + cols; c++) {
      const x = c * STEP + (r % 2 ? STEP / 2 : 0) - offsetX;
      const y = r * (STEP / 2);
      if (x < -6 || x > W + 6) continue;
      // Stars on every other lattice point, dots between
      if ((r + c) % 2 === 0) {
        const k = 3.2;
        marks.push(<Path key={`${r}-${c}`} d={`M${x} ${y - k} Q${x} ${y} ${x + k} ${y} Q${x} ${y} ${x} ${y + k} Q${x} ${y} ${x - k} ${y} Q${x} ${y} ${x} ${y - k} Z`} fill={theme.ornamentColor} fillOpacity={0.55} />);
      } else {
        marks.push(<Circle key={`${r}-${c}`} cx={x} cy={y} r={0.9} fill={theme.ornamentColor} fillOpacity={0.5} />);
      }
    }
  }
  return (
    <BookPage background={theme.pageTint}>
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
  return (
    <BookPage background={COLORS.cream}>
      <FrameBorder color={theme.ornamentColor} />
      <View style={{ position: "absolute", top: M, bottom: M, left: M, right: M, justifyContent: "center", alignItems: "center" }}>
        <View style={{ alignItems: "center", width: BOOK.trimWidth * 0.7 }}>
          <StarCluster color={COLORS.gold} size={40} />
          <View style={{ marginTop: 20, marginBottom: 20 }}>
            <OrnamentalDivider color={COLORS.gold} width={100} />
          </View>
          <Paragraphs text={page.message} style={{ ...TYPE.finalMessage, textAlign: "center", fontSize: page.messageType.fontSize, lineHeight: page.messageType.leading }} />
          <View style={{ marginTop: 20 }}>
            <WavyDots color={theme.ornamentColor} />
          </View>
          <Text style={{ fontFamily: FONTS.body, fontSize: 9, color: COLORS.textMuted, marginTop: 28, textAlign: "center" }}>
            {joinName(pdfForName(input.locale, "createdFor", input.characterName, input.characterGender), sanitizePrintText(input.characterName))}
          </Text>
          <Text style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: theme.accent, marginTop: 8 }}>{pdfT(input.locale, "end")}</Text>
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

const COLOR_NAMES: Record<string, Record<string, string>> = {
  es: { red: "Rojo", blue: "Azul", green: "Verde", purple: "Morado", orange: "Naranja", yellow: "Amarillo", pink: "Rosa", turquoise: "Turquesa" },
  ca: { red: "Vermell", blue: "Blau", green: "Verd", purple: "Lila", orange: "Taronja", yellow: "Groc", pink: "Rosa", turquoise: "Turquesa" },
  en: { red: "Red", blue: "Blue", green: "Green", purple: "Purple", orange: "Orange", yellow: "Yellow", pink: "Pink", turquoise: "Turquoise" },
  fr: { red: "Rouge", blue: "Bleu", green: "Vert", purple: "Violet", orange: "Orange", yellow: "Jaune", pink: "Rose", turquoise: "Turquoise" },
};

function AboutReaderPage({ ctx }: { ctx: BookRenderContext }) {
  const { theme, input, images } = ctx;
  const { characterAge, characterCity, characterInterests, favoriteColor, favoriteCompanion, futureDream, characterGender } = input;
  const heroLabel = characterGender === "girl" ? pdfT(input.locale, "heroine") : pdfT(input.locale, "hero");
  const locale = input.locale ?? "es";

  const traits: { label: string; icon: "pets" | "palette" | "color"; color?: string }[] = [];
  if (favoriteColor) {
    const colorId = FAVORITE_COLORS.find((c) => c.color === favoriteColor)?.id;
    const label = colorId ? (COLOR_NAMES[locale]?.[colorId] ?? COLOR_NAMES.es[colorId] ?? colorId) : null;
    if (label) traits.push({ label, icon: "color", color: favoriteColor });
  }
  if (favoriteCompanion) traits.push({ label: sanitizePrintText(favoriteCompanion), icon: "pets" });
  if (futureDream) traits.push({ label: sanitizePrintText(futureDream), icon: "palette" });

  return (
    <BookPage background="#ffffff">
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
                <Text style={{ fontFamily: FONTS.body, fontSize: 7, fontWeight: 600, color: theme.accent, letterSpacing: 0.3 }}>{sanitizePrintText(interest)}</Text>
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
    <BookPage background={COLORS.cream}>
      <View style={{ position: "absolute", top: M, bottom: M, left: M, right: M, justifyContent: "center", alignItems: "center" }}>
        <View style={{ alignItems: "center", maxWidth: BOOK.trimWidth * 0.65 }}>
          <Paragraphs text={pdfT(input.locale, "colophonText")} style={{ fontFamily: FONTS.body, fontSize: 10, color: COLORS.textMuted, textAlign: "center", lineHeight: 1.8 }} />
          {qrDataUrl ? (
            <View style={{ marginTop: 20, alignItems: "center", gap: 6 }}>
              <Image src={qrDataUrl} style={{ width: 72, height: 72 }} />
              <Text style={{ fontFamily: FONTS.body, fontSize: 7, color: COLORS.textMuted, letterSpacing: 0.5 }}>meapica.com</Text>
            </View>
          ) : null}
          <View style={{ width: 48, height: 0.5, backgroundColor: COLORS.textLight, marginTop: 16 }} />
          <Text style={{ fontFamily: FONTS.display, fontSize: 12, color: COLORS.textMuted, opacity: 0.6, letterSpacing: 1, marginTop: 12 }}>Meapica</Text>
        </View>
      </View>
    </BookPage>
  );
}

// ── Digital cover / back cover (single 208 mm pages) ─────────────────────

const DIGITAL_FRAME: PanelFrame = {
  art: { left: 0, top: 0, width: W, height: H },
  visible: { left: BOOK.bleed, top: BOOK.bleed, width: BOOK.trimWidth, height: BOOK.trimHeight },
  safe: DIGITAL_COVER_SAFE,
};

function CoverPage({ ctx }: { ctx: BookRenderContext }) {
  return (
    <BookPage background={ctx.theme.coverGradientStart}>
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
    <BookPage background={ctx.theme.coverGradientStart}>
      <BackCoverDesign frame={DIGITAL_FRAME} theme={ctx.theme} texts={ctx.coverTexts} image={backCoverImage(ctx)} logoUri={ctx.logoWhite} />
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
      return <PatternEndpaperPage key={key} theme={ctx.theme} offsetX={page.side === "right" ? GEOMETRY.spreadRightOffset : 0} />;
    case "colophon":
      return <ColophonPage key={key} ctx={ctx} />;
  }
}

/** Interior-only PDF for Gelato — exactly the 30 planned inner pages. */
export function InteriorOnlyPdf({ ctx }: { ctx: BookRenderContext }) {
  return (
    <Document title={ctx.input.story.bookTitle} author="Meapica" creator="Meapica — meapica.com" producer="Meapica">
      {ctx.plan.pages.map((p) => renderPlannedPage(p, ctx))}
    </Document>
  );
}

/** Full digital book (34 pages, same reading order as the printed book). */
export function BookPdf({ ctx }: { ctx: BookRenderContext }) {
  const { input, theme } = ctx;
  return (
    <Document
      title={input.story.bookTitle}
      author="Meapica"
      subject={joinName(pdfForName(input.locale, "personalizedStory", input.characterName, input.characterGender), input.characterName)}
      creator="Meapica — meapica.com"
      producer="Meapica"
    >
      <CoverPage ctx={ctx} />
      <EndpapersPage theme={theme} />
      {ctx.plan.pages.map((p) => renderPlannedPage(p, ctx))}
      <EndpapersPage theme={theme} />
      <BackCoverPage ctx={ctx} />
    </Document>
  );
}

async function renderDocument(element: JSX.Element): Promise<Buffer> {
  // renderToBuffer is typed for <Document> elements only
  return renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);
}

/** Full digital book — user-facing download. */
export async function renderBookPdf(input: BookPdfInput, prepared?: BookRenderContext): Promise<Buffer> {
  const ctx = prepared ?? (await prepareBookRender(input));
  return renderDocument(createElement(BookPdf, { ctx }));
}

/**
 * Interior PDF for Gelato (30 pages). Call validatePrintableBook first —
 * this renderer draws whatever it is given.
 */
export async function renderInteriorPdf(input: BookPdfInput, prepared?: BookRenderContext): Promise<Buffer> {
  const ctx = prepared ?? (await prepareBookRender(input));
  return renderDocument(createElement(InteriorOnlyPdf, { ctx }));
}
