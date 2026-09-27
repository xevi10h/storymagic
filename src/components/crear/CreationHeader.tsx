"use client";

import { useLayoutEffect, useRef } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import BrandLogo from "@/components/BrandLogo";
import { TOTAL_CREATION_STEPS } from "@/lib/creation-flow";

interface CreationHeaderProps {
  /** 1..6 — omit to hide the progress indicator. */
  currentStep?: number;
  rightAction?: "close" | "none";
  /** Header back arrow; defaults to a link home. */
  onBack?: () => void;
  /** Jump to a step by clicking the stepper. */
  onStepClick?: (step: number) => void;
  /** Whether a given step can be jumped to from here. */
  canStepNavigate?: (step: number) => boolean;
}

const STEP_KEYS = ["stepName", "stepProtagonist", "stepAdventure", "stepDedication", "stepBook", "stepOrder"] as const;

/**
 * The single progress indicator for the 6-screen creation flow.
 * Desktop: labelled stepper in the header. Mobile: "Paso 2 de 6 · Protagonista"
 * + a 6-segment bar on its own row (6 labels never fit in 390 px).
 */
export default function CreationHeader({
  currentStep,
  rightAction = "close",
  onBack,
  onStepClick,
  canStepNavigate,
}: CreationHeaderProps) {
  const t = useTranslations("crear.header");
  const labels = STEP_KEYS.map((k) => t(k));
  const steps = Array.from({ length: TOTAL_CREATION_STEPS }, (_, i) => i + 1);
  // Expose the header height so sticky elements below it (e.g. the mobile
  // protagonist portrait) can stick right under it.
  const headerRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const apply = () =>
      document.documentElement.style.setProperty("--creation-header-h", `${el.getBoundingClientRect().height}px`);
    apply();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const navigable = (step: number) =>
    !!onStepClick && step !== currentStep && (canStepNavigate?.(step) ?? false);

  const backClass =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-create-text-sub transition-colors hover:bg-create-neutral hover:text-create-text focus-visible:outline-2 focus-visible:outline-create-primary";

  return (
    <>
      <header ref={headerRef} className="sticky top-0 z-40 border-b border-create-primary/10 bg-create-bg">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-3 sm:px-6">
          <div className="flex flex-1 items-center gap-2">
            {onBack ? (
              <button type="button" onClick={onBack} className={backClass} aria-label={t("back")}>
                <span className="material-symbols-outlined text-xl" aria-hidden>arrow_back</span>
              </button>
            ) : (
              <Link href="/" className={backClass} aria-label={t("backHome")}>
                <span className="material-symbols-outlined text-xl" aria-hidden>arrow_back</span>
              </Link>
            )}
            <Link href="/" className="flex items-center" aria-label="Meapica">
              <BrandLogo className="h-5 text-secondary" />
            </Link>
          </div>

          {currentStep != null && (
            <nav aria-label={t("progressLabel")} className="hidden md:block">
              <ol className="flex items-center gap-1.5 lg:gap-2">
                {steps.map((step) => {
                  const active = step === currentStep;
                  const done = step < currentStep;
                  const label = labels[step - 1];
                  const inner = (
                    <>
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                          active
                            ? "bg-create-primary text-white ring-4 ring-create-primary/15"
                            : done
                              ? "bg-create-primary/85 text-white"
                              : "border border-create-neutral bg-white text-create-text-sub/80"
                        }`}
                      >
                        {done ? (
                          <span className="material-symbols-outlined text-sm" aria-hidden>check</span>
                        ) : (
                          step
                        )}
                      </span>
                      <span
                        className={`hidden text-xs font-bold lg:inline ${
                          active ? "text-create-primary" : done ? "text-create-text" : "text-create-text-sub/80"
                        }`}
                      >
                        {label}
                      </span>
                    </>
                  );
                  return (
                    <li key={step} className="flex items-center gap-1.5 lg:gap-2">
                      {navigable(step) ? (
                        <button
                          type="button"
                          onClick={() => onStepClick!(step)}
                          className="flex items-center gap-1.5 rounded-full pr-1 transition-opacity hover:opacity-75 focus-visible:outline-2 focus-visible:outline-create-primary"
                          aria-label={t("goToStep", { step, label })}
                        >
                          {inner}
                        </button>
                      ) : (
                        <span
                          className="flex items-center gap-1.5 pr-1"
                          aria-current={active ? "step" : undefined}
                          title={label}
                        >
                          {inner}
                        </span>
                      )}
                      {step < TOTAL_CREATION_STEPS && (
                        <span
                          aria-hidden
                          className={`h-0.5 w-3 rounded-full lg:w-5 ${done ? "bg-create-primary/45" : "bg-create-neutral"}`}
                        />
                      )}
                    </li>
                  );
                })}
              </ol>
            </nav>
          )}

          <div className="flex flex-1 items-center justify-end">
            {rightAction === "close" && (
              <Link
                href="/"
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-create-text-sub transition-colors hover:bg-create-neutral hover:text-create-text"
                aria-label={t("exit")}
              >
                <span className="material-symbols-outlined text-lg" aria-hidden>close</span>
                <span className="hidden sm:inline">{t("exit")}</span>
              </Link>
            )}
          </div>
        </div>

        {/* Mobile progress: text + segmented bar */}
        {currentStep != null && (
          <div className="px-4 pb-2.5 md:hidden" data-testid="mobile-progress">
            <p className="mb-1.5 text-xs font-bold text-create-text">
              <span className="text-create-primary">{t("stepOf", { step: currentStep, total: TOTAL_CREATION_STEPS })}</span>
              <span className="text-create-text-sub"> · {labels[currentStep - 1]}</span>
            </p>
            <div
              className="flex gap-1"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={TOTAL_CREATION_STEPS}
              aria-valuenow={currentStep}
              aria-label={t("progressLabel")}
            >
              {steps.map((step) => (
                <button
                  key={step}
                  type="button"
                  tabIndex={-1}
                  disabled={!navigable(step)}
                  onClick={() => onStepClick?.(step)}
                  aria-hidden
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    step <= currentStep ? "bg-create-primary" : "bg-create-neutral"
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </header>
    </>
  );
}
