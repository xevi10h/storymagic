"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PRICING } from "@/lib/pricing";
import BookViewerSwitch from "@/components/book-viewer/BookViewerSwitch";
import type { BookPage } from "@/components/book-viewer/types";
import { SCENE_LAYOUT_PAIRS, getActLabel, getSpreadType } from "@/components/book-viewer/types";
import type { GeneratedStory, GeneratedScene } from "@/lib/ai/story-generator";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

// ── Types ──────────────────────────────────────────────────────────────────

interface ShowcaseStoryData {
  id: string;
  template_id: string;
  title: string | null;
  cover_image_url: string | null;
  character_portrait_url: string | null;
  generated_text: GeneratedStory;
  dedication_text: string | null;
  sender_name: string | null;
  locale: string | null;
  characters: {
    name: string;
    age: number;
    gender: string;
    city: string | null;
    interests: string[] | null;
    special_trait: string | null;
    favorite_companion: string | null;
    favorite_food: string | null;
    future_dream: string | null;
    avatar_url: string | null;
  };
  story_illustrations: {
    scene_number: number;
    image_url: string | null;
    status: string;
  }[];
}

// ── Page builder (same logic as preview) ──────────────────────────────────

function buildPages(story: ShowcaseStoryData): BookPage[] {
  const generated = story.generated_text;
  const illustrations = story.story_illustrations.sort(
    (a, b) => a.scene_number - b.scene_number
  );

  const pages: BookPage[] = [
    {
      type: "cover",
      title: story.title ?? generated.bookTitle,
      characterName: story.characters.name,
      templateId: story.template_id,
      imageUrl: story.cover_image_url ?? null,
    },
    { type: "endpaper", templateId: story.template_id },
    {
      type: "title_dedication",
      title: story.title ?? generated.bookTitle,
      characterName: story.characters.name,
      templateId: story.template_id,
      dedicationText: story.dedication_text ?? generated.dedication,
      senderName: story.sender_name,
    },
  ];

  let sceneOnlyIndex = 0;
  for (const scene of generated.scenes) {
    const pair = SCENE_LAYOUT_PAIRS[(scene.sceneNumber - 1) % SCENE_LAYOUT_PAIRS.length];
    const isSpread = pair[0] === "spread_left";
    const isBridge = scene.type === "bridge";
    const spreadType = getSpreadType(scene.type ?? "scene", sceneOnlyIndex);

    const illustration = illustrations.find((i) => i.scene_number === scene.sceneNumber);
    const secondaryIllustration = illustrations.find((i) => i.scene_number === scene.sceneNumber + 12);
    const hasSecondary = secondaryIllustration?.status === "ready" && !!secondaryIllustration?.image_url;
    const imageUrl = illustration?.image_url ?? null;
    const secondaryImageUrl = hasSecondary ? secondaryIllustration!.image_url : null;
    const actLabel = getActLabel(scene.sceneNumber);

    pages.push({ type: "scene", scene, imageUrl, locked: false, layout: pair[0], actLabel, characterAge: story.characters.age, spreadType });

    if (isSpread) {
      pages.push({ type: "scene", scene, imageUrl, locked: false, layout: "spread_right", characterAge: story.characters.age, spreadType });
    } else if (secondaryImageUrl) {
      pages.push({ type: "scene", scene, imageUrl: secondaryImageUrl, locked: false, layout: "illustration_text", characterAge: story.characters.age, spreadType });
    } else {
      pages.push({ type: "scene", scene, imageUrl: null, locked: false, layout: pair[1], characterAge: story.characters.age, spreadType });
    }

    if (!isBridge) sceneOnlyIndex++;
  }

  pages.push({ type: "final", message: generated.finalMessage, characterName: story.characters.name });
  pages.push({
    type: "hero_card",
    characterName: story.characters.name,
    age: story.characters.age,
    city: story.characters.city,
    gender: story.characters.gender,
    interests: story.characters.interests ?? [],
    specialTrait: story.characters.special_trait,
    favoriteCompanion: story.characters.favorite_companion,
    favoriteFood: story.characters.favorite_food,
    futureDream: story.characters.future_dream,
    avatarUrl: story.characters.avatar_url,
    portraitUrl: story.character_portrait_url,
    templateId: story.template_id,
  });
  pages.push({ type: "colophon", storyId: story.id });
  pages.push({ type: "endpaper", templateId: story.template_id });

  const lastSceneIllustration = illustrations.find((i) => i.scene_number === generated.scenes.length);
  const backCoverImageUrl = (lastSceneIllustration?.status === "ready" && lastSceneIllustration?.image_url) || story.cover_image_url;
  pages.push({
    type: "back",
    title: story.title ?? generated.bookTitle,
    characterName: story.characters.name,
    synopsis: generated.synopsis ?? "",
    coverImageUrl: backCoverImageUrl,
    templateId: story.template_id,
    storyId: story.id,
  });

  return pages;
}

// ── Page Component ─────────────────────────────────────────────────────────

export default function ShowcasePage() {
  const t = useTranslations("showcase");
  const { storyId } = useParams<{ storyId: string }>();

  const [story, setStory] = useState<ShowcaseStoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    async function fetchStory() {
      try {
        const res = await fetch(`/api/showcase/${storyId}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Story not found");
        }
        setStory(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading story");
      } finally {
        setLoading(false);
      }
    }
    fetchStory();
  }, [storyId]);

  const pages = story ? buildPages(story) : [];
  const totalPages = pages.length;

  const handleDownloadPdf = useCallback(async () => {
    setDownloadingPdf(true);
    try {
      const res = await fetch(`/api/showcase/${storyId}/pdf`);
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "meapica-sample.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF download error:", err);
    } finally {
      setDownloadingPdf(false);
    }
  }, [storyId]);

  // ── Loading / Error states ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-cream">
        <Navbar />
        <div className="flex min-h-[60vh] flex-col items-center justify-center">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
          <p className="mt-4 text-sm text-text-muted">{t("loading")}</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="min-h-screen bg-cream">
        <Navbar />
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
          <span className="material-symbols-outlined text-5xl text-red-400">error</span>
          <p className="mt-4 text-base text-text-main">{error}</p>
          <Link href="/" className="mt-6 text-sm text-primary hover:underline">{t("backToHome")}</Link>
        </div>
        <Footer />
      </div>
    );
  }

  const softcoverPrice = (PRICING.softcover.price / 100).toFixed(2);
  const hardcoverPrice = (PRICING.hardcover.price / 100).toFixed(2);

  return (
    <div className="min-h-screen bg-cream">
      <Navbar />

      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                <span className="material-symbols-outlined text-sm">visibility</span>
                {t("sampleBadge")}
              </span>
            </div>
            <h1 className="font-display text-2xl font-bold text-secondary">
              {story.title ?? story.generated_text.bookTitle}
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              {t("personalizedFor", { name: story.characters.name })} · {totalPages} {t("pages")}
            </p>
          </div>
        </div>

        {/* Book Viewer — same as preview */}
        <BookViewerSwitch
          pages={pages}
          templateId={story.template_id}
          gender={story.characters.gender}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />

        {/* CTA section below the book */}
        <div className="mt-10 mx-auto max-w-lg space-y-4">
          {/* Pricing card */}
          <div className="rounded-xl border border-border-light bg-white p-6 shadow-sm">
            <h2 className="font-display text-lg font-bold text-secondary">
              {t("createYourVersion")}
            </h2>
            <p className="mt-1 text-sm text-text-soft">
              {t("createYourVersionHint")}
            </p>
            <div className="mt-4 flex flex-col gap-2 border-t border-border-light pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted">{t("softcover")}</span>
                <span className="font-bold text-secondary">{softcoverPrice} &euro;</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted">{t("hardcover")}</span>
                <span className="font-bold text-primary">{hardcoverPrice} &euro;</span>
              </div>
            </div>
          </div>

          {/* PDF download */}
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="group flex w-full items-center justify-center gap-2.5 rounded-xl border-2 border-border-light bg-white px-6 py-3.5 text-sm font-bold text-secondary shadow-sm transition-all hover:border-primary hover:bg-primary/5 hover:text-primary active:scale-[0.98] disabled:opacity-60"
          >
            {downloadingPdf ? (
              <>
                <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                {t("generatingPdf")}
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                {t("downloadPdf")}
              </>
            )}
          </button>

          {/* Main CTA */}
          <Link
            href="/crear"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-base font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary-hover active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-lg">edit</span>
            {t("createYourOwn")}
          </Link>
          <p className="text-center text-xs text-text-muted">{t("createHint")}</p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
