// Server-only: turns illustration refs (see illustration-refs.ts) into short-lived
// signed URLs of the PRIVATE `illustrations` bucket.
//
// Authorization model: signing uses the service role, so the CALLER decides who may
// see what. Every signing helper takes an `allow(path)` predicate built from the
// path's owner (illustrationScope) — never from a DB column a user could edit — so a
// user who writes another story's path into their own row still gets nothing.
//
// TTLs (seconds):
//   ui          1 h   book preview / dashboard (pages refetch on load)
//   creation   24 h   the avatar inside the creation flow (kept in localStorage;
//                     refreshed through POST /api/illustrations/sign on resume)
//   serverFetch 10 min server-side downloads (OpenAI refs, QA judge, PDF render)
//
// Print (Gelato) never receives illustration URLs: images are embedded in the
// print PDFs, which Gelato fetches from `book-pdfs` via 7-day signed URLs.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ILLUSTRATIONS_BUCKET, illustrationPath, illustrationScope } from "./illustration-refs";

export const ILLUSTRATION_URL_TTL = {
  ui: 60 * 60,
  creation: 24 * 60 * 60,
  serverFetch: 10 * 60,
} as const;

const SIGN_BATCH = 100;

let serviceClient: SupabaseClient | null = null;

function storageClient(): SupabaseClient {
  if (serviceClient) return serviceClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Missing Supabase service config (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  serviceClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return serviceClient;
}

export type IllustrationAccess = (path: string) => boolean;

/** Service-side access (fulfilment, server downloads): every illustration. */
export const SERVICE_ACCESS: IllustrationAccess = () => true;

/**
 * Access for a signed-in user (incl. anonymous guests) over rows they own:
 *  - story images only under the folders of `storyIds` (stories the caller loaded
 *    with the user's RLS client + user_id filter),
 *  - portraits only under `portraits/<userId>/`,
 *  - legacy portraits (`portraits/<uuid>/file`, pre-2026-09-27, owner not in the
 *    path) only when `allowLegacyPortraits` — callers pass true only for values read
 *    from the user's own rows. Those files were world-readable until this change.
 */
export function userAccess(opts: { userId: string; storyIds?: Iterable<string>; allowLegacyPortraits?: boolean }): IllustrationAccess {
  const stories = new Set([...(opts.storyIds ?? [])].map((id) => id.toLowerCase()));
  const userId = opts.userId.toLowerCase();
  return (path) => {
    const scope = illustrationScope(path);
    switch (scope.kind) {
      case "story":
        return stories.has(scope.storyId);
      case "user-portrait":
        return scope.userId === userId;
      case "legacy-portrait":
        return opts.allowLegacyPortraits === true;
      default:
        return false;
    }
  };
}

/**
 * Resolve many refs at once (one createSignedUrls call per 100 paths).
 * Result maps every input ref to: a signed URL (illustration ref, allowed, object
 * exists), the ref itself (not an illustration ref: showcase/mock/data URI), or
 * null (denied, missing object, or signing failed).
 */
export async function signIllustrationRefs(
  refs: Iterable<string | null | undefined>,
  opts: { ttl: number; allow: IllustrationAccess },
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const pathToRefs = new Map<string, string[]>();
  for (const ref of refs) {
    if (!ref || out.has(ref)) continue;
    const path = illustrationPath(ref);
    if (!path) {
      out.set(ref, ref);
      continue;
    }
    if (!opts.allow(path)) {
      out.set(ref, null);
      continue;
    }
    out.set(ref, null); // until signed
    pathToRefs.set(path, [...(pathToRefs.get(path) ?? []), ref]);
  }

  const paths = [...pathToRefs.keys()];
  for (let i = 0; i < paths.length; i += SIGN_BATCH) {
    const chunk = paths.slice(i, i + SIGN_BATCH);
    const { data, error } = await storageClient().storage.from(ILLUSTRATIONS_BUCKET).createSignedUrls(chunk, opts.ttl);
    if (error || !data) {
      console.error(`[Illustrations] Signing ${chunk.length} URL(s) failed: ${error?.message ?? "no data"}`);
      continue;
    }
    for (const item of data) {
      if (!item.path || !item.signedUrl || item.error) {
        if (item.error) console.warn(`[Illustrations] Cannot sign ${item.path}: ${item.error}`);
        continue;
      }
      for (const ref of pathToRefs.get(item.path) ?? []) out.set(ref, item.signedUrl);
    }
  }
  return out;
}

/** Single-ref convenience over signIllustrationRefs. */
export async function getIllustrationUrl(
  ref: string | null | undefined,
  opts: { ttl: number; allow: IllustrationAccess },
): Promise<string | null> {
  if (!ref) return null;
  return (await signIllustrationRefs([ref], opts)).get(ref) ?? null;
}

/**
 * URL the SERVER can fetch bytes from (OpenAI references, QA judge, PDF prefetch).
 * Illustration refs → 10-min signed URL (service access); anything else unchanged.
 * Throws when an illustration ref cannot be signed (missing object), so callers'
 * existing "download failed" handling applies.
 */
export async function toServerFetchUrl(ref: string): Promise<string> {
  if (!illustrationPath(ref)) return ref;
  const url = await getIllustrationUrl(ref, { ttl: ILLUSTRATION_URL_TTL.serverFetch, allow: SERVICE_ACCESS });
  if (!url) throw new Error(`Illustration not available: ${ref.slice(0, 120)}`);
  return url;
}

/**
 * Normalise a portrait ref coming from the client (or from a user-editable row)
 * into the object path to store/use, or null when the user may not use it.
 * Accepts a bare path, a legacy public URL or a signed URL of the user's own
 * portrait (`portraits/<userId>/...`) or a legacy portrait. Any other URL is
 * rejected (no foreign images, no server-side fetch of arbitrary hosts).
 */
export function ownedPortraitPath(ref: string | null | undefined, userId: string): string | null {
  const path = illustrationPath(ref);
  if (!path) return null;
  const scope = illustrationScope(path);
  if (scope.kind === "user-portrait") return scope.userId === userId.toLowerCase() ? path : null;
  return scope.kind === "legacy-portrait" ? path : null;
}

// ── Row helpers for API responses ────────────────────────────────────────────

interface StoryImageRow {
  id: string;
  cover_image_url?: string | null;
  character_portrait_url?: string | null;
  characters?: { avatar_url?: string | null } | null;
  story_illustrations?: { image_url?: string | null }[] | null;
}

/**
 * Replace every image ref of a story row (as loaded with the user's client and a
 * user_id filter) with a signed URL for that user. Mutates and returns the row.
 */
export async function signStoryRowImages<T extends StoryImageRow>(row: T, userId: string, ttl: number = ILLUSTRATION_URL_TTL.ui): Promise<T> {
  const illustrations = Array.isArray(row.story_illustrations) ? row.story_illustrations : [];
  const character = row.characters && !Array.isArray(row.characters) ? row.characters : null;
  const signed = await signIllustrationRefs(
    [row.cover_image_url, row.character_portrait_url, character?.avatar_url, ...illustrations.map((i) => i.image_url)],
    { ttl, allow: userAccess({ userId, storyIds: [row.id], allowLegacyPortraits: true }) },
  );
  const resolve = (ref: string | null | undefined) => (ref ? (signed.get(ref) ?? null) : (ref ?? null));
  if ("cover_image_url" in row) row.cover_image_url = resolve(row.cover_image_url);
  if ("character_portrait_url" in row) row.character_portrait_url = resolve(row.character_portrait_url);
  if (character && "avatar_url" in character) character.avatar_url = resolve(character.avatar_url);
  for (const ill of illustrations) if ("image_url" in ill) ill.image_url = resolve(ill.image_url);
  return row;
}

/**
 * stories.preview_progress ({ coverUrl?, scenes: [{ index, url }], total }, written by
 * the streaming preview with object paths) → the same shape with signed URLs for the
 * story's owner. Entries that cannot be signed are dropped (the screen just waits).
 * Anything that is not a progress object is returned as null.
 */
export async function signPreviewProgress(progress: unknown, userId: string, storyId: string, ttl: number = ILLUSTRATION_URL_TTL.ui) {
  if (!progress || typeof progress !== "object" || Array.isArray(progress)) return null;
  const p = progress as { coverUrl?: unknown; scenes?: unknown; total?: unknown };
  const coverRef = typeof p.coverUrl === "string" ? p.coverUrl : null;
  const scenes = (Array.isArray(p.scenes) ? p.scenes : []).filter(
    (s): s is { index: number; url: string } =>
      !!s && typeof s === "object" && typeof (s as { index?: unknown }).index === "number" && typeof (s as { url?: unknown }).url === "string",
  );
  const signed = await signIllustrationRefs([coverRef, ...scenes.map((s) => s.url)], {
    ttl,
    allow: userAccess({ userId, storyIds: [storyId] }),
  });
  const coverUrl = coverRef ? (signed.get(coverRef) ?? null) : null;
  // `key` = the stored ref: stable across polls (every signature is a new URL), so the
  // client keeps the image it already shows until the ref itself changes.
  return {
    ...(coverUrl && coverRef ? { coverUrl, coverKey: coverRef } : {}),
    scenes: scenes.flatMap((s) => {
      const url = signed.get(s.url);
      return url ? [{ index: s.index, url, key: s.url }] : [];
    }),
    total: typeof p.total === "number" ? p.total : scenes.length,
  };
}
