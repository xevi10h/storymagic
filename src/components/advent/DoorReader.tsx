"use client";

// An opened door (DoorMobile.dc.html): the art with the child's portrait, the story, PDF
// download + share, tomorrow's door, the Reyes-world teaser and the full-book CTA.
// History-backed: "Calendario" (and the browser's back) return to the grid.

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cx, focusRing } from "@/components/ui";
import { trackEvent } from "@/lib/tracking/consent";
import { ADVENT_DOORS_COUNT, ADVENT_PATH } from "@/lib/advent/calendar";
import type { AdventOffer } from "@/lib/advent/email";
import type { AdventLocale, RenderedStory } from "@/lib/advent/render";
import type { AdventChild } from "./child-store";
import { ChildPortrait, DoorArt, formatDoorDate, type AdventDoorData } from "./shared";
import { AdventBookBand } from "./AdventBookBand";
import { createHref } from "./links";

export default function DoorReader({
  locale,
  door,
  story,
  child,
  deName,
  nameIn,
  isToday,
  pdfUrl,
  offer,
  reyesUntil,
  onBack,
}: {
  locale: AdventLocale;
  door: AdventDoorData;
  story: RenderedStory;
  child: AdventChild;
  deName: string;
  nameIn: string;
  isToday: boolean;
  pdfUrl: string;
  offer: AdventOffer;
  reyesUntil: string | null;
  onBack: () => void;
}) {
  const t = useTranslations("advent");
  const [copied, setCopied] = useState(false);

  async function share() {
    // The public calendar, never the child's name.
    const url = `${window.location.origin}/${locale}${ADVENT_PATH}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: t("eyebrow"), url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      /* cancelled share sheet / clipboard blocked: nothing to do */
    }
  }

  const button = cx(
    "flex min-h-12 items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-line-warm bg-surface text-[15px] font-semibold text-ink-soft transition-colors hover:border-brand",
    focusRing,
  );

  return (
    <div className="mx-auto max-w-[680px] pb-12" data-testid="advent-reader">
      <div className="flex h-14 items-center px-1 sm:px-0">
        <button type="button" onClick={onBack} className={cx("flex min-h-11 items-center gap-1 rounded-md px-2.5 text-[15px] font-semibold text-ink-soft", focusRing)} data-testid="advent-back">
          <span aria-hidden className="material-symbols-outlined !text-xl" data-icon="chevron_left" />
          {t("door.back")}
        </button>
      </div>

      <div className="relative">
        <div className="relative h-[260px] w-full overflow-hidden sm:h-[340px] sm:rounded-3xl">
          <DoorArt door={door} sizes="(min-width: 680px) 680px, 100vw" priority />
        </div>
        {child.source === "character" && (
          <ChildPortrait child={child} size={96} ring={5} alt={t("portraitAlt", { name: child.name, deName })} className="absolute -bottom-10 right-5 ring-2 ring-line-warm" />
        )}
      </div>

      <article className="px-5 pt-6 sm:px-0">
        <p className="text-xs font-bold uppercase tracking-[0.06em] text-brand-text">
          {t("door.kickerOf", { n: story.door, date: formatDoorDate(locale, story.door) })}
        </p>
        <h1 className={cx("mt-2.5 font-display", child.source === "character" && "pr-24", "text-[30px] font-semibold leading-[1.15] text-ink sm:text-4xl")} data-testid="advent-story-title">
          {story.title}
        </h1>
        <div className="mt-[18px] flex flex-col gap-3.5 text-[17px] leading-[1.7] text-ink-soft sm:text-lg">
          {story.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <p className="italic text-ink-body">{story.question}</p>
        </div>

        <div className="mt-6 flex gap-2.5">
          <a href={pdfUrl} download className={cx(button, "flex-1")} data-testid="advent-pdf">
            <span aria-hidden className="material-symbols-outlined !text-lg" data-icon="download" />
            {t("door.downloadPdf")}
          </a>
          <button type="button" onClick={() => void share()} aria-label={t("door.share")} className={cx(button, "w-12")}>
            <span aria-hidden className="material-symbols-outlined !text-lg" data-icon="ios_share" />
          </button>
        </div>
        <p className="mt-2.5 min-h-5 text-center text-[13px] text-ink-muted" role="status">
          {copied
            ? t("door.copied")
            : isToday
              ? story.door < ADVENT_DOORS_COUNT
                ? t("door.tomorrow", { n: story.door + 1 })
                : t("door.last")
              : null}
        </p>
      </article>

      <div className="mt-8 flex flex-col gap-4 px-5 sm:px-0">
        {reyesUntil && (
          <section className="flex items-start gap-3 rounded-[18px] border border-line bg-surface p-4">
            <span aria-hidden className="material-symbols-outlined mt-0.5 shrink-0 !text-[22px] text-brand" data-icon="menu_book" />
            <p className="text-sm leading-relaxed text-ink-soft">
              <strong className="text-ink">{t("reyes.lead")}</strong> {t("reyes.text", { name: nameIn, date: reyesUntil })}{" "}
              <Link
                href={createHref(child, "reyes")}
                onClick={() => trackEvent("advent_cta_click", { placement: "reyes" })}
                className="font-bold text-brand-text underline-offset-2 hover:underline"
              >
                {t("reyes.link")}
              </Link>
            </p>
          </section>
        )}
        <AdventBookBand locale={locale} child={child} nameIn={nameIn} deName={deName} offer={offer} variant="compact" art="/images/path/reyes/reyes-c2map-bakery.webp" />
      </div>
    </div>
  );
}
