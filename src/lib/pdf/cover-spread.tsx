/* eslint-disable jsx-a11y/alt-text -- @react-pdf <Image> renders into a PDF and has no alt prop */
/**
 * Gelato cover file (one wide page) built from the REAL cover geometry
 * returned by the Gelato catalog API — no guessed widths, no stretching.
 *
 *   Softcover  [bleed][ back ][spine][ front ][bleed]
 *   Hardcover  [wrap][ back ][joint][spine][joint][ front ][wrap]
 *
 * Front artwork is drawn with uniform cover-fit over the whole panel
 * INCLUDING bleed / wrap-around / joint, centred on the visible panel. The back
 * is cream paper (BackCoverDesign) with the spine colour carried over its joint.
 * All text stays ≥ 15 mm inside the visible panel; the bottom band of the
 * back cover (BARCODE_RESERVE_MM above the safe margin) is left empty for the
 * barcode Gelato's print partners add to the back cover to match cover and
 * inside file (Gelato's own editor marks "Space reserved for the barcode").
 */

import { createElement, type JSX } from "react";
import { Document, Page, View, Text, Image, renderToBuffer } from "@react-pdf/renderer";
import type { CoverGeometry, MmRect } from "@/lib/gelato/catalog";
import { FONTS } from "./theme";
import { MM_TO_PT, coverFit, type Placement } from "./images";
import { rootBoxHeight } from "./primitives";
import { BRAND_LOGO_ASPECT } from "./assets";
import { fitText } from "./text";
import { BackCoverDesign, FrontCoverDesign, fitCoverTexts, vignetteBox, type CoverTexts, type PanelFrame, type Rect } from "./cover-art";
import { backCoverImage, pdfForName, pdfT, prepareBookRender, type BookPdfInput, type BookRenderContext } from "./book-template";

/** Text keep-out from the visible panel edges */
const COVER_SAFE_MM = 15;
/** Back-cover bottom band left free for Gelato's production barcode */
export const BARCODE_RESERVE_MM = 25;
/** Spines thinner than this get colour only — text would risk sliding onto the covers */
export const MIN_SPINE_TEXT_MM = 5;
/**
 * The spine colour continues this far onto the back (softcover): the cream back meets a dark
 * spine, and a fold that lands ±1.5 mm off would otherwise show a sliver of the wrong colour.
 * Hardcover: the whole back joint (hinge groove) takes the spine colour instead.
 */
const SPINE_BAND_SOFT_MM = 3;
/** Clear space at each end of the spine title */
const SPINE_END_MARGIN_MM = 20;

function toPt(r: MmRect): Rect {
  return { left: r.left * MM_TO_PT, top: r.top * MM_TO_PT, width: r.width * MM_TO_PT, height: r.height * MM_TO_PT };
}

export interface CoverLayout {
  pageWidth: number;
  pageHeight: number;
  front: PanelFrame;
  back: PanelFrame;
  spine: Rect;
  /** Spine colour continued onto the back panel next to the spine, pt */
  spineBand: number;
  spineText: { title: string; fontSize: number; showBrand: boolean } | null;
  texts: CoverTexts;
  /** Front artwork placement (for DPI checks); null when no cover image */
  frontPlacement: Placement | null;
  backPlacement: Placement | null;
  issues: string[];
}

/** Computes the cover layout for a geometry. Fonts must be loaded (prepareBookRender does it). */
export function planCoverSpread(ctx: BookRenderContext, geometry: CoverGeometry): CoverLayout {
  const pageWidth = geometry.totalWidthMm * MM_TO_PT;
  const pageHeight = geometry.totalHeightMm * MM_TO_PT;
  const spine = toPt(geometry.spine);
  const backVisible = toPt(geometry.back);
  const frontVisible = toPt(geometry.front);
  const safe = COVER_SAFE_MM * MM_TO_PT;
  const issues: string[] = [];

  // Art boxes: everything from the file edge up to the spine (joints belong to the covers)
  const back: PanelFrame = {
    art: { left: 0, top: 0, width: spine.left, height: pageHeight },
    visible: backVisible,
    safe,
    bottomReserve: BARCODE_RESERVE_MM * MM_TO_PT,
  };
  const frontArtLeft = spine.left + spine.width;
  const front: PanelFrame = {
    art: { left: frontArtLeft, top: 0, width: pageWidth - frontArtLeft, height: pageHeight },
    visible: frontVisible,
    safe,
  };

  const { texts, overflow } = fitCoverTexts({
    title: ctx.input.story.bookTitle,
    subtitle: pdfForName(ctx.input.locale, "personalizedStory", ctx.input.characterName, ctx.input.characterGender),
    name: ctx.input.characterName,
    synopsis: ctx.input.story.synopsis || pdfT(ctx.input.locale, "defaultSynopsis").replace("{name}", ctx.input.characterName),
    locale: ctx.input.locale,
    visibleWidth: Math.min(frontVisible.width, backVisible.width),
    safe,
    backHeight: backVisible.height - 2 * safe - (back.bottomReserve ?? 0),
  });
  issues.push(...overflow.map((o) => `Cover text does not fit: ${o}`));

  let spineText: CoverLayout["spineText"] = null;
  if (geometry.spine.width >= MIN_SPINE_TEXT_MM) {
    const maxSize = Math.min(8, spine.width * 0.42);
    const length = spine.height - 2 * SPINE_END_MARGIN_MM * MM_TO_PT;
    const brandWidth = 40; // "MEAPICA" at 6 pt + gap
    const fit = fitText({ text: texts.title, variant: { role: "display", weight: 600 }, width: length - brandWidth, height: maxSize * 1.2 + 0.1, maxSize, minSize: Math.min(5, maxSize), leading: 1.2 });
    if (fit.fits) spineText = { title: texts.title, fontSize: fit.fontSize, showBrand: true };
    else issues.push("Spine title too long — spine printed without text");
  }

  const coverImg = ctx.images.cover;
  const backImg = backCoverImage(ctx);
  const backBox = vignetteBox(backImg, texts.back.vignette);
  return {
    pageWidth,
    pageHeight,
    front,
    back,
    spine,
    spineBand: (geometry.jointBack?.width ?? SPINE_BAND_SOFT_MM) * MM_TO_PT,
    spineText,
    texts,
    frontPlacement: coverImg?.dims ? coverFit(coverImg.dims, front.art.width, front.art.height) : null,
    // The back prints the closing scene in the arch vignette (0 when there was no room for it)
    backPlacement: backImg?.dims && backBox ? coverFit(backImg.dims, backBox.width, backBox.height) : null,
    issues,
  };
}

function CoverSpreadDocument({ ctx, layout }: { ctx: BookRenderContext; layout: CoverLayout }) {
  const { theme } = ctx;
  const { spine, spineText } = layout;
  const cx = spine.left + spine.width / 2;
  const cy = layout.pageHeight / 2;
  const runLength = spine.height - 2 * SPINE_END_MARGIN_MM * MM_TO_PT;

  return (
    <Document title={ctx.input.story.bookTitle} author="Meapica" creator="Meapica — meapica.shop" producer="Meapica">
      <Page size={[layout.pageWidth, layout.pageHeight]} style={{ backgroundColor: theme.coverGradientStart }}>
        <View wrap={false} style={{ width: "100%", height: rootBoxHeight(layout.pageHeight), position: "relative", overflow: "hidden", backgroundColor: theme.coverGradientStart }}>
        <BackCoverDesign frame={layout.back} theme={theme} texts={layout.texts} image={backCoverImage(ctx)} logoUri={ctx.logoOrnament} />
        <FrontCoverDesign frame={layout.front} theme={theme} texts={layout.texts} image={ctx.images.cover} overlayUri={ctx.coverGradient} />

        {/* Spine — solid theme colour over the full file height (incl. wrap/bleed), continued over
            the back joint / fold tolerance (quarter-binding look; always outside the back safe area) */}
        <View style={{ position: "absolute", left: spine.left - layout.spineBand, top: 0, width: spine.width + layout.spineBand, height: layout.pageHeight, backgroundColor: theme.coverGradientStart }} />

        {spineText && (
          // Reads top → bottom (ISO 6357): a horizontal row rotated 90° clockwise around the spine centre
          <View
            style={{
              position: "absolute",
              left: cx - runLength / 2,
              top: cy - spine.width / 2,
              width: runLength,
              height: spine.width,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              transform: "rotate(90deg)",
            }}
          >
            {spineText.showBrand && (
              <Image src={ctx.logoWhite} style={{ height: spineText.fontSize * 0.9, width: spineText.fontSize * 0.9 * BRAND_LOGO_ASPECT, opacity: 0.75 }} />
            )}
            <Text style={{ fontFamily: FONTS.display, fontSize: spineText.fontSize, fontWeight: 600, color: "#ffffff", lineHeight: 1.2 }}>{spineText.title}</Text>
          </View>
        )}
        </View>
      </Page>
    </Document>
  );
}

/** Renders the Gelato cover file for the given geometry (from getCoverDimensions().geometry). */
export async function renderCoverSpreadPdf(
  input: BookPdfInput,
  geometry: CoverGeometry,
  prepared?: BookRenderContext,
): Promise<Buffer> {
  const ctx = prepared ?? (await prepareBookRender(input));
  const layout = planCoverSpread(ctx, geometry);
  const element: JSX.Element = createElement(CoverSpreadDocument, { ctx, layout });
  return renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);
}

/**
 * @deprecated Embedding the rendered square front/back pages into the cover
 * file stretched them non-uniformly (~9% on the one delivered order) and
 * ignored hardcover joints/wrap-around. Use renderCoverSpreadPdf(input,
 * geometry) or renderPrintFiles(). Kept only so old call sites fail loudly
 * instead of printing a distorted cover.
 */
export async function buildCoverSpreadFromBook(options: {
  fullBookBuffer: Buffer;
  coverWidthMm: number;
  coverHeightMm: number;
  spineWidthMm: number;
  bookTitle: string;
  spineColor: string;
}): Promise<Buffer> {
  void options;
  throw new Error(
    "buildCoverSpreadFromBook is disabled (distorted covers). Use renderPrintFiles() or renderCoverSpreadPdf(input, coverDimensions.geometry) from @/lib/pdf.",
  );
}
