// Illustration references — pure helpers (no I/O, safe in client + server code).
//
// Children's imagery (avatar portraits, character sheets, scenes, covers) lives in
// the PRIVATE `illustrations` bucket. The database stores an "illustration ref":
//
//   new rows     object path            e.g. "<storyId>/final/scene-3-m1x2k3-9f2a.jpg"
//                                            "portraits/<userId>/<uuid>/portrait-m1x2-9f2a.jpg"
//   legacy rows  full public URL        ".../storage/v1/object/public/illustrations/<path>"
//
// Anything else (showcase public URLs, MOCK_MODE picsum URLs, data: URIs, local
// /images assets) is not an illustration ref and is passed through untouched.
// Refs are turned into short-lived signed URLs server-side (illustration-urls.ts).
//
// Marketing example books ("ejemplo", landing, waitlist) are served from the PUBLIC
// `showcase` bucket, which mirrors the same object paths (scripts/publish-showcase.mts).

export const ILLUSTRATIONS_BUCKET = "illustrations";
export const SHOWCASE_BUCKET = "showcase";

/** Any Supabase Storage URL pointing into the illustrations bucket (public / signed / authenticated / render). */
const STORAGE_URL_RE = /\/storage\/v1\/(?:object|render\/image)\/(?:public|sign|authenticated)\/illustrations\/([^?#]+)/;

/** A bare object path: no scheme, no leading slash, no traversal. */
function isBarePath(ref: string): boolean {
  return (
    ref.length > 0 &&
    !/^[a-z][a-z0-9+.-]*:/i.test(ref) &&
    !ref.startsWith("/") &&
    !ref.split("/").some((seg) => seg === ".." || seg === "." || seg === "")
  );
}

/**
 * Object path inside the illustrations bucket, or null when `ref` is not an
 * illustration ref (null/empty, showcase/picsum/external URL, data: URI, local asset).
 */
export function illustrationPath(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const value = ref.trim();
  if (isBarePath(value)) return value;
  if (!/^https?:\/\//i.test(value)) return null;
  const match = STORAGE_URL_RE.exec(value);
  if (!match) return null;
  let path: string;
  try {
    path = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  return isBarePath(path) ? path : null;
}

export function isIllustrationRef(ref: string | null | undefined): boolean {
  return illustrationPath(ref) !== null;
}

/**
 * Who owns an illustration path — the basis of every authorization decision.
 * Ownership comes from the PATH (written by our server), never from a DB column
 * a user could edit.
 *
 *   <storyId>/...                       → story    (owner = stories.user_id)
 *   portraits/<userId>/<uuid>/<file>    → user     (owner = userId)
 *   portraits/<uuid>/<file>             → legacy-portrait (pre-2026-09-27, owner unknown from the path)
 */
export type IllustrationScope =
  | { kind: "story"; storyId: string }
  | { kind: "user-portrait"; userId: string }
  | { kind: "legacy-portrait" }
  | { kind: "other" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function illustrationScope(path: string): IllustrationScope {
  const segments = path.split("/");
  if (segments[0] === "portraits") {
    if (segments.length >= 4 && UUID_RE.test(segments[1])) return { kind: "user-portrait", userId: segments[1].toLowerCase() };
    if (segments.length === 3) return { kind: "legacy-portrait" };
    return { kind: "other" };
  }
  if (segments.length >= 2 && UUID_RE.test(segments[0])) return { kind: "story", storyId: segments[0].toLowerCase() };
  return { kind: "other" };
}

/** Storage folder for a user's avatar portraits (ownership encoded in the path). */
export function portraitFolder(userId: string, portraitId: string): string {
  return `portraits/${userId}/${portraitId}`;
}

/** Public URL of the showcase mirror of an illustrations object path. */
export function showcasePublicUrl(supabaseUrl: string, path: string): string {
  const base = supabaseUrl.trim().replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/${SHOWCASE_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * Showcase (marketing example) image: illustration refs are mapped onto the public
 * `showcase` mirror; anything else (already-public URL, mock) is returned as is.
 * Never signs — showcase pages are cached and used in OG tags.
 */
export function toShowcaseUrl(ref: string | null | undefined, supabaseUrl: string): string | null {
  if (!ref) return null;
  const path = illustrationPath(ref);
  return path ? showcasePublicUrl(supabaseUrl, path) : ref;
}
