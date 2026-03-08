/**
 * PDF Book Template — Editorial children's book layout
 *
 * 32-page structure: 3 header + 24 content (12 slots × 2) + 5 footer.
 * Content slots can be "scene" (full narrative) or "bridge" (atmospheric transition).
 * The mix depends on the child's age (managed by story-generator.ts).
 *
 * Page map:
 *  1    COVER               Front cover (themed gradient + title)
 *  2    ENDPAPER            Decorative pattern (front)
 *  3    TITLE_DEDICATION    Title + dedication merged into one page
 *  4-27 SCENES              12 content slots × 2 pages each (spreads)
 *  28   FINAL               Final message + "Fin"
 *  29   ABOUT_READER        "About the protagonist" keepsake page
 *  30   COLOPHON            Colophon / credits
 *  31   ENDPAPER            Back endpapers
 *  32   BACK_COVER          Back cover
 *
 * Spread types for SCENES (cycling: galeria → pergamino → ventana):
 *
 * GALERIA:
 *   Page A: Full-bleed illustration + badge + gradient title band at bottom
 *   Page B: Paper white + FrameBorder + pill / title / OrnamentalDivider / text / ornament
 *
 * PERGAMINO:
 *   Page A: accentLight bg + FrameBorder + scene number / title / accent rule / text / WavyLine
 *   Page B: Full-bleed illustration + badge
 *
 * VENTANA:
 *   Page A: Paper white + FrameBorder + drop cap row + rest of text
 *   Page B: Full-bleed illustration + badge + title overlay at bottom
 *
 * Spread type for BRIDGES (atmospheric transitions):
 *
 * PUENTE:
 *   Page A: Full-bleed atmospheric illustration (no text overlay, no badge)
 *   Page B: Colored background + single large evocative sentence centered + ornaments
 *
 * IMPORTANT @react-pdf constraints:
 * - SVGs with full-page dimensions cause page overflow → use View-based borders
 * - Images with position:absolute at 100% size overflow → use flow layout with fixed dimensions
 * - All decorative SVGs must be small (< 150pt) to avoid wrap warnings
 * - Drop caps use flexDirection:"row" (not float) to avoid layout engine issues
 */

import React, { createElement } from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Font,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { BOOK, COLORS, TYPE, FONTS, getTheme, getPdfTextConfig, type TemplateTheme, type PdfTextConfig } from "./theme";
import { OrnamentalDivider, StarCluster, WavyLine } from "./decorations";
import type { GeneratedScene, GeneratedStory } from "@/lib/ai/story-generator";

// ── Font Registration ──────────────────────────────────────────────────────

Font.register({
  family: FONTS.display,
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/fredoka/v17/X7nP4b87HvSqjb_WIi2yDCRwoQ_k7367_B-i2yQag0-mac3O8SLMFg.ttf",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/s/fredoka/v17/X7nP4b87HvSqjb_WIi2yDCRwoQ_k7367_B-i2yQag0-mac3OLyXMFg.ttf",
      fontWeight: 600,
    },
  ],
});

Font.register({
  family: FONTS.body,
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/plusjakartasans/v12/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_qU7NSg.ttf",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/s/plusjakartasans/v12/LDIZaomQNQcsA88c7O9yZ4KMCoOg4KozySKCdSNG9OcqYQ0lCR_Q.ttf",
      fontWeight: 400,
      fontStyle: "italic",
    },
    {
      src: "https://fonts.gstatic.com/s/plusjakartasans/v12/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_d0nNSg.ttf",
      fontWeight: 600,
    },
  ],
});

Font.registerHyphenationCallback((word) => [word]);

// ── Input types ────────────────────────────────────────────────────────────

export interface BookPdfInput {
  story: GeneratedStory;
  templateId: string;
  characterName: string;
  characterAge: number;
  dedicationText: string | null;
  senderName: string | null;
  storyId: string;
  coverImageUrl: string | null;
  illustrations: { sceneNumber: number; imageUrl: string | null }[];
}

// ── Spread assignment ──────────────────────────────────────────────────────
// Each content slot (scene or bridge) produces exactly 2 pages.
// Scenes cycle through galeria → pergamino → ventana.
// Bridges always use the "puente" spread type.

type SpreadType = "galeria" | "pergamino" | "ventana" | "puente";

const SCENE_CYCLE: ("galeria" | "pergamino" | "ventana")[] = [
  "galeria", "pergamino", "ventana",
];

/**
 * Returns the spread type for a given slot.
 * Bridges → always "puente".
 * Scenes → cycle through galeria/pergamino/ventana based on scene index.
 */
function getSpreadType(scene: GeneratedScene, sceneOnlyIndex: number): SpreadType {
  if (scene.type === "bridge") return "puente";
  return SCENE_CYCLE[sceneOnlyIndex % SCENE_CYCLE.length];
}

// ── View-based frame border ────────────────────────────────────────────────
// Replaces SVG PageFrameBorder to avoid page overflow bugs in @react-pdf

function FrameBorder({ color, inset }: { color: string; inset: number }) {
  return (
    <View
      style={{
        position: "absolute",
        top: inset,
        left: inset,
        right: inset,
        bottom: inset,
        borderWidth: 0.75,
        borderColor: color,
        borderRadius: 6,
        opacity: 0.4,
      }}
    />
  );
}

// ── Small corner dots (replaces CornerFlourish SVG) ────────────────────────

function CornerDot({ color, top, left, right, bottom }: {
  color: string;
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
}) {
  return (
    <View
      style={{
        position: "absolute",
        top,
        left,
        right,
        bottom,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: color,
        opacity: 0.3,
      }}
    />
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    width: BOOK.pageWidth,
    height: BOOK.pageHeight,
    position: "relative",
  },

  // Cover
  coverContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: BOOK.contentMargin + 10,
  },

  // Page number
  pageNumberWrap: {
    position: "absolute",
    bottom: BOOK.bleed + 10,
    left: 0,
    right: 0,
    alignItems: "center",
  },
});

// ── Page number component ─────────────────────────────────────────────────

function PageNumber({ num, color }: { num: number; color?: string }) {
  return (
    <View style={s.pageNumberWrap}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 12, height: 0.5, backgroundColor: color || COLORS.textLight }} />
        <Text style={[TYPE.pageNumber, color ? { color } : {}]}>{num}</Text>
        <View style={{ width: 12, height: 0.5, backgroundColor: color || COLORS.textLight }} />
      </View>
    </View>
  );
}

// ── Full-bleed illustration helper ─────────────────────────────────────────
// Used in multiple spreads. Image fills the page via flow layout.

function FullBleedImage({ imageUrl, sceneNumber }: { imageUrl: string | null; sceneNumber: number }) {
  if (imageUrl) {
    return (
      <View style={{ width: BOOK.pageWidth, height: BOOK.pageHeight }}>
        <Image
          src={imageUrl}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </View>
    );
  }
  return (
    <View style={{ width: BOOK.pageWidth, height: BOOK.pageHeight, backgroundColor: COLORS.cream, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.textMuted }}>
        Scene {sceneNumber}
      </Text>
    </View>
  );
}

// ── Scene number pill ──────────────────────────────────────────────────────

function SceneBadge({ num, top, left, right, color }: {
  num: number; top: number; left?: number; right?: number; color: string;
}) {
  return (
    <View style={{
      position: "absolute",
      top,
      left,
      right,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: color,
      justifyContent: "center",
      alignItems: "center",
    }}>
      <Text style={{ fontFamily: FONTS.display, fontSize: 11, color: "#ffffff", fontWeight: 600 }}>{num}</Text>
    </View>
  );
}

// ── Document ───────────────────────────────────────────────────────────────

export function BookPdf({ input }: { input: BookPdfInput }) {
  const theme = getTheme(input.templateId);
  const { story } = input;
  const tc = getPdfTextConfig(input.characterAge);

  // Build content pages — each slot (scene or bridge) produces exactly 2 pages
  const scenePages: React.JSX.Element[] = [];
  let pageCounter = 4; // First content page starts at page 4 (after 3 header pages)
  let sceneOnlyIndex = 0; // Counter for scenes only (used for spread cycling)

  story.scenes.forEach((scene) => {
    const illustration = input.illustrations.find(
      (ill) => ill.sceneNumber === scene.sceneNumber,
    );
    const imageUrl = illustration?.imageUrl ?? null;
    const spreadType = getSpreadType(scene, sceneOnlyIndex);

    if (spreadType === "puente") {
      scenePages.push(
        <SpreadPuenteA key={`pu-a-${scene.sceneNumber}`} theme={theme} scene={scene} imageUrl={imageUrl} pageNumber={pageCounter} />,
      );
      pageCounter++;
      scenePages.push(
        <SpreadPuenteB key={`pu-b-${scene.sceneNumber}`} theme={theme} scene={scene} pageNumber={pageCounter} tc={tc} />,
      );
      pageCounter++;
    } else if (spreadType === "galeria") {
      scenePages.push(
        <SpreadGaleriaA key={`ga-a-${scene.sceneNumber}`} theme={theme} scene={scene} imageUrl={imageUrl} pageNumber={pageCounter} />,
      );
      pageCounter++;
      scenePages.push(
        <SpreadGaleriaB key={`ga-b-${scene.sceneNumber}`} theme={theme} scene={scene} pageNumber={pageCounter} tc={tc} />,
      );
      pageCounter++;
      sceneOnlyIndex++;
    } else if (spreadType === "pergamino") {
      scenePages.push(
        <SpreadPergaminoA key={`pe-a-${scene.sceneNumber}`} theme={theme} scene={scene} pageNumber={pageCounter} tc={tc} />,
      );
      pageCounter++;
      scenePages.push(
        <SpreadPergaminoB key={`pe-b-${scene.sceneNumber}`} theme={theme} scene={scene} imageUrl={imageUrl} pageNumber={pageCounter} />,
      );
      pageCounter++;
      sceneOnlyIndex++;
    } else {
      // ventana
      scenePages.push(
        <SpreadVentanaA key={`ve-a-${scene.sceneNumber}`} theme={theme} scene={scene} pageNumber={pageCounter} tc={tc} />,
      );
      pageCounter++;
      scenePages.push(
        <SpreadVentanaB key={`ve-b-${scene.sceneNumber}`} theme={theme} scene={scene} imageUrl={imageUrl} pageNumber={pageCounter} />,
      );
      pageCounter++;
      sceneOnlyIndex++;
    }
  });

  return (
    <Document
      title={story.bookTitle}
      author="Meapica"
      subject={`Cuento personalizado para ${input.characterName}`}
      creator="Meapica — meapica.com"
    >
      {/* 1. Cover */}
      <CoverPage theme={theme} title={story.bookTitle} characterName={input.characterName} coverImageUrl={input.coverImageUrl} />
      {/* 2. Front Endpapers */}
      <EndpapersPage theme={theme} />
      {/* 3. Title + Dedication (merged) */}
      <TitleDedicationPage theme={theme} title={story.bookTitle} characterName={input.characterName} dedicationText={story.dedication} senderName={input.senderName} />
      {/* 4-27. Scenes (12 × 2 pages each) */}
      {scenePages}
      {/* 28. Final message */}
      <FinalPage theme={theme} message={story.finalMessage} characterName={input.characterName} />
      {/* 29. About the reader — keepsake page */}
      <AboutReaderPage theme={theme} characterName={input.characterName} characterAge={input.characterAge} />
      {/* 30. Colophon */}
      <ColophonPage theme={theme} storyId={input.storyId} />
      {/* 31. Back Endpapers */}
      <EndpapersPage theme={theme} />
      {/* 32. Back cover */}
      <BackCoverPage theme={theme} characterName={input.characterName} />
    </Document>
  );
}

// ── Render helpers ────────────────────────────────────────────────────────

/** Full 32-page PDF — used for user-facing download */
export async function renderBookPdf(input: BookPdfInput): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = createElement(BookPdf as any, { input });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(element as any);
}

/**
 * Interior-only PDF for Gelato — pages 2–31 (30 inner pages).
 * Submitted as `type: "inside"` in the Gelato order.
 * Excludes the front cover (page 1) and back cover (page 32) which go
 * in the cover spread file instead.
 */
export function InteriorOnlyPdf({ input }: { input: BookPdfInput }) {
  const theme = getTheme(input.templateId);
  const { story } = input;
  const tc = getPdfTextConfig(input.characterAge);

  const scenePages: React.JSX.Element[] = [];
  let pageCounter = 4;
  let sceneOnlyIndex = 0;

  story.scenes.forEach((scene) => {
    const illustration = input.illustrations.find(
      (ill) => ill.sceneNumber === scene.sceneNumber,
    );
    const imageUrl = illustration?.imageUrl ?? null;
    const spreadType = getSpreadType(scene, sceneOnlyIndex);

    if (spreadType === "puente") {
      scenePages.push(<SpreadPuenteA key={`pu-a-${scene.sceneNumber}`} theme={theme} scene={scene} imageUrl={imageUrl} pageNumber={pageCounter} />);
      pageCounter++;
      scenePages.push(<SpreadPuenteB key={`pu-b-${scene.sceneNumber}`} theme={theme} scene={scene} pageNumber={pageCounter} tc={tc} />);
      pageCounter++;
    } else if (spreadType === "galeria") {
      scenePages.push(<SpreadGaleriaA key={`ga-a-${scene.sceneNumber}`} theme={theme} scene={scene} imageUrl={imageUrl} pageNumber={pageCounter} />);
      pageCounter++;
      scenePages.push(<SpreadGaleriaB key={`ga-b-${scene.sceneNumber}`} theme={theme} scene={scene} pageNumber={pageCounter} tc={tc} />);
      pageCounter++;
      sceneOnlyIndex++;
    } else if (spreadType === "pergamino") {
      scenePages.push(<SpreadPergaminoA key={`pe-a-${scene.sceneNumber}`} theme={theme} scene={scene} pageNumber={pageCounter} tc={tc} />);
      pageCounter++;
      scenePages.push(<SpreadPergaminoB key={`pe-b-${scene.sceneNumber}`} theme={theme} scene={scene} imageUrl={imageUrl} pageNumber={pageCounter} />);
      pageCounter++;
      sceneOnlyIndex++;
    } else {
      scenePages.push(<SpreadVentanaA key={`ve-a-${scene.sceneNumber}`} theme={theme} scene={scene} pageNumber={pageCounter} tc={tc} />);
      pageCounter++;
      scenePages.push(<SpreadVentanaB key={`ve-b-${scene.sceneNumber}`} theme={theme} scene={scene} imageUrl={imageUrl} pageNumber={pageCounter} />);
      pageCounter++;
      sceneOnlyIndex++;
    }
  });

  return (
    <Document creator="Meapica — meapica.com">
      {/* Page 2 — Front Endpapers */}
      <EndpapersPage theme={theme} />
      {/* Page 3 — Title + Dedication */}
      <TitleDedicationPage theme={theme} title={story.bookTitle} characterName={input.characterName} dedicationText={story.dedication} senderName={input.senderName} />
      {/* Pages 4–27 — Scenes (12 × 2 pages) */}
      {scenePages}
      {/* Page 28 — Final message */}
      <FinalPage theme={theme} message={story.finalMessage} characterName={input.characterName} />
      {/* Page 29 — About the reader */}
      <AboutReaderPage theme={theme} characterName={input.characterName} characterAge={input.characterAge} />
      {/* Page 30 — Colophon */}
      <ColophonPage theme={theme} storyId={input.storyId} />
      {/* Page 31 — Back Endpapers */}
      <EndpapersPage theme={theme} />
    </Document>
  );
}

export async function renderInteriorPdf(input: BookPdfInput): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = createElement(InteriorOnlyPdf as any, { input });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(element as any);
}

/**
 * Cover spread PDF for Gelato — one wide page containing:
 *   [ back cover ] [ spine strip ] [ front cover ]
 * Submitted as `type: "default"` in the Gelato order.
 *
 * @param coverWidthPt  Total spread width in PDF points (from Gelato cover-dimensions API)
 * @param coverHeightPt Total spread height in PDF points (from Gelato cover-dimensions API)
 * @param spineWidthPt  Spine width in PDF points
 */
export function CoverSpreadPdf({
  input,
  coverWidthPt,
  coverHeightPt,
  spineWidthPt,
}: {
  input: BookPdfInput;
  coverWidthPt: number;
  coverHeightPt: number;
  spineWidthPt: number;
}) {
  const theme = getTheme(input.templateId);
  const { story } = input;

  // Each cover panel = (totalWidth - spine) / 2
  const panelWidth = (coverWidthPt - spineWidthPt) / 2;

  return (
    <Document creator="Meapica — meapica.com">
      <Page size={[coverWidthPt, coverHeightPt]} style={{ flexDirection: "row" }}>

        {/* ── Back cover (left panel) ── */}
        <View style={{ width: panelWidth, height: coverHeightPt, backgroundColor: theme.coverGradientStart, justifyContent: "center", alignItems: "center", padding: BOOK.contentMargin + 20 }}>
          <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: "#ffffffbb", textAlign: "center", lineHeight: 1.7 }}>
            Esta historia fue creada especialmente para
          </Text>
          <Text style={{ fontFamily: FONTS.display, fontSize: 20, fontWeight: 600, color: "#ffffff", marginTop: 8, textAlign: "center" }}>
            {input.characterName}
          </Text>
          <View style={{ width: 40, height: 1, backgroundColor: "#ffffff33", marginVertical: 14 }} />
          <Text style={{ fontFamily: FONTS.display, fontSize: 9, color: "#ffffff88", letterSpacing: 3 }}>
            MEAPICA
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 7, color: "#ffffff55", marginTop: 4, letterSpacing: 1 }}>
            meapica.com
          </Text>
          {/* Colophon */}
          <View style={{ position: "absolute", bottom: BOOK.contentMargin + 10, left: BOOK.contentMargin, right: BOOK.contentMargin, alignItems: "center" }}>
            <Text style={{ fontFamily: FONTS.body, fontSize: 6, color: "#ffffff44", textAlign: "center", lineHeight: 1.7 }}>
              Texto e ilustraciones creados exclusivamente para este libro.{"\n"}
              Dise{"\u00F1"}o editorial por Meapica — meapica.com
            </Text>
          </View>
        </View>

        {/* ── Spine ── */}
        <View style={{ width: spineWidthPt, height: coverHeightPt, backgroundColor: theme.coverGradientEnd, justifyContent: "center", alignItems: "center" }}>
          {/* Rotate spine text 90° via nested flex trick */}
          <View style={{ width: coverHeightPt * 0.6, height: spineWidthPt, justifyContent: "space-between", alignItems: "center", flexDirection: "row", transform: "rotate(-90deg)" }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 7, color: "#ffffffaa", letterSpacing: 1 }}>
              MEAPICA
            </Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 8, fontWeight: 600, color: "#ffffff", maxWidth: coverHeightPt * 0.4 }}>
              {story.bookTitle}
            </Text>
          </View>
        </View>

        {/* ── Front cover (right panel) ── */}
        <View style={{ width: panelWidth, height: coverHeightPt, backgroundColor: theme.coverGradientStart, justifyContent: "center", alignItems: "center", padding: BOOK.contentMargin + 10 }}>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.coverGradientEnd, opacity: 0.4 }} />
          <CornerDot color="#ffffff" top={BOOK.contentMargin} right={BOOK.contentMargin} />
          <CornerDot color="#ffffff" bottom={BOOK.contentMargin + 30} left={BOOK.contentMargin} />
          <View style={{ alignItems: "center", maxWidth: panelWidth * 0.75 }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 10, color: "#ffffff88", letterSpacing: 3 }}>
              MEAPICA
            </Text>
            <View style={{ width: 40, height: 1, backgroundColor: "#ffffff44", marginVertical: 16 }} />
            <Text style={{ fontFamily: FONTS.display, fontSize: 26, fontWeight: 600, color: "#ffffff", textAlign: "center", lineHeight: 1.3 }}>
              {story.bookTitle}
            </Text>
            <View style={{ width: 40, height: 1, backgroundColor: "#ffffff44", marginVertical: 16 }} />
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: "#ffffffcc", textAlign: "center" }}>
              Una historia personalizada para
            </Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 20, fontWeight: 600, color: "#ffffff", marginTop: 6, textAlign: "center" }}>
              {input.characterName}
            </Text>
          </View>
        </View>

      </Page>
    </Document>
  );
}

export async function renderCoverSpreadPdf(
  input: BookPdfInput,
  coverWidthMm: number,
  coverHeightMm: number,
  spineWidthMm: number,
): Promise<Buffer> {
  const MM_TO_PT = 2.83465;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = createElement(CoverSpreadPdf as any, {
    input,
    coverWidthPt: coverWidthMm * MM_TO_PT,
    coverHeightPt: coverHeightMm * MM_TO_PT,
    spineWidthPt: spineWidthMm * MM_TO_PT,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(element as any);
}

// ══════════════════════════════════════════════════════════════════════════
// STRUCTURAL PAGES
// ══════════════════════════════════════════════════════════════════════════

// ── Cover Page ──────────────────────────────────────────────────────────

function CoverPage({ theme, title, characterName, coverImageUrl }: { theme: TemplateTheme; title: string; characterName: string; coverImageUrl: string | null }) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={s.page}>
      {/* Background: cover illustration or gradient fallback */}
      {coverImageUrl ? (
        <>
          <Image src={coverImageUrl} style={{ position: "absolute", top: 0, left: 0, width: BOOK.pageWidth, height: BOOK.pageHeight, objectFit: "cover" }} />
          {/* Dark overlay for text readability */}
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#000000", opacity: 0.35 }} />
        </>
      ) : (
        <>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.coverGradientStart }} />
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.coverGradientEnd, opacity: 0.4 }} />
        </>
      )}

      {/* Decorative dots in corners */}
      <CornerDot color="#ffffff" top={BOOK.contentMargin} right={BOOK.contentMargin} />
      <CornerDot color="#ffffff" top={BOOK.contentMargin} right={BOOK.contentMargin + 14} />
      <CornerDot color="#ffffff" bottom={BOOK.contentMargin + 30} left={BOOK.contentMargin} />

      <View style={s.coverContent}>
        <Text style={{ fontFamily: FONTS.display, fontSize: 10, color: "#ffffff88", letterSpacing: 3 }}>
          MEAPICA
        </Text>

        <View style={{ width: 50, height: 1, backgroundColor: "#ffffff44", marginVertical: 20 }} />

        <View style={{ alignItems: "center", maxWidth: BOOK.trimWidth * 0.75 }}>
          <Text style={[TYPE.coverTitle, { textAlign: "center" }]}>{title}</Text>
        </View>

        <View style={{ width: 50, height: 1, backgroundColor: "#ffffff44", marginVertical: 20 }} />

        <Text style={[TYPE.coverSubtitle, { textAlign: "center" }]}>
          Una historia personalizada para
        </Text>
        <Text style={[TYPE.coverTitle, { fontSize: 22, marginTop: 6, textAlign: "center" }]}>
          {characterName}
        </Text>

        <View style={{ marginTop: 40 }}>
          <OrnamentalDivider color="#ffffff88" width={100} />
        </View>
      </View>
    </Page>
  );
}

// ── Endpapers ───────────────────────────────────────────────────────────

function EndpapersPage({ theme }: { theme: TemplateTheme }) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={[s.page, { backgroundColor: theme.accentLight }]}>
      {/* Corner dots */}
      <CornerDot color={theme.accent} top={24} left={24} />
      <CornerDot color={theme.accent} top={24} right={24} />
      <CornerDot color={theme.accent} bottom={24} left={24} />
      <CornerDot color={theme.accent} bottom={24} right={24} />

      {/* Subtle pattern: grid of small dots */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center" }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", width: BOOK.trimWidth * 0.6, justifyContent: "center", gap: 24 }}>
          {Array.from({ length: 25 }).map((_, i) => (
            <View
              key={i}
              style={{
                width: 4,
                height: 4,
                borderRadius: 2,
                backgroundColor: theme.accent,
                opacity: 0.15 + (i % 3) * 0.05,
              }}
            />
          ))}
        </View>
      </View>

      {/* Center ornament */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center" }}>
        <StarCluster color={theme.accent} size={35} />
        <View style={{ marginTop: 8 }}>
          <WavyLine color={theme.ornamentColor} width={80} />
        </View>
      </View>
    </Page>
  );
}

// ── Title + Dedication Page (merged) ─────────────────────────────────────

function TitleDedicationPage({ theme, title, characterName, dedicationText, senderName }: {
  theme: TemplateTheme; title: string; characterName: string; dedicationText: string; senderName: string | null;
}) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={[s.page, { backgroundColor: COLORS.paper }]}>
      <FrameBorder color={theme.ornamentColor} inset={BOOK.contentMargin - 5} />

      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: BOOK.contentMargin + 15 }}>
        {/* Brand */}
        <Text style={{ fontFamily: FONTS.display, fontSize: 9, color: COLORS.textMuted, letterSpacing: 2, marginBottom: 16 }}>
          MEAPICA PRESENTA
        </Text>

        {/* Title */}
        <Text style={{ fontFamily: FONTS.display, fontSize: 26, fontWeight: 600, color: theme.titleColor, textAlign: "center", lineHeight: 1.3 }}>
          {title}
        </Text>

        <View style={{ marginTop: 10, marginBottom: 10 }}>
          <WavyLine color={theme.ornamentColor} width={60} />
        </View>

        <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.textMedium, textAlign: "center" }}>
          Una aventura personalizada para
        </Text>
        <Text style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 600, color: theme.accent, marginTop: 4, textAlign: "center" }}>
          {characterName}
        </Text>

        {/* Heart divider */}
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 20, marginBottom: 20, gap: 8 }}>
          <View style={{ width: 30, height: 0.5, backgroundColor: COLORS.gold, opacity: 0.5 }} />
          <Text style={{ fontFamily: FONTS.body, fontSize: 10, color: COLORS.gold, opacity: 0.6 }}>{"\u2665"}</Text>
          <View style={{ width: 30, height: 0.5, backgroundColor: COLORS.gold, opacity: 0.5 }} />
        </View>

        {/* Dedication */}
        <View style={{ alignItems: "center", maxWidth: BOOK.trimWidth * 0.6 }}>
          <Text style={{ fontFamily: FONTS.body, fontStyle: "italic", fontSize: 12, color: COLORS.textMedium, textAlign: "center", lineHeight: 1.8 }}>
            {dedicationText}
          </Text>

          {senderName && (
            <Text style={{ fontFamily: FONTS.body, fontSize: 10, color: COLORS.textMuted, marginTop: 8, textAlign: "center" }}>
              {"\u2014"} {senderName}
            </Text>
          )}
        </View>

        <View style={{ marginTop: 20 }}>
          <StarCluster color={COLORS.gold} size={24} />
        </View>
      </View>
    </Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// SPREAD LAYOUTS
// ══════════════════════════════════════════════════════════════════════════

// ── GALERIA spread ──────────────────────────────────────────────────────
// Page A: full-bleed illustration + badge top-left + gradient title band at bottom
// Page B: paper white + FrameBorder + pill / title / divider / text / ornament

function SpreadGaleriaA({ theme, scene, imageUrl, pageNumber }: {
  theme: TemplateTheme; scene: GeneratedScene; imageUrl: string | null; pageNumber: number;
}) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={s.page}>
      {/* Full-bleed illustration */}
      <FullBleedImage imageUrl={imageUrl} sceneNumber={scene.sceneNumber} />

      {/* Gradient band at bottom with title */}
      <View style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        paddingTop: 28,
        paddingBottom: BOOK.contentMargin + 10,
        paddingHorizontal: BOOK.contentMargin,
        backgroundColor: "rgba(0,0,0,0.42)",
      }}>
        <Text style={{ fontFamily: FONTS.display, fontSize: 20, fontWeight: 600, color: "#ffffff", lineHeight: 1.3 }}>
          {scene.title}
        </Text>
      </View>

      {/* Scene number badge — top-left */}
      <SceneBadge num={scene.sceneNumber} top={BOOK.contentMargin} left={BOOK.contentMargin} color={theme.accent} />

      <PageNumber num={pageNumber} color="#ffffff88" />
    </Page>
  );
}

function SpreadGaleriaB({ theme, scene, pageNumber, tc }: {
  theme: TemplateTheme; scene: GeneratedScene; pageNumber: number; tc: PdfTextConfig;
}) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={[s.page, { backgroundColor: COLORS.paper }]}>
      <FrameBorder color={theme.ornamentColor} inset={BOOK.contentMargin - 5} />

      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: BOOK.contentMargin + 15 }}>
        <View style={{ alignItems: "center", maxWidth: BOOK.trimWidth * 0.78 }}>
          {/* Small scene number pill */}
          <View style={{
            backgroundColor: theme.accentLight,
            borderRadius: 10,
            paddingHorizontal: 10,
            paddingVertical: 3,
            marginBottom: 14,
          }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 9, color: theme.accent, letterSpacing: 1 }}>
              {scene.sceneNumber}
            </Text>
          </View>

          {/* Title */}
          <Text style={{ fontFamily: FONTS.display, fontSize: tc.title, fontWeight: 600, color: theme.titleColor, textAlign: "center", lineHeight: 1.3, marginBottom: 16 }}>
            {scene.title}
          </Text>

          <OrnamentalDivider color={theme.ornamentColor} width={80} />

          {/* Text */}
          <Text style={{ fontFamily: FONTS.body, fontSize: tc.body, color: COLORS.textDark, lineHeight: tc.bodyLeading, textAlign: "center", marginTop: 16 }}>
            {scene.text}
          </Text>

          {/* Bottom ornament */}
          <View style={{ marginTop: 20 }}>
            <StarCluster color={COLORS.gold} size={24} />
          </View>
        </View>
      </View>

      <PageNumber num={pageNumber} />
    </Page>
  );
}

// ── PERGAMINO spread ────────────────────────────────────────────────────
// Page A: accentLight bg + FrameBorder + scene number / title / accent rule / text / WavyLine
// Page B: full-bleed illustration + badge top-right

function SpreadPergaminoA({ theme, scene, pageNumber, tc }: {
  theme: TemplateTheme; scene: GeneratedScene; pageNumber: number; tc: PdfTextConfig;
}) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={[s.page, { backgroundColor: theme.accentLight }]}>
      <FrameBorder color={theme.ornamentColor} inset={BOOK.contentMargin - 5} />

      <View style={{ flex: 1, justifyContent: "center", padding: BOOK.contentMargin + 12 }}>
        {/* Small scene number */}
        <Text style={{ fontFamily: FONTS.display, fontSize: 11, color: theme.ornamentColor, letterSpacing: 2, marginBottom: 10 }}>
          {String(scene.sceneNumber).padStart(2, "0")}
        </Text>

        {/* Title */}
        <Text style={{ fontFamily: FONTS.display, fontSize: tc.title, fontWeight: 600, color: theme.titleColor, lineHeight: 1.3, marginBottom: 14 }}>
          {scene.title}
        </Text>

        {/* Thick accent rule */}
        <View style={{ width: BOOK.trimWidth * 0.35, height: 3, backgroundColor: theme.accent, borderRadius: 2, marginBottom: 18, opacity: 0.8 }} />

        {/* Text */}
        <Text style={{ fontFamily: FONTS.body, fontSize: tc.body, color: COLORS.textDark, lineHeight: tc.bodyLeading }}>
          {scene.text}
        </Text>

        {/* Bottom WavyLine */}
        <View style={{ marginTop: 24 }}>
          <WavyLine color={theme.ornamentColor} width={60} />
        </View>
      </View>

      <PageNumber num={pageNumber} />
    </Page>
  );
}

function SpreadPergaminoB({ theme, scene, imageUrl, pageNumber }: {
  theme: TemplateTheme; scene: GeneratedScene; imageUrl: string | null; pageNumber: number;
}) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={s.page}>
      {/* Full-bleed illustration */}
      <FullBleedImage imageUrl={imageUrl} sceneNumber={scene.sceneNumber} />

      {/* Scene number badge — top-right */}
      <SceneBadge num={scene.sceneNumber} top={BOOK.contentMargin} right={BOOK.contentMargin} color={theme.accent} />

      <PageNumber num={pageNumber} color="#ffffff88" />
    </Page>
  );
}

// ── VENTANA spread ──────────────────────────────────────────────────────
// Page A: paper white + FrameBorder + drop cap row + rest of text
// Page B: full-bleed illustration + badge top-left + title overlay at bottom

function SpreadVentanaA({ theme, scene, pageNumber, tc }: {
  theme: TemplateTheme; scene: GeneratedScene; pageNumber: number; tc: PdfTextConfig;
}) {
  // Split text: first character is the drop cap, rest is the body
  const firstChar = scene.text.charAt(0);
  const restText = scene.text.slice(1);

  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={[s.page, { backgroundColor: COLORS.paper }]}>
      <FrameBorder color={theme.ornamentColor} inset={BOOK.contentMargin - 5} />

      <View style={{ flex: 1, justifyContent: "center", padding: BOOK.contentMargin + 15 }}>
        {/* Scene title above text block */}
        <Text style={{ fontFamily: FONTS.display, fontSize: tc.title, fontWeight: 600, color: theme.titleColor, marginBottom: 18, lineHeight: 1.3 }}>
          {scene.title}
        </Text>

        {/* Drop cap row layout — avoids float, safe in @react-pdf */}
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          {/* Drop cap letter */}
          <View style={{ marginRight: 6, marginTop: 2 }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: tc.dropCap, fontWeight: 600, color: theme.accent, lineHeight: 1 }}>
              {firstChar}
            </Text>
          </View>

          {/* Rest of the text */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONTS.body, fontSize: tc.body, color: COLORS.textDark, lineHeight: tc.bodyLeading }}>
              {restText}
            </Text>
          </View>
        </View>

        {/* Bottom ornament */}
        <View style={{ marginTop: 20 }}>
          <OrnamentalDivider color={theme.ornamentColor} width={70} />
        </View>
      </View>

      <PageNumber num={pageNumber} />
    </Page>
  );
}

function SpreadVentanaB({ theme, scene, imageUrl, pageNumber }: {
  theme: TemplateTheme; scene: GeneratedScene; imageUrl: string | null; pageNumber: number;
}) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={s.page}>
      {/* Full-bleed illustration */}
      <FullBleedImage imageUrl={imageUrl} sceneNumber={scene.sceneNumber} />

      {/* Scene number badge — top-left */}
      <SceneBadge num={scene.sceneNumber} top={BOOK.contentMargin} left={BOOK.contentMargin} color={theme.accent} />

      {/* Title overlay at bottom */}
      <View style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        paddingTop: 28,
        paddingBottom: BOOK.contentMargin + 10,
        paddingHorizontal: BOOK.contentMargin,
        backgroundColor: "rgba(0,0,0,0.42)",
      }}>
        <Text style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 600, color: "#ffffff", lineHeight: 1.3 }}>
          {scene.title}
        </Text>
      </View>

      <PageNumber num={pageNumber} color="#ffffff88" />
    </Page>
  );
}

// ── PUENTE spread (bridge / atmospheric transition) ─────────────────────
// Page A: Full-bleed atmospheric illustration (no badge, no text overlay)
// Page B: Colored background + single evocative sentence centered large

function SpreadPuenteA({ theme, scene, imageUrl, pageNumber }: {
  theme: TemplateTheme; scene: GeneratedScene; imageUrl: string | null; pageNumber: number;
}) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={s.page}>
      {/* Full-bleed atmospheric illustration — no overlay, purely visual */}
      <FullBleedImage imageUrl={imageUrl} sceneNumber={scene.sceneNumber} />
      <PageNumber num={pageNumber} color="#ffffff88" />
    </Page>
  );
}

function SpreadPuenteB({ theme, scene, pageNumber, tc }: {
  theme: TemplateTheme; scene: GeneratedScene; pageNumber: number; tc: PdfTextConfig;
}) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={[s.page, { backgroundColor: theme.accentLight }]}>
      <FrameBorder color={theme.ornamentColor} inset={BOOK.contentMargin - 5} />

      {/* Corner dots for visual warmth */}
      <CornerDot color={theme.accent} top={BOOK.contentMargin + 4} left={BOOK.contentMargin + 4} />
      <CornerDot color={theme.accent} top={BOOK.contentMargin + 4} right={BOOK.contentMargin + 4} />
      <CornerDot color={theme.accent} bottom={BOOK.contentMargin + 4} left={BOOK.contentMargin + 4} />
      <CornerDot color={theme.accent} bottom={BOOK.contentMargin + 4} right={BOOK.contentMargin + 4} />

      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: BOOK.contentMargin + 30 }}>
        <View style={{ alignItems: "center", maxWidth: BOOK.trimWidth * 0.7 }}>
          <OrnamentalDivider color={theme.ornamentColor} width={60} />

          {/* Single evocative sentence — large display typography */}
          <Text style={{
            fontFamily: FONTS.display,
            fontSize: tc.bridgeText,
            fontWeight: 600,
            color: theme.titleColor,
            textAlign: "center",
            lineHeight: 1.5,
            marginTop: 28,
            marginBottom: 28,
          }}>
            {scene.text}
          </Text>

          <WavyLine color={theme.ornamentColor} width={60} />
        </View>
      </View>

      <PageNumber num={pageNumber} />
    </Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// CLOSING PAGES
// ══════════════════════════════════════════════════════════════════════════

// ── Final Message ───────────────────────────────────────────────────────

function FinalPage({ theme, message, characterName }: { theme: TemplateTheme; message: string; characterName: string }) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={[s.page, { backgroundColor: COLORS.paper }]}>
      <FrameBorder color={theme.ornamentColor} inset={BOOK.contentMargin - 5} />

      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: BOOK.contentMargin + 20 }}>
        <View style={{ alignItems: "center", maxWidth: BOOK.trimWidth * 0.7 }}>
          <StarCluster color={COLORS.gold} size={40} />

          <View style={{ marginTop: 20, marginBottom: 20 }}>
            <OrnamentalDivider color={COLORS.gold} width={100} />
          </View>

          <Text style={[TYPE.finalMessage, { textAlign: "center" }]}>{message}</Text>

          <View style={{ marginTop: 20 }}>
            <WavyLine color={theme.ornamentColor} width={80} />
          </View>

          <Text style={{ fontFamily: FONTS.body, fontSize: 9, color: COLORS.textMuted, marginTop: 28, textAlign: "center" }}>
            Una historia creada con cari{"\u00F1"}o para {characterName}
          </Text>

          <Text style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: theme.accent, marginTop: 8 }}>Fin</Text>
        </View>
      </View>
    </Page>
  );
}

// ── About the Reader (keepsake) ──────────────────────────────────────────

function AboutReaderPage({ theme, characterName, characterAge }: {
  theme: TemplateTheme; characterName: string; characterAge: number;
}) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={[s.page, { backgroundColor: COLORS.paper }]}>
      <FrameBorder color={theme.ornamentColor} inset={BOOK.contentMargin - 5} />

      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: BOOK.contentMargin + 20 }}>
        <View style={{ alignItems: "center", maxWidth: BOOK.trimWidth * 0.7 }}>
          <Text style={{ fontFamily: FONTS.display, fontSize: 9, color: COLORS.textMuted, letterSpacing: 2, marginBottom: 16 }}>
            SOBRE EL PROTAGONISTA
          </Text>

          <OrnamentalDivider color={theme.ornamentColor} width={80} />

          <Text style={{ fontFamily: FONTS.display, fontSize: 24, fontWeight: 600, color: theme.accent, marginTop: 20, textAlign: "center" }}>
            {characterName}
          </Text>

          <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.textMedium, marginTop: 8, textAlign: "center" }}>
            {characterAge} a{"\u00F1"}os
          </Text>

          <View style={{ marginTop: 24, marginBottom: 24 }}>
            <WavyLine color={theme.ornamentColor} width={60} />
          </View>

          <Text style={{ fontFamily: FONTS.body, fontStyle: "italic", fontSize: 11, color: COLORS.textMedium, textAlign: "center", lineHeight: 1.8 }}>
            Este libro fue creado especialmente para ti.{"\n"}
            Recuerda siempre que eres capaz de vivir{"\n"}
            las aventuras m{"\u00E1"}s incre{"\u00ED"}bles.
          </Text>

          <View style={{ marginTop: 28 }}>
            <StarCluster color={COLORS.gold} size={30} />
          </View>

          {/* Space for the child to draw or write */}
          <View style={{
            marginTop: 20,
            width: BOOK.trimWidth * 0.5,
            height: 60,
            borderWidth: 0.5,
            borderColor: theme.ornamentColor,
            borderStyle: "dashed",
            borderRadius: 8,
            justifyContent: "center",
            alignItems: "center",
            opacity: 0.5,
          }}>
            <Text style={{ fontFamily: FONTS.body, fontSize: 7, color: COLORS.textLight }}>
              Dibuja aqu{"\u00ED"} tu momento favorito
            </Text>
          </View>
        </View>
      </View>
    </Page>
  );
}

// ── Colophon Page ──────────────────────────────────────────────────────

function ColophonPage({ theme, storyId }: { theme: TemplateTheme; storyId: string }) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={[s.page, { backgroundColor: COLORS.paper }]}>
      <FrameBorder color={theme.ornamentColor} inset={BOOK.contentMargin - 5} />

      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: BOOK.contentMargin + 30 }}>
        <View style={{ alignItems: "center", maxWidth: BOOK.trimWidth * 0.65 }}>
          <Text style={{ fontFamily: FONTS.display, fontSize: 9, color: COLORS.textMuted, letterSpacing: 2, marginBottom: 16 }}>
            MEAPICA PRESS
          </Text>

          <OrnamentalDivider color={theme.ornamentColor} width={70} />

          <Text style={{ fontFamily: FONTS.body, fontSize: 8, color: COLORS.textMuted, textAlign: "center", lineHeight: 1.8, marginTop: 20 }}>
            Texto generado mediante inteligencia artificial.{"\n"}
            Ilustraciones creadas exclusivamente para este libro.{"\n"}
            Dise{"\u00F1"}o editorial por Meapica.
          </Text>

          <View style={{ marginTop: 16, marginBottom: 16 }}>
            <WavyLine color={theme.ornamentColor} width={50} />
          </View>

          <Text style={{ fontFamily: FONTS.body, fontSize: 7, color: COLORS.textLight, textAlign: "center", letterSpacing: 0.5 }}>
            meapica.com
          </Text>

          <Text style={{ fontFamily: FONTS.body, fontSize: 6, color: COLORS.textLight, marginTop: 10, letterSpacing: 0.5 }}>
            ID: {storyId.slice(0, 8)}
          </Text>
        </View>
      </View>
    </Page>
  );
}

// ── Back Cover ─────────────────────────────────────────────────────────

function BackCoverPage({ theme, characterName }: { theme: TemplateTheme; characterName: string }) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={s.page}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.coverGradientStart }} />

      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: BOOK.contentMargin + 20 }}>
        <Text style={[TYPE.backText, { textAlign: "center" }]}>
          Esta historia fue creada especialmente para
        </Text>
        <Text style={{ fontFamily: FONTS.display, fontSize: 24, fontWeight: 600, color: "#ffffff", marginTop: 8, textAlign: "center" }}>
          {characterName}
        </Text>

        <View style={{ width: 40, height: 1, backgroundColor: "#ffffff33", marginVertical: 16 }} />

        <OrnamentalDivider color="#ffffff55" width={80} />

        <View style={{ marginTop: 40, alignItems: "center" }}>
          <Text style={TYPE.coverBrand}>MEAPICA</Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 7, color: "#ffffff55", marginTop: 4, letterSpacing: 1 }}>
            Historias reales para tocar
          </Text>
        </View>
      </View>

      {/* Colophon credit — bottom of back cover */}
      <View style={{
        position: "absolute",
        bottom: BOOK.contentMargin + 10,
        left: BOOK.contentMargin,
        right: BOOK.contentMargin,
        alignItems: "center",
      }}>
        <Text style={{ fontFamily: FONTS.body, fontSize: 7, color: "#ffffff44", textAlign: "center", lineHeight: 1.7 }}>
          Texto e ilustraciones creados exclusivamente para este libro.{"\n"}
          Dise{"\u00F1"}o editorial por Meapica — meapica.com
        </Text>
      </View>
    </Page>
  );
}
