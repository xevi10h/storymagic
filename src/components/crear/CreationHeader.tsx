"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import BrandLogo from "@/components/BrandLogo";

interface CreationHeaderProps {
  currentStep?: number;
  totalSteps?: number;
  rightAction?: "close" | "save" | "none";
  portraitUrl?: string | null;
  characterName?: string;
  characterAge?: number;
  onRegeneratePortrait?: () => void;
  /** Jump to a step by clicking the header stepper. */
  onStepClick?: (step: number) => void;
  /** Whether a given step is reachable (already visited + data ready). */
  canStepNavigate?: (step: number) => boolean;
}

/** Character avatar: AI portrait when available, otherwise the initial letter. */
function AvatarCircle({
  portraitUrl,
  name,
  className,
  initialClassName = "text-sm",
}: {
  portraitUrl?: string | null;
  name?: string;
  className: string;
  initialClassName?: string;
}) {
  if (portraitUrl) {
    return <img src={portraitUrl} alt={name || ""} className={`${className} object-cover`} />;
  }
  return (
    <span className={`${className} flex items-center justify-center bg-create-primary/15 font-display font-bold text-create-primary ${initialClassName}`} aria-hidden="true">
      {name?.trim() ? name.trim().charAt(0).toUpperCase() : "?"}
    </span>
  );
}

/** Labelled step indicator (character → adventure → dedication). Compacts on mobile.
 * Steps the user has already reached become clickable to jump back/forward. */
function StepProgress({
  currentStep,
  totalSteps,
  labels,
  onStepClick,
  canStepNavigate,
}: {
  currentStep: number;
  totalSteps: number;
  labels: string[];
  onStepClick?: (step: number) => void;
  canStepNavigate?: (step: number) => boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-1.5 sm:gap-2 lg:gap-3">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const isActive = step === currentStep;
        const isCompleted = step < currentStep;
        const label = labels[i] ?? `${step}`;
        const navigable =
          !!onStepClick && step !== currentStep && (canStepNavigate?.(step) ?? false);

        const inner = (
          <>
            {isActive ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-create-primary text-[10px] font-bold text-white ring-4 ring-create-primary/15 sm:h-6 sm:w-6 sm:text-[11px]">
                {step}
              </span>
            ) : isCompleted ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-create-primary/80 sm:h-6 sm:w-6">
                <span className="material-symbols-outlined text-xs text-white sm:text-sm">check</span>
              </span>
            ) : (
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-create-neutral bg-white text-[10px] font-bold text-create-text-sub/70 sm:h-6 sm:w-6 sm:text-[11px]">
                {step}
              </span>
            )}
            <span
              className={`text-[11px] font-bold sm:text-xs ${
                isActive
                  ? "text-create-primary"
                  : isCompleted
                    ? "text-create-text"
                    : "text-create-text-sub/70"
              }`}
            >
              {label}
            </span>
          </>
        );

        return (
          <div key={step} className="flex items-center gap-1.5 sm:gap-2 lg:gap-3">
            {navigable ? (
              <button
                type="button"
                onClick={() => onStepClick!(step)}
                title={label}
                className="flex items-center gap-1 rounded-full transition-opacity hover:opacity-70 sm:gap-1.5"
              >
                {inner}
              </button>
            ) : (
              <div className={`flex items-center gap-1 sm:gap-1.5 ${isActive ? "" : "select-none"}`}>
                {inner}
              </div>
            )}
            {step < totalSteps && (
              <span
                className={`h-0.5 w-4 rounded-full sm:w-5 lg:w-7 ${
                  isCompleted ? "bg-create-primary/40" : "bg-create-neutral"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function CreationHeader({
  currentStep,
  totalSteps = 3,
  rightAction = "close",
  portraitUrl,
  characterName,
  characterAge,
  onRegeneratePortrait,
  onStepClick,
  canStepNavigate,
}: CreationHeaderProps) {
  const t = useTranslations("crear.header");
  // Labels for the 3-step creation flow (character → adventure → dedication).
  const stepLabels = [t("stepCharacter"), t("stepAdventure"), t("stepDedication")];
  // Tapping the avatar used to regenerate the portrait immediately (costly and
  // destructive). Always confirm first.
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const showCharacterChip = !!portraitUrl || (!!onRegeneratePortrait && !!characterName?.trim());

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

          <Link href="/" className={`flex items-center ${showCharacterChip ? "hidden sm:flex" : ""}`}>
            <BrandLogo className="h-5 text-secondary" />
          </Link>

          {/* Character portrait (visible after Step 1) */}
          {showCharacterChip && (
            <div className="flex items-center ml-2 sm:ml-3 pl-2 sm:pl-3 border-l border-create-primary/10">
              {onRegeneratePortrait ? (
                <button
                  onClick={() => setConfirmRegenerate(true)}
                  className="group relative flex items-center gap-1.5 sm:gap-2 rounded-full bg-create-neutral/60 pr-2.5 sm:pr-3 transition-colors hover:bg-create-neutral"
                  title={t("regenerateTooltip")}
                >
                  <div className="relative shrink-0">
                    <AvatarCircle
                      portraitUrl={portraitUrl}
                      name={characterName}
                      className="w-8 h-8 rounded-full ring-2 ring-create-primary/30 shadow-sm group-hover:ring-create-primary/50 transition-all"
                    />
                    <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                      <span className="material-symbols-outlined text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                        refresh
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-start leading-none min-w-0">
                    {characterName && (
                      <span className="text-xs sm:text-sm font-display font-bold text-create-text truncate max-w-20 sm:max-w-24 group-hover:text-create-primary transition-colors">
                        {characterName}
                      </span>
                    )}
                    {characterAge != null && (
                      <span className="text-[10px] sm:text-xs text-create-text-sub font-medium">
                        {characterAge} {t("years")}
                      </span>
                    )}
                  </div>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-create-neutral/60 pr-2.5 sm:pr-3">
                  <AvatarCircle
                    portraitUrl={portraitUrl}
                    name={characterName}
                    className="w-8 h-8 rounded-full ring-2 ring-create-primary/30 shadow-sm"
                  />
                  <div className="flex flex-col items-start leading-none min-w-0">
                    {characterName && (
                      <span className="text-xs sm:text-sm font-display font-bold text-create-text truncate max-w-20 sm:max-w-24">
                        {characterName}
                      </span>
                    )}
                    {characterAge != null && (
                      <span className="text-[10px] sm:text-xs text-create-text-sub font-medium">
                        {characterAge} {t("years")}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Center: Step progress (desktop) — labelled steps, fixed in the middle */}
        {currentStep != null ? (
          <div className="hidden md:flex">
            <StepProgress
              currentStep={currentStep}
              totalSteps={totalSteps}
              labels={stepLabels}
              onStepClick={onStepClick}
              canStepNavigate={canStepNavigate}
            />
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
              <span className="material-symbols-outlined text-base">exit_to_app</span>
              <span className="hidden sm:inline">{t("exit")}</span>
            </Link>
          )}
        </div>
      </header>

      {confirmRegenerate && onRegeneratePortrait && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
          onClick={() => setConfirmRegenerate(false)}
        >
          <div
            className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <AvatarCircle
              portraitUrl={portraitUrl}
              name={characterName}
              className="h-20 w-20 rounded-full ring-4 ring-create-primary/20 shadow-lg"
              initialClassName="text-3xl"
            />
            <h3 className="text-center font-display text-lg font-bold text-create-text">
              {portraitUrl
                ? t("regenerateConfirmTitle", { name: characterName ?? "" })
                : t("regenerateConfirmNoPortraitTitle", { name: characterName ?? "" })}
            </h3>
            <p className="text-center text-sm leading-relaxed text-create-text-sub">
              {portraitUrl ? t("regenerateConfirmDescription") : t("regenerateConfirmNoPortraitDescription")}
            </p>
            <div className="mt-1 flex w-full gap-3">
              <button
                type="button"
                onClick={() => setConfirmRegenerate(false)}
                className="flex-1 rounded-full border-2 border-create-neutral px-4 py-2.5 text-sm font-bold text-create-text-sub transition-all hover:bg-create-bg"
              >
                {t("regenerateConfirmCancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmRegenerate(false);
                  onRegeneratePortrait();
                }}
                className="flex-1 rounded-full bg-create-primary px-4 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:shadow-xl"
              >
                {t("regenerateConfirmYes")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile: same labelled stepper as desktop, on its own row below the header */}
      {currentStep != null && (
        <div className="flex justify-center border-b border-create-primary/10 px-3 pb-2.5 pt-2.5 md:hidden">
          <StepProgress
            currentStep={currentStep}
            totalSteps={totalSteps}
            labels={stepLabels}
            onStepClick={onStepClick}
            canStepNavigate={canStepNavigate}
          />
        </div>
      )}
    </>
  );
}
