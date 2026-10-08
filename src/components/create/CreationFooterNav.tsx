"use client";

import { useTranslations } from "next-intl";
import { Spinner } from "@/components/ui/Spinner";

interface CreationFooterNavProps {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextDisabledTooltip?: string;
  nextLoading?: boolean;
}

export default function CreationFooterNav({
  onBack,
  onNext,
  nextLabel,
  nextDisabled = false,
  nextDisabledTooltip,
  nextLoading = false,
}: CreationFooterNavProps) {
  const t = useTranslations("crear.footer");
  const resolvedNextLabel = nextLabel ?? t("next");

  return (
    <div data-bottom-bar className="sticky bottom-(--cookie-banner-h) z-30 border-t border-create-primary/10 bg-create-bg pb-[env(safe-area-inset-bottom)]">
      {nextDisabled && nextDisabledTooltip && (
        <p className="px-5 pt-2 text-center text-xs font-medium text-create-text-sub sm:hidden" data-testid="footer-hint">
          {nextDisabledTooltip}
        </p>
      )}
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
        {/* Back */}
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="group flex min-h-12 min-w-12 shrink-0 items-center justify-center gap-2 rounded-full border-2 border-create-primary/20 bg-white px-4 max-[389px]:px-3 sm:px-6 py-2.5 text-sm sm:text-base font-bold text-brand-text whitespace-nowrap transition-all hover:border-create-primary hover:bg-create-primary/5"
          >
            <span aria-hidden className="material-symbols-outlined text-lg transition-transform group-hover:-translate-x-1">
              arrow_back
            </span>
            {/* Under 390px the 19px next label ("Crear el seu llibre") needs the room: icon-only back
                (the header keeps its own back arrow); the label stays as the accessible name. */}
            <span className="max-[389px]:sr-only">{t("back")}</span>
          </button>
        ) : (
          <div />
        )}

        {/* Next */}
        <div className="relative group/tooltip">
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled || nextLoading}
            className="group flex min-h-12 items-center gap-2 rounded-full bg-create-primary px-5 sm:px-8 py-2.5 text-[19px] leading-tight font-bold text-white whitespace-nowrap shadow-lg shadow-create-primary/30 transition-all hover:bg-create-primary-hover hover:shadow-xl hover:shadow-create-primary/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-lg"
          >
            {nextLoading ? (
              <>
                <Spinner className="text-lg" />
                <span>{t("saving")}</span>
              </>
            ) : (
              <>
                <span>{resolvedNextLabel}</span>
                <span aria-hidden className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">
                  arrow_forward
                </span>
              </>
            )}
          </button>
          {nextDisabled && nextDisabledTooltip && (
            <div className="pointer-events-none absolute hidden sm:block bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-800 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover/tooltip:opacity-100">
              {nextDisabledTooltip}
              <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
