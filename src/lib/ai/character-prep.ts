// Character prep — the child's preview character sheet rendered BEFORE the Book
// Plan (POST /api/characters/prepare, called when the parent leaves the
// protagonist screen). The stories generate route reuses it through
// stories.character_prep_id when the Character Bible still matches.
//
// Table: public.character_preps (supabase/migrations/20260927140100_streaming_preview.sql).
// The optional child photo is used for the sheet only and deleted right after;
// its path is never stored (only `had_photo`).

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCharacterBible, loadReference, stageConfig, type CharacterBible, type CharacterDescriptionInput } from "./book-images";
import type { StoredSheet } from "./preview-book";

export const CHARACTER_PREPS_TABLE = "character_preps";
/** A 'rendering' row older than this belongs to a dead function (prepare maxDuration is 120 s). */
export const PREP_STALE_MS = 150_000;

export interface CharacterTraits {
  gender: "boy" | "girl" | "neutral";
  age: number;
  skinTone?: string | null;
  hairColor?: string | null;
  eyeColor?: string | null;
  hairstyle?: string | null;
  favoriteColor?: string | null;
  glasses?: string | null;
  freckles?: boolean | null;
}

/**
 * The Bible input with the SAME defaults POST /api/stories uses when it stores
 * the character row (hair_color "brown", skin_tone "medium", hairstyle "short",
 * glasses "none", freckles false) and the same shape the generate route builds
 * (row + extraTraits), so a prep made from the UI's traits matches the story.
 */
export function bibleInputFromTraits(t: CharacterTraits): CharacterDescriptionInput {
  return {
    gender: t.gender,
    age: t.age,
    skinTone: t.skinTone || "medium",
    hairColor: t.hairColor || "brown",
    eyeColor: t.eyeColor || undefined,
    hairstyle: t.hairstyle || "short",
    favoriteColor: t.favoriteColor || undefined,
    glasses: t.glasses || "none",
    freckles: t.freckles ?? false,
  };
}

/** What the child sheet depends on: the Bible text + the preview model/quality. */
export function bibleHash(bible: CharacterBible): string {
  const cfg = stageConfig("preview");
  return sha256(JSON.stringify({ v: 1, description: bible.description, age: bible.age, gender: bible.gender, model: cfg.model, quality: cfg.quality }));
}

export function prepFingerprint(hash: string, avatarRef: string | null, photoPath: string | null): string {
  return sha256(JSON.stringify({ hash, avatarRef, photoPath }));
}

export function prepBible(traits: CharacterTraits): CharacterBible {
  // The Bible has no photo field (the photo is deleted after the sheet).
  return buildCharacterBible(bibleInputFromTraits(traits));
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** "/images/avatar/x.jpg" and "https://host/images/avatar/x.jpg" are the same pre-rendered avatar. */
export function normalizeAvatarRef(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const m = ref.match(/^https?:\/\/[^/]+(\/images\/avatar\/.+)$/);
  return m ? m[1] : ref;
}

export interface PrepRow {
  id: string;
  user_id: string;
  status: "rendering" | "ready" | "failed";
  bible_hash: string;
  avatar_ref: string | null;
  child_sheet_url: string | null;
  started_at: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The prepared child sheet for a story, or null (→ the preview renders its own).
 * Waits while the prep is still rendering (it runs in parallel with the Book
 * Plan, so waiting is never slower than starting over), up to the point where
 * the prep function must be dead.
 */
export async function resolvePreparedChildSheet(
  admin: SupabaseClient,
  opts: { prepId: string; userId: string; bible: CharacterBible; avatarUrl: string | null; maxWaitMs?: number },
): Promise<StoredSheet | null> {
  const expectedHash = bibleHash(opts.bible);
  const waitUntil = Date.now() + (opts.maxWaitMs ?? 90_000);
  for (;;) {
    const { data, error } = await admin
      .from(CHARACTER_PREPS_TABLE)
      .select("id, user_id, status, bible_hash, avatar_ref, child_sheet_url, started_at")
      .eq("id", opts.prepId)
      .eq("user_id", opts.userId)
      .maybeSingle<PrepRow>();
    if (error || !data) {
      if (error) console.warn(`[CharacterPrep] lookup failed: ${error.message}`);
      return null;
    }
    if (data.bible_hash !== expectedHash) {
      console.log("[CharacterPrep] traits changed since the prep — not reused");
      return null;
    }
    const storyAvatar = normalizeAvatarRef(opts.avatarUrl);
    if (storyAvatar && storyAvatar !== normalizeAvatarRef(data.avatar_ref)) {
      console.log("[CharacterPrep] avatar changed since the prep — not reused");
      return null;
    }
    if (data.status === "ready" && data.child_sheet_url) {
      return { ref: await loadReference(data.child_sheet_url), url: data.child_sheet_url };
    }
    if (data.status !== "rendering") return null;
    const deadAt = new Date(data.started_at).getTime() + PREP_STALE_MS;
    if (Date.now() >= Math.min(waitUntil, deadAt)) {
      console.warn("[CharacterPrep] still rendering past the wait budget — not reused");
      return null;
    }
    await sleep(1000);
  }
}
