"use client";

import { useEffect, useMemo, useState } from "react";
import { NextIntlClientProvider, useLocale, useMessages, useTimeZone, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import CreationHeader from "@/components/create/CreationHeader";
import BookViewerSwitch from "@/components/book-viewer/BookViewerSwitch";
import { spreadIndexOf, spreadStart } from "@/components/book-viewer/spreads";
import ErrorBoundary from "@/components/ErrorBoundary";
import type { BookPage } from "@/components/book-viewer/types";
import { deName } from "@/lib/creation-flow";

interface SharedPreviewViewProps {
  storyId: string;
  title: string;
  childName: string;
  templateId: string;
  gender: string;
  favoriteColor: string | null;
  /** Preview slice only, images already signed (lib/share/shared-preview.ts). */
  pages: BookPage[];
}

/**
 * Read-only book preview for anyone holding a share link: the same flipbook as the
 * owner's preview, no editing, no checkout. The locked teaser page scrolls to
 * #checkout-section (viewer convention), which here is the "create yours" block.
 */
export default function SharedPreviewView({ storyId, title, childName, templateId, gender, favoriteColor, pages }: SharedPreviewViewProps) {
  const t = useTranslations("sharePreview.view");
  const locale = useLocale();
  const [currentPage, setCurrentPage] = useState(0);
  const total = pages.length;

  // The viewer's locked teaser speaks to the owner ("Desbloquear cuento"): for a visitor
  // it becomes "Crea el tuyo" (and scrolls to that block) — same component, other copy.
  const messages = useMessages();
  const timeZone = useTimeZone();
  const viewerMessages = useMemo(() => {
    const crear = (messages.crear ?? {}) as Record<string, unknown>;
    const preview = (crear.preview ?? {}) as Record<string, unknown>;
    return {
      ...messages,
      crear: { ...crear, preview: { ...preview, lockedDescription: t("lockedDescription", { name: childName }), lockedCta: t("createCta") } },
    };
  }, [messages, t, childName]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") setCurrentPage((p) => spreadStart(Math.max(0, spreadIndexOf(p, total) - 1)));
      if (e.key === "ArrowRight") setCurrentPage((p) => Math.min(total - 1, spreadStart(spreadIndexOf(p, total) + 1)));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);

  return (
    <div className="min-h-screen bg-create-bg" data-testid="shared-preview">
      <CreationHeader rightAction="none" />

      <div className="mx-auto max-w-4xl px-4 pt-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 truncate font-display text-base font-bold text-create-text-dark sm:text-lg">{title}</h1>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-brand-tint px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-text">
              {t("badge")}
            </span>
          </div>
        </div>
        <p className="mt-1 text-sm text-text-muted">{t("intro", { name: childName, deName: deName(childName, locale) })}</p>
      </div>

      <section className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
        <ErrorBoundary>
          <NextIntlClientProvider locale={locale} timeZone={timeZone} messages={viewerMessages}>
            <BookViewerSwitch
              pages={pages}
              templateId={templateId}
              gender={gender}
              favoriteColor={favoriteColor ?? undefined}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
            />
          </NextIntlClientProvider>
        </ErrorBoundary>
      </section>

      <section id="checkout-section" className="border-t border-border-light bg-white">
        <div className="mx-auto max-w-md px-4 py-10 text-center">
          <span aria-hidden className="material-symbols-outlined mb-3 text-4xl text-brand-text">auto_stories</span>
          <h2 className="font-display text-2xl font-bold text-secondary">{t("restTitle")}</h2>
          <p className="mt-2 text-sm text-text-muted">{t("restBody", { name: childName })}</p>
          <Link
            href="/create"
            className="min-h-12 mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-create-primary px-6 py-4 text-[19px] font-bold leading-tight text-white shadow-lg shadow-create-primary/20 transition-colors hover:bg-create-primary-hover active:scale-[0.98]"
            data-testid="share-create-cta"
          >
            {t("createCta")}
            <span aria-hidden className="material-symbols-outlined text-lg">arrow_forward</span>
          </Link>
          <p className="mt-6 text-xs text-text-muted">
            {t("ownerHint")}{" "}
            <Link
              href={`/auth/login?next=${encodeURIComponent(`/create/${storyId}/preview`)}`}
              className="font-semibold text-brand-text hover:underline"
            >
              {t("ownerLogin")}
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
