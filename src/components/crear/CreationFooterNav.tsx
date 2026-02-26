"use client";

import { useTranslations } from "next-intl";

interface CreationFooterNavProps {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
}

export default function CreationFooterNav({
  onBack,
  onNext,
  nextLabel,
  nextDisabled = false,
  nextLoading = false,
}: CreationFooterNavProps) {
  const t = useTranslations("crear.footer");
  const resolvedNextLabel = nextLabel ?? t("next");

  return (
    <div className="sticky bottom-0 z-20 border-t border-create-primary/10 bg-create-bg/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3 sm:px-8">
        {/* Back */}
        {onBack ? (
          <button
            onClick={onBack}
            className="group flex items-center gap-2 rounded-full border-2 border-create-primary/20 bg-white px-6 py-3 font-bold text-create-primary transition-all hover:border-create-primary hover:bg-create-primary/5"
          >
            <span className="material-symbols-outlined text-lg transition-transform group-hover:-translate-x-1">
              arrow_back
            </span>
            {t("back")}
          </button>
        ) : (
          <div />
        )}

        {/* Next */}
        <button
          onClick={onNext}
          disabled={nextDisabled || nextLoading}
          className="group flex items-center gap-2 rounded-full bg-create-primary px-8 py-3 font-bold text-white shadow-lg shadow-create-primary/30 transition-all hover:bg-create-primary-hover hover:shadow-xl hover:shadow-create-primary/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-lg"
        >
          {nextLoading ? (
            <>
              <span className="material-symbols-outlined animate-spin text-lg">
                progress_activity
              </span>
              <span>{t("saving")}</span>
            </>
          ) : (
            <>
              <span>{resolvedNextLabel}</span>
              <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">
                arrow_forward
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
