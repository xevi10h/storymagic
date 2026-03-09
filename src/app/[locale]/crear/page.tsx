"use client";

import { Suspense, useState, useCallback, useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import {
  CreateBookState,
  INITIAL_STATE,
  type CreationMode,
  type EndingChoice,
  type StoryDecisions,
  getTemplateConfig,
  getCatalogDefaults,
} from "@/lib/create-store";
import { usePersistedState, STORAGE_KEY } from "@/hooks/usePersistedState";
import { useAuth } from "@/hooks/useAuth";
import Step1ModeSelection from "@/components/crear/Step1ModeSelection";
import Step2CharacterCreation from "@/components/crear/Step2CharacterCreation";
import Step3AdventureSelection from "@/components/crear/Step3AdventureSelection";
import Step4Decisions from "@/components/crear/Step4Decisions";
import Step5AuthorMessage from "@/components/crear/Step5AuthorMessage";
import PortraitReveal from "@/components/crear/PortraitReveal";
import GuestGate from "@/components/crear/GuestGate";
import PageFlip from "@/components/crear/PageFlip";

const TOTAL_STEPS = 5;

export default function CrearPage() {
  return (
    <Suspense>
      <CrearPageContent />
    </Suspense>
  );
}

function CrearPageContent() {
  const t = useTranslations("crear");
  const locale = useLocale();
  const [state, setState, clearState] = usePersistedState<CreateBookState>(
    STORAGE_KEY,
    INITIAL_STATE
  );
  const [saving, setSaving] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGuestGate, setShowGuestGate] = useState(false);
  const [showPortraitReveal, setShowPortraitReveal] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  /** When true, user entered via catalog — skip Steps 3-5, use catalog defaults */
  const [catalogMode, setCatalogMode] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoFinishTriggered = useRef(false);
  const prefillApplied = useRef(false);
  /** Triggers auto-save in catalog mode (after portrait or when portrait already exists) */
  const [catalogAutoSave, setCatalogAutoSave] = useState(false);

  // Detect prefill params synchronously so we never render stale step 1.
  // If ?template or ?characterId are present, hold rendering until applied.
  // Also clear persisted state immediately when entering from catalog to prevent stale hydration.
  const [prefillReady, setPrefillReady] = useState(() => {
    if (typeof window === "undefined") return true; // SSR: always ready
    const p = new URLSearchParams(window.location.search);
    if (p.get("from") === "catalog") {
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
    }
    return !p.has("template") && !p.has("characterId") && !p.has("from");
  });

  // --- State updaters ---

  const goNext = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.min(prev.currentStep + 1, TOTAL_STEPS),
    }));
  }, [setState]);

  const goBack = useCallback(() => {
    // In catalog mode, going back from Step 2 returns to landing
    if (catalogMode && state.currentStep <= 2) {
      router.push("/");
      return;
    }
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 1),
    }));
  }, [setState, catalogMode, state.currentStep, router]);

  // Build a snapshot string of character fields that affect the portrait
  const getCharacterSnapshot = useCallback((char: typeof state.character) => {
    return JSON.stringify({
      gender: char.gender, age: char.age, skinTone: char.skinTone,
      hairColor: char.hairColor, hairstyle: char.hairstyle, name: char.name,
      interests: char.interests, specialTrait: char.specialTrait,
      favoriteCompanion: char.favoriteCompanion, futureDream: char.futureDream,
    });
  }, []);

  // Step 2 → Portrait Reveal → Step 3 (or auto-save in catalog mode)
  const handleStep2Next = useCallback(() => {
    if (!state.portraitUrl) {
      // No portrait yet → generate
      setShowPortraitReveal(true);
      return;
    }

    // Portrait exists — check if character data changed since it was generated
    const currentSnapshot = getCharacterSnapshot(state.character);
    if (state.portraitCharacterSnapshot && state.portraitCharacterSnapshot !== currentSnapshot) {
      // Character changed → ask user if they want to regenerate
      setShowRegenerateConfirm(true);
    } else if (catalogMode) {
      // Catalog mode with existing portrait → trigger auto-save
      setCatalogAutoSave(true);
    } else {
      // No changes → skip straight to Step 3
      goNext();
    }
  }, [state.portraitUrl, state.character, state.portraitCharacterSnapshot, getCharacterSnapshot, goNext, catalogMode]);

  // Regenerate portrait — clears current portrait and shows reveal screen
  const handleRegeneratePortrait = useCallback(() => {
    setState((prev) => ({
      ...prev,
      portraitUrl: null,
      recraftStyleId: null,
      currentStep: 2,
    }));
    setShowPortraitReveal(true);
  }, [setState]);

  const handlePortraitComplete = useCallback(
    (portraitUrl: string, recraftStyleId: string | null) => {
      setState((prev) => ({
        ...prev,
        portraitUrl,
        recraftStyleId,
        portraitCharacterSnapshot: getCharacterSnapshot(prev.character),
        currentStep: catalogMode ? prev.currentStep : 3, // In catalog mode, stay on step 2 — we'll auto-save
      }));
      setShowPortraitReveal(false);

      // In catalog mode, go directly to save+generate after portrait is ready
      if (catalogMode) {
        setCatalogAutoSave(true);
      }
    },
    [setState, getCharacterSnapshot, catalogMode],
  );

  const handlePortraitBack = useCallback(() => {
    setShowPortraitReveal(false);
  }, []);

  const setMode = useCallback(
    (mode: CreationMode) => {
      setState((prev) => ({ ...prev, mode }));
    },
    [setState]
  );

  const updateCharacter = useCallback(
    (updates: Partial<CreateBookState["character"]>) => {
      setState((prev) => {
        const newCharacter = { ...prev.character, ...updates };
        return { ...prev, character: newCharacter };
      });
    },
    [setState]
  );

  const setTemplate = useCallback(
    (templateId: string) => {
      setState((prev) => {
        // Reset decisions when template changes to avoid stale choices
        const needsReset = prev.selectedTemplate !== null && prev.selectedTemplate !== templateId;
        return {
          ...prev,
          selectedTemplate: templateId,
          decisions: needsReset ? {} : prev.decisions,
          ending: needsReset ? null : prev.ending,
        };
      });
    },
    [setState]
  );

  const updateDecisions = useCallback(
    (updates: Partial<StoryDecisions>) => {
      setState((prev) => ({
        ...prev,
        decisions: { ...prev.decisions, ...updates },
      }));
    },
    [setState]
  );

  const setDedication = useCallback(
    (dedication: string) => {
      setState((prev) => ({ ...prev, dedication }));
    },
    [setState]
  );

  const setSenderName = useCallback(
    (senderName: string) => {
      setState((prev) => ({ ...prev, senderName }));
    },
    [setState]
  );

  const setEnding = useCallback(
    (ending: EndingChoice) => {
      setState((prev) => ({ ...prev, ending }));
    },
    [setState]
  );

  const setEndingNote = useCallback(
    (endingNote: string) => {
      setState((prev) => ({ ...prev, endingNote }));
    },
    [setState]
  );

  // --- Save & navigation ---

  const saveAndGenerate = useCallback(async () => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character: state.character,
          templateId: state.selectedTemplate,
          creationMode: state.mode,
          decisions: { ...state.decisions, endingNote: state.endingNote || undefined },
          dedication: state.dedication,
          senderName: state.senderName,
          ending: state.ending,
          portraitUrl: state.portraitUrl,
          recraftStyleId: state.recraftStyleId,
          locale,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al guardar");
      }

      const { storyId } = await res.json();
      // Freeze UI before navigating so step 1 doesn't flash
      setNavigating(true);
      router.push(`/crear/${storyId}/generar`);
      // Clear persisted localStorage only — React state is frozen by navigating flag
      setTimeout(() => {
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setSaving(false);
    }
  }, [state, router, clearState]);

  const handleFinish = useCallback(async () => {
    if (user) {
      await saveAndGenerate();
    } else {
      setShowGuestGate(true);
    }
  }, [user, saveAndGenerate]);

  const handleGuestContinue = useCallback(async () => {
    setShowGuestGate(false);
    setSaving(true);
    setError(null);

    try {
      // Sign in anonymously so we get a real user_id for the DB
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error: anonError, data } =
        await supabase.auth.signInAnonymously();
      if (anonError) {
        throw new Error(anonError.message);
      }
      if (!data.session) {
        throw new Error("No se pudo crear la sesión de invitado");
      }
      // Session cookies are set synchronously when signInAnonymously resolves
      await saveAndGenerate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setSaving(false);
    }
  }, [saveAndGenerate]);

  const handleGuestLogin = useCallback(() => {
    // State is persisted in localStorage — redirect to login
    // After login, user returns to /crear?step=finish and auto-saves
    const next = encodeURIComponent("/crear?step=finish");
    router.push(`/auth/login?next=${next}`);
  }, [router]);

  // Catalog mode: auto-save after portrait is complete
  useEffect(() => {
    if (catalogAutoSave && state.portraitUrl && catalogMode && !saving) {
      setCatalogAutoSave(false);
      handleFinish();
    }
  }, [catalogAutoSave, state.portraitUrl, catalogMode, saving, handleFinish]);

  // Auto-finish after returning from login (guest who chose to log in)
  useEffect(() => {
    if (
      searchParams.get("step") === "finish" &&
      user &&
      !authLoading &&
      !autoFinishTriggered.current &&
      state.selectedTemplate
    ) {
      autoFinishTriggered.current = true;
      setState((prev) => ({ ...prev, currentStep: 5 }));
      saveAndGenerate();
    }
  }, [searchParams, user, authLoading, state.selectedTemplate, setState, saveAndGenerate]);

  // Pre-fill from dashboard or catalog: ?template={id}&characterId={id}&from=catalog
  useEffect(() => {
    if (prefillApplied.current) return;
    if (searchParams.get("step") === "finish") return; // handled by auto-finish above

    const templateParam = searchParams.get("template");
    const characterIdParam = searchParams.get("characterId");
    const fromCatalog = searchParams.get("from") === "catalog";

    if (!templateParam && !characterIdParam && !fromCatalog) return;
    prefillApplied.current = true;

    const applyPrefill = async () => {
      let characterData: CreateBookState["character"] = INITIAL_STATE.character;

      if (characterIdParam) {
        try {
          const res = await fetch(`/api/characters/${characterIdParam}`);
          if (res.ok) {
            const { character: ch } = await res.json();
            characterData = {
              name: ch.name ?? "",
              gender: ch.gender ?? "boy",
              age: ch.age ?? 6,
              hairColor: ch.hair_color ?? "",
              eyeColor: ch.eye_color ?? "#5d4037",
              skinTone: ch.skin_tone ?? "",
              hairstyle: ch.hairstyle ?? "short",
              interests: ch.interests ?? [],
              city: ch.city ?? "",
              specialTrait: ch.special_trait ?? "",
              favoriteCompanion: ch.favorite_companion ?? "",
              favoriteFood: ch.favorite_food ?? "",
              futureDream: ch.future_dream ?? "",
            };
          }
        } catch {
          // silently ignore — user enters manually
        }
      }

      // Catalog flow: start at Step 2 with catalog defaults pre-loaded
      // Clear any persisted state so character always starts fresh
      if (fromCatalog && templateParam) {
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
        const defaults = getCatalogDefaults(templateParam);
        setCatalogMode(true);
        setState({
          ...INITIAL_STATE,
          character: characterData,
          selectedTemplate: templateParam,
          mode: defaults?.mode ?? "solo",
          decisions: defaults?.decisions ?? {},
          ending: defaults?.ending ?? null,
          endingNote: defaults?.endingNote ?? "",
          dedication: defaults?.dedication ?? "",
          senderName: defaults?.senderName ?? "",
          currentStep: 2, // Go to character creation (Step 2)
        });
      } else {
        // Standard prefill from dashboard
        setState({
          ...INITIAL_STATE,
          character: characterData,
          selectedTemplate: templateParam ?? null,
          mode: "solo",
          currentStep: templateParam && characterIdParam ? 3 : templateParam ? 3 : 2,
        });
      }

      setPrefillReady(true);
    };

    applyPrefill();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve template config (needed by Steps 4 & 5)
  const templateConfig = state.selectedTemplate
    ? getTemplateConfig(state.selectedTemplate)
    : undefined;

  // Hold render until prefill is resolved to avoid step-1 flash
  if (!prefillReady) {
    return <div className="min-h-screen bg-create-bg" />;
  }

  // While navigating to generation page, freeze the UI
  if (navigating) {
    return (
      <div className="min-h-screen bg-create-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-5xl text-create-primary animate-spin">
            progress_activity
          </span>
          <p className="text-create-text-sub font-medium text-lg">
            {t("preparing")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-create-bg font-sans text-create-text relative">
      {/* Paper texture overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-40 create-paper-texture mix-blend-multiply z-0" />

      <div className="relative z-10">
        <PageFlip page={state.currentStep} disabled={catalogMode}>
          {state.currentStep === 1 && (
            <Step1ModeSelection
              mode={state.mode}
              onSelectMode={setMode}
              onNext={goNext}
            />
          )}
          {state.currentStep === 2 && !showPortraitReveal && (
            <Step2CharacterCreation
              mode={state.mode}
              character={state.character}
              catalogMode={catalogMode}
              onUpdateCharacter={updateCharacter}
              onNext={handleStep2Next}
              onBack={goBack}
            />
          )}
          {state.currentStep === 2 && showPortraitReveal && (
            <PortraitReveal
              character={state.character}
              onComplete={handlePortraitComplete}
              onRetry={() => {}}
              onBack={handlePortraitBack}
            />
          )}
          {state.currentStep === 3 && (
            <Step3AdventureSelection
              mode={state.mode}
              selectedTemplate={state.selectedTemplate}
              characterName={state.character.name}
              characterAge={state.character.age}
              characterInterests={state.character.interests}
              portraitUrl={state.portraitUrl}
              onRegeneratePortrait={handleRegeneratePortrait}
              onSelectTemplate={setTemplate}
              onNext={goNext}
              onBack={goBack}
            />
          )}
          {state.currentStep === 4 && templateConfig && (
            <Step4Decisions
              mode={state.mode}
              decisions={state.decisions}
              characterName={state.character.name}
              characterAge={state.character.age}
              template={templateConfig}
              portraitUrl={state.portraitUrl}
              onRegeneratePortrait={handleRegeneratePortrait}
              onUpdateDecisions={updateDecisions}
              onNext={goNext}
              onBack={goBack}
            />
          )}
          {state.currentStep === 5 && templateConfig && (
            <Step5AuthorMessage
              mode={state.mode}
              dedication={state.dedication}
              senderName={state.senderName}
              ending={state.ending}
              endingNote={state.endingNote}
              saving={saving}
              template={templateConfig}
              characterName={state.character.name}
              characterAge={state.character.age}
              portraitUrl={state.portraitUrl}
              onRegeneratePortrait={handleRegeneratePortrait}
              onSetDedication={setDedication}
              onSetSenderName={setSenderName}
              onSetEnding={setEnding}
              onSetEndingNote={setEndingNote}
              onNext={handleFinish}
              onBack={goBack}
            />
          )}
        </PageFlip>

        {/* Regenerate portrait confirmation */}
        {showRegenerateConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 flex flex-col items-center gap-4 animate-in fade-in zoom-in-95">
              {state.portraitUrl && (
                <img
                  src={state.portraitUrl}
                  alt=""
                  className="w-20 h-20 rounded-full object-cover ring-4 ring-create-primary/20 shadow-lg"
                />
              )}
              <h3 className="text-lg font-display font-bold text-create-text text-center">
                {t("regenerateConfirm.title")}
              </h3>
              <p className="text-sm text-create-text-sub text-center leading-relaxed">
                {t("regenerateConfirm.description")}
              </p>
              <div className="flex gap-3 w-full mt-1">
                <button
                  onClick={() => {
                    setShowRegenerateConfirm(false);
                    handleRegeneratePortrait();
                  }}
                  className="flex-1 px-4 py-2.5 border-2 border-create-primary text-create-primary font-bold rounded-full hover:bg-create-primary/5 transition-all text-sm flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">refresh</span>
                  {t("regenerateConfirm.regenerate")}
                </button>
                <button
                  onClick={() => {
                    setShowRegenerateConfirm(false);
                    goNext();
                  }}
                  className="flex-1 px-4 py-2.5 bg-create-primary text-white font-bold rounded-full shadow-lg hover:shadow-xl transition-all text-sm"
                >
                  {t("regenerateConfirm.keep")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Guest gate modal */}
        {showGuestGate && (
          <GuestGate
            onContinueAsGuest={handleGuestContinue}
            onLogin={handleGuestLogin}
            onClose={() => setShowGuestGate(false)}
            saving={saving}
          />
        )}

        {/* Error toast */}
        {error && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700 shadow-lg">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-3 font-bold hover:text-red-900"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
