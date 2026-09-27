"use client";

import { Suspense, useState, useCallback, useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import {
  CreateBookState,
  INITIAL_STATE,
  type EndingChoice,
  type StoryDecisions,
  getTemplateConfig,
  getCatalogDefaults,
} from "@/lib/create-store";
import { usePersistedState, STORAGE_KEY } from "@/hooks/usePersistedState";
import { useAuth } from "@/hooks/useAuth";
import { isIllustrationRef } from "@/lib/storage/illustration-refs";
import Step2CharacterCreation from "@/components/crear/Step2CharacterCreation";
import PathBuilder from "@/components/crear/PathBuilder";
import Step5AuthorMessage from "@/components/crear/Step5AuthorMessage";
import PortraitReveal from "@/components/crear/PortraitReveal";
import PageFlip from "@/components/crear/PageFlip";

// New flow: 1 = character, 2 = path (world + decisions), 3 = dedication
const TOTAL_STEPS = 3;

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
  const [state, setState, , hydrated] = usePersistedState<CreateBookState>(
    STORAGE_KEY,
    INITIAL_STATE
  );
  const [saving, setSaving] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  // The avatar lives in a private bucket: the URL persisted in localStorage is a
  // signed URL that expires (24 h). Re-sign it once when the flow is resumed; if
  // it no longer belongs to this session, drop it (the reveal regenerates it).
  const portraitRefreshed = useRef(false);
  useEffect(() => {
    if (!hydrated || portraitRefreshed.current) return;
    portraitRefreshed.current = true;
    const current = state.portraitUrl;
    if (!current || !isIllustrationRef(current)) return;
    fetch("/api/illustrations/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refs: [current] }),
    })
      .then((res) => (res.ok ? (res.json() as Promise<{ urls?: Record<string, string | null> }>) : null))
      .then((data) => {
        if (!data?.urls) return; // no session yet / network error: keep what we have
        const fresh = data.urls[current] ?? null;
        setState((prev) =>
          prev.portraitUrl !== current
            ? prev
            : fresh
              ? { ...prev, portraitUrl: fresh }
              : { ...prev, portraitUrl: null, recraftStyleId: null, portraitCharacterSnapshot: null },
        );
      })
      .catch(() => {});
  }, [hydrated, state.portraitUrl, setState]);

  // --- State updaters ---

  const goNext = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.min(prev.currentStep + 1, TOTAL_STEPS),
    }));
  }, [setState]);

  const goBack = useCallback(() => {
    // From the first step (character), or catalog mode, leave to the landing.
    if (state.currentStep <= 1 || (catalogMode && state.currentStep <= 2)) {
      router.push("/");
      return;
    }
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 1),
    }));
  }, [setState, catalogMode, state.currentStep, router]);

  // High-water mark: furthest step the user has validly advanced to. Lets the
  // header stepper jump back/forward among steps already unlocked this session.
  const [maxStep, setMaxStep] = useState(state.currentStep);
  useEffect(() => {
    setMaxStep((m) => Math.max(m, state.currentStep));
  }, [state.currentStep]);

  // A step is reachable when it's been unlocked AND its data prerequisites hold:
  // step 2 (path) needs a named character; step 3 (dedication) needs a chosen
  // template. The AI portrait is optional: if the provider fails the parent can
  // continue without it (the book pipeline builds its own character references).
  const isStepReachable = useCallback(
    (step: number) => {
      if (catalogMode) return false; // catalog flow auto-advances; no manual hops
      if (step < 1 || step > TOTAL_STEPS || step > maxStep) return false;
      if (step >= 2 && !state.character.name.trim()) return false;
      if (step >= 3 && !state.selectedTemplate) return false;
      return true;
    },
    [catalogMode, maxStep, state.character.name, state.selectedTemplate],
  );

  // Snapshot of the character for which the parent chose "continue without
  // portrait" (portrait provider failed). Not persisted on purpose: after a
  // reload we simply try the portrait once more.
  const [portraitSkippedFor, setPortraitSkippedFor] = useState<string | null>(null);

  const goToStep = useCallback(
    (step: number) => {
      if (!isStepReachable(step)) return;
      setShowPortraitReveal(false);
      setState((prev) => ({ ...prev, currentStep: step }));
    },
    [isStepReachable, setState],
  );

  // Build a snapshot string of character fields that affect the portrait
  const getCharacterSnapshot = useCallback((char: typeof state.character) => {
    return JSON.stringify({
      gender: char.gender, age: char.age, skinTone: char.skinTone,
      hairColor: char.hairColor, hairstyle: char.hairstyle, name: char.name,
      interests: char.interests, favoriteColor: char.favoriteColor,
      favoriteCompanion: char.favoriteCompanion, futureDream: char.futureDream,
    });
  }, []);

  // Step 2 → Portrait Reveal → Step 3 (or auto-save in catalog mode)
  const handleStep2Next = useCallback(() => {
    if (!state.portraitUrl) {
      // Parent already chose to continue without a portrait for this exact
      // character → don't hit the (failing) provider again.
      if (portraitSkippedFor === getCharacterSnapshot(state.character)) {
        if (catalogMode) setCatalogAutoSave(true);
        else goNext();
        return;
      }
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
  }, [state.portraitUrl, state.character, state.portraitCharacterSnapshot, getCharacterSnapshot, goNext, catalogMode, portraitSkippedFor]);

  // Regenerate portrait — clears current portrait and shows reveal screen
  const handleRegeneratePortrait = useCallback(() => {
    setState((prev) => ({
      ...prev,
      portraitUrl: null,
      recraftStyleId: null,
      currentStep: 1,
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
        currentStep: catalogMode ? prev.currentStep : 2, // → the path (step 2); catalog stays to auto-save
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

  // Portrait provider failed → continue with the initial-letter avatar.
  const handlePortraitSkip = useCallback(() => {
    setPortraitSkippedFor(getCharacterSnapshot(state.character));
    setState((prev) => ({
      ...prev,
      portraitUrl: null,
      recraftStyleId: null,
      portraitCharacterSnapshot: null,
      currentStep: catalogMode ? prev.currentStep : 2,
    }));
    setShowPortraitReveal(false);
    if (catalogMode) setCatalogAutoSave(true);
  }, [getCharacterSnapshot, state.character, setState, catalogMode]);

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
        console.warn("[crear] Saving story failed:", res.status, await res.text().catch(() => ""));
        throw new Error("save_failed");
      }

      const { storyId } = await res.json();
      // Freeze UI before navigating so step 1 doesn't flash.
      // The persisted draft is NOT cleared here: /generar clears it only once the
      // story reaches `preview`, so a failed generation never loses the parent's
      // input ("Volver" returns to the filled form).
      setNavigating(true);
      router.push(`/crear/${storyId}/generar`);
    } catch (err) {
      console.warn("[crear] saveAndGenerate failed:", err);
      setError(t("errors.saveFailed"));
      setSaving(false);
    }
  }, [state, router, locale, t]);

  const handleFinish = useCallback(async () => {
    if (user) {
      await saveAndGenerate();
      return;
    }
    // No account required — continue seamlessly as guest (anonymous session).
    // Account creation is offered later (post-purchase), it never blocks creation.
    setSaving(true);
    setError(null);
    try {
      // Reuse the guest session if one already exists (created before the
      // portrait generation); otherwise sign in anonymously to get a user_id.
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const {
        data: { session: existingSession },
      } = await supabase.auth.getSession();
      if (!existingSession) {
        const { error: anonError, data } =
          await supabase.auth.signInAnonymously();
        if (anonError || !data.session) {
          throw anonError ?? new Error("guest_session_missing");
        }
      }
      // Session cookies are set synchronously when signInAnonymously resolves
      await saveAndGenerate();
    } catch (err) {
      console.warn("[crear] Guest session failed:", err);
      setError(t("errors.saveFailed"));
      setSaving(false);
    }
  }, [user, saveAndGenerate, t]);

  // Catalog mode: auto-save after portrait is complete
  useEffect(() => {
    // Portrait is optional (may have been skipped after a provider failure)
    if (catalogAutoSave && catalogMode && !saving) {
      setCatalogAutoSave(false);
      handleFinish();
    }
  }, [catalogAutoSave, catalogMode, saving, handleFinish]);

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
      setState((prev) => ({ ...prev, currentStep: TOTAL_STEPS }));
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
              // Not stored on saved characters yet (avatar builder phase 2).
              glasses: INITIAL_STATE.character.glasses,
              freckles: INITIAL_STATE.character.freckles,
              interests: ch.interests ?? [],
              city: ch.city ?? "",
              favoriteColor: ch.favorite_color ?? "#E53935",
              favoriteCompanion: ch.favorite_companion ?? "",
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
          currentStep: 1, // Character step; catalog auto-saves after portrait
        });
      } else {
        // Standard prefill (dashboard reorder / SEO theme link): start at character.
        // If a template came in (SEO), the path will have its world pre-answered.
        setState({
          ...INITIAL_STATE,
          character: characterData,
          selectedTemplate: templateParam ?? null,
          mode: "solo",
          currentStep: 1,
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

  // Hold render until the persisted draft has hydrated AND prefill is resolved,
  // so we never flash step 1 before jumping to a restored step (no double render).
  if (!hydrated || !prefillReady) {
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
          {state.currentStep === 1 && !showPortraitReveal && (
            <Step2CharacterCreation
              mode={state.mode ?? "solo"}
              character={state.character}
              catalogMode={catalogMode}
              onUpdateCharacter={updateCharacter}
              onNext={handleStep2Next}
              onBack={goBack}
              onStepClick={goToStep}
              canStepNavigate={isStepReachable}
            />
          )}
          {state.currentStep === 1 && showPortraitReveal && (
            <PortraitReveal
              character={state.character}
              onComplete={handlePortraitComplete}
              onRetry={() => {}}
              onBack={handlePortraitBack}
              onSkip={handlePortraitSkip}
            />
          )}
          {state.currentStep === 2 && (
            <PathBuilder
              character={state.character}
              selectedTemplate={state.selectedTemplate}
              decisions={state.decisions}
              portraitUrl={state.portraitUrl}
              onSelectTemplate={setTemplate}
              onUpdateDecisions={updateDecisions}
              onRegeneratePortrait={handleRegeneratePortrait}
              onComplete={goNext}
              onBack={goBack}
              onStepClick={goToStep}
              canStepNavigate={isStepReachable}
            />
          )}
          {state.currentStep === 3 && templateConfig && (
            <Step5AuthorMessage
              mode={state.mode ?? "solo"}
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
              onStepClick={goToStep}
              canStepNavigate={isStepReachable}
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

        {/* Error toast */}
        {error && (
          <div
            role="alert"
            className="fixed bottom-24 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-lg"
          >
            <span className="flex-1">{error}</span>
            <button
              onClick={() => setError(null)}
              aria-label={t("errors.dismiss")}
              className="font-bold hover:text-red-900"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
