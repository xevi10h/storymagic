// Book page model shared by the owner preview (/crear/[storyId]/preview) and the
// read-only share view (/preview/[token]). Pure, client- and server-safe.

import type { BookPage } from "@/components/book-viewer/types";
import { SCENE_LAYOUT_PAIRS, artCarriesTitle, getActLabel, getSpreadType } from "@/components/book-viewer/types";
import type { GeneratedStory } from "@/lib/ai/story-generator";
import { FREE_PREVIEW_SCENES } from "@/lib/preview-access";

export interface BookPageSource {
  id: string;
  status: string;
  template_id: string;
  title: string | null;
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
}

/**
 * Preview stage: the first N scenes are shown in full, then one locked teaser page.
 * Same constant the APIs redact to (lib/preview-access.ts): the server never sends more.
 */
export const PREVIEW_CLEAR_SCENES = FREE_PREVIEW_SCENES;
/** 3 header pages + clear scenes × 2 pages + 1 locked teaser = 10. */
export const PREVIEW_PAGE_COUNT = 3 + PREVIEW_CLEAR_SCENES * 2 + 1;

/**
 * Build exactly 32 pages — standard children's book structure:
 *
 *  1  Cover
 *  2  Front endpaper
 *  3  Title + Dedication (combined)
 *  4-27  12 scenes × 2 pages = 24
 *  28 Final message
 *  29 Hero card
 *  30 Colophon (imprint + QR)
 *  31 Back endpaper
 *  32 Back cover
 *
 * 3 header pages (odd count) ensure all scene first-pages land on LEFT positions in
 * the two-page viewer, so panoramic spreads are on facing pages.
 *
 * `preview` locks every scene without a ready illustration (the owner's preview).
 */
export function buildBookPages(story: BookPageSource, synopsisFallback: string, opts: { preview: boolean }): BookPage[] {
  const generated = story.generated_text;
  const illustrations = [...story.story_illustrations].sort((a, b) => a.scene_number - b.scene_number);
  const title = story.title ?? generated.bookTitle;

  const pages: BookPage[] = [
    { type: "cover", title, characterName: story.characters.name, templateId: story.template_id, imageUrl: story.cover_image_url ?? null },
    { type: "endpaper", templateId: story.template_id },
    {
      type: "title_dedication",
      title,
      characterName: story.characters.name,
      templateId: story.template_id,
      dedicationText: story.dedication_text ?? generated.dedication,
      senderName: story.sender_name,
    },
  ];

  // Each scene = 2 pages. Layout pairs define the visual variety; act labels mark the
  // start of each act; spread types cycle galeria → pergamino → ventana (bridges = puente),
  // matching the PDF editorial cycling system exactly.
  let sceneOnlyIndex = 0;
  for (const scene of generated.scenes) {
    const pair = SCENE_LAYOUT_PAIRS[(scene.sceneNumber - 1) % SCENE_LAYOUT_PAIRS.length];
    const isSpread = pair[0] === "spread_left";
    const spreadType = getSpreadType(scene.type ?? "scene", sceneOnlyIndex);

    const illustration = illustrations.find((i) => i.scene_number === scene.sceneNumber);
    const secondary = illustrations.find((i) => i.scene_number === scene.sceneNumber + 12);
    const hasIllustration = illustration?.status === "ready" && !!illustration?.image_url;
    const secondaryImageUrl = secondary?.status === "ready" && secondary.image_url ? secondary.image_url : null;
    const locked = opts.preview && !hasIllustration;
    const imageUrl = illustration?.image_url ?? null;
    const actLabel = getActLabel(scene.sceneNumber);
    const characterAge = story.characters.age;

    // Page 2 (facing page): panorama right half, secondary illustration + text, or text page
    const facing: Extract<BookPage, { type: "scene" }> = isSpread
      ? { type: "scene", scene, imageUrl, locked, layout: "spread_right", characterAge, spreadType }
      : secondaryImageUrl
        ? { type: "scene", scene, imageUrl: secondaryImageUrl, locked, layout: "illustration_text", characterAge, spreadType }
        : { type: "scene", scene, imageUrl: null, locked, layout: pair[1], characterAge, spreadType };

    // Page 1: full-bleed art (or panorama left half) + optional act label. As in print, the
    // scene title goes on the art only when the facing page has no heading.
    const artTitle = artCarriesTitle(pair[0], facing);
    pages.push({ type: "scene", scene, imageUrl, locked, layout: pair[0], actLabel, characterAge, spreadType, artTitle });
    pages.push(facing);

    if (scene.type !== "bridge") sceneOnlyIndex++;
  }

  pages.push({ type: "final", message: generated.finalMessage, characterName: story.characters.name });
  pages.push({
    type: "hero_card",
    characterName: story.characters.name,
    age: story.characters.age,
    city: story.characters.city,
    gender: story.characters.gender,
    interests: story.characters.interests ?? [],
    favoriteColor: story.characters.favorite_color,
    favoriteCompanion: story.characters.favorite_companion,
    futureDream: story.characters.future_dream,
    avatarUrl: story.characters.avatar_url,
    portraitUrl: story.character_portrait_url,
    templateId: story.template_id,
  });
  pages.push({ type: "colophon", storyId: story.id });
  pages.push({ type: "endpaper", templateId: story.template_id });

  const lastSceneIllustration = illustrations.find((i) => i.scene_number === generated.scenes.length);
  const backCoverImageUrl =
    (lastSceneIllustration?.status === "ready" && lastSceneIllustration?.image_url) || story.cover_image_url;
  pages.push({
    type: "back",
    title,
    characterName: story.characters.name,
    synopsis: generated.synopsis ?? synopsisFallback,
    coverImageUrl: backCoverImageUrl,
    templateId: story.template_id,
    storyId: story.id,
  });

  return pages;
}

/** The preview-stage slice of a book: header + clear scenes + the last page forced into a locked teaser. */
export function toPreviewPages(pages: BookPage[]): BookPage[] {
  return pages.slice(0, PREVIEW_PAGE_COUNT).map((page, i) =>
    i === PREVIEW_PAGE_COUNT - 1 && page.type === "scene" ? { ...page, locked: true, imageUrl: null } : page,
  );
}
