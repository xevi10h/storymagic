"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { PRICING, ADDONS, type BookFormat, type AddonId } from "@/lib/pricing";
import { useAuth } from "@/hooks/useAuth";
import CreationHeader from "@/components/crear/CreationHeader";
import BookViewerSwitch from "@/components/book-viewer/BookViewerSwitch";
import ErrorBoundary from "@/components/ErrorBoundary";
import type { BookPage } from "@/components/book-viewer/types";
import { SCENE_LAYOUT_PAIRS, getActLabel, getSpreadType } from "@/components/book-viewer/types";
import type { GeneratedStory } from "@/lib/ai/story-generator";

// ── Types ──────────────────────────────────────────────────────────────────

interface StoryData {
  id: string;
  status: string;
  template_id: string;
  title: string | null;
  cover_image_url: string | null;
  character_portrait_url: string | null;
  generated_text: GeneratedStory;
  dedication_text: string | null;
  sender_name: string | null;
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

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build exactly 32 pages — standard children's book structure:
 *
 *  1  Cover
 *  2  Front endpaper
 *  3  Title + Dedication (combined)
 *  4-27  12 scenes × 2 pages = 24
 *  28 Final message
 *  29 Hero card
 *  30 Colophon (imprint + QR)
 *  31 Back endpaper
 *  32 Back cover
 *
 * 3 header pages (odd count) ensure all scene first-pages land on LEFT
 * positions in the two-page viewer, so panoramic spreads are on facing pages.
 *
 * Viewer pairing (cover is alone, then pairs):
 *   [0]        cover
 *   [1, 2]     endpaper + title_dedication
 *   [3, 4]     scene 1 page 1 (LEFT) + scene 1 page 2 (RIGHT)
 *   ...
 *   [7, 8]     scene 3 spread_left (LEFT) + spread_right (RIGHT) ✓
 */
function buildPages(story: StoryData): BookPage[] {
  const generated = story.generated_text;
  const illustrations = story.story_illustrations.sort(
    (a, b) => a.scene_number - b.scene_number
  );
  const isPreview = story.status === "preview";

  // 3 header pages (odd count) for spread alignment
  const pages: BookPage[] = [
    // 1. Cover
    {
      type: "cover",
      title: story.title ?? generated.bookTitle,
      characterName: story.characters.name,
      templateId: story.template_id,
      imageUrl: story.cover_image_url ?? null,
    },
    // 2. Front endpaper
    { type: "endpaper", templateId: story.template_id },
    // 3. Title + Dedication (combined — gets to story faster)
    {
      type: "title_dedication",
      title: story.title ?? generated.bookTitle,
      characterName: story.characters.name,
      templateId: story.template_id,
      dedicationText: story.dedication_text ?? generated.dedication,
      senderName: story.sender_name,
    },
  ];

  // 4-27. Each scene = 2 pages. Layout pairs define the visual variety.
  // Act labels mark the start of each narrative act (I, II, III).
  // Spread types cycle galeria → pergamino → ventana for scenes (bridges = puente),
  // matching the PDF editorial cycling system exactly.
  let sceneOnlyIndex = 0;
  for (const scene of generated.scenes) {
    const pair = SCENE_LAYOUT_PAIRS[(scene.sceneNumber - 1) % SCENE_LAYOUT_PAIRS.length];
    const isSpread = pair[0] === "spread_left";
    const isBridge = scene.type === "bridge";
    const spreadType = getSpreadType(scene.type ?? "scene", sceneOnlyIndex);

    const illustration = illustrations.find(
      (i) => i.scene_number === scene.sceneNumber
    );
    const secondaryIllustration = illustrations.find(
      (i) => i.scene_number === scene.sceneNumber + 12
    );
    const hasIllustration = illustration?.status === "ready" && !!illustration?.image_url;
    const hasSecondary = secondaryIllustration?.status === "ready" && !!secondaryIllustration?.image_url;
    const locked = isPreview && !hasIllustration;
    const imageUrl = illustration?.image_url ?? null;
    const secondaryImageUrl = hasSecondary ? secondaryIllustration.image_url : null;
    const actLabel = getActLabel(scene.sceneNumber);

    const characterAge = story.characters.age;

    // Page 1: primary layout with primary illustration + optional act label
    pages.push({ type: "scene", scene, imageUrl, locked, layout: pair[0], actLabel, characterAge, spreadType });

    // Page 2: depends on layout type
    if (isSpread) {
      // Panoramic spread — same image, right half
      pages.push({ type: "scene", scene, imageUrl, locked, layout: "spread_right", characterAge, spreadType });
    } else if (secondaryImageUrl) {
      // Secondary illustration exists → show it WITH scene text (never pure immersive)
      pages.push({ type: "scene", scene, imageUrl: secondaryImageUrl, locked, layout: "illustration_text", characterAge, spreadType });
    } else {
      // No secondary → pure text page
      pages.push({ type: "scene", scene, imageUrl: null, locked, layout: pair[1], characterAge, spreadType });
    }

    if (!isBridge) sceneOnlyIndex++;
  }

  // 28. Final message
  pages.push({
    type: "final",
    message: generated.finalMessage,
    characterName: story.characters.name,
  });

  // 29. Hero card
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

  // 30. Colophon (imprint + QR — standard end-of-book position)
  pages.push({ type: "colophon", storyId: story.id });

  // 31. Back endpaper
  pages.push({ type: "endpaper", templateId: story.template_id });

  // 32. Back cover
  const lastSceneIllustration = illustrations.find(
    (i) => i.scene_number === generated.scenes.length
  );
  const backCoverImageUrl =
    (lastSceneIllustration?.status === "ready" && lastSceneIllustration?.image_url) ||
    story.cover_image_url;

  pages.push({
    type: "back",
    title: story.title ?? generated.bookTitle,
    characterName: story.characters.name,
    synopsis: generated.synopsis ?? `${story.characters.name} está a punto de vivir la aventura más extraordinaria de su vida.`,
    coverImageUrl: backCoverImageUrl,
    templateId: story.template_id,
    storyId: story.id,
  });

  return pages; // Always 32 pages
}

// In preview mode: show first N scenes fully (illustration + text) then 1 locked teaser page
const PREVIEW_CLEAR_SCENES = 3;  // 3 clear scenes × 2 pages = 6 scene pages

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

  // PDF download filename built from book title
  const pdfFilename = story?.generated_text?.bookTitle
    ? `${story.generated_text.bookTitle.replace(/[^a-zA-Z0-9áéíóúñüàèòïçÁÉÍÓÚÑÜÀÈÒÏÇ\s-]/g, "").replace(/\s+/g, "-").toLowerCase().slice(0, 60)}-meapica.pdf`
    : `${storyId}.pdf`;

  // Dev bypass: instant unlock without checkout (MOCK_MODE only)
  const [bypassingUnlock, setBypassingUnlock] = useState(false);
  const isMockMode = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

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

  // In preview mode, limit visible pages:
  // 3 header (cover + endpaper + title_dedication) + clear scenes × 2 pages + 1 locked teaser
  const previewScenePages = PREVIEW_CLEAR_SCENES * 2;
  const maxVisiblePages = isPreviewMode
    ? 3 + previewScenePages + 1  // 3 headers + 6 scene pages + 1 locked = 10
    : pages.length;
  const visiblePages = isPreviewMode
    ? pages.slice(0, maxVisiblePages).map((page, i) => {
        // Force the last page to be locked as a teaser, regardless of illustration status
        if (i === maxVisiblePages - 1 && page.type === "scene") {
          return { ...page, locked: true, imageUrl: null };
        }
        return page;
      })
    : pages.slice(0, maxVisiblePages);
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

  // Dev-only: bypass checkout and unlock all illustrations instantly
  const handleDevUnlock = useCallback(async () => {
    setBypassingUnlock(true);
    try {
      const res = await fetch(`/api/stories/${storyId}/complete`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Unlock failed");
      }
      // Refresh story data
      const storyRes = await fetch(`/api/stories/${storyId}`);
      if (storyRes.ok) setStory(await storyRes.json());
    } catch (err) {
      console.error("[DEV] Unlock failed:", err);
    } finally {
      setBypassingUnlock(false);
    }
  }, [storyId]);

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
          {story.title ?? story.generated_text.bookTitle}
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
        <ErrorBoundary>
          <BookViewerSwitch
            pages={visiblePages}
            templateId={story.template_id}
            gender={story.characters.gender}
            favoriteColor={story.characters.favorite_color ?? undefined}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </ErrorBoundary>
      </section>

      {/* PDF Download — only for fully ready stories */}
      {isFullyReady && (
        <div className="mx-auto max-w-3xl px-4 pb-6">
          <a
            href={`/api/stories/${storyId}/pdf${process.env.NEXT_PUBLIC_MOCK_MODE === "true" ? "?force=true" : ""}`}
            download={pdfFilename}
            className="group mx-auto flex w-full max-w-md items-center justify-center gap-2.5 rounded-xl border-2 border-border-light bg-white px-6 py-3.5 text-sm font-bold text-secondary transition-all hover:border-create-primary hover:bg-create-primary/5 hover:text-create-primary active:scale-[0.98] shadow-sm"
          >
            <span className="material-symbols-outlined text-lg">
              picture_as_pdf
            </span>
            {t("downloadPdf")}
          </a>
          <p className="mt-2 text-center text-xs text-text-muted">
            {t("downloadHint")}
          </p>
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

            {/* Dev-only: instant unlock bypassing checkout */}
            {isMockMode && (
              <div className="mt-6 rounded-lg border border-dashed border-amber-400 bg-amber-50 p-4">
                <p className="mb-3 text-center text-xs font-bold text-amber-700 uppercase tracking-wider">
                  DEV — Mock Mode
                </p>
                <button
                  onClick={handleDevUnlock}
                  disabled={bypassingUnlock}
                  className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-600 disabled:opacity-60"
                >
                  {bypassingUnlock ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                      Unlocking…
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-base">lock_open</span>
                      Unlock all scenes instantly (skip checkout)
                    </span>
                  )}
                </button>
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
              className="inline-flex w-full max-w-md items-center justify-center gap-2 rounded-xl border-2 border-border-light px-6 py-3.5 text-sm font-bold text-secondary transition-all hover:border-create-primary hover:bg-create-primary/5 hover:text-create-primary active:scale-[0.98]"
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
