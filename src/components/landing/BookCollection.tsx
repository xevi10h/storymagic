"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PRICING } from "@/lib/pricing";

interface ShowcaseBook {
  id: string;
  templateId: string;
  title: string;
  coverImage: string | null;
  characterName: string;
  characterAge: number;
  totalPages: number;
}

// Fallback static books when no showcase stories exist in the DB
const STATIC_BOOKS = [
  {
    key: "enchantedForest" as const,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuC6VL_AYqEty2H-GbV81WP_azfa6-IU9kYV335jDZwd4snVh3otFA0MLoHWzYBVRN6D7uO6bEFGhpnzN-NUinjaYGN0HlgT1dOrbips2Im89VsZRyTu-1V11GVPrma6xPMEKRBhlVhLpHl_mt8bkHQwuhNbWsxIeJndFCX9sJiIJtt31XHdiKH6_MBR4lvbIxqMGr915OaUtE8B6HC-E9cFrDodvb0saZB_Arw2STBeUL4o93_O5P1_AKxGrZxtlgICx5yeCsm7Diec",
    hasBadge: true,
  },
  {
    key: "spaceMission" as const,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuABBA0Cf06fPnqKSfGRm48Pmu6ucN-jUEVB4HEwyp-DBH-xxNU5J_KCoHPCTwqmiwLMRseYBXwbRpHgq9uGNsFjGl5RhN408EvyctgZzWyxWGPtAoOWRBqqLf6HYJ6JHExoCBXpq4UW8ANQYnEa9PuknwvT7CnGVOeOS7yJBU2sEszUjY0x_mXI_Hhc2iI-v8CqAuBFA55xP-nK_bsvWEmgN_L1YmVe5GI5bQD1_m9-emm22sbMoQqYpkXSt7WSjqHd-KmyZYEHrJ8D",
    hasBadge: false,
  },
  {
    key: "underwaterKingdom" as const,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBNgOqfWleS4dgz8lpSn13SgKrqUX_lP8f64zkeoepf32guQ7HsMYX45v2De6eISqj4HKCS6vKKvM3ZXXvHgQcfkScKM69Qq8C9c23L3XfJxnYyf-Amm2dWaNV0rMpNApWD-CoAZgVSgpoHsiAdE-SHMcIjcbkNUDOIFXpw_VN5172nLLzKL-pTmyhy6Im4agwWHIb4rcpVepJWGLcQ9krIodcO40-np3zmYRQDyte5QPiC3O5Wg2dlzxX5J03TD8dTpwAXyuXeYFLH",
    hasBadge: false,
  },
];

const softcoverPrice = (PRICING.softcover.price / 100).toFixed(2);
const hardcoverPrice = (PRICING.hardcover.price / 100).toFixed(2);

export default function BookCollection() {
  const t = useTranslations("bookCollection");
  const [showcaseBooks, setShowcaseBooks] = useState<ShowcaseBook[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function fetchShowcase() {
      try {
        const res = await fetch("/api/showcase");
        if (res.ok) {
          const data: ShowcaseBook[] = await res.json();
          if (data.length > 0) setShowcaseBooks(data);
        }
      } catch {
        // Silently fall back to static books
      } finally {
        setLoaded(true);
      }
    }
    fetchShowcase();
  }, []);

  const hasShowcase = showcaseBooks.length > 0;

  return (
    <section className="bg-cream px-4 py-24" id="catalog">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 flex flex-col items-end justify-between gap-6 md:flex-row">
          <div>
            <h2 className="mb-4 font-display text-4xl font-bold text-secondary">
              {t("title")}
            </h2>
            <p className="max-w-xl text-lg text-text-soft">
              {hasShowcase ? t("subtitleShowcase") : t("subtitle")}
            </p>
          </div>
          {!hasShowcase && (
            <a
              className="group flex items-center gap-1 text-sm font-bold uppercase tracking-wide text-primary hover:text-primary-hover"
              href="#"
            >
              {t("viewAll")}
              <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">
                arrow_right_alt
              </span>
            </a>
          )}
        </div>

        {/* Showcase books from the database */}
        {hasShowcase && (
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3">
            {showcaseBooks.slice(0, 3).map((book) => (
              <Link
                key={book.id}
                href={`/ejemplo/${book.id}`}
                className="group cursor-pointer rounded-lg border border-border-light/50 bg-white p-4 pb-6 shadow-sm transition-all duration-300 hover:shadow-xl"
              >
                {/* Cover image */}
                <div className="relative mb-6 aspect-[3/4] overflow-hidden rounded-sm bg-cream shadow-inner">
                  {book.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={book.coverImage}
                      alt={book.title}
                      className="h-full w-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="material-symbols-outlined text-6xl text-text-light">
                        auto_stories
                      </span>
                    </div>
                  )}
                  <div
                    className="pointer-events-none absolute inset-0 opacity-30"
                    style={{
                      backgroundImage:
                        "url('https://www.transparenttextures.com/patterns/rough-cloth.png')",
                    }}
                  />
                  {/* "See sample" overlay on hover */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-300 group-hover:bg-black/30">
                    <span className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-secondary opacity-0 shadow-lg transition-all duration-300 group-hover:opacity-100">
                      <span className="material-symbols-outlined text-base">visibility</span>
                      {t("viewSample")}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 px-2">
                  <h3 className="font-display text-2xl font-bold text-secondary transition-colors group-hover:text-primary">
                    {book.title}
                  </h3>
                  <p className="line-clamp-1 text-sm text-text-muted">
                    {t("madeFor", { name: book.characterName })}
                  </p>
                  <div className="mt-2 flex flex-col gap-2 border-t border-border-light/50 pt-2">
                    <div className="flex items-center justify-between text-sm text-text-muted">
                      <span>{t("softcover")}</span>
                      <span className="font-bold text-secondary">{softcoverPrice}&euro;</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-text-muted">
                      <span>{t("hardcoverPremium")}</span>
                      <span className="font-bold text-primary">{hardcoverPrice}&euro;</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Static fallback books (when no showcase stories exist) */}
        {!hasShowcase && loaded && (
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3">
            {STATIC_BOOKS.map((book) => (
              <div
                key={book.key}
                className="group cursor-pointer rounded-lg border border-border-light/50 bg-white p-4 pb-6 shadow-sm transition-all duration-300 hover:shadow-xl"
              >
                <div className="relative mb-6 aspect-[3/4] overflow-hidden rounded-sm bg-cream shadow-inner">
                  <div
                    className="absolute inset-0 bg-cover bg-center opacity-90 transition-transform duration-700 group-hover:scale-105"
                    style={{ backgroundImage: `url('${book.image}')` }}
                  />
                  <div
                    className="pointer-events-none absolute inset-0 opacity-30"
                    style={{
                      backgroundImage:
                        "url('https://www.transparenttextures.com/patterns/rough-cloth.png')",
                    }}
                  />
                  {book.hasBadge && (
                    <div className="absolute right-0 top-0 rounded-bl-lg bg-primary px-3 py-1 text-xs font-bold text-white shadow-sm">
                      {t("hardcover")}
                    </div>
                  )}
                </div>

                <div className="space-y-3 px-2">
                  <h3 className="font-display text-2xl font-bold text-secondary transition-colors group-hover:text-primary">
                    {t(`books.${book.key}.title`)}
                  </h3>
                  <p className="line-clamp-2 text-sm italic text-text-soft">
                    {t(`books.${book.key}.description`)}
                  </p>
                  <div className="mt-2 flex flex-col gap-2 border-t border-border-light/50 pt-2">
                    <div className="flex items-center justify-between text-sm text-text-muted">
                      <span>{t("softcover")}</span>
                      <span className="font-bold text-secondary">{softcoverPrice}&euro;</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-text-muted">
                      <span>{t("hardcoverPremium")}</span>
                      <span className="font-bold text-primary">{hardcoverPrice}&euro;</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Skeleton while loading */}
        {!loaded && (
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-lg border border-border-light/50 bg-white p-4 pb-6 shadow-sm"
              >
                <div className="mb-6 aspect-[3/4] rounded-sm bg-border-light/50" />
                <div className="space-y-3 px-2">
                  <div className="h-7 w-3/4 rounded bg-border-light/50" />
                  <div className="h-4 w-full rounded bg-border-light/30" />
                  <div className="mt-2 border-t border-border-light/50 pt-2">
                    <div className="h-4 w-full rounded bg-border-light/30" />
                    <div className="mt-2 h-4 w-full rounded bg-border-light/30" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
