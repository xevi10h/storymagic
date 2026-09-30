// Server-only: the data behind a read-only share link (/[locale]/preview/[token]).
//
// Security model:
//  - the token (preview-share-token.ts) is verified BEFORE any database access;
//  - the service role reads only whitelisted columns (never user_id/email/account data
//    reach the client — user_id is only compared server-side to detect the owner);
//  - whatever the story status (preview or paid), only the PREVIEW slice is built
//    (toPreviewPages + withTeaserEnd: cover + dedication + 3 scenes + the remaining chapter titles), so paid
//    content never leaves the server; scene image prompts are stripped;
//  - images are signed for that story's folder only, with the 1-hour UI TTL.

import type { BookPage } from "@/components/book-viewer/types";
import type { GeneratedStory } from "@/lib/ai/story-generator";
import { buildBookPages, toPreviewPages } from "@/lib/book-pages";
import { withTeaserEnd } from "@/lib/preview-teaser";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { ILLUSTRATION_URL_TTL, signIllustrationRefs, storyOnlyAccess } from "@/lib/storage/illustration-urls";
import { SHAREABLE_STORY_STATUSES, verifyPreviewShareToken } from "./preview-share-token";

export interface SharedPreview {
  storyId: string;
  ownerId: string; // server-side only: never pass to a client component
  title: string;
  childName: string;
  templateId: string;
  gender: string;
  favoriteColor: string | null;
  pages: BookPage[];
}

export type SharedPreviewResult =
  | { ok: true; preview: SharedPreview }
  | { ok: false; reason: "invalid" | "expired" | "not_found" };

type Character = { name: string; age: number; gender: string; favorite_color: string | null };

export async function loadSharedPreview(token: string): Promise<SharedPreviewResult> {
  const verified = verifyPreviewShareToken(token);
  if (!verified.ok) return verified;

  const admin = createFulfilmentClient();
  const { data: row, error } = await admin
    .from("stories")
    .select(
      "id, user_id, status, template_id, title, cover_image_url, generated_text, dedication_text, sender_name, characters(name, age, gender, favorite_color), story_illustrations(scene_number, image_url, status)",
    )
    .eq("id", verified.storyId)
    .in("status", [...SHAREABLE_STORY_STATUSES])
    .maybeSingle();
  if (error) console.error(`[share] Loading story ${verified.storyId} failed: ${error.message}`);
  if (!row) return { ok: false, reason: "not_found" };

  const generated = row.generated_text as unknown as GeneratedStory | null;
  const characters = row.characters as unknown as Character | Character[] | null;
  const character = Array.isArray(characters) ? characters[0] : characters;
  if (!generated || !Array.isArray(generated.scenes) || !character) return { ok: false, reason: "not_found" };

  const illustrations = (row.story_illustrations ?? []) as { scene_number: number; image_url: string | null; status: string }[];
  const allPages = buildBookPages(
    {
      id: row.id,
      status: "preview",
      template_id: row.template_id,
      title: row.title,
      cover_image_url: row.cover_image_url,
      character_portrait_url: null,
      generated_text: generated,
      dedication_text: row.dedication_text,
      sender_name: row.sender_name,
      characters: {
        ...character,
        city: null,
        interests: null,
        favorite_companion: null,
        future_dream: null,
        avatar_url: null,
      },
      story_illustrations: illustrations,
    },
    "",
    { preview: true },
  );

  const pages = toPreviewPages(allPages).map(stripPage);
  const refs = pages.flatMap((p) => (p.type === "cover" || p.type === "scene" ? [p.imageUrl] : []));
  const signed = await signIllustrationRefs(refs, { ttl: ILLUSTRATION_URL_TTL.ui, allow: storyOnlyAccess(row.id) });
  const sign = (ref: string | null | undefined) => (ref ? (signed.get(ref) ?? null) : null);

  return {
    ok: true,
    preview: {
      storyId: row.id,
      ownerId: row.user_id,
      title: row.title ?? generated.bookTitle,
      childName: character.name,
      templateId: row.template_id,
      gender: character.gender,
      favoriteColor: character.favorite_color,
      // Ends on the remaining chapter titles (signed art only), not on a blank padlock page.
      pages: withTeaserEnd(
        pages.map((p) =>
          p.type === "cover" ? { ...p, imageUrl: sign(p.imageUrl) } : p.type === "scene" ? { ...p, imageUrl: sign(p.imageUrl) } : p,
        ),
        { scenes: generated.scenes.map((s) => ({ sceneNumber: s.sceneNumber, title: s.title })), characterName: character.name },
      ),
    },
  };
}

/** Keep only what the viewer renders: no image prompts; the locked teaser carries no text. */
function stripPage(page: BookPage): BookPage {
  if (page.type !== "scene") return page;
  const { sceneNumber, type, title, text } = page.scene;
  return {
    ...page,
    scene: page.locked
      ? { sceneNumber, type, title: "", text: "", imagePrompt: "" }
      : { sceneNumber, type, title, text, imagePrompt: "" },
  };
}
