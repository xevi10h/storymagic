"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PRICING } from "@/lib/pricing";
import type { GeneratedScene, GeneratedStory } from "@/lib/ai/story-generator";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

// ── Types ──────────────────────────────────────────────────────────────────

interface ShowcaseStoryData {
  id: string;
  template_id: string;
  generated_text: GeneratedStory;
  dedication_text: string | null;
  sender_name: string | null;
  characters: {
    name: string;
    age: number;
    gender: string;
    city: string | null;
  };
  story_illustrations: {
    scene_number: number;
    image_url: string | null;
  }[];
}

type BookPage =
  | { type: "cover"; title: string; characterName: string; templateId: string }
  | { type: "dedication"; text: string; senderName: string | null }
  | { type: "scene"; scene: GeneratedScene; imageUrl: string | null }
  | { type: "final"; message: string; characterName: string }
  | { type: "back"; characterName: string };

// ── Helpers ────────────────────────────────────────────────────────────────

function buildPages(story: ShowcaseStoryData): BookPage[] {
  const generated = story.generated_text;
  const illustrations = story.story_illustrations.sort(
    (a, b) => a.scene_number - b.scene_number,
  );

  const pages: BookPage[] = [
    {
      type: "cover",
      title: generated.bookTitle,
      characterName: story.characters.name,
      templateId: story.template_id,
    },
    {
      type: "dedication",
      text: generated.dedication,
      senderName: story.sender_name,
    },
  ];

  for (const scene of generated.scenes) {
    const illustration = illustrations.find(
      (i) => i.scene_number === scene.sceneNumber,
    );
    pages.push({
      type: "scene",
      scene,
      imageUrl: illustration?.image_url ?? null,
    });
  }

  pages.push({
    type: "final",
    message: generated.finalMessage,
    characterName: story.characters.name,
  });

  pages.push({
    type: "back",
    characterName: story.characters.name,
  });

  return pages;
}

function getTemplateGradient(templateId: string): string {
  const gradients: Record<string, string> = {
    space: "from-indigo-900 to-slate-900",
    forest: "from-emerald-800 to-green-900",
    superhero: "from-red-700 to-rose-900",
    pirates: "from-blue-800 to-cyan-900",
    chef: "from-orange-600 to-amber-800",
  };
  return gradients[templateId] ?? "from-secondary to-secondary-hover";
}

// ── Page Component ─────────────────────────────────────────────────────────

export default function ShowcasePage() {
  const t = useTranslations("showcase");
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

  const goToPrevPage = useCallback(() => {
    setCurrentPage((p) => Math.max(0, p - 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setCurrentPage((p) => Math.min(totalPages - 1, p + 1));
  }, [totalPages]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") goToPrevPage();
      if (e.key === "ArrowRight") goToNextPage();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToPrevPage, goToNextPage]);

  const handleDownloadPdf = useCallback(async () => {
    setDownloadingPdf(true);
    try {
      const res = await fetch(`/api/showcase/${storyId}/pdf`);
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ??
        "meapica-sample.pdf";
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

  // ── Loading state ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-cream">
        <Navbar />
        <div className="flex min-h-[60vh] flex-col items-center justify-center">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary">
            progress_activity
          </span>
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
          <span className="material-symbols-outlined text-5xl text-red-400">
            error
          </span>
          <p className="mt-4 text-base text-text-main">{error}</p>
          <Link
            href="/"
            className="mt-6 text-sm text-primary hover:underline"
          >
            {t("backToHome")}
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const page = pages[currentPage];
  const softcoverPrice = (PRICING.softcover.price / 100).toFixed(2);
  const hardcoverPrice = (PRICING.hardcover.price / 100).toFixed(2);

  return (
    <div className="min-h-screen bg-cream">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 py-12">
        {/* Breadcrumb */}
        <nav className="mb-8 text-sm text-text-muted">
          <Link href="/#catalog" className="hover:text-primary">
            {t("library")}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-text-main">{story.generated_text.bookTitle}</span>
        </nav>

        {/* Showcase badge */}
        <div className="mb-6 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            <span className="material-symbols-outlined text-sm">visibility</span>
            {t("sampleBadge")}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-5">
          {/* Book viewer — left side */}
          <div className="lg:col-span-3">
            {/* Title + page counter */}
            <div className="mb-4 flex items-center justify-between">
              <h1 className="font-display text-2xl font-bold text-secondary">
                {story.generated_text.bookTitle}
              </h1>
              <span className="text-xs text-text-muted tabular-nums">
                {currentPage + 1} / {totalPages}
              </span>
            </div>

            {/* Book page */}
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border-light bg-white shadow-xl">
              <PageContent page={page} templateId={story.template_id} />

              {/* Navigation overlays */}
              {currentPage > 0 && (
                <button
                  onClick={goToPrevPage}
                  className="absolute left-0 top-0 bottom-0 flex w-1/5 items-center justify-start pl-3 opacity-50 transition-opacity hover:opacity-100"
                  aria-label={t("previous")}
                >
                  <span className="material-symbols-outlined rounded-full bg-white/90 p-2 text-xl text-text-muted shadow-md">
                    chevron_left
                  </span>
                </button>
              )}
              {currentPage < totalPages - 1 && (
                <button
                  onClick={goToNextPage}
                  className="absolute right-0 top-0 bottom-0 flex w-1/5 items-center justify-end pr-3 opacity-50 transition-opacity hover:opacity-100"
                  aria-label={t("next")}
                >
                  <span className="material-symbols-outlined rounded-full bg-white/90 p-2 text-xl text-text-muted shadow-md">
                    chevron_right
                  </span>
                </button>
              )}
            </div>

            {/* Page dots */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
              {pages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === currentPage
                      ? "w-6 bg-primary"
                      : "w-2 bg-border-light hover:bg-text-muted"
                  }`}
                  aria-label={`Page ${i + 1}`}
                />
              ))}
            </div>

            {/* Mobile navigation */}
            <div className="mt-4 flex items-center justify-center gap-4 sm:hidden">
              <button
                onClick={goToPrevPage}
                disabled={currentPage === 0}
                className="flex items-center gap-1 rounded-full border border-border-light px-4 py-2 text-sm text-text-soft transition-colors hover:bg-white disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-base">chevron_left</span>
                {t("previous")}
              </button>
              <button
                onClick={goToNextPage}
                disabled={currentPage === totalPages - 1}
                className="flex items-center gap-1 rounded-full border border-border-light px-4 py-2 text-sm text-text-soft transition-colors hover:bg-white disabled:opacity-30"
              >
                {t("next")}
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
            </div>
          </div>

          {/* Info panel — right side */}
          <div className="lg:col-span-2">
            <div className="sticky top-24 space-y-6">
              {/* Story info */}
              <div className="rounded-xl border border-border-light bg-white p-6 shadow-sm">
                <h2 className="font-display text-lg font-bold text-secondary">
                  {story.generated_text.bookTitle}
                </h2>
                <p className="mt-2 text-sm text-text-soft">
                  {t("personalizedFor", { name: story.characters.name })}
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

                <div className="mt-4 flex items-center gap-2 text-xs text-text-muted">
                  <span className="material-symbols-outlined text-sm">menu_book</span>
                  {t("pageCount", { count: totalPages })}
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
                    <span className="material-symbols-outlined animate-spin text-lg">
                      progress_activity
                    </span>
                    {t("generatingPdf")}
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                    {t("downloadPdf")}
                  </>
                )}
              </button>

              {/* CTA */}
              <Link
                href="/crear"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-base font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary-hover active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-lg">edit</span>
                {t("createYourOwn")}
              </Link>
              <p className="text-center text-xs text-text-muted">
                {t("createHint")}
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

// ── Page Content Renderer ──────────────────────────────────────────────────

function PageContent({
  page,
  templateId,
}: {
  page: BookPage;
  templateId: string;
}) {
  const t = useTranslations("showcase");
  const gradient = getTemplateGradient(templateId);

  switch (page.type) {
    case "cover":
      return (
        <div
          className={`flex h-full flex-col items-center justify-center bg-gradient-to-br ${gradient} p-8 text-center`}
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
            <span className="material-symbols-outlined text-3xl text-white">
              auto_stories
            </span>
          </div>
          <h2 className="font-display text-2xl font-bold leading-tight text-white">
            {page.title}
          </h2>
          <p className="mt-3 text-sm text-white/70">
            {t("personalizedStory")}{" "}
            <span className="font-bold text-white">{page.characterName}</span>
          </p>
          <div className="mt-6 h-px w-16 bg-white/30" />
          <p className="mt-3 text-xs uppercase tracking-wider text-white/50">
            meapica
          </p>
        </div>
      );

    case "dedication":
      return (
        <div className="flex h-full flex-col items-center justify-center bg-cream p-8 text-center">
          <span className="material-symbols-outlined mb-4 text-3xl text-create-gold">
            favorite
          </span>
          <p className="max-w-xs font-display text-base italic leading-relaxed text-secondary">
            &ldquo;{page.text}&rdquo;
          </p>
          {page.senderName && (
            <p className="mt-4 text-sm text-text-muted">
              — {page.senderName}
            </p>
          )}
        </div>
      );

    case "scene":
      return (
        <div className="flex h-full flex-col">
          <div className="relative flex-1 bg-cream">
            {page.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={page.imageUrl}
                alt={page.scene.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-text-light">
                  image
                </span>
              </div>
            )}
            <div className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-sm">
              <span className="text-xs font-bold text-secondary">
                {page.scene.sceneNumber}
              </span>
            </div>
          </div>
          <div className="p-5">
            <h3 className="font-display text-sm font-bold text-secondary">
              {page.scene.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-text-soft">
              {page.scene.text}
            </p>
          </div>
        </div>
      );

    case "final":
      return (
        <div className="flex h-full flex-col items-center justify-center bg-cream p-8 text-center">
          <span className="material-symbols-outlined mb-4 text-4xl text-create-gold">
            auto_awesome
          </span>
          <p className="max-w-xs font-display text-lg font-bold leading-relaxed text-secondary">
            {page.message}
          </p>
          <div className="mt-6 h-px w-16 bg-border-light" />
          <p className="mt-3 text-xs text-text-muted">{t("end")}</p>
        </div>
      );

    case "back":
      return (
        <div
          className={`flex h-full flex-col items-center justify-center bg-gradient-to-br ${gradient} p-8 text-center`}
        >
          <p className="text-sm text-white/70">{t("createdFor")}</p>
          <p className="mt-2 font-display text-2xl font-bold text-white">
            {page.characterName}
          </p>
          <div className="mt-6 h-px w-16 bg-white/30" />
          <p className="mt-4 text-xs uppercase tracking-wider text-white/40">
            meapica
          </p>
        </div>
      );
  }
}
