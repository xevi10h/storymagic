"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { PRICING, ADDONS, type BookFormat, type AddonId } from "@/lib/pricing";
import { useAuth } from "@/hooks/useAuth";
import CreationHeader from "@/components/crear/CreationHeader";
import BookViewerSwitch from "@/components/book-viewer/BookViewerSwitch";
import type { BookPage } from "@/components/book-viewer/types";
import type { GeneratedStory } from "@/lib/ai/story-generator";

// ── Types ──────────────────────────────────────────────────────────────────

interface StoryData {
  id: string;
  status: string;
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
    status: string;
  }[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildPages(story: StoryData): BookPage[] {
  const generated = story.generated_text;
  const illustrations = story.story_illustrations.sort(
    (a, b) => a.scene_number - b.scene_number
  );
  const isPreview = story.status === "preview";

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
      (i) => i.scene_number === scene.sceneNumber
    );
    const hasIllustration = illustration?.status === "ready" && !!illustration?.image_url;

    pages.push({
      type: "scene",
      scene,
      imageUrl: illustration?.image_url ?? null,
      locked: isPreview && !hasIllustration,
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

// Number of clear scene pages visible in preview (scenes with illustrations)
const PREVIEW_CLEAR_SCENES = 3;
// Additional blurred scene pages to show after clear ones
const PREVIEW_BLURRED_SCENES = 2;

// ── Page Component ─────────────────────────────────────────────────────────

export default function PreviewPage() {
  const t = useTranslations("crear.preview");
  const tPricing = useTranslations("pricing");
  const { storyId } = useParams<{ storyId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const needsAccount = !user || user.is_anonymous === true;

  const [story, setStory] = useState<StoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  // Checkout state
  const [format, setFormat] = useState<BookFormat>("digital_pdf");
  const [addons, setAddons] = useState<Set<AddonId>>(new Set());
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // PDF download state (only for completed stories)
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const isPreviewMode = story?.status === "preview";
  const isFullyReady = story?.status === "ready" || story?.status === "ordered";

  // Fetch story data
  useEffect(() => {
    async function fetchStory() {
      try {
        const res = await fetch(`/api/stories/${storyId}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Story not found");
        }
        const data = await res.json();
        // Redirect to generation page if not yet generated
        if (data.status === "draft" || data.status === "generating") {
          router.replace(`/crear/${storyId}/generar`);
          return;
        }
        setStory(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading story");
      } finally {
        setLoading(false);
      }
    }
    fetchStory();
  }, [storyId, router]);

  const pages = story ? buildPages(story) : [];

  // In preview mode, limit visible pages: cover + dedication + clear scenes + blurred scenes
  const maxVisiblePages = isPreviewMode
    ? 2 + PREVIEW_CLEAR_SCENES + PREVIEW_BLURRED_SCENES // cover + dedication + 3 clear + 2 blurred
    : pages.length;
  const visiblePages = pages.slice(0, maxVisiblePages);
  const totalPages = visiblePages.length;

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") setCurrentPage((p) => Math.max(0, p - 1));
      if (e.key === "ArrowRight") setCurrentPage((p) => Math.min(totalPages - 1, p + 1));
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [totalPages]);

  // Filter addons: only show physical-only addons when format requires shipping
  const selectedFormatRequiresShipping = PRICING[format].requiresShipping;

  const toggleAddon = useCallback((id: AddonId) => {
    setAddons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Clear physical addons when switching to digital format
  useEffect(() => {
    if (!selectedFormatRequiresShipping) {
      setAddons(new Set());
    }
  }, [selectedFormatRequiresShipping]);

  const subtotal =
    PRICING[format].price +
    Array.from(addons).reduce((sum, id) => sum + ADDONS[id].price, 0);

  const handleDownloadPdf = useCallback(async () => {
    setDownloadingPdf(true);
    setPdfError(null);
    try {
      const res = await fetch(`/api/stories/${storyId}/pdf`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t("pdfError"));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ??
        "meapica-book.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : t("pdfError"));
    } finally {
      setDownloadingPdf(false);
    }
  }, [storyId, t]);

  const handleCheckout = useCallback(async () => {
    setCheckingOut(true);
    setCheckoutError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId,
          format,
          addons: Array.from(addons),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Checkout failed");
      }

      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : t("checkoutError")
      );
      setCheckingOut(false);
    }
  }, [storyId, format, addons, t]);

  // ── Loading / Error states ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-create-bg">
        <CreationHeader rightAction="close" />
        <div className="flex flex-1 flex-col items-center justify-center">
          <span className="material-symbols-outlined animate-spin text-4xl text-create-primary">
            progress_activity
          </span>
          <p className="mt-4 text-sm text-text-muted">{t("loadingStory")}</p>
        </div>
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="flex min-h-screen flex-col bg-create-bg">
        <CreationHeader rightAction="close" />
        <div className="flex flex-1 flex-col items-center justify-center px-4">
          <span className="material-symbols-outlined text-5xl text-red-400">
            error
          </span>
          <p className="mt-4 text-base text-text-main">{error}</p>
          <Link
            href="/crear"
            className="mt-6 text-sm text-create-primary hover:underline"
          >
            {t("backToCreate")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-create-bg">
      <CreationHeader rightAction="close" />

      {/* Book title + page counter */}
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-2">
        <h2 className="font-display text-sm font-bold text-secondary truncate max-w-50 sm:max-w-none">
          {story.generated_text.bookTitle}
        </h2>
        <div className="flex items-center gap-2">
          {isPreviewMode && (
            <span className="rounded-full bg-create-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-create-primary uppercase tracking-wide">
              {t("previewBadge")}
            </span>
          )}
          <span className="text-xs text-text-muted tabular-nums">
            {currentPage + 1} / {totalPages}
          </span>
        </div>
      </div>

      {/* Book viewer */}
      <section className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
        <BookViewerSwitch
          pages={visiblePages}
          templateId={story.template_id}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      </section>

      {/* PDF Download — only for fully ready stories */}
      {isFullyReady && (
        <div className="mx-auto max-w-3xl px-4 pb-6">
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="group mx-auto flex items-center gap-2.5 rounded-xl border-2 border-border-light bg-white px-6 py-3.5 text-sm font-bold text-secondary transition-all hover:border-create-primary hover:bg-create-primary/5 hover:text-create-primary active:scale-[0.98] disabled:opacity-60 shadow-sm"
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
                <span className="material-symbols-outlined text-lg">
                  picture_as_pdf
                </span>
                {t("downloadPdf")}
              </>
            )}
          </button>
          <p className="mt-2 text-center text-xs text-text-muted">
            {t("downloadHint")}
          </p>
          {pdfError && (
            <p className="mt-2 text-center text-xs text-red-600">{pdfError}</p>
          )}
        </div>
      )}

      {/* ── Paywall / Checkout Section ────────────────────────────────────── */}
      {isPreviewMode && (
        <section id="checkout-section" className="border-t border-border-light bg-white">
          <div className="mx-auto max-w-3xl px-4 py-10">
            {/* Paywall hook message */}
            <div className="text-center mb-8">
              <span className="material-symbols-outlined text-4xl text-create-primary mb-3">
                auto_stories
              </span>
              <h2 className="font-display text-2xl font-bold text-secondary">
                {t("paywallTitle")}
              </h2>
              <p className="mt-2 text-sm text-text-muted max-w-md mx-auto">
                {t("paywallDescription", { name: story.characters.name })}
              </p>
            </div>

            {/* Format selection — 3 options */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(Object.entries(PRICING) as [BookFormat, typeof PRICING[BookFormat]][]).map(
                ([key, val]) => {
                  const isSelected = format === key;
                  const isDigital = key === "digital_pdf";
                  return (
                    <button
                      key={key}
                      onClick={() => setFormat(key)}
                      className={`relative rounded-xl border-2 p-5 text-left transition-all ${
                        isSelected
                          ? "border-create-primary bg-create-primary/5 shadow-md shadow-create-primary/10"
                          : "border-border-light hover:border-border-medium"
                      }`}
                    >
                      {/* Best value badge for digital */}
                      {isDigital && (
                        <span className="absolute -top-2.5 left-4 rounded-full bg-create-primary px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">
                          {t("instantDelivery")}
                        </span>
                      )}

                      {/* Check indicator */}
                      {isSelected && (
                        <div className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-create-primary">
                          <span className="material-symbols-outlined text-xs text-white">
                            check
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-xl text-create-primary">
                          {val.icon}
                        </span>
                        <span className="font-display text-base font-bold text-text-main pr-6">
                          {tPricing(`${key}.label`)}
                        </span>
                      </div>

                      <p className="text-xl font-bold text-secondary tabular-nums">
                        {(val.price / 100).toFixed(2)} €
                      </p>

                      <p className="mt-1 text-xs text-text-muted">
                        {tPricing(`${key}.description`)}
                      </p>
                    </button>
                  );
                }
              )}
            </div>

            {/* Add-ons — only for physical formats */}
            {selectedFormatRequiresShipping && (
              <div className="mt-8">
                <h3 className="font-display text-sm font-bold text-text-main uppercase tracking-wider">
                  {t("optionalExtras")}
                </h3>
                <div className="mt-4 space-y-4">
                  {(Object.entries(ADDONS) as [AddonId, typeof ADDONS[AddonId]][]).map(
                    ([key, val]) => {
                      const selected = addons.has(key);
                      return (
                        <button
                          key={key}
                          onClick={() => toggleAddon(key)}
                          className={`group relative w-full rounded-xl border-2 p-5 text-left transition-all ${
                            selected
                              ? "border-create-primary bg-create-primary/5 shadow-md shadow-create-primary/10"
                              : "border-border-light hover:border-border-medium hover:shadow-sm"
                          }`}
                        >
                          {val.badge && (
                            <span className="absolute -top-2.5 left-4 rounded-full bg-create-gold px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">
                              {tPricing(`addons.${key}.badge`)}
                            </span>
                          )}

                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                                  selected
                                    ? "bg-create-primary text-white"
                                    : "bg-cream text-create-primary"
                                }`}
                              >
                                <span className="material-symbols-outlined text-xl">
                                  {val.icon}
                                </span>
                              </div>
                              <div>
                                <span className="text-sm font-bold text-text-main">
                                  {tPricing(`addons.${key}.label`)}
                                </span>
                                <p className="mt-0.5 text-xs text-text-muted">
                                  {tPricing(`addons.${key}.description`)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-base font-bold text-secondary tabular-nums">
                                +{(val.price / 100).toFixed(2)} €
                              </span>
                              <div
                                className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
                                  selected
                                    ? "border-create-primary bg-create-primary"
                                    : "border-border-medium group-hover:border-text-muted"
                                }`}
                              >
                                {selected && (
                                  <span className="material-symbols-outlined text-xs text-white">
                                    check
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <ul className="mt-3 ml-13 space-y-1.5">
                            {val.detailIcons.map((icon, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-1.5 text-xs text-text-soft"
                              >
                                <span className="material-symbols-outlined text-sm mt-px text-create-primary shrink-0">
                                  check_circle
                                </span>
                                {tPricing(`addons.${key}.details.${i}`)}
                              </li>
                            ))}
                          </ul>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            )}

            {/* Order summary + CTA */}
            <div className="mt-8 rounded-xl border border-border-light bg-cream p-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-muted">
                  {tPricing(`${format}.label`)}
                </span>
                <span className="text-sm tabular-nums">
                  {(PRICING[format].price / 100).toFixed(2)} €
                </span>
              </div>
              {Array.from(addons).map((id) => (
                <div key={id} className="mt-2 flex items-center justify-between">
                  <span className="text-sm text-text-muted">
                    {tPricing(`addons.${id}.label`)}
                  </span>
                  <span className="text-sm tabular-nums">
                    {(ADDONS[id].price / 100).toFixed(2)} €
                  </span>
                </div>
              ))}
              <div className="mt-4 border-t border-border-medium pt-4 flex items-center justify-between">
                <span className="font-display text-base font-bold text-text-main">
                  {t("total")}
                </span>
                <span className="font-display text-xl font-bold text-secondary tabular-nums">
                  {(subtotal / 100).toFixed(2)} €
                </span>
              </div>

              <button
                onClick={handleCheckout}
                disabled={checkingOut}
                className="mt-6 w-full rounded-xl bg-create-primary px-6 py-4 text-base font-bold text-white transition-all hover:bg-create-primary-hover active:scale-[0.98] disabled:opacity-60 shadow-lg shadow-create-primary/20"
              >
                {checkingOut ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined animate-spin text-lg">
                      progress_activity
                    </span>
                    {t("processing")}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-lg">
                      shopping_bag
                    </span>
                    {t("buyNow", { price: (subtotal / 100).toFixed(2) })}
                  </span>
                )}
              </button>

              {checkoutError && (
                <p className="mt-3 text-center text-xs text-red-600">
                  {checkoutError}
                </p>
              )}

              <p className="mt-4 text-center text-xs text-text-muted">
                {t("paymentSecure")}
              </p>

              {/* Save for later */}
              <div className="mt-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-border-light" />
                <span className="text-xs text-text-muted">{t("orSaveForLater")}</span>
                <div className="h-px flex-1 bg-border-light" />
              </div>

              {needsAccount ? (
                <Link
                  href={`/auth/signup?next=/crear/${storyId}/preview`}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-border-light px-6 py-3.5 text-sm font-bold text-secondary transition-all hover:border-create-primary hover:bg-create-primary/5 hover:text-create-primary active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-lg">bookmark_add</span>
                  {t("saveForLater")}
                </Link>
              ) : (
                <Link
                  href="/dashboard"
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-border-light px-6 py-3.5 text-sm font-bold text-secondary transition-all hover:border-create-primary hover:bg-create-primary/5 hover:text-create-primary active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-lg">bookmark_added</span>
                  {t("savedGoToLibrary")}
                </Link>
              )}
              <p className="mt-2 text-center text-xs text-text-muted">
                {needsAccount ? t("saveForLaterHintAnonymous") : t("saveForLaterHintLoggedIn")}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Checkout for fully ready stories (already paid, viewing complete book) */}
      {isFullyReady && (
        <section className="border-t border-border-light bg-white">
          <div className="mx-auto max-w-3xl px-4 py-8 text-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border-2 border-border-light px-6 py-3.5 text-sm font-bold text-secondary transition-all hover:border-create-primary hover:bg-create-primary/5 hover:text-create-primary active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-lg">library_books</span>
              {t("savedGoToLibrary")}
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
