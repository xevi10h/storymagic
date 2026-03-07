/**
 * PDF Book Template — Editorial children's book layout
 *
 * 24-page structure with 12 scenes across 5 layout types:
 * (24 pages = multiple of 4, required for print binding)
 *
 * Page  Type              Content
 * ────  ────────────────  ────────────────────────────────
 *  1    COVER             Front cover (themed gradient + title)
 *  2    ENDPAPER          Decorative pattern
 *  3    TITLE             "meapica presents..." + book title
 *  4    DEDICATION        Dedication text in ornamental frame
 *  5    FULL_BLEED        Scene 1 — Opening (dramatic first impression)
 *  6    TEXT_PAGE          Scene 1 text
 *  7    CLASSIC           Scene 2 — The spark
 *  8    SPLIT             Scene 3 — Crossing the threshold
 *  9    VIGNETTE          Scene 4 — First encounter (intimate)
 * 10    CLASSIC           Scene 5 — Making an ally
 * 11    SPLIT             Scene 6 — Exploration (discovery)
 * 12    FULL_BLEED        Scene 7 — First test (dramatic mid-point)
 * 13    TEXT_PAGE          Scene 7 text
 * 14    VIGNETTE          Scene 8 — Deepening bonds (quiet moment)
 * 15    CLASSIC           Scene 9 — The great challenge
 * 16    FULL_BLEED        Scene 10 — Darkest moment (maximum impact)
 * 17    TEXT_PAGE          Scene 10 text
 * 18    SPLIT             Scene 11 — Breakthrough (triumph)
 * 19    VIGNETTE          Scene 12 — Homecoming (intimate resolution)
 * 20    FINAL             Final message + "Fin"
 * 21    ABOUT_READER      "About the protagonist" keepsake page
 * 22    COLOPHON          Credits
 * 23    ENDPAPER          Back endpapers
 * 24    BACK_COVER        Back cover
 *
 * IMPORTANT @react-pdf constraints:
 * - SVGs with full-page dimensions cause page overflow → use View-based borders
 * - Images with position:absolute at 100% size overflow → use flow layout
 * - All decorative SVGs must be small (< 150pt) to avoid wrap warnings
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
import { BOOK, COLORS, TYPE, FONTS, getTheme, type TemplateTheme } from "./theme";
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
  illustrations: { sceneNumber: number; imageUrl: string | null }[];
}

// ── Layout assignment ──────────────────────────────────────────────────────
// Deliberately mapped to narrative arc beats for visual rhythm:
//   - FULL_BLEED (2 pages): dramatic moments → scenes 1, 7, 10
//   - CLASSIC (1 page): standard narration → scenes 2, 5, 9
//   - SPLIT (1 page): transitions/discovery → scenes 3, 6, 11
//   - VIGNETTE (1 page): intimate/quiet → scenes 4, 8, 12
// No two consecutive scenes share the same layout type.

type SceneLayout = "full_bleed" | "classic" | "split" | "vignette";

const SCENE_LAYOUTS: SceneLayout[] = [
  "full_bleed", // Scene 1  — Opening
  "classic",    // Scene 2  — The spark
  "split",      // Scene 3  — Crossing the threshold
  "vignette",   // Scene 4  — First encounter
  "classic",    // Scene 5  — Making an ally
  "split",      // Scene 6  — Exploration
  "full_bleed", // Scene 7  — First test (mid-point)
  "vignette",   // Scene 8  — Deepening bonds
  "classic",    // Scene 9  — The great challenge
  "full_bleed", // Scene 10 — Darkest moment
  "split",      // Scene 11 — Breakthrough
  "vignette",   // Scene 12 — Homecoming
];

function getSceneLayout(sceneIndex: number): SceneLayout {
  return SCENE_LAYOUTS[sceneIndex] ?? "classic";
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
// Simple dot decorations that don't cause SVG overflow

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

  // Text page: text-only companion to full_bleed
  textPage: {
    backgroundColor: COLORS.paper,
    justifyContent: "center",
    alignItems: "center",
    padding: BOOK.contentMargin + 15,
  },
  textPageInner: { alignItems: "center", maxWidth: BOOK.trimWidth * 0.78 },

  // CLASSIC: image top, text bottom
  classicTextArea: {
    flex: 1,
    padding: BOOK.contentMargin,
    paddingTop: 16,
    justifyContent: "flex-start",
    backgroundColor: COLORS.paper,
  },

  // VIGNETTE: text with small centered illustration
  vignettePage: {
    backgroundColor: COLORS.paper,
    padding: BOOK.contentMargin,
    alignItems: "center",
    justifyContent: "center",
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

// ── Document ───────────────────────────────────────────────────────────────

export function BookPdf({ input }: { input: BookPdfInput }) {
  const theme = getTheme(input.templateId);
  const { story } = input;

  // Build scene pages with their assigned layouts
  const scenePages: React.JSX.Element[] = [];
  let pageCounter = 5; // First scene page starts at 5

  story.scenes.forEach((scene, i) => {
    const layout = getSceneLayout(i);
    const illustration = input.illustrations.find(
      (ill) => ill.sceneNumber === scene.sceneNumber,
    );
    const imageUrl = illustration?.imageUrl ?? null;

    if (layout === "full_bleed") {
      scenePages.push(
        <FullBleedPage
          key={`fb-${scene.sceneNumber}`}
          theme={theme}
          scene={scene}
          imageUrl={imageUrl}
          pageNumber={pageCounter}
        />,
      );
      pageCounter++;
      scenePages.push(
        <TextOnlyPage
          key={`tp-${scene.sceneNumber}`}
          theme={theme}
          scene={scene}
          pageNumber={pageCounter}
        />,
      );
      pageCounter++;
    } else if (layout === "classic") {
      scenePages.push(
        <ClassicPage
          key={`cl-${scene.sceneNumber}`}
          theme={theme}
          scene={scene}
          imageUrl={imageUrl}
          pageNumber={pageCounter}
        />,
      );
      pageCounter++;
    } else if (layout === "split") {
      scenePages.push(
        <SplitPage
          key={`sp-${scene.sceneNumber}`}
          theme={theme}
          scene={scene}
          imageUrl={imageUrl}
          pageNumber={pageCounter}
        />,
      );
      pageCounter++;
    } else {
      scenePages.push(
        <VignettePage
          key={`vi-${scene.sceneNumber}`}
          theme={theme}
          scene={scene}
          imageUrl={imageUrl}
          pageNumber={pageCounter}
        />,
      );
      pageCounter++;
    }
  });

  return (
    <Document
      title={story.bookTitle}
      author="meapica"
      subject={`Cuento personalizado para ${input.characterName}`}
      creator="meapica — meapica.com"
    >
      {/* 1. Cover */}
      <CoverPage theme={theme} title={story.bookTitle} characterName={input.characterName} />
      {/* 2. Endpapers */}
      <EndpapersPage theme={theme} />
      {/* 3. Title */}
      <TitlePage theme={theme} title={story.bookTitle} characterName={input.characterName} />
      {/* 4. Dedication */}
      <DedicationPage theme={theme} text={story.dedication} senderName={input.senderName} />
      {/* 5-20. Scenes */}
      {scenePages}
      {/* 20. Final message */}
      <FinalPage theme={theme} message={story.finalMessage} characterName={input.characterName} />
      {/* 21. About the reader — keepsake page */}
      <AboutReaderPage theme={theme} characterName={input.characterName} characterAge={input.characterAge} />
      {/* 22. Colophon */}
      <ColophonPage theme={theme} characterName={input.characterName} />
      {/* 23. Endpapers */}
      <EndpapersPage theme={theme} />
      {/* 24. Back cover */}
      <BackCoverPage theme={theme} characterName={input.characterName} />
    </Document>
  );
}

// ── Render helper ─────────────────────────────────────────────────────────

export async function renderBookPdf(input: BookPdfInput): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = createElement(BookPdf as any, { input });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(element as any);
}

// ══════════════════════════════════════════════════════════════════════════
// STRUCTURAL PAGES
// ══════════════════════════════════════════════════════════════════════════

// ── Cover Page ──────────────────────────────────────────────────────────

function CoverPage({ theme, title, characterName }: { theme: TemplateTheme; title: string; characterName: string }) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={s.page}>
      {/* Background gradient simulation — two overlapping color layers */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.coverGradientStart }} />
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.coverGradientEnd, opacity: 0.4 }} />

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

// ── Title Page ──────────────────────────────────────────────────────────

function TitlePage({ theme, title, characterName }: { theme: TemplateTheme; title: string; characterName: string }) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={[s.page, { backgroundColor: COLORS.paper }]}>
      {/* View-based border instead of SVG PageFrameBorder */}
      <FrameBorder color={theme.ornamentColor} inset={BOOK.contentMargin - 5} />

      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: BOOK.contentMargin + 20 }}>
        <Text style={{ fontFamily: FONTS.display, fontSize: 9, color: COLORS.textMuted, letterSpacing: 2, marginBottom: 30 }}>
          MEAPICA PRESENTA
        </Text>

        <OrnamentalDivider color={theme.ornamentColor} width={80} />

        <Text style={{ fontFamily: FONTS.display, fontSize: 28, fontWeight: 600, color: theme.titleColor, textAlign: "center", marginTop: 24, lineHeight: 1.3 }}>
          {title}
        </Text>

        <View style={{ marginTop: 24, marginBottom: 24 }}>
          <WavyLine color={theme.ornamentColor} width={60} />
        </View>

        <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMedium, textAlign: "center" }}>
          Una aventura personalizada para
        </Text>
        <Text style={{ fontFamily: FONTS.display, fontSize: 20, fontWeight: 600, color: theme.accent, marginTop: 8, textAlign: "center" }}>
          {characterName}
        </Text>

        <View style={{ marginTop: 40 }}>
          <StarCluster color={COLORS.gold} size={30} />
        </View>
      </View>
    </Page>
  );
}

// ── Dedication Page ─────────────────────────────────────────────────────

function DedicationPage({ theme, text, senderName }: { theme: TemplateTheme; text: string; senderName: string | null }) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={[s.page, { backgroundColor: COLORS.paper }]}>
      <FrameBorder color={theme.ornamentColor} inset={BOOK.contentMargin - 5} />

      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: BOOK.contentMargin + 20 }}>
        <View style={{ alignItems: "center", maxWidth: BOOK.trimWidth * 0.65 }}>
          <Text style={{ fontFamily: FONTS.display, fontSize: 42, color: COLORS.gold, opacity: 0.4, marginBottom: -8 }}>
            {"\u201C"}
          </Text>

          <Text style={[TYPE.dedicationText, { textAlign: "center" }]}>{text}</Text>

          <Text style={{ fontFamily: FONTS.display, fontSize: 42, color: COLORS.gold, opacity: 0.4, marginTop: -4, marginBottom: 15 }}>
            {"\u201D"}
          </Text>

          {senderName && (
            <Text style={[TYPE.dedicationSender, { textAlign: "center" }]}>{"\u2014"} {senderName}</Text>
          )}

          <View style={{ marginTop: 24 }}>
            <OrnamentalDivider color={theme.ornamentColor} width={90} />
          </View>
        </View>
      </View>
    </Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// SCENE LAYOUTS
// ══════════════════════════════════════════════════════════════════════════

// ── Layout: FULL_BLEED ──────────────────────────────────────────────────
// Full-page illustration with scene title overlaid at the bottom.
// CRITICAL: Image uses flow layout (not position:absolute) to avoid
// @react-pdf creating a separate page for the image.

function FullBleedPage({ theme, scene, imageUrl, pageNumber }: {
  theme: TemplateTheme; scene: GeneratedScene; imageUrl: string | null; pageNumber: number;
}) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={s.page}>
      {/* Image fills the page via flow layout */}
      {imageUrl ? (
        <View style={{ width: BOOK.pageWidth, height: BOOK.pageHeight }}>
          <Image
            src={imageUrl}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </View>
      ) : (
        <View style={{ width: BOOK.pageWidth, height: BOOK.pageHeight, backgroundColor: COLORS.cream, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.textMuted }}>
            Scene {scene.sceneNumber}
          </Text>
        </View>
      )}

      {/* Title overlay at bottom — absolute positioned ON TOP of image */}
      <View style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        paddingTop: 28,
        paddingBottom: BOOK.contentMargin + 10,
        paddingHorizontal: BOOK.contentMargin,
        backgroundColor: "rgba(0,0,0,0.4)",
      }}>
        <Text style={{ fontFamily: FONTS.display, fontSize: 20, fontWeight: 600, color: "#ffffff", lineHeight: 1.3 }}>
          {scene.title}
        </Text>
      </View>

      {/* Scene number badge */}
      <View style={{
        position: "absolute",
        top: BOOK.contentMargin,
        left: BOOK.contentMargin,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: theme.accent,
        justifyContent: "center",
        alignItems: "center",
      }}>
        <Text style={{ fontFamily: FONTS.display, fontSize: 11, color: "#ffffff", fontWeight: 600 }}>{scene.sceneNumber}</Text>
      </View>

      <PageNumber num={pageNumber} color="#ffffff88" />
    </Page>
  );
}

// ── Layout: TEXT_PAGE ───────────────────────────────────────────────────
// Text-only companion page for FULL_BLEED scenes.
// Uses View-based border instead of SVG PageFrameBorder.

function TextOnlyPage({ theme, scene, pageNumber }: {
  theme: TemplateTheme; scene: GeneratedScene; pageNumber: number;
}) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={[s.page, s.textPage]}>
      <FrameBorder color={theme.ornamentColor} inset={BOOK.contentMargin - 5} />

      <View style={s.textPageInner}>
        <View style={{ width: 30, height: 2, backgroundColor: theme.accent, borderRadius: 1, marginBottom: 16, opacity: 0.6 }} />

        <Text style={[TYPE.sceneText, { textAlign: "center", lineHeight: 2.0, fontSize: 13 }]}>
          {scene.text}
        </Text>

        <View style={{ marginTop: 20 }}>
          <OrnamentalDivider color={theme.ornamentColor} width={80} />
        </View>
      </View>

      <PageNumber num={pageNumber} />
    </Page>
  );
}

// ── Layout: CLASSIC ─────────────────────────────────────────────────────
// Image top (60%), text bottom (40%). The workhorse layout.
// Uses flow layout for the image — NO position:absolute.

function ClassicPage({ theme, scene, imageUrl, pageNumber }: {
  theme: TemplateTheme; scene: GeneratedScene; imageUrl: string | null; pageNumber: number;
}) {
  const imageHeight = BOOK.pageHeight * 0.6;

  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={[s.page, { backgroundColor: COLORS.paper }]}>
      {/* Image area — fixed height, flow layout */}
      <View style={{ width: BOOK.pageWidth, height: imageHeight, overflow: "hidden" }}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <View style={{ width: "100%", height: "100%", backgroundColor: COLORS.cream, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.textMuted }}>
              Scene {scene.sceneNumber}
            </Text>
          </View>
        )}
      </View>

      {/* Scene badge on top of image */}
      <View style={{
        position: "absolute",
        top: 12,
        left: BOOK.contentMargin,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: theme.accent,
        justifyContent: "center",
        alignItems: "center",
      }}>
        <Text style={{ fontFamily: FONTS.display, fontSize: 11, color: "#ffffff", fontWeight: 600 }}>{scene.sceneNumber}</Text>
      </View>

      {/* Text area */}
      <View style={s.classicTextArea}>
        <View style={{ width: 30, height: 2, backgroundColor: theme.accent, borderRadius: 1, marginBottom: 10, opacity: 0.6 }} />
        <Text style={[TYPE.sceneTitle, { color: theme.titleColor }]}>{scene.title}</Text>
        <Text style={[TYPE.sceneText, { marginTop: 8 }]}>{scene.text}</Text>
      </View>

      <PageNumber num={pageNumber} />
    </Page>
  );
}

// ── Layout: SPLIT ──────────────────────────────────────────────────────
// Side-by-side: image left (~52%), text right (~48%).
// Used for transition/discovery scenes — creates a cinematic feel.

function SplitPage({ theme, scene, imageUrl, pageNumber }: {
  theme: TemplateTheme; scene: GeneratedScene; imageUrl: string | null; pageNumber: number;
}) {
  const imageWidth = BOOK.pageWidth * 0.52;
  const textWidth = BOOK.pageWidth - imageWidth;

  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={s.page}>
      <View style={{ flexDirection: "row", width: BOOK.pageWidth, height: BOOK.pageHeight }}>
        {/* Left: illustration */}
        <View style={{ width: imageWidth, height: BOOK.pageHeight, overflow: "hidden" }}>
          {imageUrl ? (
            <Image
              src={imageUrl}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <View style={{ width: "100%", height: "100%", backgroundColor: COLORS.cream, justifyContent: "center", alignItems: "center" }}>
              <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.textMuted }}>
                Scene {scene.sceneNumber}
              </Text>
            </View>
          )}
        </View>

        {/* Right: text content */}
        <View style={{
          width: textWidth,
          height: BOOK.pageHeight,
          backgroundColor: COLORS.paper,
          justifyContent: "center",
          paddingHorizontal: BOOK.contentMargin,
          paddingVertical: BOOK.contentMargin + 10,
        }}>
          {/* Thin accent bar */}
          <View style={{ width: 24, height: 2.5, backgroundColor: theme.accent, borderRadius: 1, marginBottom: 14, opacity: 0.7 }} />

          {/* Scene title */}
          <Text style={[TYPE.sceneTitle, { color: theme.titleColor, marginBottom: 12 }]}>
            {scene.title}
          </Text>

          {/* Scene text */}
          <Text style={[TYPE.sceneText, { lineHeight: 1.9 }]}>
            {scene.text}
          </Text>

          {/* Bottom decoration */}
          <View style={{ marginTop: 20 }}>
            <WavyLine color={theme.ornamentColor} width={55} />
          </View>
        </View>
      </View>

      {/* Scene number badge — top-left on the image */}
      <View style={{
        position: "absolute",
        top: BOOK.contentMargin,
        left: BOOK.contentMargin,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: theme.accent,
        justifyContent: "center",
        alignItems: "center",
      }}>
        <Text style={{ fontFamily: FONTS.display, fontSize: 11, color: "#ffffff", fontWeight: 600 }}>{scene.sceneNumber}</Text>
      </View>

      <PageNumber num={pageNumber} />
    </Page>
  );
}

// ── Layout: VIGNETTE ────────────────────────────────────────────────────
// Text-centric page with a small centered illustration.
// Uses View-based corner decorations instead of SVG CornerFlourish.

function VignettePage({ theme, scene, imageUrl, pageNumber }: {
  theme: TemplateTheme; scene: GeneratedScene; imageUrl: string | null; pageNumber: number;
}) {
  const vignetteSize = BOOK.trimWidth * 0.48;

  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={[s.page, s.vignettePage]}>
      {/* Corner dots instead of large SVG flourishes */}
      <CornerDot color={theme.ornamentColor} top={BOOK.contentMargin} left={BOOK.contentMargin} />
      <CornerDot color={theme.ornamentColor} top={BOOK.contentMargin} right={BOOK.contentMargin} />
      <CornerDot color={theme.ornamentColor} bottom={BOOK.contentMargin} left={BOOK.contentMargin} />
      <CornerDot color={theme.ornamentColor} bottom={BOOK.contentMargin} right={BOOK.contentMargin} />

      {/* Title */}
      <Text style={[TYPE.sceneTitle, { color: theme.titleColor, textAlign: "center", marginBottom: 14 }]}>
        {scene.title}
      </Text>

      {/* Small centered illustration */}
      <View style={{
        width: vignetteSize,
        height: vignetteSize,
        borderRadius: 12,
        overflow: "hidden",
        borderWidth: 2,
        borderColor: theme.accentLight,
        marginVertical: 10,
      }}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <View style={{ width: "100%", height: "100%", backgroundColor: COLORS.cream, justifyContent: "center", alignItems: "center", borderRadius: 12 }}>
            <Text style={{ fontFamily: FONTS.body, fontSize: 10, color: COLORS.textMuted }}>
              Scene {scene.sceneNumber}
            </Text>
          </View>
        )}
      </View>

      {/* Text below illustration */}
      <View style={{ alignItems: "center", paddingHorizontal: BOOK.contentMargin, maxWidth: BOOK.trimWidth * 0.85 }}>
        <Text style={[TYPE.sceneText, { textAlign: "center", lineHeight: 1.9 }]}>
          {scene.text}
        </Text>
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
// A personal page where the child's name and age are highlighted.
// Fills the 24th page slot required for print binding (multiple of 4).

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

// ── Colophon ────────────────────────────────────────────────────────────

function ColophonPage({ theme, characterName }: { theme: TemplateTheme; characterName: string }) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={[s.page, { backgroundColor: COLORS.paper }]}>
      <View style={{ flex: 1, justifyContent: "flex-end", alignItems: "center", padding: BOOK.contentMargin + 20, paddingBottom: BOOK.contentMargin + 40 }}>
        <WavyLine color={theme.ornamentColor} width={60} />

        <Text style={{ fontFamily: FONTS.body, fontSize: 8, color: COLORS.textMuted, marginTop: 20, textAlign: "center", lineHeight: 1.8 }}>
          Este libro fue creado especialmente para {characterName}.{"\n"}
          Texto generado por inteligencia artificial.{"\n"}
          Ilustraciones generadas por Recraft V3.{"\n"}
          Dise{"\u00F1"}o editorial por meapica.
        </Text>

        <View style={{ marginTop: 16 }}>
          <Text style={{ fontFamily: FONTS.display, fontSize: 9, color: COLORS.textLight, letterSpacing: 2 }}>
            MEAPICA
          </Text>
        </View>
        <Text style={{ fontFamily: FONTS.body, fontSize: 6, color: COLORS.textLight, marginTop: 4, letterSpacing: 1 }}>
          Historias reales para tocar
        </Text>
      </View>
    </Page>
  );
}

// ── Back Cover ──────────────────────────────────────────────────────────

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
    </Page>
  );
}
