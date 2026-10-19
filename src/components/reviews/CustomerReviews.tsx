import { getTranslations } from "next-intl/server";
import { Heading, cx } from "@/components/ui";
import type { ReviewSummary } from "@/lib/reviews/review-content";
import { Stars } from "./Stars";

const INTL_LOCALE: Record<string, string> = { es: "es-ES", ca: "ca-ES", en: "en-GB", fr: "fr-FR" };

/**
 * Real customer reviews (verified buyers, one per order, published with their consent).
 * Renders NOTHING when there are none: no placeholder, no fake social proof
 * (docs/brand.md). The page passes the same summary to ProductJsonLd, so the review
 * markup always matches what is visible.
 */
export default async function CustomerReviews({
  locale,
  summary,
  className = "py-16 sm:py-24",
}: {
  locale: string;
  summary: ReviewSummary;
  /** Vertical rhythm of the section (a page that stacks paper sections passes "pb-16 sm:pb-24"). */
  className?: string;
}) {
  if (summary.count < 1 || summary.shown.length < 1) return null;
  const t = await getTranslations({ locale, namespace: "reviews" });
  const intl = INTL_LOCALE[locale] ?? "es-ES";
  const average = new Intl.NumberFormat(intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(summary.average);
  const date = (iso: string) => new Intl.DateTimeFormat(intl, { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" }).format(new Date(iso));

  return (
    <section id="reviews" aria-labelledby="reviews-title" className={cx("scroll-mt-[var(--landing-nav-h,64px)] bg-paper px-4 sm:px-6", className)} data-testid="customer-reviews">
      <div className="mx-auto max-w-5xl">
        <Heading id="reviews-title" size="page" as="h2" eyebrow={t("eyebrow")} className="text-balance text-center">
          {t("title")}
        </Heading>
        <p className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-ink-soft">
          <Stars rating={summary.average} label={t("starsLabel", { rating: average })} starClassName="h-5 w-5" />
          <span className="font-bold tabular-nums text-ink">{t("average", { average })}</span>
          <span aria-hidden>·</span>
          <span>{t("count", { count: summary.count })}</span>
        </p>

        <ul className="mt-8 grid grid-cols-1 gap-4 sm:mt-10 sm:grid-cols-2 lg:grid-cols-3">
          {summary.shown.map((r) => (
            <li key={r.id} className="flex flex-col rounded-2xl border-2 border-line bg-surface p-5">
              <Stars rating={r.rating} label={t("starsLabel", { rating: String(r.rating) })} />
              {r.body && (
                <p lang={r.locale} className="mt-3 whitespace-pre-line break-words text-[15px] leading-relaxed text-ink-body">
                  {r.body}
                </p>
              )}
              <p className="mt-auto pt-4 text-sm">
                <span className="font-semibold text-ink">{r.displayName}</span>
                <span className="block text-xs text-ink-muted">
                  {t("verified")} · <time dateTime={r.publishedAt}>{date(r.publishedAt)}</time>
                </span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
