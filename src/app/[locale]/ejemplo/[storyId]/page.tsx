"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PRICING, formatPrice } from "@/lib/pricing";
import BrandLogo from "@/components/BrandLogo";
import { Button, buttonClass, cx, focusRing } from "@/components/ui";
import BookViewerSwitch from "@/components/book-viewer/BookViewerSwitch";
import ErrorBoundary from "@/components/ErrorBoundary";
import type { BookPage } from "@/components/book-viewer/types";
import { SCENE_LAYOUT_PAIRS, artCarriesTitle, getActLabel, getSpreadType } from "@/components/book-viewer/types";
import type { GeneratedStory } from "@/lib/ai/story-generator";
import { BrandLoader } from "@/components/ui/BrandLoader";

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
    favorite_color: string | null;
    favorite_companion: string | null;
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

    const characterAge = story.characters.age;
    const facing: Extract<BookPage, { type: "scene" }> = isSpread
      ? { type: "scene", scene, imageUrl, locked: false, layout: "spread_right", characterAge, spreadType }
      : secondaryImageUrl
        ? { type: "scene", scene, imageUrl: secondaryImageUrl, locked: false, layout: "illustration_text", characterAge, spreadType }
        : { type: "scene", scene, imageUrl: null, locked: false, layout: pair[1], characterAge, spreadType };
    // As in print, the scene title goes on the art only when the facing page has no heading.
    const artTitle = artCarriesTitle(pair[0], facing);
    pages.push({ type: "scene", scene, imageUrl, locked: false, layout: pair[0], actLabel, characterAge, spreadType, artTitle });
    pages.push(facing);

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
    favoriteColor: story.characters.favorite_color,
    favoriteCompanion: story.characters.favorite_companion,
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
  const tPricing = useTranslations("pricing");
  const tHero = useTranslations("hero");
  const tCollection = useTranslations("bookCollection");
  const locale = useLocale();
  const { storyId } = useParams<{ storyId: string }>();

  const [story, setStory] = useState<ShowcaseStoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

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
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-paper px-4">
        <BrandLoader size="lg" caption={t("loading")} />
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-paper px-4 text-center">
        <Link href="/" aria-label="Meapica" className={cx("mb-10 rounded-md", focusRing)}>
          <BrandLogo className="h-7 text-brand-deep" />
        </Link>
        <h1 className="text-balance font-display text-[26px] font-bold leading-tight text-ink sm:text-4xl">{t("notFound")}</h1>
        <p className="mt-2 max-w-md text-base leading-relaxed text-ink-body">{t("notFoundHint")}</p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Link href="/ejemplo" className={buttonClass()}>
            {tCollection("viewAll")}
            <span aria-hidden className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">
              arrow_forward
            </span>
          </Link>
          <Link href="/" className={buttonClass({ variant: "quiet" })}>
            {t("backToHome")}
          </Link>
        </div>
      </div>
    );
  }

  const bookTitle = story.title ?? story.generated_text.bookTitle;
  const softcoverPrice = formatPrice(PRICING.softcover.price, locale);
  const hardcoverPrice = formatPrice(PRICING.hardcover.price, locale);
  // Same world as this example, pre-chosen in the creation flow.
  const createHref = `/crear?template=${encodeURIComponent(story.template_id)}&from=example`;

  return (
    <div className="min-h-[100dvh] bg-paper">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-brand/10 bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-1">
            <Link
              href="/ejemplo"
              aria-label={t("title")}
              className={cx(
                "-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-line hover:text-ink-soft",
                focusRing,
              )}
            >
              <span aria-hidden className="material-symbols-outlined">arrow_back</span>
            </Link>
            <Link href="/" aria-label="Meapica" className={cx("flex items-center rounded-md", focusRing)}>
              <BrandLogo className="h-5 text-brand-deep sm:h-6" />
            </Link>
          </div>
          <Link href={createHref} className={buttonClass({ size: "sm" })}>
            {tHero("cta")}
          </Link>
        </div>
      </header>

      {/* ── Title bar ──────────────────────────────────────────────────── */}
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pt-5 sm:px-6">
        <h1 className="min-w-0 truncate font-display text-lg font-bold text-ink sm:text-xl">{bookTitle}</h1>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-brand-tint px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-brand-text">
            {t("sampleBadge")}
          </span>
          <span className="text-xs text-ink-muted tabular-nums">
            {currentPage + 1} / {totalPages}
          </span>
        </div>
      </div>

      {/* ── Book Viewer (same container as the preview page) ───────────── */}
      <section className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
        <ErrorBoundary>
          <BookViewerSwitch
            pages={pages}
            templateId={story.template_id}
            gender={story.characters.gender}
            favoriteColor={story.characters.favorite_color ?? undefined}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </ErrorBoundary>
      </section>

      {/* ── Free sample PDF ────────────────────────────────────────────── */}
      <div className="mx-auto max-w-md px-4 pb-10">
        <Button
          variant="secondary"
          block
          onClick={handleDownloadPdf}
          loading={downloadingPdf}
          leadingIcon={downloadingPdf ? undefined : "download"}
        >
          {downloadingPdf ? t("generatingPdf") : t("downloadPdf")}
        </Button>
        <p className="mt-2 text-center text-xs text-ink-muted">{t("createHint")}</p>
      </div>

      {/* ── Create your own ────────────────────────────────────────────── */}
      <section aria-labelledby="create-own-title" className="border-t border-line bg-surface">
        <div className="mx-auto max-w-2xl px-4 py-14 text-center sm:py-20">
          <h2 id="create-own-title" className="text-balance font-display text-[26px] font-bold leading-tight text-ink sm:text-4xl">
            {t("createYourVersion")}
          </h2>
          <p className="mx-auto mt-3 max-w-prose text-base leading-relaxed text-ink-body">{t("createYourVersionHint")}</p>
          <Link href={createHref} className={buttonClass({ className: "mt-7 min-h-14 sm:px-8" })}>
            {tHero("cta")}
            <span aria-hidden className="material-symbols-outlined text-xl transition-transform group-hover:translate-x-1">
              arrow_forward
            </span>
          </Link>
          <p className="mt-4 text-sm text-ink-soft tabular-nums">
            {t("softcover")} <span className="font-bold text-brand-deep">{softcoverPrice}</span>
            <span aria-hidden> · </span>
            {t("hardcover")} <span className="font-bold text-brand-deep">{hardcoverPrice}</span>
            <span aria-hidden> · </span>
            {tPricing("vatIncluded")}
          </p>
        </div>
      </section>
    </div>
  );
}
