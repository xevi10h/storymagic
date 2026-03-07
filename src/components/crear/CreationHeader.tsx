"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import LogoIcon from "@/components/LogoIcon";

interface CreationHeaderProps {
  currentStep?: number;
  totalSteps?: number;
  rightAction?: "close" | "save" | "none";
}

export default function CreationHeader({
  currentStep,
  totalSteps = 5,
  rightAction = "close",
}: CreationHeaderProps) {
  const t = useTranslations("crear.header");
  const progress =
    currentStep && totalSteps ? (currentStep / totalSteps) * 100 : 0;

  return (
    <>
      {/* Header — 3-column layout so center stays perfectly centered */}
      <header className="sticky top-0 z-50 flex items-center border-b border-create-primary/10 bg-create-bg/90 px-5 py-2.5 backdrop-blur-md sm:px-8">
        {/* Left: Home + Logo — flex-1 so it mirrors right column width */}
        <div className="flex flex-1 items-center gap-3 min-w-0">
          <Link
            href="/"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-create-text-sub transition-colors hover:bg-create-neutral hover:text-create-text"
            aria-label={t("backHome")}
          >
            <span className="material-symbols-outlined text-xl">
              arrow_back
            </span>
          </Link>

          <Link href="/" className="flex items-center gap-2.5">
            <LogoIcon className="h-7 w-7 text-create-primary" />
            <span className="font-display text-lg font-bold tracking-tight text-create-text-dark">
              StoryMagic
            </span>
          </Link>
        </div>

        {/* Center: Step progress (desktop) — fixed in the middle */}
        {currentStep != null ? (
          <div className="hidden items-center gap-2.5 md:flex">
            {Array.from({ length: totalSteps }, (_, i) => {
              const step = i + 1;
              const isActive = step === currentStep;
              const isCompleted = step < currentStep;

              return (
                <div key={step} className="flex items-center gap-2.5">
                  {isActive ? (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-create-primary text-xs font-bold text-white ring-4 ring-create-primary/15">
                      {step}
                    </div>
                  ) : isCompleted ? (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-create-primary/80">
                      <span className="material-symbols-outlined text-xs text-white">
                        check
                      </span>
                    </div>
                  ) : (
                    <div className="h-2.5 w-2.5 rounded-full bg-create-neutral" />
                  )}
                  {step < totalSteps && (
                    <div
                      className={`h-0.5 w-6 rounded-full ${
                        isCompleted ? "bg-create-primary/30" : "bg-create-neutral"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="hidden md:block" />
        )}

        {/* Right: Action — flex-1 + justify-end so it mirrors left column width */}
        <div className="flex flex-1 items-center justify-end">
          {rightAction === "close" && (
            <Link
              href="/"
              className="flex h-9 w-9 items-center justify-center rounded-full text-create-text-sub transition-colors hover:bg-create-neutral hover:text-create-text"
              aria-label={t("exit")}
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </Link>
          )}
          {rightAction === "save" && (
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-create-text-sub transition-colors hover:bg-create-neutral hover:text-create-text"
            >
              <span className="material-symbols-outlined text-base">logout</span>
              <span className="hidden sm:inline">{t("exit")}</span>
            </Link>
          )}
        </div>
      </header>

      {/* Mobile progress bar (below header) */}
      {currentStep != null && (
        <div className="px-5 pb-3 pt-3 sm:px-8 md:hidden">
          <div className="flex items-center justify-between text-xs font-semibold text-create-text-sub">
            <span>
              {t("step", { current: currentStep, total: totalSteps })}
            </span>
            <span className="tabular-nums text-create-primary">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-create-neutral">
            <div
              className="h-full rounded-full bg-create-primary transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </>
  );
}
