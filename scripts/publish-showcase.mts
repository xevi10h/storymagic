/**
 * Publish marketing imagery to the PUBLIC `showcase` bucket (the `illustrations`
 * bucket holding children's images is private since 2026-09-27).
 *
 * Copies, server side, from `illustrations` to `showcase` under the SAME object path:
 *   - every image of stories flagged is_showcase (cover, portrait, avatar, scenes)
 *     → the app maps their refs to the showcase mirror (toShowcaseUrl), rows untouched
 *   - waitlist covers (waitlist-covers/*, the Teo example cover) and style-samples/*
 *   - images referenced by blog_posts (cover_image_url + body_markdown); those rows
 *     ARE rewritten to the showcase public URL (the blog renders stored URLs as is)
 *
 * Idempotent (existing destination objects are skipped). Run it BEFORE applying
 * supabase/migrations/20260927140100_private_illustrations.sql, and again every
 * time a story is newly flagged is_showcase. Unflagging does NOT delete the copy:
 * remove it from the `showcase` bucket by hand.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/publish-showcase.mts [--dry-run]
 */

import { readFileSync } from "fs";
import { resolve } from "path";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const { createClient } = await import("@supabase/supabase-js");
const { ILLUSTRATIONS_BUCKET, SHOWCASE_BUCKET, illustrationPath, showcasePublicUrl } = await import("../src/lib/storage/illustration-refs.ts");

const DRY_RUN = process.argv.includes("--dry-run");
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/** Static marketing objects (src/components/waitlist/WaitlistPage.tsx). */
const STATIC_PATHS = ["f6b7a973-e2de-41f9-9b80-bd86c21febca/cover-1774593946858.png"];
const STATIC_PREFIXES = ["waitlist-covers", "style-samples"];

async function ensureBucket(): Promise<void> {
  const { data } = await admin.storage.getBucket(SHOWCASE_BUCKET);
  if (data) {
    if (!data.public) throw new Error(`Bucket "${SHOWCASE_BUCKET}" exists but is not public — apply 20260927140000_showcase_bucket.sql`);
    return;
  }
  if (DRY_RUN) return console.log(`[dry-run] would create public bucket "${SHOWCASE_BUCKET}"`);
  const { error } = await admin.storage.createBucket(SHOWCASE_BUCKET, { public: true });
  if (error) throw new Error(`createBucket(${SHOWCASE_BUCKET}): ${error.message}`);
  console.log(`Created public bucket "${SHOWCASE_BUCKET}"`);
}

async function listPrefix(prefix: string): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(ILLUSTRATIONS_BUCKET).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`list(${prefix}): ${error.message}`);
    // Folders come back with id === null; only files are copied.
    for (const item of data ?? []) if (item.id) out.push(`${prefix}/${item.name}`);
    if (!data || data.length < 1000) return out;
  }
}

async function collectShowcaseStoryPaths(): Promise<string[]> {
  const { data, error } = await admin
    .from("stories")
    .select("id, cover_image_url, character_portrait_url, characters (avatar_url), story_illustrations (image_url)")
    .eq("is_showcase", true);
  if (error) throw new Error(`showcase stories: ${error.message}`);
  const refs: (string | null)[] = [];
  for (const s of data ?? []) {
    const character = s.characters as unknown as { avatar_url: string | null } | null;
    refs.push(s.cover_image_url, s.character_portrait_url, character?.avatar_url ?? null);
    for (const ill of (s.story_illustrations ?? []) as { image_url: string | null }[]) refs.push(ill.image_url);
  }
  console.log(`${data?.length ?? 0} showcase stories`);
  return refs.map((r) => illustrationPath(r)).filter((p): p is string => !!p);
}

const LEGACY_URL_RE = /https?:\/\/[^\s"'()<>]+\/storage\/v1\/object\/public\/illustrations\/[^\s"'()<>?#]+(?:\?[^\s"'()<>#]*)?/g;

async function collectBlogPaths(): Promise<{ paths: string[]; rewrite: () => Promise<void> }> {
  const { data, error } = await admin.from("blog_posts").select("id, cover_image_url, body_markdown");
  if (error) {
    console.warn(`blog_posts skipped: ${error.message}`);
    return { paths: [], rewrite: async () => {} };
  }
  const paths: string[] = [];
  const updates: { id: string; cover_image_url: string | null; body_markdown: string }[] = [];
  const toShowcase = (url: string) => {
    const path = illustrationPath(url);
    if (!path) return url;
    paths.push(path);
    return showcasePublicUrl(SUPABASE_URL!, path);
  };
  for (const post of (data ?? []) as { id: string; cover_image_url: string | null; body_markdown: string | null }[]) {
    const cover = post.cover_image_url && /^https?:/.test(post.cover_image_url) ? toShowcase(post.cover_image_url) : post.cover_image_url;
    const body = (post.body_markdown ?? "").replace(LEGACY_URL_RE, (u) => toShowcase(u));
    if (cover !== post.cover_image_url || body !== (post.body_markdown ?? "")) updates.push({ id: post.id, cover_image_url: cover, body_markdown: body });
  }
  return {
    paths,
    rewrite: async () => {
      for (const u of updates) {
        if (DRY_RUN) {
          console.log(`[dry-run] would rewrite blog post ${u.id}`);
          continue;
        }
        const { error: upErr } = await admin.from("blog_posts").update({ cover_image_url: u.cover_image_url, body_markdown: u.body_markdown }).eq("id", u.id);
        if (upErr) throw new Error(`blog_posts ${u.id}: ${upErr.message}`);
        console.log(`Rewrote blog post ${u.id}`);
      }
    },
  };
}

async function copyToShowcase(path: string): Promise<"copied" | "exists" | "missing"> {
  if (DRY_RUN) return "copied";
  const { error } = await admin.storage.from(ILLUSTRATIONS_BUCKET).copy(path, path, { destinationBucket: SHOWCASE_BUCKET });
  if (!error) return "copied";
  if (/exist|duplicate/i.test(error.message)) return "exists";
  if (/not.?found/i.test(error.message)) return "missing";
  throw new Error(`copy(${path}): ${error.message}`);
}

await ensureBucket();
const blog = await collectBlogPaths();
const staticPaths = [...STATIC_PATHS, ...(await Promise.all(STATIC_PREFIXES.map(listPrefix))).flat()];
const all = [...new Set([...(await collectShowcaseStoryPaths()), ...staticPaths, ...blog.paths])];
console.log(`${all.length} object(s) to publish${DRY_RUN ? " (dry run)" : ""}`);

const counts = { copied: 0, exists: 0, missing: 0 };
for (const path of all) {
  const result = await copyToShowcase(path);
  counts[result]++;
  if (result === "missing") console.warn(`  missing in illustrations: ${path}`);
}
await blog.rewrite();
console.log(`Done — copied ${counts.copied}, already there ${counts.exists}, missing ${counts.missing}`);
