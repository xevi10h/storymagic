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
  Defs,
  LinearGradient,
  Stop,
  renderToBuffer,
} from "@react-pdf/renderer";
import { BOOK, COLORS, TYPE, FONTS, getTheme, getPdfTextConfig, type TemplateTheme, type PdfTextConfig } from "./theme";
import { OrnamentalDivider, StarCluster, WavyLine, WavyDots } from "./decorations";
import type { GeneratedScene, GeneratedStory } from "@/lib/ai/story-generator";
import QRCode from "qrcode";

// ── Brand logo PNG — rasterised server-side with sharp ────────────────────────
// @react-pdf/renderer Image only supports PNG/JPEG, not SVG data URIs.
// We convert once per process and cache the result.

const BRAND_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1013 255" fill="white"><g transform="translate(0,255) scale(0.1,-0.1)"><path d="M443 2525 c-28 -20 -30 -65 -5 -87 9 -9 44 -21 77 -28 246 -48 461 -157 617 -311 98 -97 121 -142 30 -58 -187 173 -574 300 -922 303 -129 1 -161 -9 -202 -66 -31 -44 -30 -112 1 -373 20 -162 24 -249 25 -460 0 -251 -5 -334 -40 -626 -20 -161 -15 -197 32 -248 42 -48 94 -63 194 -59 l75 3 17 136 c63 508 70 935 22 1319 -21 171 -33 154 99 146 417 -25 698 -186 793 -455 36 -100 32 -143 -30 -331 -136 -414 -158 -701 -77 -1007 48 -181 83 -228 188 -259 108 -31 193 2 283 111 106 127 230 209 399 265 135 44 241 60 451 69 203 8 230 15 270 71 33 47 34 87 6 308 -34 269 -36 252 22 208 52 -40 133 -84 204 -111 45 -17 46 -18 63 -83 46 -186 195 -343 375 -397 30 -9 105 -19 165 -22 256 -13 464 68 654 254 52 51 95 93 96 93 1 0 12 -27 24 -59 44 -121 137 -219 248 -261 123 -47 296 -35 402 27 54 31 130 108 157 158 10 19 22 35 25 35 4 0 10 -20 13 -44 11 -70 63 -146 121 -176 66 -34 177 -35 247 -3 62 28 131 93 175 165 20 32 38 58 40 58 3 0 2 -146 -2 -324 l-8 -325 30 -30 c57 -57 165 -51 203 12 19 31 20 54 20 570 0 595 3 634 62 755 73 147 231 218 389 173 135 -38 240 -194 243 -359 l1 -55 -160 -59 c-270 -98 -363 -154 -423 -256 -22 -39 -27 -59 -27 -118 0 -61 4 -77 30 -120 45 -72 117 -107 235 -112 302 -15 528 165 591 471 10 51 19 104 19 118 0 20 13 37 56 70 31 23 90 80 132 125 l77 82 0 -292 c0 -248 3 -300 18 -356 41 -150 123 -215 272 -215 68 0 89 4 138 28 64 32 125 95 173 182 l31 56 38 -50 c74 -97 175 -164 296 -197 88 -24 280 -24 369 0 131 36 268 132 349 244 45 63 61 75 61 46 0 -9 13 -44 30 -79 77 -160 235 -245 434 -232 142 9 255 71 331 181 40 59 52 59 54 0 2 -41 34 -123 56 -144 36 -34 90 -42 149 -22 72 25 81 52 50 157 -38 125 -47 236 -40 467 9 271 3 283 -124 280 -36 -1 -63 -8 -80 -20 -24 -18 -25 -25 -37 -191 -13 -199 -37 -292 -95 -382 -82 -128 -232 -173 -362 -109 -37 17 -58 37 -86 81 -50 77 -64 140 -64 274 1 128 18 207 68 310 49 99 94 148 178 189 59 30 81 36 136 36 87 0 136 -16 182 -61 51 -49 70 -59 120 -59 80 0 130 36 130 95 0 58 -50 110 -151 154 -167 74 -407 68 -571 -15 -77 -39 -205 -172 -250 -259 -56 -111 -98 -261 -98 -354 0 -51 -70 -162 -154 -247 -151 -151 -350 -201 -530 -134 -138 52 -226 214 -226 415 1 266 147 458 349 458 48 0 78 -6 108 -22 50 -25 67 -49 84 -114 16 -64 41 -81 116 -75 48 4 61 10 85 37 23 26 28 40 28 84 -1 98 -58 178 -164 228 -87 42 -154 52 -286 46 -177 -8 -273 -48 -386 -161 -137 -137 -192 -303 -181 -547 l6 -136 -35 -74 c-48 -99 -79 -138 -130 -160 -49 -22 -80 -15 -112 26 -38 49 -45 142 -36 485 13 451 12 481 -8 513 -25 37 -86 52 -147 37 -61 -15 -88 -43 -107 -110 -28 -95 -84 -190 -163 -272 -40 -43 -77 -78 -82 -78 -4 0 -15 26 -24 58 -61 214 -199 357 -391 407 -113 29 -278 14 -374 -35 -48 -25 -134 -102 -161 -147 -13 -20 -24 -32 -25 -27 -2 5 -8 43 -15 84 -16 101 -43 130 -124 130 -67 0 -121 -21 -136 -53 -8 -18 -6 -42 10 -104 29 -111 44 -269 39 -388 -4 -84 -12 -121 -48 -229 -48 -144 -118 -264 -169 -290 -79 -41 -142 -3 -157 96 -4 29 -6 139 -4 243 7 315 8 312 -21 341 -22 21 -35 25 -84 25 -70 0 -109 -14 -124 -47 -6 -14 -11 -73 -11 -132 0 -335 -113 -536 -310 -550 -142 -10 -240 73 -281 238 -19 77 -16 240 6 320 62 225 182 347 351 358 91 6 135 -9 196 -66 42 -40 56 -46 101 -50 140 -11 195 94 95 183 -149 135 -459 155 -671 43 -38 -20 -93 -63 -139 -110 -119 -119 -184 -267 -203 -461 -8 -75 -26 -108 -114 -207 -156 -178 -424 -281 -623 -239 -107 23 -191 80 -238 163 -43 74 -41 86 18 86 147 0 328 41 457 104 106 52 160 96 209 171 96 144 79 330 -40 450 -50 49 -124 87 -202 104 -67 14 -211 14 -288 0 -228 -41 -420 -250 -461 -502 l-16 -96 -38 21 c-86 48 -168 148 -212 259 -57 143 -58 208 -10 554 30 218 27 253 -21 301 -49 49 -98 58 -241 45 -155 -15 -290 -43 -423 -87 -168 -57 -267 -112 -431 -239 l-26 -20 23 31 c42 60 169 169 257 221 105 63 259 124 370 148 138 30 150 35 153 77 2 28 -2 40 -20 52 -30 21 -47 20 -159 -9 -164 -42 -314 -112 -440 -206 -75 -55 -199 -182 -247 -251 -34 -49 -104 -189 -116 -230 -6 -20 -11 -14 -40 48 -90 192 -218 348 -372 454 -139 96 -358 186 -499 204 -38 5 -55 3 -72 -9z m1983 -467 c-33 -263 -40 -373 -40 -633 0 -206 4 -320 17 -430 10 -82 20 -160 23 -171 5 -20 0 -22 -68 -28 -184 -18 -397 -77 -527 -147 -79 -42 -188 -124 -220 -165 -11 -14 -22 -21 -25 -16 -9 15 -44 244 -61 392 -24 219 -29 366 -16 483 37 336 162 529 422 651 123 58 340 112 463 115 l39 1 -7 -52z m1316 -489 c70 -36 104 -106 95 -197 -15 -144 -178 -247 -430 -273 -142 -14 -147 -12 -147 59 0 115 50 250 121 327 95 103 251 139 361 84z m2963 -621 c-49 -166 -163 -271 -294 -271 -67 0 -98 14 -107 49 -15 58 84 133 261 198 142 53 149 54 140 24z"/><path d="M7295 2276 c-41 -18 -83 -69 -91 -111 -20 -108 49 -187 166 -189 97 -1 160 53 168 146 4 61 -19 106 -77 145 -39 27 -117 31 -166 9z"/></g></svg>`;

const _brandLogoPngCache = new Map<string, string>();

async function getBrandLogoPng(fill: string = "#ffffff"): Promise<string> {
  const cached = _brandLogoPngCache.get(fill);
  if (cached) return cached;
  const sharp = (await import("sharp")).default;
  // Swap the hardcoded fill color in the SVG before rasterising
  const svgWithColor = BRAND_LOGO_SVG.replace('fill="white"', `fill="${fill}"`);
  const pngBuffer = await sharp(Buffer.from(svgWithColor))
    .resize(400)
    .png()
    .toBuffer();
  const dataUri = `data:image/png;base64,${pngBuffer.toString("base64")}`;
  _brandLogoPngCache.set(fill, dataUri);
  return dataUri;
}

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

/** Returns the act label for a scene number (matching web getActLabel) */
function getActLabel(sceneNumber: number): string | undefined {
  if (sceneNumber === 1) return "I";
  if (sceneNumber === 4) return "II";
  if (sceneNumber === 10) return "III";
  return undefined;
}

// ── View-based frame border ────────────────────────────────────────────────

function FrameBorder({ color }: { color: string }) {
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

// Minimum space reserved at the bottom for page numbers so content never overlaps
const PAGE_NUM_RESERVED = BOOK.bleed + 28; // ~40pt — clears the number + decorative lines

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

// ── Bottom gradient overlay ──────────────────────────────────────────────────
// Rasterised PNG gradient — SVG LinearGradient has id-collision bugs in react-pdf
// multi-page documents. A PNG image stretched to full width is 100% reliable.

const _gradientCache = new Map<string, string>();

async function getGradientPng(maxOpacity: number, heightPx: number, rgb: [number, number, number] = [0, 0, 0]): Promise<string> {
  const key = `${maxOpacity}-${heightPx}-${rgb.join(",")}`;
  const cached = _gradientCache.get(key);
  if (cached) return cached;

  const sharp = (await import("sharp")).default;
  const h = heightPx;
  // Build a 1px wide × h px tall RGBA raw buffer with a smooth gradient
  const buf = Buffer.alloc(h * 4);
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1); // 0 = top (transparent), 1 = bottom (darkest)
    // Smooth cubic curve for natural-looking gradient
    const alpha = Math.round(maxOpacity * 255 * (t * t * t));
    const idx = y * 4;
    buf[idx] = rgb[0];     // R
    buf[idx + 1] = rgb[1]; // G
    buf[idx + 2] = rgb[2]; // B
    buf[idx + 3] = Math.min(alpha, 255); // A
  }
  const pngBuffer = await sharp(buf, { raw: { width: 1, height: h, channels: 4 } })
    .png()
    .toBuffer();
  const dataUri = `data:image/png;base64,${pngBuffer.toString("base64")}`;
  _gradientCache.set(key, dataUri);
  return dataUri;
}

function BottomGradientOverlay({ gradientUri, height = 0.55 }: { gradientUri?: string; height?: number }) {
  if (!gradientUri) return null;
  const h = BOOK.pageHeight * height;
  return (
    <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: h }}>
      <Image src={gradientUri} style={{ width: BOOK.pageWidth, height: h }} />
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
  actLabel?: string;
  /** Pre-rendered gradient PNG data URI for text-over-image pages */
  gradientUri?: string;
}

/** Act label overlay — decorative "I", "II", "III" at top of illustration pages */
function ActLabel({ label, variant }: { label: string; variant: "light" | "dark"; color?: string }) {
  const isLight = variant === "light";
  const lineColor = isLight ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.15)";
  const textColor = isLight ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.3)";
  return (
    <View style={{ position: "absolute", top: 14, left: 0, right: 0, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 }}>
      <View style={{ width: 18, height: 0.5, backgroundColor: lineColor }} />
      <Text style={{ fontFamily: FONTS.display, fontSize: 8, fontWeight: 600, color: textColor, letterSpacing: 3 }}>{label}</Text>
      <View style={{ width: 18, height: 0.5, backgroundColor: lineColor }} />
    </View>
  );
}

/** immersive — full-bleed image + gradient overlay + title at bottom (matches web SceneImmersive) */
function PageImmersive({ theme, scene, imageUrl, pageNumber, actLabel, gradientUri }: ScenePageProps) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={s.page}>
      <FullBleedImage imageUrl={imageUrl} sceneNumber={scene.sceneNumber} />

      <BottomGradientOverlay gradientUri={gradientUri} height={0.6} />

      {actLabel && <ActLabel label={actLabel} variant="light" />}

      {/* Title at bottom — above page number */}
      <View style={{ position: "absolute", bottom: PAGE_NUM_RESERVED, left: 0, right: 0, paddingBottom: 10, paddingHorizontal: BOOK.contentMargin }}>
        <Text style={{ fontFamily: FONTS.display, fontSize: 20, fontWeight: 600, color: "#ffffff", lineHeight: 1.3 }}>
          {scene.title}
        </Text>
      </View>

      <PageNumber num={pageNumber} color="#ffffff88" />
    </Page>
  );
}

/** split_top — image top ~78% + title strip below (matches web SceneSplitTop) */
function PageSplitTop({ theme, scene, imageUrl, pageNumber, actLabel }: ScenePageProps) {
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

      {actLabel && <ActLabel label={actLabel} variant="light" />}

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
function PageSplitBottom({ theme, scene, imageUrl, pageNumber, actLabel }: ScenePageProps) {
  const imageHeight = BOOK.pageHeight * 0.78;
  const stripHeight = BOOK.pageHeight - imageHeight;

  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={[s.page, { backgroundColor: COLORS.cream }]}>
      {actLabel && <ActLabel label={actLabel} variant="dark" />}

      {/* Title strip at top */}
      <View style={{ height: stripHeight, justifyContent: "center", paddingHorizontal: BOOK.contentMargin }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 2, height: 28, borderRadius: 1, backgroundColor: theme.accent }} />
          <Text style={{ fontFamily: FONTS.display, fontSize: 16, fontWeight: 600, color: theme.titleColor, lineHeight: 1.3 }}>
            {scene.title}
          </Text>
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

/** full_illustration — image fills entire page (matches web SceneFullIllustration) */
function PageFullIllustration({ scene, imageUrl, pageNumber, actLabel }: ScenePageProps) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={s.page}>
      <FullBleedImage imageUrl={imageUrl} sceneNumber={scene.sceneNumber} />
      {actLabel && <ActLabel label={actLabel} variant="light" />}
      <PageNumber num={pageNumber} color="#ffffff88" />
    </Page>
  );
}

/** spread_left — left half of a panoramic 2:1 image + gradient + title (matches web SceneSpreadLeft) */
function PageSpreadLeft({ theme, scene, imageUrl, pageNumber, actLabel, gradientUri }: ScenePageProps) {
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

      <BottomGradientOverlay gradientUri={gradientUri} height={0.6} />

      {actLabel && <ActLabel label={actLabel} variant="light" />}

      {/* Title at bottom — above page number */}
      <View style={{ position: "absolute", bottom: PAGE_NUM_RESERVED, left: 0, right: 0, paddingBottom: 10, paddingHorizontal: BOOK.contentMargin }}>
        <Text style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 600, color: "#ffffff", lineHeight: 1.3 }}>
          {scene.title}
        </Text>
      </View>

      <PageNumber num={pageNumber} color="#ffffff88" />
    </Page>
  );
}

/** spread_right — right half of panoramic image + text overlay at bottom (matches web SceneSpreadRight) */
function PageSpreadRight({ theme, scene, imageUrl, pageNumber, tc, gradientUri }: ScenePageProps) {
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

      <BottomGradientOverlay gradientUri={gradientUri} height={0.65} />

      {/* Text overlay at bottom — above page number */}
      <View style={{ position: "absolute", bottom: PAGE_NUM_RESERVED, left: 0, right: 0, paddingBottom: 10, paddingHorizontal: BOOK.contentMargin }}>
        <Text style={{ fontFamily: FONTS.body, fontSize: tc.body, color: "#ffffffee", lineHeight: tc.bodyLeading }}>
          {scene.text}
        </Text>
      </View>

      <PageNumber num={pageNumber} color="#ffffff88" />
    </Page>
  );
}

/** illustration_text — secondary illustration top ~56% + text below (matches web SceneIllustrationText) */
function PageIllustrationText({ theme, scene, imageUrl, pageNumber, tc }: ScenePageProps) {
  // Image takes 40% to leave enough room for text (web uses 56% but clips with overflow-hidden)
  const imageHeight = BOOK.pageHeight * 0.40;
  // Slightly smaller font so text fits under the illustration
  const fontSize = Math.max(tc.body - 1, 9);

  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={[s.page, { backgroundColor: COLORS.cream }]}>
      <FrameBorder color={theme.ornamentColor} />

      {/* Secondary illustration — full width, landscape ratio */}
      <View style={{ width: BOOK.pageWidth, height: imageHeight }}>
        {imageUrl ? (
          <Image src={imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <View style={{ width: "100%", height: "100%", backgroundColor: COLORS.cream }} />
        )}
      </View>

      {/* Body text below — no title (already on facing page), centered editorial style */}
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: BOOK.contentMargin + 6, paddingTop: 8, paddingBottom: 12 }}>
        <View style={{ alignItems: "center", maxWidth: BOOK.trimWidth * 0.88 }}>
          <OrnamentalDivider color={theme.ornamentColor} width={60} />

          <Text style={{ fontFamily: FONTS.body, fontSize, color: COLORS.textDark, lineHeight: tc.bodyLeading, textAlign: "center", marginTop: 8 }}>
            {scene.text}
          </Text>

          <View style={{ marginTop: 6 }}>
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
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={[s.page, { backgroundColor: COLORS.cream }]}>
      <FrameBorder color={theme.ornamentColor} />

      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: BOOK.contentMargin + 10, paddingTop: BOOK.contentMargin, paddingBottom: PAGE_NUM_RESERVED }}>
        <View style={{ alignItems: "center", maxWidth: BOOK.trimWidth * 0.78 }}>
          {/* Title */}
          <Text style={{ fontFamily: FONTS.display, fontSize: tc.title, fontWeight: 600, color: theme.titleColor, textAlign: "center", lineHeight: 1.3, marginBottom: 12 }}>
            {scene.title}
          </Text>

          <OrnamentalDivider color={theme.ornamentColor} width={80} />

          {/* Text */}
          <Text style={{ fontFamily: FONTS.body, fontSize: tc.body, color: COLORS.textDark, lineHeight: tc.bodyLeading, textAlign: "center", marginTop: 12 }}>
            {scene.text}
          </Text>

          {/* Bottom ornament */}
          <View style={{ marginTop: 14 }}>
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
      <FrameBorder color={theme.ornamentColor} />

      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: BOOK.contentMargin + 8, paddingTop: BOOK.contentMargin, paddingBottom: PAGE_NUM_RESERVED }}>
        {/* Title */}
        <Text style={{ fontFamily: FONTS.display, fontSize: tc.title, fontWeight: 600, color: theme.titleColor, lineHeight: 1.3, marginBottom: 10 }}>
          {scene.title}
        </Text>

        {/* Accent rule */}
        <View style={{ width: BOOK.trimWidth * 0.35, height: 1, backgroundColor: theme.accent, borderRadius: 1, marginBottom: 14, opacity: 0.8 }} />

        {/* Text */}
        <Text style={{ fontFamily: FONTS.body, fontSize: tc.body, color: COLORS.textDark, lineHeight: tc.bodyLeading }}>
          {scene.text}
        </Text>

        {/* Bottom dots */}
        <View style={{ marginTop: 16 }}>
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
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={[s.page, { backgroundColor: COLORS.cream }]}>
      <FrameBorder color={theme.ornamentColor} />

      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: BOOK.contentMargin + 10, paddingTop: BOOK.contentMargin, paddingBottom: PAGE_NUM_RESERVED }}>
        {/* Scene title */}
        <Text style={{ fontFamily: FONTS.display, fontSize: tc.title, fontWeight: 600, color: theme.titleColor, marginBottom: 14, lineHeight: 1.3 }}>
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
        <View style={{ marginTop: 14 }}>
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
      <FrameBorder color={theme.ornamentColor} />

      {/* Corner dots */}
      <CornerDot color={theme.accent} top={BOOK.contentMargin + 4} left={BOOK.contentMargin + 4} />
      <CornerDot color={theme.accent} top={BOOK.contentMargin + 4} right={BOOK.contentMargin + 4} />
      <CornerDot color={theme.accent} bottom={BOOK.contentMargin + 4} left={BOOK.contentMargin + 4} />
      <CornerDot color={theme.accent} bottom={BOOK.contentMargin + 4} right={BOOK.contentMargin + 4} />

      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: BOOK.contentMargin + 30, paddingTop: BOOK.contentMargin + 30, paddingBottom: PAGE_NUM_RESERVED }}>
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

export function BookPdf({ input, qrDataUrl, logoDataUri, logoMuted, gradientUri, whiteGradientUri }: { input: BookPdfInput; qrDataUrl?: string; logoDataUri?: string; logoMuted?: string; gradientUri?: string; whiteGradientUri?: string }) {
  const theme = getTheme(input.templateId, input.characterGender);
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

    const actLabel = getActLabel(scene.sceneNumber);
    const baseProps: ScenePageProps = { theme, scene, imageUrl, pageNumber: pageCounter, tc, actLabel, gradientUri };

    if (isBridge) {
      // Bridge: uses SCENE_LAYOUT_PAIRS like regular scenes (matching web)
      const isSpread = pair[0] === "spread_left";

      scenePages.push(
        React.cloneElement(
          renderIllustrationPage(pair[0], baseProps),
          { key: `br-p1-${scene.sceneNumber}` }
        ),
      );
      pageCounter++;

      if (isSpread) {
        scenePages.push(
          React.cloneElement(
            renderIllustrationPage("spread_right", { ...baseProps, pageNumber: pageCounter }),
            { key: `br-p2-${scene.sceneNumber}` }
          ),
        );
      } else {
        scenePages.push(
          <TextPagePuente key={`br-txt-${scene.sceneNumber}`} {...{ ...baseProps, pageNumber: pageCounter, imageUrl: null }} />,
        );
      }
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
      <CoverPage theme={theme} title={story.bookTitle} characterName={input.characterName} coverImageUrl={input.coverImageUrl} logoDataUri={logoDataUri} />
      {/* 2. Front Endpapers */}
      <EndpapersPage theme={theme} />
      {/* 3. Title + Dedication (merged) */}
      <TitleDedicationPage theme={theme} title={story.bookTitle} characterName={input.characterName} dedicationText={story.dedication} senderName={input.senderName} logoDataUri={logoMuted} />
      {/* 4-27. Scenes */}
      {scenePages}
      {/* 28. Final message */}
      <FinalPage theme={theme} message={story.finalMessage} characterName={input.characterName} />
      {/* 29. About the reader — keepsake page */}
      <AboutReaderPage theme={theme} input={input} gradientUri={whiteGradientUri} />
      {/* 30. Colophon */}
      <ColophonPage theme={theme} storyId={input.storyId} qrDataUrl={qrDataUrl} />
      {/* 31. Back Endpapers */}
      <EndpapersPage theme={theme} />
      {/* 32. Back cover */}
      <BackCoverPage theme={theme} input={input} logoDataUri={logoDataUri} />
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
  const theme = getTheme(input.templateId, input.characterGender);
  const [qrDataUrl, logoWhite, logoOrnament, gradientUri, whiteGradientUri] = await Promise.all([
    generateQrDataUrl(input.storyId, theme.coverGradientStart),
    getBrandLogoPng("#ffffff"),
    getBrandLogoPng(theme.ornamentColor),
    // Gradient overlay PNG for text-over-image pages (75% max opacity, 200px tall)
    getGradientPng(0.75, 200),
    // White gradient for hero card portrait-to-cream fade
    getGradientPng(0.95, 200, [250, 248, 245]),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = createElement(BookPdf as any, { input, qrDataUrl, logoDataUri: logoWhite, logoMuted: logoOrnament, gradientUri, whiteGradientUri });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(element as any);
}

/**
 * Interior-only PDF for Gelato — pages 2–31 (30 inner pages).
 */
export function InteriorOnlyPdf({ input, qrDataUrl, gradientUri, whiteGradientUri }: { input: BookPdfInput; qrDataUrl?: string; gradientUri?: string; whiteGradientUri?: string }) {
  const theme = getTheme(input.templateId, input.characterGender);
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
    const actLabel = getActLabel(scene.sceneNumber);
    const baseProps: ScenePageProps = { theme, scene, imageUrl, pageNumber: pageCounter, tc, actLabel, gradientUri };

    if (isBridge) {
      const isSpread = pair[0] === "spread_left";

      scenePages.push(
        React.cloneElement(
          renderIllustrationPage(pair[0], baseProps),
          { key: `br-p1-${scene.sceneNumber}` }
        ),
      );
      pageCounter++;

      if (isSpread) {
        scenePages.push(
          React.cloneElement(
            renderIllustrationPage("spread_right", { ...baseProps, pageNumber: pageCounter }),
            { key: `br-p2-${scene.sceneNumber}` }
          ),
        );
      } else {
        scenePages.push(
          <TextPagePuente key={`br-txt-${scene.sceneNumber}`} {...{ ...baseProps, pageNumber: pageCounter, imageUrl: null }} />,
        );
      }
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
      <AboutReaderPage theme={theme} input={input} gradientUri={whiteGradientUri} />
      <ColophonPage theme={theme} storyId={input.storyId} qrDataUrl={qrDataUrl} />
      <EndpapersPage theme={theme} />
    </Document>
  );
}

export async function renderInteriorPdf(input: BookPdfInput): Promise<Buffer> {
  const theme = getTheme(input.templateId, input.characterGender);
  const [qrDataUrl, whiteGradientUri] = await Promise.all([
    generateQrDataUrl(input.storyId, theme.coverGradientStart),
    getGradientPng(0.95, 200, [250, 248, 245]),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = createElement(InteriorOnlyPdf as any, { input, qrDataUrl, whiteGradientUri });
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
  const theme = getTheme(input.templateId, input.characterGender);
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

function CoverPage({ theme, title, characterName, coverImageUrl, logoDataUri }: { theme: TemplateTheme; title: string; characterName: string; coverImageUrl: string | null; logoDataUri?: string }) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={s.page}>
      {coverImageUrl ? (
        <>
          <Image src={coverImageUrl} style={{ position: "absolute", top: 0, left: 0, width: BOOK.pageWidth, height: BOOK.pageHeight, objectFit: "cover" }} />
          {/* Smooth gradient: from-black/20 at top, via-transparent, to-black/75 at bottom */}
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
            <Svg width={BOOK.pageWidth} height={BOOK.pageHeight} viewBox={`0 0 ${BOOK.pageWidth} ${BOOK.pageHeight}`}>
              <Defs>
                <LinearGradient id="coverGrad" x1="0" y1="0" x2="0" y2={String(BOOK.pageHeight)}>
                  <Stop offset="0%" stopColor="#000000" stopOpacity={0.2} />
                  <Stop offset="35%" stopColor="#000000" stopOpacity={0} />
                  <Stop offset="65%" stopColor="#000000" stopOpacity={0.15} />
                  <Stop offset="100%" stopColor="#000000" stopOpacity={0.75} />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width={BOOK.pageWidth} height={BOOK.pageHeight} fill="url(#coverGrad)" />
            </Svg>
          </View>
        </>
      ) : (
        <>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.coverGradientStart }} />
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.coverGradientEnd, opacity: 0.4 }} />
        </>
      )}

      {/* Brand logo at top — matching web BrandLogo */}
      {logoDataUri && (
        <View style={{ position: "absolute", top: BOOK.contentMargin + 10, left: 0, right: 0, alignItems: "center" }}>
          <Image src={logoDataUri} style={{ height: 26, width: Math.round(26 * (1013 / 255)), opacity: 0.85 }} />
        </View>
      )}

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
  const W = BOOK.pageWidth;
  const H = BOOK.pageHeight;
  const SPACING = 20;
  const cols = Math.ceil(W / SPACING) + 1;
  const rows = Math.ceil(H / SPACING) + 1;

  // Dark gradient with subtle dot pattern — matches web's linear-gradient(to bottom right, grad-start, grad-end)
  return (
    <Page size={[W, H]} style={[s.page, { backgroundColor: theme.coverGradientStart }]}>
      {/* Secondary gradient overlay */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.coverGradientEnd, opacity: 0.3 }} />
      {/* White dot grid — matches web's radial-gradient dots */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          {Array.from({ length: rows }).map((_, r) =>
            Array.from({ length: cols }).map((_, c) => (
              <Rect
                key={`${r}-${c}`}
                x={c * SPACING - 0.75}
                y={r * SPACING - 0.75}
                width={1.5}
                height={1.5}
                rx={0.75}
                ry={0.75}
                fill="#ffffff"
                fillOpacity={0.08}
              />
            ))
          )}
        </Svg>
      </View>
    </Page>
  );
}

// ── Title + Dedication Page (merged) ─────────────────────────────────────

function TitleDedicationPage({ theme, title, characterName, dedicationText, senderName, logoDataUri }: {
  theme: TemplateTheme; title: string; characterName: string; dedicationText: string; senderName: string | null; logoDataUri?: string;
}) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={[s.page, { backgroundColor: COLORS.cream }]}>
      <FrameBorder color={theme.ornamentColor} />

      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: BOOK.contentMargin + 15 }}>
        {/* Brand */}
        {logoDataUri ? (
          <Image src={logoDataUri} style={{ height: 14, width: Math.round(14 * (1013 / 255)), marginBottom: 16, opacity: 0.7 }} />
        ) : (
          <Text style={{ fontFamily: FONTS.display, fontSize: 9, color: COLORS.textMuted, letterSpacing: 2, marginBottom: 16 }}>
            MEAPICA
          </Text>
        )}

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
          <Text style={{ fontFamily: FONTS.body, fontStyle: "italic", fontSize: 12, color: theme.titleColor, opacity: 0.8, textAlign: "center", lineHeight: 1.8 }}>
            {"\u201C"}{dedicationText}{"\u201D"}
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
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={[s.page, { backgroundColor: COLORS.cream }]}>
      <FrameBorder color={theme.ornamentColor} />

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

function AboutReaderPage({ theme, input, gradientUri }: {
  theme: TemplateTheme; input: BookPdfInput; gradientUri?: string;
}) {
  const { characterName, characterAge, portraitUrl, characterCity, characterInterests, specialTrait, favoriteCompanion, favoriteFood, futureDream, characterGender } = input;
  const hasPortrait = !!portraitUrl;
  const heroLabel = characterGender === "girl" ? "La Hero\u00EDna" : "El H\u00E9roe";

  const traits: { label: string }[] = [];
  if (specialTrait) traits.push({ label: specialTrait });
  if (favoriteCompanion) traits.push({ label: favoriteCompanion });
  if (favoriteFood) traits.push({ label: favoriteFood });
  if (futureDream) traits.push({ label: futureDream });

  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={[s.page, { backgroundColor: "#ffffff" }]}>
      {/* Full-bleed portrait background */}
      {hasPortrait ? (
        <Image src={portraitUrl!} style={{ position: "absolute", top: 0, left: 0, width: BOOK.pageWidth, height: BOOK.pageHeight, objectFit: "cover", objectPosition: "top" }} />
      ) : (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.coverGradientStart }}>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.coverGradientEnd, opacity: 0.3 }} />
        </View>
      )}

      {/* Hero badge — top left with frosted look */}
      <View style={{
        position: "absolute", top: BOOK.bleed + 12, left: BOOK.bleed + 12,
        backgroundColor: theme.accent, borderRadius: 12,
        paddingHorizontal: 12, paddingVertical: 5,
      }}>
        <Text style={{ fontFamily: FONTS.body, fontSize: 6.5, fontWeight: 700, color: "#ffffff", letterSpacing: 2 }}>
          {heroLabel.toUpperCase()}
        </Text>
      </View>

      {/* Dreamy white fade — tall and soft for editorial feel */}
      {gradientUri && (
        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: BOOK.pageHeight * 0.55 }}>
          <Image src={gradientUri} style={{ width: BOOK.pageWidth, height: BOOK.pageHeight * 0.55 }} />
        </View>
      )}

      {/* ── Character card panel ── */}
      <View style={{
        position: "absolute", bottom: BOOK.bleed + 16, left: BOOK.contentMargin,
        right: BOOK.contentMargin,
      }}>
        {/* Name — large editorial display */}
        <Text style={{
          fontFamily: FONTS.display, fontSize: 28, fontWeight: 800,
          color: theme.titleColor, lineHeight: 1.15,
        }}>
          {characterName}
        </Text>

        {/* Accent underline — short decorative bar */}
        <View style={{
          width: 32, height: 2.5, borderRadius: 1.25,
          backgroundColor: theme.accent, marginTop: 6, opacity: 0.8,
        }} />

        {/* Age + city */}
        <Text style={{
          fontFamily: FONTS.body, fontSize: 9, color: COLORS.textMuted,
          marginTop: 8, letterSpacing: 0.3,
        }}>
          {characterAge} a{"\u00F1"}os{characterCity ? `  \u00B7  ${characterCity}` : ""}
        </Text>

        {/* Traits with diamond accent markers */}
        {traits.length > 0 && (
          <View style={{ marginTop: 12, gap: 6 }}>
            {traits.map((trait, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <View style={{
                  width: 5, height: 5,
                  backgroundColor: theme.accent,
                  transform: "rotate(45deg)",
                }} />
                <Text style={{
                  fontFamily: FONTS.body, fontSize: 9, fontWeight: 600,
                  color: theme.titleColor, letterSpacing: 0.2,
                }}>
                  {trait.label}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Interest pills — frosted glass style */}
        {characterInterests && characterInterests.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 12 }}>
            {characterInterests.map((interest) => (
              <View key={interest} style={{
                backgroundColor: theme.accentLight, borderRadius: 10,
                paddingHorizontal: 10, paddingVertical: 4,
              }}>
                <Text style={{
                  fontFamily: FONTS.body, fontSize: 7, fontWeight: 600,
                  color: theme.accent, letterSpacing: 0.3,
                }}>
                  {interest}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Page>
  );
}

// ── Colophon Page ──────────────────────────────────────────────────────

function ColophonPage({ qrDataUrl }: { theme: TemplateTheme; storyId: string; qrDataUrl?: string }) {
  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={[s.page, { backgroundColor: COLORS.cream }]}>
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

          {/* Divider */}
          <View style={{ width: 48, height: 0.5, backgroundColor: COLORS.textLight, marginTop: 16 }} />

          {/* Brand */}
          <View style={{ marginTop: 12 }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 12, color: COLORS.textMuted, opacity: 0.4, letterSpacing: 1 }}>
              Meapica
            </Text>
          </View>
        </View>
      </View>
    </Page>
  );
}

// ── Back Cover ─────────────────────────────────────────────────────────

function BackCoverPage({ theme, input, logoDataUri }: { theme: TemplateTheme; input: BookPdfInput; logoDataUri?: string }) {
  const synopsis = input.story.synopsis || `${input.characterName} est\u00E1 a punto de vivir la aventura m\u00E1s extraordinaria de su vida.`;
  // Use last scene illustration (matching web), fallback to cover image
  const lastSceneNumber = input.story.scenes.length;
  const lastIllustration = input.illustrations.find((i) => i.sceneNumber === lastSceneNumber);
  const bgImageUrl = lastIllustration?.imageUrl || input.coverImageUrl;

  return (
    <Page size={[BOOK.pageWidth, BOOK.pageHeight]} style={s.page}>
      {/* Background gradient */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.coverGradientStart }} />
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.coverGradientEnd, opacity: 0.3 }} />

      {/* Last scene illustration as faded background */}
      {bgImageUrl && (
        <>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.35 }}>
            <Image src={bgImageUrl} style={{ width: BOOK.pageWidth, height: BOOK.pageHeight, objectFit: "cover" }} />
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
          <Text style={{ fontFamily: FONTS.display, fontSize: 11, color: "#ffffffbb", textAlign: "center", lineHeight: 1.6 }}>
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
          {logoDataUri ? (
            <Image src={logoDataUri} style={{ height: 16, width: Math.round(16 * (1013 / 255)), opacity: 0.35 }} />
          ) : (
            <Text style={{ fontFamily: FONTS.display, fontSize: 12, color: "#ffffff44", letterSpacing: 1 }}>Meapica</Text>
          )}
          <Text style={{ fontFamily: FONTS.body, fontSize: 6, color: "#ffffff22", marginTop: 3, letterSpacing: 2 }}>
            meapica.com
          </Text>
        </View>
      </View>
    </Page>
  );
}
