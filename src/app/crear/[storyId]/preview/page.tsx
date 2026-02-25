"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PRICING, ADDONS, type BookFormat, type AddonId } from "@/lib/pricing";
import { STORY_TEMPLATES } from "@/lib/create-store";
import CreationHeader from "@/components/crear/CreationHeader";
import type { GeneratedScene, GeneratedStory } from "@/lib/ai/gemini";

// ── Types ──────────────────────────────────────────────────────────────────

interface StoryData {
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

function buildPages(story: StoryData): BookPage[] {
  const generated = story.generated_text;
  const illustrations = story.story_illustrations.sort(
    (a, b) => a.scene_number - b.scene_number
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
      (i) => i.scene_number === scene.sceneNumber
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

export default function PreviewPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const router = useRouter();

  const [story, setStory] = useState<StoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  // Checkout state
  const [format, setFormat] = useState<BookFormat>("softcover");
  const [addons, setAddons] = useState<Set<AddonId>>(new Set());
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

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
        if (data.status !== "ready") {
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
  const totalPages = pages.length;

  const goToPrevPage = useCallback(() => {
    setCurrentPage((p) => Math.max(0, p - 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setCurrentPage((p) => Math.min(totalPages - 1, p + 1));
  }, [totalPages]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") goToPrevPage();
      if (e.key === "ArrowRight") goToNextPage();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToPrevPage, goToNextPage]);

  const toggleAddon = useCallback((id: AddonId) => {
    setAddons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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
        err instanceof Error ? err.message : "Error al procesar el pago"
      );
      setCheckingOut(false);
    }
  }, [storyId, format, addons]);

  // ── Loading / Error states ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-create-bg">
        <CreationHeader rightAction="close" />
        <div className="flex flex-1 flex-col items-center justify-center">
          <span className="material-symbols-outlined animate-spin text-4xl text-create-primary">
            progress_activity
          </span>
          <p className="mt-4 text-sm text-text-muted">Cargando tu cuento...</p>
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
            Volver a crear
          </Link>
        </div>
      </div>
    );
  }

  const page = pages[currentPage];
  const template = STORY_TEMPLATES.find((t) => t.id === story.template_id);

  return (
    <div className="min-h-screen bg-create-bg">
      <CreationHeader rightAction="close" />

      {/* Book title + page counter */}
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-2">
        <h2 className="font-display text-sm font-bold text-secondary truncate max-w-50 sm:max-w-none">
          {story.generated_text.bookTitle}
        </h2>
        <span className="text-xs text-text-muted tabular-nums">
          {currentPage + 1} / {totalPages}
        </span>
      </div>

      {/* Book viewer */}
      <section className="mx-auto max-w-3xl px-4 py-8">
        <div className="relative">
          {/* Book page */}
          <div className="relative aspect-square w-full max-w-lg mx-auto overflow-hidden rounded-2xl shadow-xl border border-border-light bg-white">
            <PageContent page={page} templateId={story.template_id} />

            {/* Page navigation overlays */}
            <button
              onClick={goToPrevPage}
              disabled={currentPage === 0}
              className="absolute left-0 top-0 bottom-0 w-1/5 flex items-center justify-start pl-3 opacity-0 hover:opacity-100 transition-opacity disabled:hidden"
              aria-label="Previous page"
            >
              <span className="material-symbols-outlined rounded-full bg-white/90 p-2 text-xl text-text-muted shadow-md">
                chevron_left
              </span>
            </button>
            <button
              onClick={goToNextPage}
              disabled={currentPage === totalPages - 1}
              className="absolute right-0 top-0 bottom-0 w-1/5 flex items-center justify-end pr-3 opacity-0 hover:opacity-100 transition-opacity disabled:hidden"
              aria-label="Next page"
            >
              <span className="material-symbols-outlined rounded-full bg-white/90 p-2 text-xl text-text-muted shadow-md">
                chevron_right
              </span>
            </button>
          </div>

          {/* Page dots */}
          <div className="mt-6 flex items-center justify-center gap-1.5 flex-wrap">
            {pages.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i)}
                className={`h-2 rounded-full transition-all ${
                  i === currentPage
                    ? "w-6 bg-create-primary"
                    : "w-2 bg-border-light hover:bg-text-muted"
                }`}
                aria-label={`Go to page ${i + 1}`}
              />
            ))}
          </div>

          {/* Navigation buttons (mobile-friendly) */}
          <div className="mt-4 flex items-center justify-center gap-4 sm:hidden">
            <button
              onClick={goToPrevPage}
              disabled={currentPage === 0}
              className="flex items-center gap-1 rounded-full border border-border-light px-4 py-2 text-sm text-text-soft transition-colors hover:bg-cream disabled:opacity-30"
            >
              <span className="material-symbols-outlined text-base">
                chevron_left
              </span>
              Anterior
            </button>
            <button
              onClick={goToNextPage}
              disabled={currentPage === totalPages - 1}
              className="flex items-center gap-1 rounded-full border border-border-light px-4 py-2 text-sm text-text-soft transition-colors hover:bg-cream disabled:opacity-30"
            >
              Siguiente
              <span className="material-symbols-outlined text-base">
                chevron_right
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Checkout section */}
      <section className="border-t border-border-light bg-white">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <h2 className="text-center font-display text-2xl font-bold text-secondary">
            Haz realidad este cuento
          </h2>
          <p className="mt-2 text-center text-sm text-text-muted">
            Elige el formato y los extras para tu libro personalizado
          </p>

          {/* Format selection */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(Object.entries(PRICING) as [BookFormat, typeof PRICING[BookFormat]][]).map(
              ([key, val]) => (
                <button
                  key={key}
                  onClick={() => setFormat(key)}
                  className={`relative rounded-xl border-2 p-5 text-left transition-all ${
                    format === key
                      ? "border-create-primary bg-create-primary/5 shadow-md shadow-create-primary/10"
                      : "border-border-light hover:border-border-medium"
                  }`}
                >
                  {/* Check inside top-right */}
                  {format === key && (
                    <div className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-create-primary">
                      <span className="material-symbols-outlined text-xs text-white">
                        check
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-xl text-create-primary">
                      {key === "softcover" ? "menu_book" : "book"}
                    </span>
                    <span className="font-display text-base font-bold text-text-main">
                      {val.label}
                    </span>
                    <span className="ml-auto text-lg font-bold text-secondary tabular-nums whitespace-nowrap pr-6">
                      {(val.price / 100).toFixed(2)} €
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    {val.description}
                  </p>
                </button>
              )
            )}
          </div>

          {/* Add-ons */}
          <div className="mt-8">
            <h3 className="font-display text-sm font-bold text-text-main uppercase tracking-wider">
              Extras opcionales
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
                      {/* Badge */}
                      {val.badge && (
                        <span className="absolute -top-2.5 left-4 rounded-full bg-create-gold px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">
                          {val.badge}
                        </span>
                      )}

                      {/* Header row: icon + title + price */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          {/* Addon icon */}
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
                              {val.label}
                            </span>
                            <p className="mt-0.5 text-xs text-text-muted">
                              {val.description}
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

                      {/* Details with check icons */}
                      <ul className="mt-3 ml-13 space-y-1.5">
                        {val.details.map((detail, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-1.5 text-xs text-text-soft"
                          >
                            <span className="material-symbols-outlined text-sm mt-px text-create-primary shrink-0">
                              check_circle
                            </span>
                            {detail.text}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* Order summary + CTA */}
          <div className="mt-8 rounded-xl border border-border-light bg-cream p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted">
                {PRICING[format].label}
              </span>
              <span className="text-sm tabular-nums">
                {(PRICING[format].price / 100).toFixed(2)} €
              </span>
            </div>
            {Array.from(addons).map((id) => (
              <div key={id} className="mt-2 flex items-center justify-between">
                <span className="text-sm text-text-muted">
                  {ADDONS[id].label}
                </span>
                <span className="text-sm tabular-nums">
                  {(ADDONS[id].price / 100).toFixed(2)} €
                </span>
              </div>
            ))}
            <div className="mt-4 border-t border-border-medium pt-4 flex items-center justify-between">
              <span className="font-display text-base font-bold text-text-main">
                Total
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
                  Procesando...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-lg">
                    shopping_bag
                  </span>
                  Comprar ahora — {(subtotal / 100).toFixed(2)} €
                </span>
              )}
            </button>

            {checkoutError && (
              <p className="mt-3 text-center text-xs text-red-600">
                {checkoutError}
              </p>
            )}

            <p className="mt-4 text-center text-xs text-text-muted">
              Pago seguro con Stripe. Envío a toda España y Europa.
            </p>
          </div>
        </div>
      </section>
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
          <h2 className="font-display text-2xl font-bold text-white leading-tight">
            {page.title}
          </h2>
          <p className="mt-3 text-sm text-white/70">
            Una historia personalizada para{" "}
            <span className="font-bold text-white">{page.characterName}</span>
          </p>
          <div className="mt-6 h-px w-16 bg-white/30" />
          <p className="mt-3 text-xs text-white/50 tracking-wider uppercase">
            StoryMagic
          </p>
        </div>
      );

    case "dedication":
      return (
        <div className="flex h-full flex-col items-center justify-center bg-cream p-8 text-center">
          <span className="material-symbols-outlined text-3xl text-create-gold mb-4">
            favorite
          </span>
          <p className="font-display text-base italic leading-relaxed text-secondary max-w-xs">
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
          {/* Illustration area */}
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
            {/* Scene number badge */}
            <div className="absolute top-3 left-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-sm">
              <span className="text-xs font-bold text-secondary">
                {page.scene.sceneNumber}
              </span>
            </div>
          </div>
          {/* Text area */}
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
          <span className="material-symbols-outlined text-4xl text-create-gold mb-4">
            auto_awesome
          </span>
          <p className="font-display text-lg font-bold leading-relaxed text-secondary max-w-xs">
            {page.message}
          </p>
          <div className="mt-6 h-px w-16 bg-border-light" />
          <p className="mt-3 text-xs text-text-muted">Fin</p>
        </div>
      );

    case "back":
      return (
        <div
          className={`flex h-full flex-col items-center justify-center bg-gradient-to-br ${gradient} p-8 text-center`}
        >
          <p className="text-sm text-white/70">
            Una historia creada especialmente para
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-white">
            {page.characterName}
          </p>
          <div className="mt-6 h-px w-16 bg-white/30" />
          <p className="mt-4 text-xs text-white/40 tracking-wider uppercase">
            StoryMagic
          </p>
        </div>
      );
  }
}
