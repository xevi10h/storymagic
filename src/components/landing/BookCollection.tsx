"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PRICING, formatPrice } from "@/lib/pricing";
import { ChoiceChip, Heading, cx, focusRing } from "@/components/ui";
import BookCollectionCard from "./BookCollectionCard";
import { AGE_FILTERS, buildCatalog, fitsAgeFilter, type AgeFilter, type ShowcaseBook } from "./BookCollectionData";

const FILTER_LABEL_KEYS: Record<AgeFilter, "filterAll" | "filter2to4" | "filter5to7" | "filter8to12"> = {
  all: "filterAll",
  "2-4": "filter2to4",
  "5-7": "filter5to7",
  "8-12": "filter8to12",
};

/** Real books painted on the platform, locale first; any failure falls back to template art. */
async function fetchShowcase(locale: string): Promise<ShowcaseBook[]> {
  try {
    const localeRes = await fetch(`/api/showcase?locale=${locale}`);
    if (localeRes.ok) {
      const data: ShowcaseBook[] = await localeRes.json();
      if (data.length > 0) return data;
    }
    const res = await fetch("/api/showcase");
    return res.ok ? ((await res.json()) as ShowcaseBook[]) : [];
  } catch {
    return [];
  }
}

/** Whether the carousel can scroll further left/right (arrows hide when it can't). */
function useScrollEdges(ref: RefObject<HTMLDivElement | null>, contentKey: string) {
  const [edges, setEdges] = useState({ left: false, right: false });
  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [ref, update, contentKey]);

  return edges;
}

export default function BookCollection() {
  const t = useTranslations("bookCollection");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const [showcase, setShowcase] = useState<ShowcaseBook[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeFilter, setActiveFilter] = useState<AgeFilter>("all");
  const scrollRef = useRef<HTMLDivElement>(null);

  // The lowest printed format is the "from" price (source of truth: src/lib/pricing).
  const fromPrice = formatPrice(Math.min(PRICING.softcover.price, PRICING.hardcover.price), locale);

  useEffect(() => {
    let cancelled = false;
    fetchShowcase(locale).then((books) => {
      if (cancelled) return;
      setShowcase(books);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  // Skeletons match the final card count, so nothing jumps when the art arrives.
  const worlds = useMemo(
    () => buildCatalog(showcase).filter((w) => fitsAgeFilter(w.template, activeFilter)),
    [showcase, activeFilter],
  );
  const contentKey = `${loaded}-${activeFilter}-${worlds.length}`;
  const edges = useScrollEdges(scrollRef, contentKey);


  const onFilterKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = AGE_FILTERS[(AGE_FILTERS.indexOf(activeFilter) + step + AGE_FILTERS.length) % AGE_FILTERS.length];
    setActiveFilter(next);
    const chip = e.currentTarget.querySelector<HTMLButtonElement>(`[data-filter="${next}"]`);
    chip?.focus();
    chip?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  };

  const scrollByPage = (direction: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  };

  const arrowClass = cx(
    "flex size-11 items-center justify-center rounded-full border-2 border-line bg-surface text-ink-soft transition-colors hover:border-brand/40 hover:text-brand-text disabled:pointer-events-none disabled:opacity-40",
    focusRing,
  );
  const showArrows = edges.left || edges.right;

  // Carousel below xl (snap, next card peeks), 5-column grid on wide desktop (10 worlds = 2 full rows).
  const trackClass =
    "no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:gap-4 sm:px-6 xl:mx-0 xl:grid xl:grid-cols-5 xl:gap-5 xl:overflow-visible xl:px-0 xl:pb-0";
  const itemClass = "w-[min(78vw,280px)] shrink-0 snap-start xl:w-auto";

  return (
    <section id="catalog" aria-labelledby="catalog-title" className="scroll-mt-[var(--landing-nav-h,64px)] bg-paper px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-[1200px]">
        <Heading as="h2" id="catalog-title" size="page" eyebrow={tNav("books")} subtitle={t("subtitle")} className="max-w-2xl text-balance">
          {t("title")}
        </Heading>

        <div className="mb-5 mt-6 flex items-center gap-4">
          <div
            role="radiogroup"
            aria-label={t("filterLabel")}
            onKeyDown={onFilterKeyDown}
            className="no-scrollbar -mx-4 flex min-w-0 flex-1 scroll-px-4 gap-2 overflow-x-auto px-4 sm:-mx-6 sm:scroll-px-6 sm:px-6 md:mx-0 md:scroll-px-0 md:px-0"
          >
            {AGE_FILTERS.map((filter) => (
              <ChoiceChip
                key={filter}
                selected={activeFilter === filter}
                // Roving tabindex (ARIA radio group): Tab enters on the checked chip, arrows move.
                tabIndex={activeFilter === filter ? 0 : -1}
                data-filter={filter}
                onClick={(e) => {
                  setActiveFilter(filter);
                  // Keep the chosen chip fully visible in the scrollable chip row.
                  e.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
                }}
                className="shrink-0 whitespace-nowrap px-4 tabular-nums"
              >
                {t(FILTER_LABEL_KEYS[filter])}
              </ChoiceChip>
            ))}
          </div>

          {showArrows && (
            <div className="hidden shrink-0 gap-2 md:flex xl:hidden">
              <button type="button" onClick={() => scrollByPage(-1)} disabled={!edges.left} aria-label={t("prev")} className={arrowClass}>
                <span aria-hidden className="material-symbols-outlined">chevron_left</span>
              </button>
              <button type="button" onClick={() => scrollByPage(1)} disabled={!edges.right} aria-label={t("next")} className={arrowClass}>
                <span aria-hidden className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          )}
        </div>

        {/* Keyed by filter: a fresh track starts at the first card (scroll-snap would otherwise
            re-snap to the previously snapped card when the list changes). */}
        <div key={activeFilter} ref={scrollRef} className={trackClass} aria-busy={!loaded || undefined}>
          {loaded
            ? worlds.map((world) => (
                <BookCollectionCard key={world.template.id} world={world} fromPrice={fromPrice} className={itemClass} />
              ))
            : worlds.map((world) => (
                <div key={world.template.id} aria-hidden className={cx(itemClass, "animate-pulse overflow-hidden rounded-2xl border-2 border-line bg-surface")}>
                  <div className="aspect-square bg-line" />
                  <div className="space-y-3 p-4">
                    <div className="h-5 w-3/4 rounded bg-line" />
                    <div className="h-4 w-full rounded bg-line/70" />
                    <div className="h-4 w-1/2 rounded bg-line/70" />
                    <div className="h-9 w-full rounded bg-line/70" />
                  </div>
                </div>
              ))}
        </div>
      </div>
    </section>
  );
}
