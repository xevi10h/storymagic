import { cache } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { loadSharedPreview } from "@/lib/share/shared-preview";
import { deName } from "@/lib/creation-flow";
import SharedPreviewView from "@/components/share/SharedPreviewView";

// Read-only share link of a story preview (token → lib/share/preview-share-token.ts).
// Always rendered per request (signed image URLs, private data): never cached or indexed.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; token: string }> };

// Metadata + page share one lookup per request.
const load = cache((token: string) => loadSharedPreview(token));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, token } = await params;
  const result = await load(token);
  const t = await getTranslations({ locale, namespace: "sharePreview" });
  const base: Metadata = {
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    // The token is in the URL: never leak it through the Referer header.
    referrer: "no-referrer",
  };
  if (!result.ok) return { ...base, title: t("notFound.title") };
  const name = result.preview.childName;
  return { ...base, title: t("view.metaTitle", { name, deName: deName(name, locale) }) };
}

export default async function SharedPreviewPage({ params }: Props) {
  const { locale, token } = await params;
  const result = await load(token);
  if (!result.ok) notFound();
  const { preview } = result;

  // The owner (same browser or logged in elsewhere) gets the full, editable preview.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user && user.id === preview.ownerId) redirect(`/${locale}/crear/${preview.storyId}/preview`);

  return (
    <SharedPreviewView
      storyId={preview.storyId}
      title={preview.title}
      childName={preview.childName}
      templateId={preview.templateId}
      gender={preview.gender}
      favoriteColor={preview.favoriteColor}
      pages={preview.pages}
    />
  );
}
