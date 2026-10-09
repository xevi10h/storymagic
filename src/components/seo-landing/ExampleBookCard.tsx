import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cx, focusRing } from "@/components/ui";
import { ageBandSlug } from "@/lib/product-facts";
import type { ShowcaseStory } from "@/lib/showcase";
import { showcasePath } from "@/lib/showcase-slug";

/**
 * One example book as a card: its real cover, age band and title, linking to
 * /examples/{slug} in the book's own locale. Used by the examples index and by the
 * "more examples" block of each example page.
 */
export default function ExampleBookCard({
  story,
  priority,
  headingLevel: Title = "h2",
}: {
  story: ShowcaseStory;
  priority?: boolean;
  headingLevel?: "h2" | "h3";
}) {
  const t = useTranslations("showcase");
  const tc = useTranslations("bookCollection");
  return (
    <Link
      href={showcasePath(story.slug)}
      locale={story.locale as Locale}
      className={cx(
        "group flex h-full flex-col overflow-hidden rounded-2xl border-2 border-line bg-surface transition-colors hover:border-brand/40",
        focusRing,
      )}
    >
      {/* Pages are square (20 × 20 cm book): no cropping. */}
      <div className="relative aspect-square bg-line">
        {story.coverImage && (
          <Image
            src={story.coverImage}
            alt={t("coverAlt", { title: story.title })}
            fill
            sizes="(max-width: 768px) 46vw, (max-width: 1024px) 31vw, 280px"
            priority={priority}
            className="object-cover"
          />
        )}
        <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-ink-soft shadow-sm tabular-nums">
          {ageBandSlug(story.characterAge)} {tc("years")}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <Title className="font-display text-base font-semibold leading-tight text-ink text-balance sm:text-lg">{story.title}</Title>
        <span className="mt-auto inline-flex items-center gap-1 text-sm font-bold text-brand-text">
          <span aria-hidden className="material-symbols-outlined !text-lg">
            menu_book
          </span>
          {tc("viewSample")}
        </span>
      </div>
    </Link>
  );
}
