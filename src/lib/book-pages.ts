// The web book = the printed book. Builds the viewer's pages from the print plan
// (src/lib/book/book-plan.ts — made server-side with the PDF's own planner), in the PDF's
// reading order: cover · endpaper · p1–p30 · endpaper · back cover (34 pages).
// Used by the owner preview (/crear/[storyId]/preview), the example books (/ejemplo/[id])
// and the read-only share view (/preview/[token]). Pure, client- and server-safe.

import type { BookPage, ScenePrint } from "@/components/book-viewer/types";
import type { GeneratedStory } from "@/lib/ai/story-generator";
import { FREE_PREVIEW_SCENES } from "@/lib/preview-access";
import { estimateBookPlan, printedStory, type BookPlan } from "@/lib/book/book-plan";
import { PAGES_BEFORE_INTERIOR } from "@/lib/book/sequence";
import { spreadGradientHeight } from "@/lib/book/print-spec";
import { colorName, interestLabel, joinName, pdfForName, pdfT, printQuotes, sanitizePrintText } from "@/lib/book/print-text";
import { FAVORITE_COLORS } from "@/lib/create-store";

export interface BookPageSource {
  id: string;
  status: string;
  template_id: string;
  title: string | null;
  /** Book language (stories.locale); the printed copy is in this language */
  locale?: string | null;
  cover_image_url: string | null;
  character_portrait_url: string | null;
  generated_text: GeneratedStory;
  dedication_text: string | null;
  sender_name: string | null;
  characters: {
    name: string;
    age: number;
    gender: string;
    city: string | null;
    interests: string[] | null;
    favorite_color: string | null;
    favorite_companion: string | null;
    future_dream: string | null;
    avatar_url: string | null;
  };
  story_illustrations: { scene_number: number; image_url: string | null; status: string }[];
  /** Print plan made server-side with the PDF's font metrics (book-plan.server.ts). */
  book_plan?: BookPlan | null;
}

/**
 * Preview stage: the first N scenes are shown in full, then one locked teaser page.
 * Same constant the APIs redact to (lib/preview-access.ts): the server never sends more.
 */
export const PREVIEW_CLEAR_SCENES = FREE_PREVIEW_SCENES;
/** Cover + endpaper + p1 + clear scenes × 2 pages + 1 locked teaser = 10. */
export const PREVIEW_PAGE_COUNT = PAGES_BEFORE_INTERIOR + 1 + PREVIEW_CLEAR_SCENES * 2 + 1;

/**
 * The 34 pages of the book, exactly as printed (src/lib/book/sequence.ts). With no server
 * plan (`book_plan`), a font-free estimate keeps the same sequence with the age band's sizes.
 *
 * `preview` locks every scene without a ready illustration (the owner's preview).
 */
export function buildBookPages(story: BookPageSource, _synopsisFallback: string, opts: { preview: boolean }): BookPage[] {
  const printed = printedStory(story);
  const locale = story.locale ?? "es";
  // No server plan: the estimate has no usable hero/map URLs (stored refs are private paths).
  const plan = story.book_plan ?? estimateBookPlan({ ...story, locale }, { hero: null, map: null });
  const c = story.characters;
  const name = c.name;
  const scenes = new Map(printed.scenes.map((s) => [s.sceneNumber, s]));
  const ready = new Map(
    story.story_illustrations.filter((i) => i.status === "ready" && !!i.image_url).map((i) => [i.scene_number, i.image_url as string]),
  );
  const title = plan.cover.title;

  const pages: BookPage[] = [
    { type: "cover", title, characterName: name, templateId: story.template_id, imageUrl: story.cover_image_url ?? null, cover: plan.cover },
    { type: "endpaper", templateId: story.template_id, offset: "left" },
  ];

  for (const p of plan.interior) {
    switch (p.kind) {
      case "title-dedication":
        pages.push({
          type: "title_dedication",
          title,
          print: p,
          characterName: sanitizePrintText(name),
          kicker: pdfForName(locale, "personalizedAdventure", name, c.gender),
          quotes: printQuotes(locale),
        });
        break;
      case "illustration":
      case "spread":
      case "text":
      case "illustration-text": {
        const scene = scenes.get(p.sceneNumber);
        if (!scene) break;
        const imageScene = p.kind === "text" ? null : p.image.sceneNumber;
        const imageUrl = imageScene !== null ? (ready.get(imageScene) ?? null) : null;
        // The owner's preview locks the scene until its main illustration exists.
        const locked = opts.preview && !ready.has(p.sceneNumber);
        const spreadGradient =
          p.kind === "spread"
            ? spreadGradientHeight(plan.interior.flatMap((q) => (q.kind === "spread" && q.sceneNumber === p.sceneNumber ? [q.overlay] : [])))
            : undefined;
        pages.push({ type: "scene", scene, imageUrl: locked ? null : imageUrl, locked, print: p as ScenePrint, spreadGradient });
        break;
      }
      case "final":
        pages.push({
          type: "final",
          print: p,
          kicker: joinName(pdfForName(locale, "createdFor", name, c.gender), sanitizePrintText(name)),
          end: pdfT(locale, "end"),
        });
        break;
      case "about-reader": {
        const colorId = c.favorite_color ? FAVORITE_COLORS.find((f) => f.color === c.favorite_color)?.id : undefined;
        const traits: Extract<BookPage, { type: "hero_card" }>["traits"] = [];
        if (colorId && c.favorite_color) traits.push({ label: colorName(locale, colorId), icon: "color", color: c.favorite_color });
        if (c.favorite_companion) traits.push({ label: sanitizePrintText(c.favorite_companion), icon: "pets" });
        if (c.future_dream) traits.push({ label: sanitizePrintText(c.future_dream), icon: "palette" });
        pages.push({
          type: "hero_card",
          characterName: sanitizePrintText(name),
          heroLabel: pdfT(locale, c.gender === "girl" ? "heroine" : "hero"),
          ageLine: `${c.age} ${pdfT(locale, "years")}${c.city ? `  ·  ${sanitizePrintText(c.city)}` : ""}`,
          traits,
          interests: (c.interests ?? []).slice(0, 8).map((i) => sanitizePrintText(interestLabel(locale, i))),
          // p27: the print-size hero render, else the cover art (never the small avatar)
          portraitUrl: plan.images.hero ?? story.cover_image_url ?? null,
        });
        break;
      }
      case "map":
        if (plan.images.map) pages.push({ type: "map", half: p.half, imageUrl: plan.images.map, panel: p.panel });
        else pages.push({ type: "endpaper", templateId: story.template_id, offset: p.half });
        break;
      case "endpaper":
        pages.push({ type: "endpaper", templateId: story.template_id, offset: p.side === "left" ? "left" : "right" });
        break;
      case "colophon":
        pages.push({ type: "colophon", text: pdfT(locale, "colophonText") });
        break;
    }
  }

  pages.push({ type: "endpaper", templateId: story.template_id, offset: "right" });
  // Back cover art: the closing illustration, falling back to the cover art (backCoverImage)
  pages.push({
    type: "back",
    title,
    characterName: name,
    synopsis: plan.cover.synopsis,
    coverImageUrl: ready.get(printed.scenes.length) ?? story.cover_image_url,
    templateId: story.template_id,
    storyId: story.id,
    cover: plan.cover,
  });
  return pages;
}

/** The preview-stage slice of a book: header + clear scenes + the last page forced into a locked teaser. */
export function toPreviewPages(pages: BookPage[]): BookPage[] {
  return pages.slice(0, PREVIEW_PAGE_COUNT).map((page, i) =>
    i === PREVIEW_PAGE_COUNT - 1 && page.type === "scene" ? { ...page, locked: true, imageUrl: null } : page,
  );
}
