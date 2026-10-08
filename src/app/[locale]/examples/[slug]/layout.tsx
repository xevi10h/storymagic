import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { findShowcaseRef, getShowcaseBook, getShowcaseRefs, showcaseEditions, showcaseRedirectTarget } from "@/lib/showcase";
import { isStoryUuid, showcasePath } from "@/lib/showcase-slug";
import { SITE_URL } from "@/lib/product-facts";
import { EXAMPLE_COPY, asLoc } from "./copy";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string; slug: string }>;
};

// Prerendered (ISR) like the blog posts: the story text, title, canonical and
// hreflang are in the HTML. Examples flagged later render on first request.
export const revalidate = 3600;

/** Old → new slug of renamed example books. 2026-10-08: the Spanish edition's hero became Martín (Martí is the Catalan name). */
const RENAMED_SLUGS: Record<string, string> = { "es/marti-y-la-luz-guardada": "martin-y-la-luz-guardada" };

export async function generateStaticParams() {
  try {
    return (await getShowcaseRefs()).map(({ locale, slug }) => ({ locale, slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  // Legacy UUID URLs are redirected by the layout; unknown slugs 404 there too
  // (Next adds the noindex tag to a 404 itself).
  const ref = isStoryUuid(slug) ? null : await findShowcaseRef(locale, slug);
  const story = ref ? await getShowcaseBook(ref.id) : null;
  if (!ref || !story) return {};

  const copy = EXAMPLE_COPY[asLoc(locale)];
  const title = ref.title;
  const description = copy.description(title, story.characters.name, story.characters.age, story.characters.gender);
  const canonicalUrl = `${SITE_URL}/${locale}${showcasePath(ref.slug)}`;

  // hreflang: the same book's edition in each locale (each has its own slug).
  const languages: Record<string, string> = {};
  for (const edition of await showcaseEditions(ref.groupId)) {
    languages[edition.locale] = `${SITE_URL}/${edition.locale}${showcasePath(edition.slug)}`;
  }
  if (languages[routing.defaultLocale]) languages["x-default"] = languages[routing.defaultLocale];

  // Public `showcase` mirror (never a signed URL: OG images are cached by crawlers).
  const firstScene = [...story.story_illustrations].sort((a, b) => a.scene_number - b.scene_number)[0]?.image_url ?? null;
  const coverImage = story.cover_image_url ?? firstScene;

  // Keep the SERP title within ~60 chars: drop the brand suffix when it would overflow.
  const seoTitle = copy.seoTitle(title);
  const branded = `${seoTitle} | Meapica`;

  return {
    title: { absolute: branded.length <= 60 ? branded : seoTitle },
    description,
    alternates: { canonical: canonicalUrl, languages },
    openGraph: {
      title: seoTitle,
      description,
      type: "article",
      url: canonicalUrl,
      siteName: "Meapica",
      ...(coverImage ? { images: [{ url: coverImage, width: 1024, height: 1024, alt: title }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: seoTitle,
      description,
      ...(coverImage ? { images: [coverImage] } : {}),
    },
  };
}

export default async function ShowcaseStoryLayout({ children, params }: Props) {
  const { locale, slug } = await params;

  // Pre-slug URLs (/examples/{story uuid}) → 308 to the readable URL: this book's
  // edition in the requested locale, else the book in its own locale. Done here,
  // above the segment's loading boundary, so it is a real HTTP redirect.
  if (isStoryUuid(slug)) {
    const target = await showcaseRedirectTarget(locale, slug);
    if (!target) notFound();
    permanentRedirect(`/${target.locale}${showcasePath(target.slug)}`);
  }

  if (!(await findShowcaseRef(locale, slug))) {
    // A renamed example keeps its indexed URL alive with a 308.
    const renamed = RENAMED_SLUGS[`${locale}/${slug}`];
    if (renamed) permanentRedirect(`/${locale}${showcasePath(renamed)}`);
    // Unknown / unpublished slug → a real 404 (not a 200 "not found" shell).
    notFound();
  }
  return children;
}
