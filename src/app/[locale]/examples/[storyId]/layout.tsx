import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { toShowcaseUrl } from "@/lib/storage/illustration-refs";
import { SHOWCASE_STATUSES, showcaseReadClient } from "@/lib/showcase";

const BASE_URL = "https://meapica.shop";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string; storyId: string }>;
};

/** One query per request for metadata + the 404 check (React cache dedupes it). */
const getShowcaseStory = cache(async (storyId: string) => {
  const { data, error } = await showcaseReadClient()
    .from("stories")
    .select(`
      id,
      template_id,
      generated_text,
      characters (name, age),
      story_illustrations (scene_number, image_url)
    `)
    .eq("id", storyId)
    .eq("is_showcase", true)
    .in("status", SHOWCASE_STATUSES)
    .maybeSingle();
  // 22P02 = not a UUID → simply not found. Any other error is an outage: throw
  // (500, not cached) rather than answer a cacheable 404 for a real example.
  if (error && error.code !== "22P02") throw new Error(`showcase story ${storyId}: ${error.message}`);
  return data;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, storyId } = await params;
  const story = await getShowcaseStory(storyId);

  if (!story) {
    const t = await getTranslations({ locale, namespace: "showcase" });
    // The layout answers notFound() (404), and Next adds the noindex tag itself.
    return { title: t("notFound") };
  }

  const generated = story.generated_text as unknown as {
    bookTitle: string;
  } | null;

  const character = story.characters as unknown as {
    name: string;
    age: number;
  } | null;

  const illustrations = (
    story.story_illustrations as unknown as {
      scene_number: number;
      image_url: string | null;
    }[]
  ).sort((a, b) => a.scene_number - b.scene_number);

  // Use the first illustration as the OG image; if none, omit images
  // and the parent route's opengraph-image.tsx will serve as fallback
  // Public `showcase` mirror (never a signed URL: OG images are cached by crawlers).
  const coverImage = toShowcaseUrl(illustrations[0]?.image_url, process.env.NEXT_PUBLIC_SUPABASE_URL!);
  const title = generated?.bookTitle ?? "Showcase Story";
  const characterName = character?.name ?? "";

  const descriptionMap: Record<string, string> = {
    es: `Lee "${title}", un cuento personalizado para ${characterName}. Descubre la historia completa con ilustraciones únicas en Meapica.`,
    ca: `Llegeix "${title}", un conte personalitzat per a ${characterName}. Descobreix la història completa amb il·lustracions úniques a Meapica.`,
    en: `Read "${title}", a personalized story for ${characterName}. Discover the full story with unique illustrations on Meapica.`,
    fr: `Lisez "${title}", un conte personnalisé pour ${characterName}. Découvrez l'histoire complète avec des illustrations uniques sur Meapica.`,
  };

  const description = descriptionMap[locale] || descriptionMap.es;
  const canonicalUrl = `${BASE_URL}/${locale}/examples/${storyId}`;

  // Build hreflang alternates
  const languages: Record<string, string> = {
    es: `${BASE_URL}/es/examples/${storyId}`,
    ca: `${BASE_URL}/ca/examples/${storyId}`,
    en: `${BASE_URL}/en/examples/${storyId}`,
    fr: `${BASE_URL}/fr/examples/${storyId}`,
    "x-default": `${BASE_URL}/es/examples/${storyId}`,
  };

  return {
    title,
    description,
    // Story content is client-rendered (empty shell for crawlers) — keep out
    // of the index until the viewer is SSR'd. OG tags stay for social shares.
    robots: { index: false, follow: true },
    alternates: {
      canonical: canonicalUrl,
      languages,
    },
    openGraph: {
      title: `${title} | Meapica`,
      description,
      type: "article",
      url: canonicalUrl,
      siteName: "Meapica",
      ...(coverImage
        ? {
            images: [
              {
                url: coverImage,
                width: 1024,
                height: 1024,
                alt: title,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Meapica`,
      description,
      ...(coverImage ? { images: [coverImage] } : {}),
    },
  };
}

export default async function ShowcaseStoryLayout({ children, params }: Props) {
  // Unknown / unpublished id → a real 404 (not a 200 "not found" shell).
  const { storyId } = await params;
  if (!(await getShowcaseStory(storyId))) notFound();
  return children;
}
