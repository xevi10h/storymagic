import { createClient } from "@supabase/supabase-js";
import type { SeoPageType } from "@/lib/seo-landing";

// Blog data access. `blog_posts` is not in the generated Database types, so we
// use an untyped client and map rows to explicit interfaces here.
// RLS exposes only status='published' rows to the anon key.

export interface BlogPostMeta {
  slug: string;
  locale: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  author: string;
  publishedAt: string | null;
  tags: string[];
  readingMinutes: number;
}

export interface BlogPost extends BlogPostMeta {
  bodyMarkdown: string;
  seoTitle: string | null;
  seoDescription: string | null;
  relatedType: SeoPageType | null;
  relatedSlug: string | null;
}

function publicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function readingMinutes(markdown: string): number {
  const words = markdown.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toMeta(row: any): BlogPostMeta {
  return {
    slug: row.slug,
    locale: row.locale,
    title: row.title,
    excerpt: row.excerpt,
    coverImageUrl: row.cover_image_url ?? null,
    author: row.author,
    publishedAt: row.published_at ?? null,
    tags: row.tags ?? [],
    readingMinutes: readingMinutes(row.body_markdown ?? ""),
  };
}

export async function getPublishedPosts(locale: string): Promise<BlogPostMeta[]> {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select(
      "slug, locale, title, excerpt, cover_image_url, author, published_at, tags, body_markdown",
    )
    .eq("status", "published")
    .eq("locale", locale)
    .order("published_at", { ascending: false });
  if (error || !data) return [];
  return data.map(toMeta);
}

export async function getPost(
  locale: string,
  slug: string,
): Promise<BlogPost | null> {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("status", "published")
    .eq("locale", locale)
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  const row: any = data;
  return {
    ...toMeta(row),
    bodyMarkdown: row.body_markdown ?? "",
    seoTitle: row.seo_title ?? null,
    seoDescription: row.seo_description ?? null,
    relatedType: (row.related_type as SeoPageType | null) ?? null,
    relatedSlug: row.related_slug ?? null,
  };
}

/** Locales in which a given slug is published (for hreflang alternates). */
export async function getLocalesForSlug(slug: string): Promise<string[]> {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select("locale")
    .eq("status", "published")
    .eq("slug", slug);
  if (error || !data) return [];
  return data.map((r: any) => r.locale);
}

/** All published (locale, slug, updatedAt) for sitemap. */
export async function getAllPublishedPostRefs(): Promise<
  { locale: string; slug: string; updatedAt: string | null }[]
> {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select("slug, locale, updated_at")
    .eq("status", "published");
  if (error || !data) return [];
  return data.map((r: any) => ({
    locale: r.locale,
    slug: r.slug,
    updatedAt: r.updated_at ?? null,
  }));
}
