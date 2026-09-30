/**
 * Server-only: the book plan with REAL font metrics — the same planner calls the PDF renderer
 * makes (prepareBookRender), so the web viewer receives the printed book's exact page
 * sequence and fitted type. Loads the embedded PDF fonts (Node only).
 */

import { ensurePdfFontsLoaded } from "@/lib/pdf/fonts";
import { planInteriorPages, type PlannedPage } from "@/lib/pdf/layout";
import { fitCoverTexts } from "@/lib/pdf/cover-art";
import { BOOK } from "./print-spec";
import { mapPanelStrings, pdfForName, pdfT } from "./print-text";
import {
  availableImagesOf,
  estimateBookPlan,
  planAssetsOf,
  printedStory,
  type BookPlan,
  type BookPlanSource,
  type PlanPage,
} from "./book-plan";

function toWire(page: PlannedPage): PlanPage {
  if ("scene" in page) {
    const { scene, ...rest } = page;
    return { ...rest, sceneNumber: scene.sceneNumber } as PlanPage;
  }
  return page;
}

/**
 * Plans the printed book of a story. `images` are the hero portrait / map URLs the viewer
 * will load (signed or public) — the map spread is planned only when both the map image and
 * its game exist, exactly like the PDF (buildPdfInput). Never throws: a planning failure
 * falls back to the font-free estimate (logged).
 */
export async function planBook(src: BookPlanSource, images: { hero: string | null; map: string | null }): Promise<BookPlan> {
  try {
    await ensurePdfFontsLoaded();
    const story = printedStory(src);
    const locale = src.locale ?? "es";
    const game = planAssetsOf(story).mapGame ?? null;
    const hasMap = !!(images.map && game);
    const plan = planInteriorPages({
      story,
      characterAge: src.characters.age,
      dedicationText: src.dedication_text,
      senderName: src.sender_name,
      availableImages: availableImagesOf(src),
      map: hasMap && game ? { game, strings: mapPanelStrings(locale, game.band, game.items.length) } : null,
    });
    const { texts } = fitCoverTexts({
      title: story.bookTitle,
      subtitle: pdfForName(locale, "personalizedStory", src.characters.name, src.characters.gender),
      name: src.characters.name,
      synopsis: story.synopsis || pdfT(locale, "defaultSynopsis").replace("{name}", src.characters.name),
      locale,
      visibleWidth: BOOK.trimWidth,
      safe: BOOK.safeMargin,
    });
    return {
      version: 1,
      source: "fitted",
      locale,
      interior: plan.pages.map(toWire),
      cover: texts,
      images: { hero: images.hero, map: hasMap ? images.map : null },
    };
  } catch (err) {
    console.error("[book-plan] Planning with font metrics failed, using the estimate:", err);
    return estimateBookPlan(src, images);
  }
}
