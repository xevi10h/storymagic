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
  /** Continue without an AI portrait (initial-letter avatar) after a failure. */
  onSkip: () => void;
}

/** Failure kinds shown to parents — never raw provider/backend text. */
type PortraitError = "rate_limited" | "provider_unavailable" | "generic";

type Phase = "generating" | "revealing" | "revealed" | "error";

/** Rotating status messages shown while the portrait generates (~10-20s). */
const GENERATING_STEPS = ["step1", "step2", "step3", "step4"] as const;

/** Client-side budget: 1 initial portrait + 3 regenerations per character. */
const MAX_REGENERATIONS = 3;

/**
 * Successful generations per character. Module-scoped so the budget survives
 * remounts (e.g. regenerating from a later step) within the SPA session.
 */
const generationsByCharacter = new Map<string, number>();

/** Mirrors the portrait-affecting snapshot used by the crear page. */
function characterKey(char: CharacterData): string {
  return JSON.stringify({
    gender: char.gender, age: char.age, skinTone: char.skinTone,
    hairColor: char.hairColor, hairstyle: char.hairstyle, name: char.name,
    interests: char.interests, favoriteColor: char.favoriteColor,
    favoriteCompanion: char.favoriteCompanion, futureDream: char.futureDream,
  });
}

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
  onSkip,
}: PortraitRevealProps) {
  const t = useTranslations("crear.portraitReveal");
  const [phase, setPhase] = useState<Phase>("generating");
  const [portraitUrl, setPortraitUrl] = useState<string | null>(null);
  const [recraftStyleId, setRecraftStyleId] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<PortraitError | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [generationCount, setGenerationCount] = useState(
    () => generationsByCharacter.get(characterKey(character)) ?? 0,
  );
  const startedRef = useRef(false);

  // Cycle the status message while generating so the wait feels alive
  useEffect(() => {
    if (phase !== "generating") return;
    const id = setInterval(
      () => setStepIdx((i) => (i + 1) % GENERATING_STEPS.length),
      2600,
    );
    return () => clearInterval(id);
  }, [phase]);

  const generatePortrait = useCallback(async () => {
    setPhase("generating");
    setErrorKind(null);

    try {
      // The endpoint requires a session (rate-limited per user) — guests get an
      // anonymous one here, reused later when the story is saved.
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        const { error: anonError } = await supabase.auth.signInAnonymously();
        if (anonError) throw anonError;
      }

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
        const data = await res.json().catch(() => ({}));
        const kind: PortraitError =
          res.status === 429
            ? "rate_limited"
            : res.status === 503 || data?.error === "provider_unavailable"
              ? "provider_unavailable"
              : "generic";
        console.warn("[PortraitReveal] Portrait API failed:", res.status, data?.error);
        setErrorKind(kind);
        setPhase("error");
        return;
      }

      const data = await res.json();
      setPortraitUrl(data.portraitUrl);
      setRecraftStyleId(data.recraftStyleId);

      // Consume one unit of the per-character generation budget
      const key = characterKey(character);
      const used = (generationsByCharacter.get(key) ?? 0) + 1;
      generationsByCharacter.set(key, used);
      setGenerationCount(used);

      // Brief pause before reveal animation
      setPhase("revealing");
      setTimeout(() => setPhase("revealed"), 600);
    } catch (err) {
      console.warn("[PortraitReveal] Generation failed:", err);
      setErrorKind("generic");
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
    <div className="flex flex-col h-[100dvh] bg-create-bg overflow-hidden">
      <CreationHeader currentStep={1} totalSteps={3} rightAction="save" />

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

                {/* Initial: pulsing while generating, static fallback avatar on error */}
                {(phase === "generating" || phase === "error") && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`font-display font-bold text-6xl text-create-primary/40 ${phase === "generating" ? "animate-pulse" : ""}`}>
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
                <p key={stepIdx} className="cp-rise text-create-text-sub text-sm">
                  {t(GENERATING_STEPS[stepIdx])}
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
                  {/* Hidden once the regeneration budget (initial + 3) is spent */}
                  {generationCount <= MAX_REGENERATIONS && (
                    <button
                      onClick={handleRetry}
                      className="px-4 sm:px-5 py-3 border-2 border-create-neutral/40 text-create-text-sub font-bold rounded-full hover:bg-white hover:border-create-primary/30 transition-all text-sm whitespace-nowrap flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-base">
                        refresh
                      </span>
                      {t("regenerateButton")}
                    </button>
                  )}
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
                <h2 className="text-xl font-display font-bold text-create-text">
                  {t("errorTitle", { name: character.name })}
                </h2>
                <p className="text-create-text-sub text-sm max-w-sm">
                  {errorKind === "rate_limited"
                    ? t("rateLimitError")
                    : errorKind === "provider_unavailable"
                      ? t("providerUnavailable")
                      : t("errorSubtitle")}
                </p>
                <div className="flex flex-col-reverse sm:flex-row items-center gap-3 mt-4 w-full sm:w-auto">
                  <button
                    onClick={onBack}
                    className="w-full sm:w-auto px-6 py-2.5 text-create-text-sub font-bold rounded-full hover:bg-white transition-all text-sm"
                  >
                    {t("backButton")}
                  </button>
                  {errorKind === "generic" && (
                    <button
                      onClick={handleRetry}
                      className="w-full sm:w-auto px-6 py-2.5 border-2 border-create-neutral/40 text-create-text-sub font-bold rounded-full hover:bg-white hover:border-create-primary/30 transition-all text-sm flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-base">refresh</span>
                      {t("retryButton")}
                    </button>
                  )}
                  <button
                    onClick={onSkip}
                    className="w-full sm:w-auto px-6 py-2.5 bg-create-primary text-white font-bold rounded-full shadow-lg hover:shadow-xl transition-all text-sm flex items-center justify-center gap-1"
                  >
                    {t("continueWithoutPortrait")}
                    <span className="material-symbols-outlined text-base">arrow_forward</span>
                  </button>
                </div>
                <p className="text-create-text-sub/80 text-xs max-w-xs mt-1">
                  {t("continueWithoutPortraitHint")}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
