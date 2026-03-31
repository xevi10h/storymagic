"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import type { CharacterData } from "@/lib/create-store";
import CreationHeader from "./CreationHeader";

interface PortraitRevealProps {
  character: CharacterData;
  onComplete: (portraitUrl: string, recraftStyleId: string | null) => void;
  onRetry: () => void;
  onBack: () => void;
}

type Phase = "generating" | "revealing" | "revealed" | "error";

/**
 * Full-screen transition between Step 2 and Step 3.
 *
 * Flow:
 * 1. "generating" — nebula animation + status text while API call runs
 * 2. "revealing" — portrait fades in with scale animation (0.5s)
 * 3. "revealed" — portrait fully visible + CTA button to continue
 * 4. "error" — retry button if generation failed
 */
export default function PortraitReveal({
  character,
  onComplete,
  onRetry,
  onBack,
}: PortraitRevealProps) {
  const t = useTranslations("crear.portraitReveal");
  const [phase, setPhase] = useState<Phase>("generating");
  const [portraitUrl, setPortraitUrl] = useState<string | null>(null);
  const [recraftStyleId, setRecraftStyleId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const startedRef = useRef(false);

  const generatePortrait = useCallback(async () => {
    setPhase("generating");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/characters/portrait", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gender: character.gender,
          age: character.age,
          skinTone: character.skinTone,
          hairColor: character.hairColor,
          eyeColor: character.eyeColor,
          hairstyle: character.hairstyle,
          childName: character.name,
          interests: character.interests,
          favoriteColor: character.favoriteColor,
          favoriteCompanion: character.favoriteCompanion,
          futureDream: character.futureDream,
          city: character.city,
        }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          throw new Error("RATE_LIMITED");
        }
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
      }

      const data = await res.json();
      setPortraitUrl(data.portraitUrl);
      setRecraftStyleId(data.recraftStyleId);

      // Brief pause before reveal animation
      setPhase("revealing");
      setTimeout(() => setPhase("revealed"), 600);
    } catch (err) {
      console.error("[PortraitReveal] Generation failed:", err);
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
      setPhase("error");
    }
  }, [character]);

  // Generate portrait exactly once — ref guard prevents StrictMode double-fire
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    generatePortrait();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContinue = () => {
    if (portraitUrl) {
      onComplete(portraitUrl, recraftStyleId);
    }
  };

  const handleRetry = () => {
    onRetry();
    generatePortrait();
  };

  return (
    <div className="flex flex-col h-screen bg-create-bg overflow-hidden">
      <CreationHeader currentStep={2} rightAction="save" />

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="flex flex-col items-center max-w-md w-full">

          {/* Portrait container */}
          <div className="relative mb-8">
            {/* Outer glow ring */}
            <div className={`absolute -inset-4 rounded-full transition-all duration-1000 ${
              phase === "revealed" ? "bg-create-primary/10 blur-2xl scale-110" : "bg-transparent"
            }`} />

            {/* Portrait circle */}
            <div className="relative w-52 h-52 md:w-64 md:h-64 rounded-full overflow-hidden shadow-2xl border-4 border-white">
              {/* Nebula background (always visible, portrait overlays it) */}
              <div className="absolute inset-0 bg-gradient-to-br from-create-primary/20 via-amber-200/30 to-create-primary/10">
                <div className="absolute inset-0 bg-gradient-to-tr from-create-primary/15 via-transparent to-amber-300/20 animate-spin" style={{ animationDuration: "8s" }} />
                <div className="absolute inset-4 bg-gradient-to-bl from-amber-200/20 via-transparent to-create-primary/15 animate-spin" style={{ animationDuration: "6s", animationDirection: "reverse" }} />
                <div className="absolute inset-8 rounded-full bg-white/20 backdrop-blur-sm" />

                {/* Pulsing initial during generation */}
                {(phase === "generating") && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-display font-bold text-6xl text-create-primary/40 animate-pulse">
                      {character.name ? character.name.charAt(0).toUpperCase() : "?"}
                    </span>
                  </div>
                )}
              </div>

              {/* Portrait image (fades in) */}
              {portraitUrl && (
                <img
                  src={portraitUrl}
                  alt={character.name}
                  className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${
                    phase === "revealing"
                      ? "opacity-0 scale-110"
                      : phase === "revealed"
                      ? "opacity-100 scale-100"
                      : "opacity-0 scale-110"
                  }`}
                />
              )}
            </div>
          </div>

          {/* Text */}
          <div className="text-center">
            {phase === "generating" && (
              <div className="flex flex-col items-center gap-3 animate-in fade-in">
                <span className="material-symbols-outlined text-3xl text-create-primary animate-spin" style={{ animationDuration: "2s" }}>
                  progress_activity
                </span>
                <h2 className="text-xl md:text-2xl font-display font-bold text-create-text">
                  {t("generating", { name: character.name })}
                </h2>
                <p className="text-create-text-sub text-sm">
                  {t("generatingSubtitle")}
                </p>
              </div>
            )}

            {(phase === "revealing" || phase === "revealed") && (
              <div className={`flex flex-col items-center gap-3 transition-all duration-500 ${
                phase === "revealed" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}>
                <h2 className="text-2xl md:text-3xl font-display font-bold text-create-text">
                  {t(character.gender === "girl" ? "revealTitleFemale" : "revealTitle", { name: character.name })}
                </h2>
                <p className="text-create-text-sub text-sm max-w-xs">
                  {t("revealSubtitle")}
                </p>

                <div className="flex items-center gap-3 mt-4">
                  <button
                    onClick={handleRetry}
                    className="px-4 sm:px-5 py-3 border-2 border-create-neutral/40 text-create-text-sub font-bold rounded-full hover:bg-white hover:border-create-primary/30 transition-all text-sm whitespace-nowrap flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-base">
                      refresh
                    </span>
                    {t("regenerateButton")}
                  </button>
                  <button
                    onClick={handleContinue}
                    className="px-6 sm:px-8 py-3 bg-create-primary text-white font-bold rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all text-sm whitespace-nowrap"
                  >
                    {t("continueButton")}
                    <span className="material-symbols-outlined text-base ml-1 align-middle">
                      arrow_forward
                    </span>
                  </button>
                </div>
              </div>
            )}

            {phase === "error" && (
              <div className="flex flex-col items-center gap-3">
                <span className="material-symbols-outlined text-3xl text-red-400">
                  {errorMessage === "RATE_LIMITED" ? "schedule" : "error_outline"}
                </span>
                <h2 className="text-xl font-display font-bold text-create-text">
                  {t("errorTitle")}
                </h2>
                <p className="text-create-text-sub text-sm max-w-xs">
                  {errorMessage === "RATE_LIMITED"
                    ? t("rateLimitError")
                    : t("errorSubtitle")}
                </p>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={onBack}
                    className="px-6 py-2.5 border-2 border-create-neutral/40 text-create-text-sub font-bold rounded-full hover:bg-white transition-all text-sm"
                  >
                    {t("backButton")}
                  </button>
                  {errorMessage !== "RATE_LIMITED" && (
                    <button
                      onClick={handleRetry}
                      className="px-6 py-2.5 bg-create-primary text-white font-bold rounded-full shadow-lg hover:shadow-xl transition-all text-sm"
                    >
                      {t("retryButton")}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
