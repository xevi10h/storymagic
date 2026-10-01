/**
 * Blog share images: for every blog post whose cover lives in the public
 * `showcase` bucket as `blog/<name>.png`, uploads `blog/<name>-og.jpg` next to it:
 * 1200x630 (centre crop), JPEG, kept under 300 KB so WhatsApp renders the link
 * preview (it skips og:images that are too heavy; the PNG covers are ~2.3 MB).
 * The page itself keeps using the PNG cover; og:image points at the JPG copy
 * (blogOgImageUrl in src/lib/blog.ts). Originals are never touched.
 *
 * Idempotent: skips copies that already exist unless --force. Run after
 * publishing a post with a new cover:
 *
 *   node --env-file=.env.local scripts/blog-og-images.mjs [--force]
 */

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const BUCKET = "showcase";
const MAX_BYTES = 300 * 1024;
const force = process.argv.includes("--force");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (.env.local)");
  process.exit(1);
}
const supabase = createClient(url, key);
const publicPrefix = `${url}/storage/v1/object/public/${BUCKET}/`;

const { data: posts, error } = await supabase.from("blog_posts").select("cover_image_url");
if (error) throw error;

const covers = [...new Set(posts.map((p) => p.cover_image_url).filter(Boolean))];
const { data: existing } = await supabase.storage.from(BUCKET).list("blog", { limit: 1000 });
const existingNames = new Set((existing ?? []).map((f) => f.name));

for (const cover of covers) {
  const match = cover.startsWith(publicPrefix) && cover.slice(publicPrefix.length).match(/^blog\/([^/]+)\.png$/);
  if (!match) {
    console.log(`skip (not a showcase/blog PNG): ${cover}`);
    continue;
  }
  const ogName = `${match[1]}-og.jpg`;
  if (!force && existingNames.has(ogName)) {
    console.log(`exists: blog/${ogName}`);
    continue;
  }

  const res = await fetch(cover);
  if (!res.ok) throw new Error(`download ${cover}: HTTP ${res.status}`);
  const source = Buffer.from(await res.arrayBuffer());

  // Step quality down until the file fits the WhatsApp budget.
  let jpg;
  for (const quality of [82, 76, 70, 64, 58]) {
    jpg = await sharp(source)
      .resize(1200, 630, { fit: "cover", position: "centre" })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    if (jpg.length <= MAX_BYTES) break;
  }
  if (jpg.length > MAX_BYTES) throw new Error(`blog/${ogName} is still ${jpg.length} bytes`);

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(`blog/${ogName}`, jpg, { contentType: "image/jpeg", upsert: true, cacheControl: "31536000" });
  if (upErr) throw upErr;
  console.log(`uploaded: blog/${ogName} (${Math.round(jpg.length / 1024)} KB)`);
}
