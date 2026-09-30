"use client";

import { useEffect, useState, useCallback, useRef, useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import {
  PRICING,
  DEFAULT_BOOK_FORMAT,
  TOTAL_SCENE_COUNT,
  addonPrice,
  formatPrice,
  type BookFormat,
  type AddonId,
} from "@/lib/pricing";
import { useAuth } from "@/hooks/useAuth";
import CreationHeader from "@/components/crear/CreationHeader";
import BookRevealOverlay from "@/components/crear/BookRevealOverlay";
import BookEditSheets, { type EditPanel } from "@/components/crear/BookEditSheets";
import PurchasePanel, { type ConsentState } from "@/components/purchase/PurchasePanel";
import PreviewFaq from "@/components/purchase/PreviewFaq";
import { withTeaserEnd } from "@/lib/preview-teaser";
import { getBookColors } from "@/lib/template-colors";
import SendPreviewEmail from "@/components/crear/SendPreviewEmail";
import { clearStoredDraft, patchStoredDraft, readStoredDraft } from "@/lib/creation-flow";
import BookViewerSwitch from "@/components/book-viewer/BookViewerSwitch";
import { spreadIndexOf, spreadStart } from "@/components/book-viewer/spreads";
import ErrorBoundary from "@/components/ErrorBoundary";
import type { GeneratedStory } from "@/lib/ai/story-generator";
import { PREVIEW_CLEAR_SCENES, buildBookPages, toPreviewPages } from "@/lib/book-pages";
import SharePreviewButton from "@/components/share/SharePreviewButton";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { Spinner } from "@/components/ui/Spinner";
import { OfferCallout, ReorderSheet } from "@/components/dashboard/OrdersTab";
import type { StoryUpsell } from "@/lib/upsell";

// ── Types ──────────────────────────────────────────────────────────────────

interface StoryData {
  id: string;
  status: string;
  character_id: string;
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
    hair_color: string | null;
    skin_tone: string | null;
    eye_color: string | null;
    hairstyle: string | null;
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

/** Two-column preview + buy panel from Tailwind's lg breakpoint. */
function useIsWide(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia("(min-width: 1024px)");
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => false,
  );
}

// In preview mode: show first N scenes fully (illustration + text) then 1 locked teaser page

// ── Page Component ─────────────────────────────────────────────────────────

export default function PreviewPage() {
  const t = useTranslations("crear.preview");
  const tPricing = useTranslations("pricing");
  const tDash = useTranslations("dashboard");
  const tPurchase = useTranslations("crear.purchase");
  const locale = useLocale();
  const price = useCallback((cents: number) => formatPrice(cents, locale), [locale]);
  const { storyId } = useParams<{ storyId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const needsAccount = !user || user.is_anonymous === true;

  const [story, setStory] = useState<StoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 401/404: the story exists for another session (guest in another browser / other account).
  const [notAccessible, setNotAccessible] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  // One-shot "book is born" reveal — flagged by /generar right before redirect
  const [showReveal, setShowReveal] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem("meapica_fresh_book") === storyId) {
        sessionStorage.removeItem("meapica_fresh_book");
        setShowReveal(true);
      }
    } catch {
      // storage unavailable — skip the reveal
    }
  }, [storyId]);

  // Checkout state
  const [format, setFormat] = useState<BookFormat>(DEFAULT_BOOK_FORMAT);
  const [addons, setAddons] = useState<Set<AddonId>>(new Set());
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  // The sticky bar only pays once the parent has picked a format themselves
  // (the pre-selected hardcover does not count); until then it shows the formats.
  const [formatChosen, setFormatChosen] = useState(false);
  // Express consent to lose the withdrawal right (art. 103 c + m LGDCU): never pre-ticked.
  const [withdrawalConsent, setWithdrawalConsent] = useState(false);
  // LSSI 21.2 opt-out at collection: unticked by default.
  const [marketingOptOut, setMarketingOptOut] = useState(false);
  const [consentState, setConsentState] = useState<ConsentState>("idle");
  const [editPanel, setEditPanel] = useState<EditPanel | null>(null);
  const isWide = useIsWide();
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [previewOutdated, setPreviewOutdated] = useState(false);

  // Dev bypass: instant unlock without checkout (MOCK_MODE only)
  const [bypassingUnlock, setBypassingUnlock] = useState(false);
  const isMockMode = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

  // Previews made by the removed image engines have no frozen image plan and can't be fulfilled.
  const isOutdatedPreview =
    story?.status === "preview" && (previewOutdated || !(story.generated_text as { imagePlan?: unknown }).imagePlan);
  const isPreviewMode = story?.status === "preview";
  const isFullyReady = story?.status === "ready" || story?.status === "ordered";

  // Post-purchase offer on the owner's finished book (PDF → printed, or an extra
  // copy within 60 days). Decided server-side; /api/checkout re-checks it.
  const [offer, setOffer] = useState<StoryUpsell | null>(null);
  const [offerSheetOpen, setOfferSheetOpen] = useState(false);
  useEffect(() => {
    if (!isFullyReady) return;
    let cancelled = false;
    fetch(`/api/stories/${storyId}/offer`)
      .then((res) => (res.ok ? (res.json() as Promise<{ offer?: StoryUpsell | null }>) : null))
      .then((data) => {
        if (!cancelled) setOffer(data?.offer ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isFullyReady, storyId]);

  // Fetch story data
  useEffect(() => {
    async function fetchStory() {
      try {
        const res = await fetch(`/api/stories/${storyId}`);
        if (res.status === 401 || res.status === 404) {
          setNotAccessible(true);
          return;
        }
        if (!res.ok) {
          throw new Error(`story_fetch_${res.status}`);
        }
        const data = await res.json();
        // Redirect to generation page if not yet generated
        if (data.status === "draft" || data.status === "generating") {
          router.replace(`/crear/${storyId}/generar`);
          return;
        }
        setStory(data);
      } catch (err) {
        console.warn("[preview] Loading story failed:", err);
        setError(t("loadError"));
      } finally {
        setLoading(false);
      }
    }
    fetchStory();
  }, [storyId, router, t]);

  const pages = story
    ? buildBookPages(story, t("synopsisFallback", { name: story.characters.name }), { preview: isPreviewMode })
    : [];
  // Same preview slice as the read-only share view (lib/book-pages).
  const visiblePages = isPreviewMode ? toPreviewPages(pages) : pages;

  // The preview ends on "what's still to come" + the printed book, not on a blank padlock page.
  const bookPages =
    isPreviewMode && story
      ? withTeaserEnd(visiblePages, {
          scenes: story.generated_text.scenes,
          characterName: story.characters.name,
          order: isOutdatedPreview
            ? undefined
            : {
                title: story.title ?? story.generated_text.bookTitle,
                characterName: story.characters.name,
                coverUrl: story.cover_image_url,
                format: format === "digital_pdf" ? "pdf" : format,
                priceFrom: price(PRICING.softcover.price),
              },
        })
      : visiblePages;
  const totalPages = bookPages.length;

  // Keyboard navigation (not while a field or the format radios have focus)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable='true']")) return;
      if (e.key === "ArrowLeft") setCurrentPage((p) => spreadStart(Math.max(0, spreadIndexOf(p, totalPages) - 1)));
      if (e.key === "ArrowRight") setCurrentPage((p) => Math.min(totalPages - 1, spreadStart(spreadIndexOf(p, totalPages) + 1)));
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
    Array.from(addons).reduce((sum, id) => sum + addonPrice(id, format), 0);

  // Title / dedication edits from the checklist sheets update the book in place.
  const handleTitleSaved = useCallback((title: string) => {
    setStory((prev) => (prev ? { ...prev, title } : prev));
  }, []);
  const handleDedicationSaved = useCallback((v: { dedication: string; senderName: string }) => {
    setStory((prev) =>
      prev
        ? { ...prev, dedication_text: v.dedication.trim() ? v.dedication : null, sender_name: v.senderName.trim() ? v.senderName : null }
        : prev,
    );
  }, []);

  // Screen 5 (the book) vs screen 6 (format + payment): the progress indicator
  // follows the checkout section once its top passes the middle of the viewport.
  // Measured on scroll/resize instead of an IntersectionObserver band: the
  // observer latched "in view" while the flipbook was still loading (short page)
  // and the header showed step 6 on arrival.
  // Two columns (lg+): the buy panel is always beside the book, so step 6 starts
  // with the first explicit format choice instead.
  const [checkoutInView, setCheckoutInView] = useState(false);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = document.getElementById("checkout-section");
      setCheckoutInView(!!el && el.getBoundingClientRect().top < window.innerHeight * 0.5);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onScroll = schedule;
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", schedule);
    // Layout grows as the flipbook loads without any scroll event: re-measure then too.
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    ro?.observe(document.body);
    schedule();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", schedule);
      ro?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [story?.status]);
  // "Lo quiero" / teaser CTA / sticky bar before a choice: bring the format radios
  // into view (scroll-margin keeps them clear of the sticky header) and focus the
  // selected one, so arrow keys / a tap choose straight away.
  const scrollToCheckout = useCallback(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const formats = document.getElementById("formats");
    if (!formats) return;
    const r = formats.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) {
      formats.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
    formats.querySelector<HTMLInputElement>("input:checked")?.focus({ preventScroll: true });
  }, []);

  // Earlier screens stay reachable without losing anything (the draft is kept).
  const goToStep = useCallback(
    (step: number) => {
      if (step === 4) return router.push(`/crear/${storyId}/generar`);
      if (step === 6) return scrollToCheckout();
      if (step === 5) return window.scrollTo({ top: 0, behavior: "smooth" });
      patchStoredDraft({ currentStep: step }, storyId);
      router.push("/crear");
    },
    [router, storyId, scrollToCheckout],
  );
  const [draftMatches, setDraftMatches] = useState(false);
  useEffect(() => {
    setDraftMatches(readStoredDraft()?.createdStory?.id === storyId);
  }, [storyId]);

  const chooseFormat = useCallback((next: BookFormat) => {
    setFormat(next);
    setFormatChosen(true);
  }, []);

  // Mobile sticky buy bar: shown while the main CTA is off-screen.
  const mainCtaRef = useRef<HTMLButtonElement | null>(null);
  const [mainCtaVisible, setMainCtaVisible] = useState(false);
  useEffect(() => {
    const el = mainCtaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setMainCtaVisible(entry.isIntersecting),
      { rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [story?.status]);

  const scrollToConsent = useCallback(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("withdrawal-consent")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  }, []);

  const handleCheckout = useCallback(async () => {
    if (!withdrawalConsent) {
      setConsentState("missing");
      scrollToConsent();
      return;
    }
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
          locale,
          withdrawalConsent: true,
          marketingOptOut,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.error === "preview_outdated") {
          setPreviewOutdated(true);
          setCheckingOut(false);
          return;
        }
        throw new Error(data?.error === "mock_mode_checkout_disabled" ? "mock" : "checkout");
      }

      const { url } = await res.json();
      // The book is ordered from here on: the creation draft is no longer needed.
      if (readStoredDraft()?.createdStory?.id === storyId) clearStoredDraft();
      window.location.href = url;
    } catch (err) {
      console.warn("[preview] Checkout failed:", err);
      setCheckoutError(
        err instanceof Error && err.message === "mock"
          ? "DEV: checkout is disabled in MOCK_MODE (shared prod DB). Use the Mock Mode unlock button."
          : t("checkoutError"),
      );
      setCheckingOut(false);
    }
  }, [storyId, format, addons, locale, withdrawalConsent, marketingOptOut, t, scrollToConsent]);

  // Mobile sticky bar: formats first; once chosen, the consent line (softly, never
  // the red error), then straight to Stripe.
  const handleStickyBuy = useCallback(() => {
    if (!formatChosen) return scrollToCheckout();
    if (!withdrawalConsent) {
      setConsentState("nudge");
      scrollToConsent();
      return;
    }
    void handleCheckout();
  }, [formatChosen, withdrawalConsent, scrollToCheckout, scrollToConsent, handleCheckout]);

  // The PDF lives in private storage: ask for a short-lived signed URL, then navigate to it.
  const handleDownloadPdf = useCallback(async () => {
    setDownloadingPdf(true);
    setDownloadError(null);
    try {
      const res = await fetch(`/api/stories/${storyId}/pdf`);
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? `pdf_${res.status}`);
      window.location.href = data.url;
    } catch (err) {
      console.warn("[preview] PDF download failed:", err);
      setDownloadError(tDash("pdfNotReady"));
    } finally {
      setDownloadingPdf(false);
    }
  }, [storyId, tDash]);

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
        <div className="flex flex-1 flex-col items-center justify-center px-4">
          <BrandLoader size="lg" caption={t("loadingStory")} />
        </div>
      </div>
    );
  }

  if (notAccessible) {
    return (
      <div className="flex min-h-screen flex-col bg-create-bg" data-testid="preview-not-accessible">
        <CreationHeader rightAction="close" />
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <div className="max-w-md">
            <span aria-hidden className="material-symbols-outlined text-5xl text-brand-text">devices</span>
            <h1 className="mt-4 font-display text-2xl font-bold text-secondary">{t("notAccessibleTitle")}</h1>
            <p className="mt-3 text-sm leading-relaxed text-text-muted">{t("notAccessibleBody")}</p>
            <div className="mt-8 flex flex-col items-center gap-3">
              {needsAccount && (
                <Link
                  href={`/auth/login?next=/crear/${storyId}/preview`}
                  className="min-h-12 inline-flex items-center gap-2 rounded-xl bg-create-primary px-6 py-3.5 text-[19px] font-bold leading-tight text-white transition-colors hover:bg-create-primary-hover"
                >
                  <span aria-hidden className="material-symbols-outlined text-lg">login</span>
                  {t("notAccessibleLogin")}
                </Link>
              )}
              <Link href="/crear" className="text-sm text-text-muted transition-colors hover:text-brand-text">
                {t("notAccessibleCreate")}
              </Link>
            </div>
          </div>
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
            className="mt-6 text-sm text-brand-text hover:underline"
          >
            {t("backToCreate")}
          </Link>
        </div>
      </div>
    );
  }

  const currentTitle = story.title ?? story.generated_text.bookTitle;
  const titleSuggestions = Array.from(
    new Set([...(story.generated_text.titleOptions ?? []), currentTitle].filter(Boolean)),
  ).slice(0, 4);
  const childName = story.characters.name;
  // Purchasable preview: two columns on desktop (book | sticky buy panel).
  const showBuy = isPreviewMode && !isOutdatedPreview;
  const isDigital = format === "digital_pdf";
  const bookColors = getBookColors(story.template_id, story.characters.gender, story.characters.favorite_color);
  const spineColor = bookColors.gradientStart;
  // Back cover of the 3D mockup, from the same data as the printed one (closing art or the cover)
  const backPage = pages.find((p) => p.type === "back");
  const mockupBack =
    backPage?.type === "back"
      ? {
          imageUrl: backPage.coverImageUrl,
          synopsis: backPage.synopsis,
          subtitle: t("personalizedStory"),
          titleColor: bookColors.titleColor,
          accentColor: bookColors.accent,
          ornamentColor: bookColors.ornamentColor,
        }
      : undefined;
  const editLink = (panel: EditPanel) => {
    const EditLink = (chunks: React.ReactNode) => (
      <button
        type="button"
        onClick={() => setEditPanel(panel)}
        data-testid={`edit-link-${panel}`}
        className="font-semibold text-create-text underline decoration-create-text-sub/40 underline-offset-2 transition-colors hover:text-brand-text"
      >
        {chunks}
      </button>
    );
    return EditLink;
  };

  const titleBlock = (
    <div className="min-w-0">
      <h1 className="font-display text-lg font-bold leading-snug text-create-text-dark sm:text-xl">
        {currentTitle}
        {isPreviewMode && (
          <button
            type="button"
            onClick={() => setEditPanel("cover")}
            aria-label={tPurchase("editTitle")}
            title={tPurchase("editTitle")}
            className="ml-1.5 inline-flex h-7 w-7 translate-y-[-1px] items-center justify-center rounded-full align-middle text-create-text-sub transition-colors hover:bg-create-neutral hover:text-brand-text"
          >
            <span aria-hidden className="material-symbols-outlined text-[18px]">edit</span>
          </button>
        )}
      </h1>
      {isPreviewMode && (
        <p className="mt-0.5 text-xs text-create-text-sub">
          {t("previewBadge")} · {tPurchase("scenesShown", { shown: PREVIEW_CLEAR_SCENES, total: TOTAL_SCENE_COUNT })}
        </p>
      )}
    </div>
  );

  return (
    <div className={`min-h-screen bg-create-bg ${showBuy ? "pb-28 sm:pb-0" : ""}`}>
      <CreationHeader
        currentStep={isPreviewMode ? ((isWide ? formatChosen : checkoutInView) ? 6 : 5) : undefined}
        onBack={() => router.push(`/crear/${storyId}/generar`)}
        onStepClick={goToStep}
        canStepNavigate={(step) => isPreviewMode && (step >= 4 || draftMatches)}
      />

      {showReveal && (
        <BookRevealOverlay
          coverUrl={story.cover_image_url}
          childName={story.characters.name}
          onDone={() => setShowReveal(false)}
        />
      )}

      <main
        className={
          showBuy
            ? "mx-auto max-w-[1520px] px-4 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-8 lg:px-8 xl:grid-cols-[minmax(0,1fr)_410px] xl:gap-12"
            : "mx-auto max-w-4xl px-4"
        }
      >
        <div className="min-w-0">
          <div className="pt-4 lg:pt-6">{titleBlock}</div>

          {/* Book viewer: on desktop as tall as the viewport allows (two square pages) */}
          <section className="py-5 sm:py-8 lg:pt-5">
            <div
              className="mx-auto"
              style={showBuy ? { maxWidth: "min(100%, calc((100dvh - var(--creation-header-h, 56px) - 150px) * 2))" } : undefined}
            >
              <ErrorBoundary>
                <BookViewerSwitch
                  pages={bookPages}
                  templateId={story.template_id}
                  gender={story.characters.gender}
                  favoriteColor={story.characters.favorite_color ?? undefined}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                  onEdit={isPreviewMode ? setEditPanel : undefined}
                  onOrder={showBuy ? scrollToCheckout : undefined}
                  hidePageCount={isPreviewMode}
                  actions={
                    isPreviewMode ? (
                      <SharePreviewButton
                        storyId={storyId}
                        childName={childName}
                        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border-light bg-white px-4 py-1.5 text-xs font-semibold text-create-text-dark transition-colors hover:border-create-primary hover:text-brand-text disabled:opacity-60"
                      />
                    ) : undefined
                  }
                />
              </ErrorBoundary>
            </div>
            {isPreviewMode && (
              <p className="mt-3 text-center text-xs text-create-text-sub">
                {tPurchase.rich("editLinks", {
                  title: editLink("cover"),
                  dedication: editLink("dedication"),
                  look: editLink("protagonist"),
                })}
              </p>
            )}
          </section>
        </div>

        {showBuy && (
          <aside className="pb-8 lg:sticky lg:top-[calc(var(--creation-header-h,56px)+16px)] lg:max-h-[calc(100dvh-var(--creation-header-h,56px)-24px)] lg:overflow-y-auto lg:overscroll-contain lg:py-4">
            <div className="rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(44,24,16,0.04),0_8px_24px_-12px_rgba(44,24,16,0.12)] ring-1 ring-create-neutral sm:p-6">
              <PurchasePanel
                ref={mainCtaRef}
                childName={childName}
                title={currentTitle}
                coverUrl={story.cover_image_url}
                spineColor={spineColor}
                back={mockupBack}
                compact={isWide}
                format={format}
                onChooseFormat={chooseFormat}
                addons={addons}
                onToggleAddon={toggleAddon}
                subtotal={subtotal}
                consent={withdrawalConsent}
                consentState={consentState}
                onConsentChange={(checked) => {
                  setWithdrawalConsent(checked);
                  if (checked) setConsentState("idle");
                }}
                marketingOptOut={marketingOptOut}
                onMarketingOptOutChange={setMarketingOptOut}
                checkingOut={checkingOut}
                checkoutError={checkoutError}
                onCheckout={() => void handleCheckout()}
                devTools={
                  isMockMode ? (
                    <div data-dev-tools className="mt-4 rounded-lg border border-dashed border-amber-400 bg-amber-50 p-3">
                      <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-wider text-amber-700">DEV · Mock Mode</p>
                      <button
                        type="button"
                        onClick={handleDevUnlock}
                        disabled={bypassingUnlock}
                        className="w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-amber-600 disabled:opacity-60"
                      >
                        {bypassingUnlock ? "Unlocking…" : "Unlock all scenes instantly (skip checkout)"}
                      </button>
                    </div>
                  ) : undefined
                }
              />
            </div>
          </aside>
        )}
      </main>

      {isPreviewMode && (
        <BookEditSheets
          storyId={storyId}
          childName={story.characters.name}
          character={story.characters}
          useDraftLook={draftMatches}
          title={currentTitle}
          titleSuggestions={titleSuggestions}
          dedication={story.dedication_text ?? ""}
          senderName={story.sender_name ?? ""}
          open={editPanel}
          onOpenChange={setEditPanel}
          onTitleSaved={handleTitleSaved}
          onDedicationSaved={handleDedicationSaved}
          onChangeLook={() => goToStep(2)}
        />
      )}

      {/* PDF Download — only for fully ready stories */}
      {isFullyReady && (
        <div className="mx-auto max-w-3xl px-4 pb-6">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="group mx-auto flex w-full max-w-md items-center justify-center gap-2.5 rounded-xl border-2 border-border-light bg-white px-6 py-3.5 text-sm font-bold text-secondary transition-all hover:border-create-primary hover:bg-create-primary/5 hover:text-brand-text active:scale-[0.98] disabled:opacity-60 shadow-sm"
          >
            {downloadingPdf ? (
              <Spinner className="text-lg" />
            ) : (
              <span aria-hidden className="material-symbols-outlined text-lg">picture_as_pdf</span>
            )}
            {t("downloadPdf")}
          </button>
          <p className="mt-2 text-center text-xs text-text-muted">
            {t("downloadHint")}
          </p>
          {downloadError && (
            <p className="mt-2 text-center text-xs text-red-600" role="alert">{downloadError}</p>
          )}
          {offer && <OfferCallout offer={offer} onOpen={() => setOfferSheetOpen(true)} className="mx-auto mt-6 max-w-xl" />}
          <ReorderSheet
            storyId={offerSheetOpen ? storyId : null}
            title={currentTitle}
            offer={offer}
            onClose={() => setOfferSheetOpen(false)}
          />
        </div>
      )}

      {/* ── Outdated preview (old engine): can't be bought, offer a fresh one ── */}
      {isOutdatedPreview && (
        <section id="checkout-section" className="border-t border-border-light bg-white">
          <div className="mx-auto max-w-md px-4 py-10 text-center">
            <span aria-hidden className="material-symbols-outlined mb-3 text-4xl text-brand-text">history</span>
            <h2 className="font-display text-xl font-bold text-secondary">{t("previewOutdatedTitle")}</h2>
            <p className="mt-2 text-sm text-text-muted">{t("previewOutdatedBody")}</p>
            <Link
              href={`/crear?characterId=${story.character_id}`}
              className="min-h-12 mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-create-primary px-6 py-3.5 text-[19px] font-bold leading-tight text-white transition-colors hover:bg-create-primary-hover"
            >
              <span aria-hidden className="material-symbols-outlined text-lg">auto_stories</span>
              {t("previewOutdatedCta")}
            </Link>
          </div>
        </section>
      )}

      {/* Secondary: decide later (save / share / email — three equal options) + short FAQ */}
      {showBuy && (
        <div className="mx-auto max-w-[1360px] px-4 pb-16 lg:px-8">
          <div className="mx-auto max-w-4xl space-y-12 border-t border-create-neutral pt-10">
            <section aria-labelledby="save-later-title" data-testid="decide-later">
              <h2 id="save-later-title" className="font-display text-xl font-bold text-secondary">
                {tPurchase("secondaryTitle")}
              </h2>
              <ul className="mt-4 grid divide-y divide-create-neutral overflow-hidden rounded-2xl bg-white ring-1 ring-create-neutral md:grid-cols-3 md:divide-x md:divide-y-0">
                <LaterOption
                  icon={needsAccount ? "bookmark_add" : "bookmark_added"}
                  title={needsAccount ? tPurchase("later.saveTitle") : tPurchase("later.savedTitle")}
                  body={needsAccount ? tPurchase("later.saveBody") : tPurchase("later.savedBody")}
                >
                  <Link
                    href={needsAccount ? `/auth/login?next=/crear/${storyId}/preview` : "/dashboard"}
                    className={LATER_BUTTON}
                    data-testid="later-save"
                  >
                    {needsAccount ? tPurchase("later.saveAction") : tPurchase("later.savedAction")}
                  </Link>
                </LaterOption>
                <LaterOption icon="ios_share" title={tPurchase("later.shareTitle")} body={tPurchase("later.shareBody")}>
                  <SharePreviewButton storyId={storyId} childName={childName} fullWidth className={LATER_BUTTON} />
                </LaterOption>
                <LaterOption icon="mail" title={tPurchase("later.emailTitle")} body={tPurchase("later.emailBody")}>
                  <SendPreviewEmail
                    storyId={storyId}
                    childName={childName}
                    variant="inline"
                    sendLabel={tPurchase("later.emailSend")}
                    buttonClassName={LATER_BUTTON_INLINE}
                  />
                </LaterOption>
              </ul>
            </section>
            <PreviewFaq />
          </div>
        </div>
      )}

      {/* Mobile sticky buy bar: price from the first screen; formats first, then Stripe */}
      {showBuy && !mainCtaVisible && (
        <div
          data-testid="sticky-buy"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-create-neutral bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur sm:hidden"
        >
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-bold text-create-text-dark">
                {formatChosen ? (
                  <>
                    {/* Price first: the 19px CTA leaves ~110px at 360, so truncation eats the label, not the price */}
                    <span className="tabular-nums">{price(subtotal)}</span> · {tPricing(`${format}.label`)}
                  </>
                ) : (
                  tPurchase("stickyFrom", { price: price(PRICING.softcover.price) })
                )}
              </p>
              <p className={`mt-0.5 truncate text-[11px] ${formatChosen && isDigital ? "text-create-text-sub" : "font-semibold text-success"}`}>
                {formatChosen && isDigital ? tPricing("vatIncluded") : tPurchase("stickyNote")}
              </p>
            </div>
            <button
              type="button"
              onClick={handleStickyBuy}
              disabled={checkingOut}
              className="min-h-12 flex shrink-0 items-center gap-1.5 rounded-xl bg-create-primary px-5 py-3.5 text-[19px] font-bold leading-tight text-white shadow-lg shadow-create-primary/20 transition-all active:scale-[0.98] disabled:opacity-60"
            >
              {checkingOut && <Spinner className="text-lg" />}
              {!formatChosen ? tPurchase("stickyChoose") : isDigital ? t("stickyCtaDigital") : t("stickyCtaPhysical")}
            </button>
          </div>
          {checkoutError && (
            <p className="mt-2 text-center text-xs text-red-600" role="alert">{checkoutError}</p>
          )}
        </div>
      )}

      {/* Checkout for fully ready stories (already paid, viewing complete book) */}
      {isFullyReady && (
        <section className="border-t border-border-light bg-white">
          <div className="mx-auto max-w-3xl px-4 py-8 text-center">
            <Link
              href="/dashboard"
              className="inline-flex w-full max-w-md items-center justify-center gap-2 rounded-xl border-2 border-border-light px-6 py-3.5 text-sm font-bold text-secondary transition-all hover:border-create-primary hover:bg-create-primary/5 hover:text-brand-text active:scale-[0.98]"
            >
              <span aria-hidden className="material-symbols-outlined text-lg">library_books</span>
              {t("savedGoToLibrary")}
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

/** Secondary action in the "¿Lo decides más tarde?" options (same weight for all three). */
const LATER_BUTTON_BASE =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border-2 border-create-neutral bg-white px-4 text-sm font-bold text-secondary transition-colors hover:border-create-primary hover:text-brand-text disabled:opacity-60";
const LATER_BUTTON = `${LATER_BUTTON_BASE} w-full`;
/** The email option's button, beside its field */
const LATER_BUTTON_INLINE = `${LATER_BUTTON_BASE} shrink-0`;

/** One of the three "decide later" options: icon + title, one line, action at the foot. */
function LaterOption({ icon, title, body, children }: { icon: string; title: string; body: string; children: React.ReactNode }) {
  return (
    <li className="flex flex-col p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand-text">
          <span className="material-symbols-outlined text-[22px]">{icon}</span>
        </span>
        <h3 className="font-display text-base font-bold leading-tight text-create-text-dark">{title}</h3>
      </div>
      <p className="mt-2.5 text-sm leading-relaxed text-create-text-sub">{body}</p>
      <div className="mt-4 md:mt-auto md:pt-5">{children}</div>
    </li>
  );
}
