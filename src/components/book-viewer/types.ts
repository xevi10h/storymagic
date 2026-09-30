import type { ReactNode } from "react";
import type { GeneratedScene } from "@/lib/ai/story-generator";
import type { CoverPlan, PlanPageOf } from "@/lib/book/book-plan";
import type { MapPanel } from "@/lib/book/print-spec";

/**
 * One page of the book as the web viewer shows it. Every page of the printed book maps to
 * exactly one entry, in reading order (cover · endpaper · p1–p30 · endpaper · back cover),
 * built from the print plan by src/lib/book-pages.ts and drawn by BookPrintPage in the
 * PDF's own geometry. `teaser_*` pages exist only at the end of the pre-purchase preview.
 */

/** The inner pages of a scene: full-bleed art, panorama halves, text pages, text under a secondary illustration. */
export type ScenePrint = PlanPageOf<"illustration"> | PlanPageOf<"spread"> | PlanPageOf<"text"> | PlanPageOf<"illustration-text">;

export type BookPage =
  | { type: "cover"; title: string; characterName: string; templateId: string; imageUrl: string | null; cover: CoverPlan }
  /** Patterned endpaper; `offset` = x of the page in spread coordinates (pattern continuous across a fold). */
  | { type: "endpaper"; templateId: string; offset: "left" | "right" }
  | { type: "title_dedication"; title: string; print: PlanPageOf<"title-dedication">; characterName: string; kicker: string; quotes: [string, string] }
  | {
      type: "scene";
      scene: GeneratedScene;
      /** Art drawn on this page (primary, panorama or secondary illustration); null on text pages */
      imageUrl: string | null;
      locked: boolean;
      print: ScenePrint;
      /** Panorama halves: bottom gradient height (pt) shared by both halves (spreadGradientHeight) */
      spreadGradient?: number;
    }
  | { type: "final"; print: PlanPageOf<"final">; kicker: string; end: string }
  | {
      type: "hero_card";
      characterName: string;
      heroLabel: string;
      ageLine: string;
      /** Traits as printed: favourite colour (swatch), companion (paw), dream (palette) */
      traits: { label: string; icon: "color" | "pets" | "palette"; color?: string }[];
      interests: string[];
      /** Print-size hero portrait (finalHero), else the cover art — as page 27 of the PDF */
      portraitUrl: string | null;
    }
  /** Adventure map spread (pp. 28–29); the search-and-find panel sits on the right half. */
  | { type: "map"; half: "left" | "right"; imageUrl: string; panel: MapPanel | null }
  | { type: "colophon"; text: string }
  /** Preview end, left: the chapters still to come over blurred art from the book. */
  | { type: "teaser_chapters"; chapters: string[]; firstChapter: number; characterName: string; imageUrl: string | null }
  /** Preview end, right: the printed book (mockup of the real cover) with price and CTA. */
  | {
      type: "teaser_order";
      title: string;
      characterName: string;
      coverUrl: string | null;
      format: "hardcover" | "softcover" | "pdf";
      /** Formatted lowest printed price, e.g. "34,90 €" */
      priceFrom: string;
    }
  | {
      type: "back";
      title: string;
      characterName: string;
      synopsis: string;
      /** Closing illustration (scene 12), else the cover art — as the printed back cover */
      coverImageUrl: string | null;
      templateId: string;
      storyId: string;
      cover: CoverPlan;
    };

export interface BookViewerProps {
  pages: BookPage[];
  templateId: string;
  /** Character gender — influences color palette tinting */
  gender?: string;
  /** Child's favorite color hex — overrides accent palette */
  favoriteColor?: string;
  currentPage: number;
  onPageChange: (pageIndex: number) => void;
  /** Preview only: ✎ buttons on the cover (title) and dedication pages. */
  onEdit?: (target: "cover" | "dedication") => void;
  /** Preview only: the teaser_order page's CTA (scrolls to the formats). */
  onOrder?: () => void;
  /** Hide the "2–3 / 11" page count under the book (the preview shows "3 de 12 escenas" instead). */
  hidePageCount?: boolean;
  /** Extra buttons in the row under the book, next to "Ampliar" (e.g. Compartir). */
  actions?: ReactNode;
}
