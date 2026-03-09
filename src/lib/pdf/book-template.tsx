/**
 * PDF Book Template — Editorial children's book layout
 *
 * Unified with the web viewer: both use the same SCENE_LAYOUT_PAIRS system
 * and the same spread cycling (galeria → pergamino → ventana) for text pages.
 *
 * 32-page structure: 3 header + 24 content (12 slots × 2) + 5 footer.
 * Content slots can be "scene" (full narrative) or "bridge" (atmospheric transition).
 *
 * Page map:
 *  1    COVER               Front cover (themed gradient + title)
 *  2    ENDPAPER            Decorative pattern (front)
 *  3    TITLE_DEDICATION    Title + dedication merged into one page
 *  4-27 SCENES              12 content slots × 2 pages each
 *  28   FINAL               Final message + "Fin"
 *  29   ABOUT_READER        "About the protagonist" keepsake page
 *  30   COLOPHON            Colophon / credits + QR code
 *  31   ENDPAPER            Back endpapers
 *  32   BACK_COVER          Back cover
 *
 * Layout types (matching web viewer exactly):
 *   immersive         — full-bleed image + gradient overlay + title at bottom
 *   split_top         — image top ~78% + title strip below
 *   split_bottom      — title strip top + image bottom ~78%
 *   full_illustration  — image fills entire page, badge only
 *   text_only          — editorial text page (cycles galeria/pergamino/ventana/puente)
 *   illustration_text  — secondary illustration top + text below
 *   spread_left        — left half of panoramic double-page spread
 *   spread_right       — right half of same panoramic image + text overlay
 *
 * IMPORTANT @react-pdf constraints:
 * - SVGs with full-page dimensions cause page overflow → use View-based borders
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
  Svg,
  Rect,
  renderToBuffer,
} from "@react-pdf/renderer";
import { BOOK, COLORS, TYPE, FONTS, getTheme, getPdfTextConfig, type TemplateTheme, type PdfTextConfig } from "./theme";
import { OrnamentalDivider, StarCluster, WavyLine, WavyDots } from "./decorations";
import type { GeneratedScene, GeneratedStory } from "@/lib/ai/story-generator";
import QRCode from "qrcode";

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
  // Hero card / back cover enrichment
  portraitUrl?: string | null;
  characterGender?: string;
  characterCity?: string | null;
  characterInterests?: string[];
  specialTrait?: string | null;
  favoriteCompanion?: string | null;
  favoriteFood?: string | null;
  futureDream?: string | null;
}

// ── Layout system (matching web viewer types.ts) ──────────────────────────

type ScenePageLayout =
  | "immersive"
  | "split_top"
  | "split_bottom"
  | "full_illustration"
  | "text_only"
  | "illustration_text"
  | "spread_left"
  | "spread_right";

const SCENE_LAYOUT_PAIRS: [ScenePageLayout, ScenePageLayout][] = [
  ["immersive", "text_only"],           // Scene 1: dramatic opening
  ["split_top", "text_only"],           // Scene 2: world building
  ["spread_left", "spread_right"],      // Scene 3: first adventure — panorama!
  ["full_illustration", "text_only"],   // Scene 4: new encounter — visual impact
  ["split_bottom", "text_only"],        // Scene 5: meeting ally
  ["immersive", "text_only"],           // Scene 6: exploring wonders
  ["split_top", "text_only"],           // Scene 7: first test
  ["spread_left", "spread_right"],      // Scene 8: climactic moment — panorama!
  ["full_illustration", "text_only"],   // Scene 9: big obstacle — visual impact
  ["immersive", "text_only"],           // Scene 10: darkest moment
  ["split_bottom", "text_only"],        // Scene 11: breakthrough
  ["immersive", "text_only"],           // Scene 12: resolution / homecoming
];

// Spread type for text pages — cycles galeria → pergamino → ventana for scenes
type SpreadType = "galeria" | "pergamino" | "ventana" | "puente";

const SPREAD_CYCLE: ("galeria" | "pergamino" | "ventana")[] = [
  "galeria", "pergamino", "ventana",
];

function getSpreadType(sceneType: string, sceneOnlyIndex: number): SpreadType {
  if (sceneType === "bridge") return "puente";
  return SPREAD_CYCLE[sceneOnlyIndex % SPREAD_CYCLE.length];
}

// ── View-based frame border ────────────────────────────────────────────────

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

// ── Small corner dots ──────────────────────────────────────────────────────

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

// ── Scene number badge ──────────────────────────────────────────────────────

function SceneBadge({ num, top, left, right, color }: {
  num: number; top: number; left?: number; right?: number; color: string;
}) {
  return (
    <View style={{
      position: "absolute",
      top,
      left,
      right,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: "rgba(255,255,255,0.8)",
      justifyContent: "center",
      alignItems: "center",
    }}>
      <Text style={{ fontFamily: FONTS.display, fontSize: 10, color, fontWeight: 600 }}>{num}</Text>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// ILLUSTRATION PAGE TYPES (matching web viewer layouts)
// ══════════════════════════════════════════════════════════════════════════

interface ScenePageProps {
  theme: TemplateTheme;
  scene: GeneratedScene;
  imageUrl: string | null;
  pageNumber: number;
  tc: PdfTextConfig;
}

/** immersive — full-bleed image + gradient overlay + title at bottom (matches web SceneImmersive) */
function PageImmersive({ theme, scene, imageUrl, pageNumber }: ScenePageProps) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={s.page}>
      <FullBleedImage imageUrl={imageUrl} sceneNumber={scene.sceneNumber} />

      {/* Gradient overlay: transparent at top, dark at bottom */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: BOOK.pageHeight * 0.5, backgroundColor: "#000000", opacity: 0.55 }} />
      <View style={{ position: "absolute", bottom: BOOK.pageHeight * 0.35, left: 0, right: 0, height: BOOK.pageHeight * 0.15, backgroundColor: "#000000", opacity: 0.2 }} />

      {/* Scene number badge — top-left */}
      <SceneBadge num={scene.sceneNumber} top={BOOK.contentMargin} left={BOOK.contentMargin} color={theme.accent} />

      {/* Title at bottom */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingBottom: BOOK.contentMargin + 10, paddingHorizontal: BOOK.contentMargin }}>
        <Text style={{ fontFamily: FONTS.display, fontSize: 20, fontWeight: 600, color: "#ffffff", lineHeight: 1.3 }}>
          {scene.title}
        </Text>
      </View>

      <PageNumber num={pageNumber} color="#ffffff88" />
    </Page>
  );
}

/** split_top — image top ~78% + title strip below (matches web SceneSplitTop) */
function PageSplitTop({ theme, scene, imageUrl, pageNumber }: ScenePageProps) {
  const imageHeight = BOOK.pageHeight * 0.78;
  const stripHeight = BOOK.pageHeight - imageHeight;

  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={[s.page, { backgroundColor: COLORS.cream }]}>
      {/* Top image area */}
      <View style={{ width: BOOK.pageWidth, height: imageHeight }}>
        {imageUrl ? (
          <Image src={imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <View style={{ width: "100%", height: "100%", backgroundColor: COLORS.cream }} />
        )}
      </View>

      {/* Scene badge on image — top-left */}
      <SceneBadge num={scene.sceneNumber} top={BOOK.contentMargin} left={BOOK.contentMargin} color={theme.accent} />

      {/* Title strip below image */}
      <View style={{ height: stripHeight, justifyContent: "center", paddingHorizontal: BOOK.contentMargin }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 2, height: 28, borderRadius: 1, backgroundColor: theme.accent }} />
          <Text style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: theme.titleColor, lineHeight: 1.3 }}>
            {scene.title}
          </Text>
        </View>
      </View>

      <PageNumber num={pageNumber} />
    </Page>
  );
}

/** split_bottom — title strip top + image bottom ~78% (matches web SceneSplitBottom) */
function PageSplitBottom({ theme, scene, imageUrl, pageNumber }: ScenePageProps) {
  const imageHeight = BOOK.pageHeight * 0.78;
  const stripHeight = BOOK.pageHeight - imageHeight;

  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={[s.page, { backgroundColor: COLORS.cream }]}>
      {/* Title strip at top */}
      <View style={{ height: stripHeight, justifyContent: "center", paddingHorizontal: BOOK.contentMargin }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 2, height: 28, borderRadius: 1, backgroundColor: theme.accent }} />
          <View>
            <Text style={{ fontFamily: FONTS.body, fontSize: 7, fontWeight: 600, color: COLORS.textMuted, letterSpacing: 2 }}>
              {String(scene.sceneNumber).padStart(2, "0")}
            </Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: theme.titleColor, lineHeight: 1.3 }}>
              {scene.title}
            </Text>
          </View>
        </View>
      </View>

      {/* Bottom image area */}
      <View style={{ width: BOOK.pageWidth, height: imageHeight }}>
        {imageUrl ? (
          <Image src={imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <View style={{ width: "100%", height: "100%", backgroundColor: COLORS.cream }} />
        )}
      </View>

      <PageNumber num={pageNumber} />
    </Page>
  );
}

/** full_illustration — image fills entire page, badge only (matches web SceneFullIllustration) */
function PageFullIllustration({ theme, scene, imageUrl, pageNumber }: ScenePageProps) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={s.page}>
      <FullBleedImage imageUrl={imageUrl} sceneNumber={scene.sceneNumber} />
      <SceneBadge num={scene.sceneNumber} top={BOOK.contentMargin} left={BOOK.contentMargin} color={theme.accent} />
      <PageNumber num={pageNumber} color="#ffffff88" />
    </Page>
  );
}

/** spread_left — left half of a panoramic 2:1 image + gradient + title (matches web SceneSpreadLeft) */
function PageSpreadLeft({ theme, scene, imageUrl, pageNumber }: ScenePageProps) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={s.page}>
      {/* Show left half of panoramic image by using a 2x wide container and clipping */}
      <View style={{ width: BOOK.pageWidth, height: BOOK.pageHeight, overflow: "hidden" }}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            style={{
              width: BOOK.pageWidth * 2,
              height: BOOK.pageHeight,
              objectFit: "cover",
            }}
          />
        ) : (
          <View style={{ width: "100%", height: "100%", backgroundColor: COLORS.cream }} />
        )}
      </View>

      {/* Gradient overlay */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: BOOK.pageHeight * 0.5, backgroundColor: "#000000", opacity: 0.5 }} />
      <View style={{ position: "absolute", bottom: BOOK.pageHeight * 0.35, left: 0, right: 0, height: BOOK.pageHeight * 0.15, backgroundColor: "#000000", opacity: 0.15 }} />

      {/* Badge */}
      <SceneBadge num={scene.sceneNumber} top={BOOK.contentMargin} left={BOOK.contentMargin} color={theme.accent} />

      {/* Title at bottom */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingBottom: BOOK.contentMargin + 10, paddingHorizontal: BOOK.contentMargin }}>
        <Text style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 600, color: "#ffffff", lineHeight: 1.3 }}>
          {scene.title}
        </Text>
      </View>

      <PageNumber num={pageNumber} color="#ffffff88" />
    </Page>
  );
}

/** spread_right — right half of panoramic image + text overlay at bottom (matches web SceneSpreadRight) */
function PageSpreadRight({ theme, scene, imageUrl, pageNumber, tc }: ScenePageProps) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={s.page}>
      {/* Show right half of panoramic image by offsetting 2x wide image to the left */}
      <View style={{ width: BOOK.pageWidth, height: BOOK.pageHeight, overflow: "hidden" }}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            style={{
              width: BOOK.pageWidth * 2,
              height: BOOK.pageHeight,
              objectFit: "cover",
              marginLeft: -BOOK.pageWidth,
            }}
          />
        ) : (
          <View style={{ width: "100%", height: "100%", backgroundColor: COLORS.cream }} />
        )}
      </View>

      {/* Gradient overlay */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: BOOK.pageHeight * 0.5, backgroundColor: "#000000", opacity: 0.55 }} />
      <View style={{ position: "absolute", bottom: BOOK.pageHeight * 0.35, left: 0, right: 0, height: BOOK.pageHeight * 0.15, backgroundColor: "#000000", opacity: 0.2 }} />

      {/* Text overlay at bottom */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingBottom: BOOK.contentMargin + 10, paddingHorizontal: BOOK.contentMargin }}>
        <Text style={{ fontFamily: FONTS.body, fontSize: tc.body, color: "#ffffffdd", lineHeight: tc.bodyLeading }}>
          {scene.text}
        </Text>
      </View>

      <PageNumber num={pageNumber} color="#ffffff88" />
    </Page>
  );
}

/** illustration_text — secondary illustration top ~56% + text below (matches web SceneIllustrationText) */
function PageIllustrationText({ theme, scene, imageUrl, pageNumber, tc }: ScenePageProps) {
  const imageHeight = BOOK.pageHeight * 0.56;

  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={[s.page, { backgroundColor: COLORS.paper }]}>
      <FrameBorder color={theme.ornamentColor} inset={BOOK.contentMargin - 5} />

      {/* Secondary illustration — full width, landscape ratio */}
      <View style={{ width: BOOK.pageWidth, height: imageHeight }}>
        {imageUrl ? (
          <Image src={imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <View style={{ width: "100%", height: "100%", backgroundColor: COLORS.cream }} />
        )}
      </View>

      {/* Body text below — no title (already on facing page), centered editorial style */}
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: BOOK.contentMargin + 10, paddingTop: 10 }}>
        <View style={{ alignItems: "center", maxWidth: BOOK.trimWidth * 0.85 }}>
          <OrnamentalDivider color={theme.ornamentColor} width={60} />

          <Text style={{ fontFamily: FONTS.body, fontSize: tc.body, color: COLORS.textDark, lineHeight: tc.bodyLeading, textAlign: "center", marginTop: 10 }}>
            {scene.text}
          </Text>

          <View style={{ marginTop: 8 }}>
            <WavyDots color={theme.ornamentColor} />
          </View>
        </View>
      </View>

      <PageNumber num={pageNumber} />
    </Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// TEXT PAGE TYPES (cycling galeria → pergamino → ventana, or puente for bridges)
// ══════════════════════════════════════════════════════════════════════════

/** Galeria text — centered text with ornamental divider, star cluster. Paper white bg, frame border. */
function TextPageGaleria({ theme, scene, pageNumber, tc }: ScenePageProps) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={[s.page, { backgroundColor: COLORS.paper }]}>
      <FrameBorder color={theme.ornamentColor} inset={BOOK.contentMargin - 5} />

      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: BOOK.contentMargin + 15 }}>
        <View style={{ alignItems: "center", maxWidth: BOOK.trimWidth * 0.78 }}>
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

/** Pergamino text — left-aligned with accent rule, on colored background. */
function TextPagePergamino({ theme, scene, pageNumber, tc }: ScenePageProps) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={[s.page, { backgroundColor: theme.accentLight }]}>
      <FrameBorder color={theme.ornamentColor} inset={BOOK.contentMargin - 5} />

      <View style={{ flex: 1, justifyContent: "center", padding: BOOK.contentMargin + 12 }}>
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

        {/* Bottom dots */}
        <View style={{ marginTop: 24 }}>
          <WavyDots color={theme.ornamentColor} />
        </View>
      </View>

      <PageNumber num={pageNumber} />
    </Page>
  );
}

/** Ventana text — drop cap style, paper white background. */
function TextPageVentana({ theme, scene, pageNumber, tc }: ScenePageProps) {
  const firstChar = scene.text.charAt(0);
  const restText = scene.text.slice(1);

  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={[s.page, { backgroundColor: COLORS.paper }]}>
      <FrameBorder color={theme.ornamentColor} inset={BOOK.contentMargin - 5} />

      <View style={{ flex: 1, justifyContent: "center", padding: BOOK.contentMargin + 15 }}>
        {/* Scene title */}
        <Text style={{ fontFamily: FONTS.display, fontSize: tc.title, fontWeight: 600, color: theme.titleColor, marginBottom: 18, lineHeight: 1.3 }}>
          {scene.title}
        </Text>

        {/* Drop cap row */}
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <View style={{ marginRight: 6, marginTop: 2 }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: tc.dropCap, fontWeight: 600, color: theme.accent, lineHeight: 1 }}>
              {firstChar}
            </Text>
          </View>
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

/** Puente text (bridge) — large centered display sentence on colored background. */
function TextPagePuente({ theme, scene, pageNumber, tc }: ScenePageProps) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={[s.page, { backgroundColor: theme.accentLight }]}>
      <FrameBorder color={theme.ornamentColor} inset={BOOK.contentMargin - 5} />

      {/* Corner dots */}
      <CornerDot color={theme.accent} top={BOOK.contentMargin + 4} left={BOOK.contentMargin + 4} />
      <CornerDot color={theme.accent} top={BOOK.contentMargin + 4} right={BOOK.contentMargin + 4} />
      <CornerDot color={theme.accent} bottom={BOOK.contentMargin + 4} left={BOOK.contentMargin + 4} />
      <CornerDot color={theme.accent} bottom={BOOK.contentMargin + 4} right={BOOK.contentMargin + 4} />

      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: BOOK.contentMargin + 30 }}>
        <View style={{ alignItems: "center", maxWidth: BOOK.trimWidth * 0.7 }}>
          <OrnamentalDivider color={theme.ornamentColor} width={60} />

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

          <WavyDots color={theme.ornamentColor} />
        </View>
      </View>

      <PageNumber num={pageNumber} />
    </Page>
  );
}

/** Routes to the correct text page variant based on spreadType */
function TextPageBySpread({ theme, scene, pageNumber, tc, spreadType }: ScenePageProps & { spreadType: SpreadType }) {
  switch (spreadType) {
    case "pergamino": return <TextPagePergamino theme={theme} scene={scene} imageUrl={null} pageNumber={pageNumber} tc={tc} />;
    case "ventana": return <TextPageVentana theme={theme} scene={scene} imageUrl={null} pageNumber={pageNumber} tc={tc} />;
    case "puente": return <TextPagePuente theme={theme} scene={scene} imageUrl={null} pageNumber={pageNumber} tc={tc} />;
    case "galeria":
    default: return <TextPageGaleria theme={theme} scene={scene} imageUrl={null} pageNumber={pageNumber} tc={tc} />;
  }
}

/** Bridge illustration page — full-bleed atmospheric image, no badge, no overlay (matches web) */
function PageBridgeIllustration({ scene, imageUrl, pageNumber }: ScenePageProps) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={s.page}>
      <FullBleedImage imageUrl={imageUrl} sceneNumber={scene.sceneNumber} />
      <PageNumber num={pageNumber} color="#ffffff88" />
    </Page>
  );
}

/** Routes illustration page to the correct layout renderer */
function renderIllustrationPage(layout: ScenePageLayout, props: ScenePageProps): React.JSX.Element {
  switch (layout) {
    case "immersive": return <PageImmersive {...props} />;
    case "split_top": return <PageSplitTop {...props} />;
    case "split_bottom": return <PageSplitBottom {...props} />;
    case "full_illustration": return <PageFullIllustration {...props} />;
    case "spread_left": return <PageSpreadLeft {...props} />;
    case "spread_right": return <PageSpreadRight {...props} />;
    case "illustration_text": return <PageIllustrationText {...props} />;
    default: return <PageImmersive {...props} />;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// DOCUMENT
// ══════════════════════════════════════════════════════════════════════════

export function BookPdf({ input, qrDataUrl }: { input: BookPdfInput; qrDataUrl?: string }) {
  const theme = getTheme(input.templateId);
  const { story } = input;
  const tc = getPdfTextConfig(input.characterAge);

  // Build content pages using SCENE_LAYOUT_PAIRS (same as web viewer)
  const scenePages: React.JSX.Element[] = [];
  let pageCounter = 4; // First content page starts at 4 (after 3 header pages)
  let sceneOnlyIndex = 0;

  story.scenes.forEach((scene) => {
    const pair = SCENE_LAYOUT_PAIRS[(scene.sceneNumber - 1) % SCENE_LAYOUT_PAIRS.length];
    const isBridge = scene.type === "bridge";
    const spreadType = getSpreadType(scene.type ?? "scene", sceneOnlyIndex);

    const illustration = input.illustrations.find(
      (ill) => ill.sceneNumber === scene.sceneNumber,
    );
    const secondaryIllustration = input.illustrations.find(
      (ill) => ill.sceneNumber === scene.sceneNumber + 12,
    );
    const imageUrl = illustration?.imageUrl ?? null;
    const secondaryImageUrl = secondaryIllustration?.imageUrl ?? null;

    const baseProps: ScenePageProps = { theme, scene, imageUrl, pageNumber: pageCounter, tc };

    if (isBridge) {
      // Bridge: illustration page (no overlay) + puente text page
      scenePages.push(
        <PageBridgeIllustration key={`br-ill-${scene.sceneNumber}`} {...baseProps} />,
      );
      pageCounter++;
      scenePages.push(
        <TextPagePuente key={`br-txt-${scene.sceneNumber}`} {...{ ...baseProps, pageNumber: pageCounter, imageUrl: null }} />,
      );
      pageCounter++;
    } else {
      // Scene: Page 1 = illustration layout, Page 2 = text or secondary illustration
      const isSpread = pair[0] === "spread_left";

      // Page 1: primary illustration
      scenePages.push(
        React.cloneElement(
          renderIllustrationPage(pair[0], baseProps),
          { key: `sc-p1-${scene.sceneNumber}` }
        ),
      );
      pageCounter++;

      // Page 2
      if (isSpread) {
        // Panoramic spread — same image, right half
        scenePages.push(
          React.cloneElement(
            renderIllustrationPage("spread_right", { ...baseProps, pageNumber: pageCounter }),
            { key: `sc-p2-${scene.sceneNumber}` }
          ),
        );
      } else if (secondaryImageUrl) {
        // Secondary illustration exists → show with text
        scenePages.push(
          <PageIllustrationText
            key={`sc-p2-${scene.sceneNumber}`}
            {...{ ...baseProps, imageUrl: secondaryImageUrl, pageNumber: pageCounter }}
          />,
        );
      } else {
        // Pure text page — cycles galeria/pergamino/ventana
        scenePages.push(
          React.cloneElement(
            <TextPageBySpread {...{ ...baseProps, pageNumber: pageCounter, imageUrl: null, spreadType }} />,
            { key: `sc-p2-${scene.sceneNumber}` }
          ),
        );
      }
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
      {/* 4-27. Scenes */}
      {scenePages}
      {/* 28. Final message */}
      <FinalPage theme={theme} message={story.finalMessage} characterName={input.characterName} />
      {/* 29. About the reader — keepsake page */}
      <AboutReaderPage theme={theme} input={input} />
      {/* 30. Colophon */}
      <ColophonPage theme={theme} storyId={input.storyId} qrDataUrl={qrDataUrl} />
      {/* 31. Back Endpapers */}
      <EndpapersPage theme={theme} />
      {/* 32. Back cover */}
      <BackCoverPage theme={theme} input={input} />
    </Document>
  );
}

// ── Render helpers ────────────────────────────────────────────────────────

/** Generate QR code as data URL for PDF embedding */
async function generateQrDataUrl(storyId: string, color: string): Promise<string> {
  try {
    return await QRCode.toDataURL(`https://meapica.com/book/${storyId}`, {
      width: 200,
      margin: 0,
      color: { dark: color, light: "#00000000" },
      errorCorrectionLevel: "M",
    });
  } catch {
    return "";
  }
}

/** Full 32-page PDF — used for user-facing download */
export async function renderBookPdf(input: BookPdfInput): Promise<Buffer> {
  const theme = getTheme(input.templateId);
  const qrDataUrl = await generateQrDataUrl(input.storyId, theme.coverGradientStart);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = createElement(BookPdf as any, { input, qrDataUrl });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(element as any);
}

/**
 * Interior-only PDF for Gelato — pages 2–31 (30 inner pages).
 */
export function InteriorOnlyPdf({ input, qrDataUrl }: { input: BookPdfInput; qrDataUrl?: string }) {
  const theme = getTheme(input.templateId);
  const { story } = input;
  const tc = getPdfTextConfig(input.characterAge);

  const scenePages: React.JSX.Element[] = [];
  let pageCounter = 4;
  let sceneOnlyIndex = 0;

  story.scenes.forEach((scene) => {
    const pair = SCENE_LAYOUT_PAIRS[(scene.sceneNumber - 1) % SCENE_LAYOUT_PAIRS.length];
    const isBridge = scene.type === "bridge";
    const spreadType = getSpreadType(scene.type ?? "scene", sceneOnlyIndex);

    const illustration = input.illustrations.find(
      (ill) => ill.sceneNumber === scene.sceneNumber,
    );
    const secondaryIllustration = input.illustrations.find(
      (ill) => ill.sceneNumber === scene.sceneNumber + 12,
    );
    const imageUrl = illustration?.imageUrl ?? null;
    const secondaryImageUrl = secondaryIllustration?.imageUrl ?? null;
    const baseProps: ScenePageProps = { theme, scene, imageUrl, pageNumber: pageCounter, tc };

    if (isBridge) {
      scenePages.push(<PageBridgeIllustration key={`br-ill-${scene.sceneNumber}`} {...baseProps} />);
      pageCounter++;
      scenePages.push(<TextPagePuente key={`br-txt-${scene.sceneNumber}`} {...{ ...baseProps, pageNumber: pageCounter, imageUrl: null }} />);
      pageCounter++;
    } else {
      const isSpread = pair[0] === "spread_left";

      scenePages.push(
        React.cloneElement(
          renderIllustrationPage(pair[0], baseProps),
          { key: `sc-p1-${scene.sceneNumber}` }
        ),
      );
      pageCounter++;

      if (isSpread) {
        scenePages.push(
          React.cloneElement(
            renderIllustrationPage("spread_right", { ...baseProps, pageNumber: pageCounter }),
            { key: `sc-p2-${scene.sceneNumber}` }
          ),
        );
      } else if (secondaryImageUrl) {
        scenePages.push(
          <PageIllustrationText key={`sc-p2-${scene.sceneNumber}`} {...{ ...baseProps, imageUrl: secondaryImageUrl, pageNumber: pageCounter }} />,
        );
      } else {
        scenePages.push(
          React.cloneElement(
            <TextPageBySpread {...{ ...baseProps, pageNumber: pageCounter, imageUrl: null, spreadType }} />,
            { key: `sc-p2-${scene.sceneNumber}` }
          ),
        );
      }
      pageCounter++;
      sceneOnlyIndex++;
    }
  });

  return (
    <Document creator="Meapica — meapica.com">
      <EndpapersPage theme={theme} />
      <TitleDedicationPage theme={theme} title={story.bookTitle} characterName={input.characterName} dedicationText={story.dedication} senderName={input.senderName} />
      {scenePages}
      <FinalPage theme={theme} message={story.finalMessage} characterName={input.characterName} />
      <AboutReaderPage theme={theme} input={input} />
      <ColophonPage theme={theme} storyId={input.storyId} qrDataUrl={qrDataUrl} />
      <EndpapersPage theme={theme} />
    </Document>
  );
}

export async function renderInteriorPdf(input: BookPdfInput): Promise<Buffer> {
  const theme = getTheme(input.templateId);
  const qrDataUrl = await generateQrDataUrl(input.storyId, theme.coverGradientStart);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = createElement(InteriorOnlyPdf as any, { input, qrDataUrl });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(element as any);
}

/**
 * Cover spread PDF for Gelato — one wide page containing:
 *   [ back cover ] [ spine strip ] [ front cover ]
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
  const panelWidth = (coverWidthPt - spineWidthPt) / 2;

  return (
    <Document creator="Meapica — meapica.com">
      <Page size={[coverWidthPt, coverHeightPt]} style={{ flexDirection: "row" }}>
        {/* Back cover (left panel) */}
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
          <View style={{ position: "absolute", bottom: BOOK.contentMargin + 10, left: BOOK.contentMargin, right: BOOK.contentMargin, alignItems: "center" }}>
            <Text style={{ fontFamily: FONTS.body, fontSize: 6, color: "#ffffff44", textAlign: "center", lineHeight: 1.7 }}>
              Texto e ilustraciones creados exclusivamente para este libro.{"\n"}
              Dise{"\u00F1"}o editorial por Meapica — meapica.com
            </Text>
          </View>
        </View>

        {/* Spine */}
        <View style={{ width: spineWidthPt, height: coverHeightPt, backgroundColor: theme.coverGradientEnd, justifyContent: "center", alignItems: "center" }}>
          <View style={{ width: coverHeightPt * 0.6, height: spineWidthPt, justifyContent: "space-between", alignItems: "center", flexDirection: "row", transform: "rotate(-90deg)" }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 7, color: "#ffffffaa", letterSpacing: 1 }}>
              MEAPICA
            </Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 8, fontWeight: 600, color: "#ffffff", maxWidth: coverHeightPt * 0.4 }}>
              {story.bookTitle}
            </Text>
          </View>
        </View>

        {/* Front cover (right panel) */}
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
      {coverImageUrl ? (
        <>
          <Image src={coverImageUrl} style={{ position: "absolute", top: 0, left: 0, width: BOOK.pageWidth, height: BOOK.pageHeight, objectFit: "cover" }} />
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#000000", opacity: 0.15 }} />
          <View style={{ position: "absolute", top: BOOK.pageHeight * 0.5, left: 0, right: 0, bottom: 0, backgroundColor: "#000000", opacity: 0.45 }} />
        </>
      ) : (
        <>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.coverGradientStart }} />
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.coverGradientEnd, opacity: 0.4 }} />
        </>
      )}

      {/* Brand at top */}
      <View style={{ position: "absolute", top: BOOK.contentMargin + 10, left: 0, right: 0, alignItems: "center" }}>
        <Text style={{ fontFamily: FONTS.display, fontSize: 14, color: "#ffffffcc", letterSpacing: 1 }}>
          Meapica
        </Text>
      </View>

      {/* Title + character at bottom — matching web order */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: BOOK.contentMargin + 5, paddingBottom: BOOK.contentMargin + 15, alignItems: "center" }}>
        <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: "#ffffffbb", marginBottom: 6, letterSpacing: 0.5, textAlign: "center" }}>
          Una historia personalizada para{" "}
          <Text style={{ fontWeight: 600, color: "#ffffff" }}>{characterName}</Text>
        </Text>
        <Text style={{ fontFamily: FONTS.display, fontSize: 28, fontWeight: 600, color: "#ffffff", lineHeight: 1.2, textAlign: "center" }}>
          {title}
        </Text>
      </View>
    </Page>
  );
}

// ── Endpapers ───────────────────────────────────────────────────────────

function EndpapersPage({ theme }: { theme: TemplateTheme }) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={s.page}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.coverGradientStart }} />
      <View style={{ position: "absolute", top: 0, left: 0, width: BOOK.pageWidth * 0.5, bottom: 0, backgroundColor: theme.coverGradientEnd, opacity: 0.3 }} />

      {/* Dot texture */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center" }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", width: BOOK.trimWidth * 0.8, justifyContent: "center", gap: 20 }}>
          {Array.from({ length: 40 }).map((_, i) => (
            <View
              key={i}
              style={{
                width: 2,
                height: 2,
                borderRadius: 1,
                backgroundColor: "#ffffff",
                opacity: 0.04 + (i % 4) * 0.015,
              }}
            />
          ))}
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
          MEAPICA
        </Text>

        {/* Title */}
        <Text style={{ fontFamily: FONTS.display, fontSize: 26, fontWeight: 600, color: theme.titleColor, textAlign: "center", lineHeight: 1.3 }}>
          {title}
        </Text>

        <View style={{ marginTop: 10, marginBottom: 10 }}>
          <OrnamentalDivider color={theme.ornamentColor} width={60} />
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
            <WavyDots color={theme.ornamentColor} />
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

function AboutReaderPage({ theme, input }: {
  theme: TemplateTheme; input: BookPdfInput;
}) {
  const { characterName, characterAge, portraitUrl, characterCity, characterInterests, specialTrait, favoriteCompanion, favoriteFood, futureDream } = input;
  const hasPortrait = !!portraitUrl;

  // Trait entries to display
  const traits: { label: string; value: string }[] = [];
  if (specialTrait) traits.push({ label: "Superpoder", value: specialTrait });
  if (favoriteCompanion) traits.push({ label: "Compa\u00F1ero", value: favoriteCompanion });
  if (favoriteFood) traits.push({ label: "Favorito", value: favoriteFood });
  if (futureDream) traits.push({ label: "Sue\u00F1o", value: futureDream });

  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={s.page}>
      {/* Background: portrait image or gradient fallback */}
      {hasPortrait ? (
        <>
          <Image src={portraitUrl!} style={{ position: "absolute", top: 0, left: 0, width: BOOK.pageWidth, height: BOOK.pageHeight, objectFit: "cover" }} />
          <View style={{ position: "absolute", top: BOOK.pageHeight * 0.35, left: 0, right: 0, bottom: 0, backgroundColor: "#ffffff", opacity: 0.85 }} />
          <View style={{ position: "absolute", top: BOOK.pageHeight * 0.25, left: 0, right: 0, height: BOOK.pageHeight * 0.15, backgroundColor: "#ffffff", opacity: 0.4 }} />
        </>
      ) : (
        <>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.coverGradientStart }} />
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.coverGradientEnd, opacity: 0.3 }} />
          <View style={{ position: "absolute", top: BOOK.pageHeight * 0.4, left: 0, right: 0, bottom: 0, backgroundColor: "#ffffff", opacity: 0.9 }} />
        </>
      )}

      {/* "SOBRE EL PROTAGONISTA" header — matching web */}
      <View style={{ position: "absolute", top: BOOK.contentMargin, left: 0, right: 0, alignItems: "center" }}>
        <Text style={{ fontFamily: FONTS.display, fontSize: 7, fontWeight: 600, color: COLORS.textMuted, letterSpacing: 2 }}>
          SOBRE EL PROTAGONISTA
        </Text>
      </View>

      {/* Character details at bottom */}
      <View style={{ position: "absolute", bottom: BOOK.contentMargin + 10, left: BOOK.contentMargin + 5, right: BOOK.contentMargin + 5 }}>
        <View style={{ marginBottom: 8 }}>
          <OrnamentalDivider color={theme.ornamentColor} width={60} />
        </View>

        <View style={{ alignItems: "center", marginBottom: 8 }}>
          <Text style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 600, color: theme.titleColor, lineHeight: 1.2, textAlign: "center" }}>
            {characterName}
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 10, color: COLORS.textMuted, marginTop: 4 }}>
            {characterAge} a{"\u00F1"}os{characterCity ? ` \u00B7 ${characterCity}` : ""}
          </Text>
        </View>

        <View style={{ marginBottom: 8 }}>
          <OrnamentalDivider color={theme.ornamentColor} width={60} />
        </View>

        <View style={{ alignItems: "center", marginBottom: 10 }}>
          <Text style={{ fontFamily: FONTS.body, fontStyle: "italic", fontSize: 10, color: COLORS.textMedium, textAlign: "center", lineHeight: 1.6, maxWidth: BOOK.trimWidth * 0.7 }}>
            Este libro fue creado especialmente para ti.{"\n"}
            Recuerda siempre que eres capaz de vivir{"\n"}
            las aventuras m{"\u00E1"}s incre{"\u00ED"}bles.
          </Text>
        </View>

        {/* Traits */}
        {traits.length > 0 && (
          <View style={{ gap: 4, marginBottom: 8 }}>
            {traits.map((trait) => (
              <View key={trait.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: theme.accent }} />
                <Text style={{ fontFamily: FONTS.body, fontSize: 9, fontWeight: 600, color: theme.titleColor }}>
                  {trait.value}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Interests */}
        {characterInterests && characterInterests.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
            {characterInterests.map((interest) => (
              <View key={interest} style={{ borderWidth: 0.5, borderColor: COLORS.textLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "#ffffff99" }}>
                <Text style={{ fontFamily: FONTS.body, fontSize: 7, color: COLORS.textMedium }}>
                  {interest}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Drawing box — "Dibuja aquí tu momento favorito" (matching web) */}
        <View style={{ marginTop: 4 }}>
          <StarCluster color={COLORS.gold} size={20} />
        </View>
        <View style={{
          marginTop: 6,
          borderWidth: 0.75,
          borderColor: COLORS.textLight,
          borderRadius: 6,
          paddingVertical: 24,
          paddingHorizontal: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ffffff55",
        }}>
          <Text style={{ fontFamily: FONTS.body, fontSize: 8, color: COLORS.textLight, textAlign: "center" }}>
            Dibuja aqu{"\u00ED"} tu momento favorito
          </Text>
        </View>
      </View>
    </Page>
  );
}

// ── Colophon Page ──────────────────────────────────────────────────────

function ColophonPage({ theme, storyId, qrDataUrl }: { theme: TemplateTheme; storyId: string; qrDataUrl?: string }) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={[s.page, { backgroundColor: COLORS.paper }]}>
      <FrameBorder color={theme.ornamentColor} inset={BOOK.contentMargin - 5} />

      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: BOOK.contentMargin + 30 }}>
        <View style={{ alignItems: "center", maxWidth: BOOK.trimWidth * 0.65 }}>
          {/* Colophon text */}
          <Text style={{ fontFamily: FONTS.body, fontSize: 10, color: COLORS.textMuted, textAlign: "center", lineHeight: 1.8 }}>
            Texto generado mediante inteligencia artificial.{"\n"}
            Ilustraciones creadas exclusivamente para este libro.{"\n"}
            Dise{"\u00F1"}o editorial por Meapica.
          </Text>

          {/* QR code */}
          {qrDataUrl ? (
            <View style={{ marginTop: 20, alignItems: "center", gap: 6 }}>
              <Image src={qrDataUrl} style={{ width: 72, height: 72 }} />
              <Text style={{ fontFamily: FONTS.body, fontSize: 7, color: COLORS.textLight, letterSpacing: 0.5 }}>
                meapica.com
              </Text>
            </View>
          ) : (
            <View style={{ marginTop: 20, marginBottom: 20 }}>
              <View style={{ width: 48, height: 0.5, backgroundColor: COLORS.textLight }} />
            </View>
          )}

          {/* Brand */}
          <View style={{ marginTop: qrDataUrl ? 10 : 0 }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 12, color: COLORS.textMuted, opacity: 0.4, letterSpacing: 1 }}>
              Meapica
            </Text>
          </View>

          <Text style={{ fontFamily: FONTS.body, fontSize: 6, color: COLORS.textLight, marginTop: 10, letterSpacing: 0.5 }}>
            ID: {storyId.slice(0, 8)}
          </Text>
        </View>
      </View>
    </Page>
  );
}

// ── Back Cover ─────────────────────────────────────────────────────────

function BackCoverPage({ theme, input }: { theme: TemplateTheme; input: BookPdfInput }) {
  const synopsis = input.story.synopsis || `${input.characterName} est\u00E1 a punto de vivir la aventura m\u00E1s extraordinaria de su vida.`;
  const hasCoverImage = !!input.coverImageUrl;

  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={s.page}>
      {/* Background gradient */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.coverGradientStart }} />
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.coverGradientEnd, opacity: 0.3 }} />

      {/* Cover image as faded background */}
      {hasCoverImage && (
        <>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.35 }}>
            <Image src={input.coverImageUrl!} style={{ width: BOOK.pageWidth, height: BOOK.pageHeight, objectFit: "cover" }} />
          </View>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#000000", opacity: 0.45 }} />
        </>
      )}

      {/* Subtle dot texture */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center" }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", width: BOOK.trimWidth * 0.7, justifyContent: "center", gap: 14 }}>
          {Array.from({ length: 30 }).map((_, i) => (
            <View key={i} style={{ width: 1, height: 1, borderRadius: 0.5, backgroundColor: "#ffffff", opacity: 0.04 }} />
          ))}
        </View>
      </View>

      {/* Content */}
      <View style={{ flex: 1, justifyContent: "space-between", alignItems: "center", paddingHorizontal: BOOK.contentMargin + 10, paddingVertical: BOOK.contentMargin + 15 }}>
        {/* Top: title + character */}
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontFamily: FONTS.display, fontSize: 14, fontWeight: 600, color: "#ffffffdd", textAlign: "center", lineHeight: 1.3 }}>
            {input.story.bookTitle}
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 9, color: "#ffffff77", marginTop: 4, letterSpacing: 0.5 }}>
            Una historia personalizada para {input.characterName}
          </Text>
        </View>

        {/* Center: synopsis */}
        <View style={{ alignItems: "center", maxWidth: BOOK.trimWidth * 0.78 }}>
          <Text style={{ fontFamily: FONTS.body, fontStyle: "italic", fontSize: 11, color: "#ffffffbb", textAlign: "center", lineHeight: 1.6 }}>
            {"\u201C"}{synopsis}{"\u201D"}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 }}>
            <View style={{ width: 24, height: 0.5, backgroundColor: "#ffffff33" }} />
            <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: "#ffffff44" }} />
            <View style={{ width: 24, height: 0.5, backgroundColor: "#ffffff33" }} />
          </View>
        </View>

        {/* Bottom: brand */}
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontFamily: FONTS.display, fontSize: 12, color: "#ffffff44", letterSpacing: 1 }}>
            Meapica
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 6, color: "#ffffff22", marginTop: 3, letterSpacing: 2 }}>
            meapica.com
          </Text>
        </View>
      </View>
    </Page>
  );
}
