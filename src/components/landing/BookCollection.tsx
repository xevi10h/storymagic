"use client";

import { useEffect, useState, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PRICING } from "@/lib/pricing";
import { STORY_TEMPLATES } from "@/lib/create-store";

interface ShowcaseBook {
  id: string;
  templateId: string;
  title: string;
  coverImage: string | null;
  characterName: string;
  characterAge: number;
  totalPages: number;
}

type AgeFilter = "all" | "2-4" | "5-7" | "8-12";

const softcoverPrice = (PRICING.softcover.price / 100).toFixed(2);
const hardcoverPrice = (PRICING.hardcover.price / 100).toFixed(2);

function getAgeFilter(age: number): AgeFilter {
  if (age <= 4) return "2-4";
  if (age <= 7) return "5-7";
  return "8-12";
}

function templateMatchesFilter(templateId: string, filter: AgeFilter): boolean {
  if (filter === "all") return true;
  const template = STORY_TEMPLATES.find((t) => t.id === templateId);
  if (!template) return true;
  const [min, max] = filter.split("-").map(Number);
  // Use midpoint of template's age range to assign it to a single filter bucket
  const midpoint = (template.ageMin + template.ageMax) / 2;
  return midpoint >= min && midpoint <= max;
}

export default function BookCollection() {
  const t = useTranslations("bookCollection");
  const td = useTranslations("data");
  const [showcaseBooks, setShowcaseBooks] = useState<ShowcaseBook[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeFilter, setActiveFilter] = useState<AgeFilter>("all");
  const scrollRef = useRef<HTMLDivElement>(null);
  const locale = useLocale();

  useEffect(() => {
    async function fetchShowcase() {
      try {
        // Try locale-specific showcase first, fall back to all
        const localeRes = await fetch(`/api/showcase?locale=${locale}`);
        if (localeRes.ok) {
          const data: ShowcaseBook[] = await localeRes.json();
          if (data.length > 0) {
            setShowcaseBooks(data);
            setLoaded(true);
            return;
          }
        }
        // Fallback: fetch all showcase stories regardless of locale
        const res = await fetch("/api/showcase");
        if (res.ok) {
          const data: ShowcaseBook[] = await res.json();
          if (data.length > 0) setShowcaseBooks(data);
        }
      } catch {
        // Silently fall back to template cards
      } finally {
        setLoaded(true);
      }
    }
    fetchShowcase();
  }, [locale]);

  const hasShowcase = showcaseBooks.length > 0;

  // When we have showcase books, filter them; otherwise show template cards
  const filteredShowcase = showcaseBooks.filter((b) =>
    templateMatchesFilter(b.templateId, activeFilter),
  );
  const filteredTemplates = STORY_TEMPLATES.filter((t) =>
    templateMatchesFilter(t.id, activeFilter),
  );

  const filters: { id: AgeFilter; label: string }[] = [
    { id: "all", label: t("filterAll") },
    { id: "2-4", label: t("filter2to4") },
    { id: "5-7", label: t("filter5to7") },
    { id: "8-12", label: t("filter8to12") },
  ];

  const scroll = (direction: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: direction === "left" ? -320 : 320,
      behavior: "smooth",
    });
  };

  return (
    <section className="bg-cream px-4 py-24" id="catalog">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="mb-3 font-display text-3xl font-bold text-secondary md:text-4xl">
              {t("title")}
            </h2>
            <p className="max-w-xl text-base text-text-soft md:text-lg">
              {hasShowcase ? t("subtitleShowcase") : t("subtitle")}
            </p>
          </div>

          {/* Age filters */}
          <div className="flex gap-2">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                  activeFilter === f.id
                    ? "bg-primary text-white shadow-md"
                    : "bg-white text-text-muted hover:bg-primary/10 hover:text-primary"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Carousel with navigation arrows */}
        <div className="relative">
          {/* Left arrow */}
          <button
            onClick={() => scroll("left")}
            className="absolute -left-2 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur transition-all hover:bg-white hover:shadow-xl md:flex size-10"
          >
            <span className="material-symbols-outlined text-secondary">
              chevron_left
            </span>
          </button>

          {/* Scrollable row */}
          <div
            ref={scrollRef}
            className="flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth pl-4 pr-8 md:px-1"
            style={{ scrollbarWidth: "none" }}
          >
            {/* Showcase books from DB */}
            {hasShowcase &&
              filteredShowcase.map((book) => (
                <div
                  key={book.id}
                  className="group relative flex shrink-0 snap-start flex-col rounded-xl border border-border-light/50 bg-white shadow-sm transition-all duration-300 hover:shadow-xl w-70"
                >
                  {/* Cover */}
                  <Link
                    href={`/ejemplo/${book.id}`}
                    className="relative aspect-3/4 overflow-hidden rounded-t-xl bg-cream"
                  >
                    {book.coverImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={book.coverImage}
                        alt={book.title}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <span className="material-symbols-outlined text-6xl text-text-light">
                          auto_stories
                        </span>
                      </div>
                    )}
                    {/* Hover overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-300 group-hover:bg-black/30">
                      <span className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-secondary opacity-0 shadow-lg transition-all duration-300 group-hover:opacity-100">
                        <span className="material-symbols-outlined text-base">
                          auto_stories
                        </span>
                        {t("viewSample")}
                      </span>
                    </div>
                    {/* Age badge */}
                    <div className="absolute right-2 top-2 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-bold text-primary backdrop-blur">
                      {getAgeFilter(book.characterAge) === "2-4"
                        ? "2-4"
                        : getAgeFilter(book.characterAge) === "5-7"
                          ? "5-7"
                          : "8-12"}{" "}
                      {t("years")}
                    </div>
                  </Link>

                  {/* Info */}
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h3 className="font-display text-lg font-bold text-secondary leading-tight">
                      {book.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <span>{t("softcover")}</span>
                      <span className="font-bold text-secondary">
                        {softcoverPrice}&euro;
                      </span>
                      <span className="text-border-light">|</span>
                      <span>{t("hardcoverShort")}</span>
                      <span className="font-bold text-primary">
                        {hardcoverPrice}&euro;
                      </span>
                    </div>

                    {/* CTA */}
                    <Link
                      href={`/crear?template=${book.templateId}&from=catalog`}
                      className="mt-auto flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white whitespace-nowrap shadow-sm transition-all hover:bg-primary-hover hover:shadow-md min-h-[36px]"
                    >
                      <span className="material-symbols-outlined text-sm">
                        child_care
                      </span>
                      {t("personalize")}
                    </Link>
                  </div>
                </div>
              ))}

            {/* Template cards (when no showcase books OR as fallback) */}
            {!hasShowcase &&
              loaded &&
              filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="group relative flex shrink-0 snap-start flex-col rounded-xl border border-border-light/50 bg-white shadow-sm transition-all duration-300 hover:shadow-xl w-70"
                >
                  {/* Cover */}
                  <div className="relative aspect-3/4 overflow-hidden rounded-t-xl bg-cream">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={template.image}
                      alt={td(`templates.${template.id}.title`)}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    {/* Age badge */}
                    <div className="absolute right-2 top-2 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-bold text-primary backdrop-blur">
                      {td(`templates.${template.id}.ageRange`)}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h3 className="font-display text-lg font-bold text-secondary leading-tight">
                      {td(`templates.${template.id}.title`)}
                    </h3>
                    <p className="text-xs text-text-muted line-clamp-2">
                      {td(`templates.${template.id}.description`)}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <span>{t("softcover")}</span>
                      <span className="font-bold text-secondary">
                        {softcoverPrice}&euro;
                      </span>
                      <span className="text-border-light">|</span>
                      <span>{t("hardcoverShort")}</span>
                      <span className="font-bold text-primary">
                        {hardcoverPrice}&euro;
                      </span>
                    </div>

                    {/* CTA */}
                    <Link
                      href={`/crear?template=${template.id}&from=catalog`}
                      className="mt-auto flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white whitespace-nowrap shadow-sm transition-all hover:bg-primary-hover hover:shadow-md min-h-[36px]"
                    >
                      <span className="material-symbols-outlined text-sm">
                        child_care
                      </span>
                      {t("personalize")}
                    </Link>
                  </div>
                </div>
              ))}

            {/* Skeleton */}
            {!loaded &&
              Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse shrink-0 snap-start rounded-xl border border-border-light/50 bg-white shadow-sm w-70"
                >
                  <div className="aspect-3/4 rounded-t-xl bg-border-light/30" />
                  <div className="space-y-3 p-4">
                    <div className="h-5 w-3/4 rounded bg-border-light/30" />
                    <div className="h-3 w-full rounded bg-border-light/20" />
                    <div className="h-10 w-full rounded-lg bg-border-light/20" />
                  </div>
                </div>
              ))}
          </div>

          {/* Right arrow */}
          <button
            onClick={() => scroll("right")}
            className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur transition-all hover:bg-white hover:shadow-xl md:flex size-10"
          >
            <span className="material-symbols-outlined text-secondary">
              chevron_right
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
