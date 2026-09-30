/**
 * The whole printed book as data — the contract between the print planner and the web viewer.
 *
 * The server builds it with real font metrics (book-plan.server.ts → planInteriorPages +
 * fitCoverTexts, exactly what the PDF renders) and ships it with the story
 * (`book_plan` on /api/stories/[id], /api/showcase/[id], the share view). The web viewer
 * (src/lib/book-pages.ts → BookPrintPage) draws every page from it in the PDF's point
 * geometry, so the screen shows the same pages, in the same order, with the same text,
 * type sizes, crops and composition as the printed book.
 *
 * `estimateBookPlan` is the font-free fallback (same page sequence, the age band's sizes)
 * for a story delivered without a plan — e.g. an API mock. Pure: client- and server-safe.
 */

import type { GeneratedScene, GeneratedStory } from "@/lib/ai/story-generator";
import type { MapGame } from "@/lib/ai/adventure-map";
import type { PlannedPage } from "@/lib/pdf/layout";
import {
  BOOK,
  GEOMETRY,
  getPdfTextConfig,
  splitTitleOnName,
  type BackCoverLayout,
  type CoverTitleLockup,
  type FittedType,
  type MapPanel,
} from "./print-spec";
import { SECONDARY_SCENE_OFFSET, sequenceInterior } from "./sequence";
import { mapPanelStrings, pdfForName, pdfT, printQuotes, sanitizePrintText, tieLastWords } from "./print-text";

/** A planned inner page on the wire: the scene is referenced by number (its text is on the page). */
type Wire<P> = P extends { scene: GeneratedScene } ? Omit<P, "scene"> & { sceneNumber: number } : P;
export type PlanPage = Wire<PlannedPage>;
export type PlanPageOf<K extends PlanPage["kind"]> = Extract<PlanPage, { kind: K }>;

/** Cover copy + fitted sizes (src/lib/pdf/cover-art.tsx CoverTexts). */
export interface CoverPlan {
  title: string;
  titleLockup: CoverTitleLockup;
  subtitle: string;
  name: string;
  synopsis: string;
  synopsisQuotes: [open: string, close: string];
  back: BackCoverLayout;
}

export interface BookPlan {
  version: 1;
  /** "fitted": real font metrics (server, = the PDF); "estimated": font-free fallback */
  source: "fitted" | "estimated";
  /** Book language (stories.locale) — the printed copy is in this language */
  locale: string;
  /** The 30 inner pages, p1 … p30 */
  interior: PlanPage[];
  cover: CoverPlan;
  /** Hero portrait (p27) and adventure map (pp. 28–29) — URLs usable by the viewer */
  images: { hero: string | null; map: string | null };
}

/** What a plan is built from (a stories row with its character and illustrations). */
export interface BookPlanSource {
  title: string | null;
  locale?: string | null;
  generated_text: GeneratedStory;
  dedication_text: string | null;
  sender_name: string | null;
  characters: { name: string; age: number; gender: string };
  story_illustrations: { scene_number: number; image_url: string | null; status: string }[];
}

/** imageAssets written by the final-book pipeline (src/lib/ai/book-images.ts BookImageAssets). */
export interface PlanImageAssets {
  finalHero?: { url: string } | null;
  finalMap?: { url: string } | null;
  mapGame?: MapGame | null;
}

export function planAssetsOf(story: GeneratedStory | null | undefined): PlanImageAssets {
  return ((story as { imageAssets?: PlanImageAssets } | null)?.imageAssets ?? {}) as PlanImageAssets;
}

/** The story as printed: an edited title (stories.title) replaces the generated one, as in the fulfilment pipeline. */
export function printedStory(src: Pick<BookPlanSource, "title" | "generated_text">): GeneratedStory {
  return src.title ? { ...src.generated_text, bookTitle: src.title } : src.generated_text;
}

/** Scene numbers (1–24) with a usable image — the same set the PDF prints. */
export function availableImagesOf(src: Pick<BookPlanSource, "story_illustrations">): Set<number> {
  return new Set(src.story_illustrations.filter((i) => i.status === "ready" && !!i.image_url).map((i) => i.scene_number));
}

// ── Font-free fallback ────────────────────────────────────────────────────

const EST_OVERLAY_TITLE: FittedType = { fontSize: 20, leading: 1.25 };

/** Same page sequence as the PDF with the age band's sizes (no font metrics). */
export function estimateBookPlan(src: BookPlanSource, images: { hero: string | null; map: string | null }): BookPlan {
  const story = printedStory(src);
  const locale = src.locale ?? "es";
  const tc = getPdfTextConfig(src.characters.age);
  const body: FittedType = { fontSize: tc.body, leading: tc.bodyLeading };
  const game = planAssetsOf(story).mapGame ?? null;
  const hasMap = !!(images.map && game);
  const scenes = new Map(story.scenes.map((s) => [s.sceneNumber, s]));
  const text = (n: number) => tieLastWords(sanitizePrintText(scenes.get(n)?.text ?? ""));

  const interior: PlanPage[] = sequenceInterior({ scenes: story.scenes, availableImages: availableImagesOf(src), hasMap }).map((p): PlanPage => {
    const base = { pageNumber: p.pageNumber, side: p.side };
    switch (p.kind) {
      case "title-dedication":
        return {
          ...base,
          kind: "title-dedication",
          title: sanitizePrintText(story.bookTitle),
          titleType: { fontSize: 26, leading: 1.3 },
          dedication: sanitizePrintText(src.dedication_text?.trim() || story.dedication || ""),
          dedicationType: { fontSize: 12, leading: 1.7 },
          sender: src.sender_name ? sanitizePrintText(src.sender_name) : null,
          front: { scale: 1, kicker: 11, display: 18, sender: 10, logo: 14 },
        };
      case "illustration":
        return {
          ...base,
          kind: "illustration",
          sceneNumber: p.scene.sceneNumber,
          layout: p.layout,
          image: { sceneNumber: p.scene.sceneNumber, boxWidth: BOOK.pageWidth, boxHeight: BOOK.pageHeight, windowLeft: 0 },
          title: p.artTitle ? EST_OVERLAY_TITLE : null,
        };
      case "spread": {
        const n = p.scene.sceneNumber;
        const image = { sceneNumber: n, boxWidth: GEOMETRY.spreadWidth, boxHeight: BOOK.pageHeight, windowLeft: p.half === "left" ? 0 : GEOMETRY.spreadRightOffset };
        if (p.half === "left") {
          return { ...base, kind: "spread", half: "left", sceneNumber: n, image, overlay: { text: sanitizePrintText(p.scene.title), type: EST_OVERLAY_TITLE, role: "title", mode: "gradient", blockHeight: 2 * 20 * 1.25 } };
        }
        const words = text(n).split(/\s+/).length;
        const mode = words <= 45 ? "gradient" : "panel";
        return { ...base, kind: "spread", half: "right", sceneNumber: n, image, overlay: { text: text(n), type: body, role: "body", mode, blockHeight: GEOMETRY.maxGradientTextHeight } };
      }
      case "text":
        return {
          ...base,
          kind: "text",
          sceneNumber: p.scene.sceneNumber,
          variant: p.variant,
          body: text(p.scene.sceneNumber),
          titleType: p.variant === "puente" ? EST_OVERLAY_TITLE : { fontSize: tc.title, leading: 1.3 },
          bodyType: p.variant === "puente" ? { fontSize: tc.bridgeText, leading: 1.5 } : body,
          scale: 1,
          lift: 0,
        };
      case "illustration-text":
        return {
          ...base,
          kind: "illustration-text",
          sceneNumber: p.scene.sceneNumber,
          image: { sceneNumber: p.scene.sceneNumber + SECONDARY_SCENE_OFFSET, boxWidth: BOOK.pageWidth, boxHeight: GEOMETRY.illTextImageHeight, windowLeft: 0 },
          body: text(p.scene.sceneNumber),
          bodyType: body,
        };
      case "final":
        return {
          ...base,
          kind: "final",
          message: sanitizePrintText(story.finalMessage ?? ""),
          messageType: { fontSize: Math.max(16, tc.body * 1.1), leading: 1.5 },
          front: { scale: 1, kicker: 9.5, display: 26, sender: 10, logo: 14 },
        };
      case "map": {
        if (p.half === "left" || !game) return { ...base, kind: "map", half: p.half, panel: null };
        const strings = mapPanelStrings(locale, game.band, game.items.length);
        const panel: MapPanel = {
          band: game.band,
          kicker: strings.kicker,
          title: strings.title,
          howTo: strings.howTo,
          items: game.items.map((it) => {
            const label = sanitizePrintText(it.label);
            return game.band === "little" ? label : label.charAt(0).toLocaleUpperCase() + label.slice(1);
          }),
          trail: game.band === "middle" ? sanitizePrintText(game.trailLine) || strings.trail : null,
          questionsTitle: strings.questions,
          questions: game.band === "big" ? game.questions.map((q) => sanitizePrintText(q.question)) : [],
          answers:
            game.band === "big" && game.questions.length
              ? `${strings.answers}: ${game.questions.map((q, i) => `${i + 1}. ${sanitizePrintText(q.answer).replace(/ /g, " ")}`).join("   ")}`
              : null,
          scale: 0.9,
          height: 0,
        };
        return { ...base, kind: "map", half: "right", panel };
      }
      default:
        return { ...base, kind: p.kind };
    }
  });

  return { version: 1, source: "estimated", locale, interior, cover: estimateCover(src, story, locale), images: { hero: images.hero, map: hasMap ? images.map : null } };
}

function estimateCover(src: BookPlanSource, story: GeneratedStory, locale: string): CoverPlan {
  const title = sanitizePrintText(story.bookTitle);
  const name = sanitizePrintText(src.characters.name);
  const split = splitTitleOnName(title, name);
  const rest = { fontSize: 22, leading: 1.15 };
  const titleLockup: CoverTitleLockup = split
    ? {
        segments: [
          ...(split.pre ? [{ text: split.pre, type: rest, hero: false }] : []),
          { text: split.hero, type: { fontSize: 52, leading: 1.05 }, hero: true },
          ...(split.post ? [{ text: split.post, type: rest, hero: false }] : []),
        ],
        height: 0,
        showSubtitle: false,
      }
    : { segments: [{ text: title, type: { fontSize: 30, leading: 1.15 }, hero: false }], height: 0, showSubtitle: true };
  return {
    title,
    titleLockup,
    subtitle: sanitizePrintText(pdfForName(locale, "personalizedStory", name, src.characters.gender)),
    name,
    synopsis: sanitizePrintText(story.synopsis || pdfT(locale, "defaultSynopsis").replace("{name}", name)),
    synopsisQuotes: printQuotes(locale),
    back: { titleType: { fontSize: 16, leading: 1.2 }, synopsisType: { fontSize: 11.5, leading: 1.5 }, measure: Math.min((BOOK.trimWidth - 2 * BOOK.safeMargin) * 0.82, 132 * (72 / 25.4)), vignette: 150 },
  };
}
