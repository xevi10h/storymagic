import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { toShowcaseUrl } from "@/lib/storage/illustration-refs";
import { SHOWCASE_STATUSES } from "@/lib/showcase";

const BASE_URL = "https://meapica.com";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string; storyId: string }>;
};

function createPublicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, storyId } = await params;
  const supabase = createPublicClient();

  const { data: story } = await supabase
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
    .single();

  if (!story) {
    const t = await getTranslations({ locale, namespace: "showcase" });
    return {
      title: t("notFound"),
      robots: { index: false, follow: false },
    };
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
  const canonicalUrl = `${BASE_URL}/${locale}/ejemplo/${storyId}`;

  // Build hreflang alternates
  const languages: Record<string, string> = {
    es: `${BASE_URL}/es/ejemplo/${storyId}`,
    ca: `${BASE_URL}/ca/ejemplo/${storyId}`,
    en: `${BASE_URL}/en/ejemplo/${storyId}`,
    fr: `${BASE_URL}/fr/ejemplo/${storyId}`,
    "x-default": `${BASE_URL}/es/ejemplo/${storyId}`,
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

export default function ShowcaseStoryLayout({ children }: Props) {
  return children;
}
