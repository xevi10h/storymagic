"use client";

import { Suspense, useState, useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import {
  CreateBookState,
  INITIAL_STATE,
  type CreationMode,
  type EndingChoice,
  type StoryDecisions,
  getTemplateConfig,
} from "@/lib/create-store";
import { usePersistedState, STORAGE_KEY } from "@/hooks/usePersistedState";
import { useAuth } from "@/hooks/useAuth";
import Step1ModeSelection from "@/components/crear/Step1ModeSelection";
import Step2CharacterCreation from "@/components/crear/Step2CharacterCreation";
import Step3AdventureSelection from "@/components/crear/Step3AdventureSelection";
import Step4Decisions from "@/components/crear/Step4Decisions";
import Step5AuthorMessage from "@/components/crear/Step5AuthorMessage";
import GuestGate from "@/components/crear/GuestGate";

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
  const [state, setState, clearState] = usePersistedState<CreateBookState>(
    STORAGE_KEY,
    INITIAL_STATE
  );
  const [saving, setSaving] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGuestGate, setShowGuestGate] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoFinishTriggered = useRef(false);

  // --- State updaters ---

  const goNext = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.min(prev.currentStep + 1, TOTAL_STEPS),
    }));
  }, [setState]);

  const goBack = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 1),
    }));
  }, [setState]);

  const setMode = useCallback(
    (mode: CreationMode) => {
      setState((prev) => ({ ...prev, mode }));
    },
    [setState]
  );

  const updateCharacter = useCallback(
    (updates: Partial<CreateBookState["character"]>) => {
      setState((prev) => ({
        ...prev,
        character: { ...prev.character, ...updates },
      }));
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
          decisions: state.decisions,
          dedication: state.dedication,
          senderName: state.senderName,
          ending: state.ending,
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

  // Resolve template config (needed by Steps 4 & 5)
  const templateConfig = state.selectedTemplate
    ? getTemplateConfig(state.selectedTemplate)
    : undefined;

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
        {state.currentStep === 1 && (
          <Step1ModeSelection
            mode={state.mode}
            onSelectMode={setMode}
            onNext={goNext}
          />
        )}
        {state.currentStep === 2 && (
          <Step2CharacterCreation
            character={state.character}
            onUpdateCharacter={updateCharacter}
            onNext={goNext}
            onBack={goBack}
          />
        )}
        {state.currentStep === 3 && (
          <Step3AdventureSelection
            selectedTemplate={state.selectedTemplate}
            characterName={state.character.name}
            characterAge={state.character.age}
            characterInterests={state.character.interests}
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
            template={templateConfig}
            onUpdateDecisions={updateDecisions}
            onNext={goNext}
            onBack={goBack}
          />
        )}
        {state.currentStep === 5 && templateConfig && (
          <Step5AuthorMessage
            dedication={state.dedication}
            senderName={state.senderName}
            ending={state.ending}
            saving={saving}
            template={templateConfig}
            characterName={state.character.name}
            onSetDedication={setDedication}
            onSetSenderName={setSenderName}
            onSetEnding={setEnding}
            onNext={handleFinish}
            onBack={goBack}
          />
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
