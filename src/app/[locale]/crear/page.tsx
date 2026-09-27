"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  HAIRSTYLES,
  INITIAL_STATE,
  type CharacterData,
  type CreateBookState,
  type ProtagonistMode,
  type TreeChoice,
} from "@/lib/create-store";
import {
  CREATE_PAGE_STEPS,
  migrateCreateState,
  protagonistSnapshot,
  storyInputSnapshot,
} from "@/lib/creation-flow";
import { usePersistedState, STORAGE_KEY } from "@/hooks/usePersistedState";
import { ensureGuestSession } from "@/lib/guest-session";
import CreationHeader from "@/components/crear/CreationHeader";
import StepName from "@/components/crear/StepName";
import StepProtagonist from "@/components/crear/StepProtagonist";
import StepAdventure from "@/components/crear/StepAdventure";

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
  const router = useRouter();
  const [state, setState, , hydrated] = usePersistedState<CreateBookState>(
    STORAGE_KEY,
    INITIAL_STATE,
    migrateCreateState,
  );
  const [saving, setSaving] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Entry links can pre-fill the draft: ?template= (catalog/SEO: world pre-chosen)
  // and ?characterId= (dashboard: reuse a saved character). Hold rendering until
  // applied so a stale draft never flashes.
  const [prefillReady, setPrefillReady] = useState(() => {
    if (typeof window === "undefined") return true;
    const p = new URLSearchParams(window.location.search);
    return !p.has("template") && !p.has("characterId");
  });
  const prefillApplied = useRef(false);
  useEffect(() => {
    if (prefillApplied.current || prefillReady) return;
    prefillApplied.current = true;
    const p = new URLSearchParams(window.location.search);
    const templateParam = p.get("template");
    const characterIdParam = p.get("characterId");

    void (async () => {
      let character: CharacterData = INITIAL_STATE.character;
      if (characterIdParam) {
        try {
          const res = await fetch(`/api/characters/${characterIdParam}`);
          if (res.ok) {
            const { character: ch } = await res.json();
            character = {
              ...INITIAL_STATE.character,
              name: ch.name ?? "",
              gender: ch.gender ?? "boy",
              age: ch.age ?? 6,
              hairColor: ch.hair_color ?? INITIAL_STATE.character.hairColor,
              eyeColor: ch.eye_color ?? INITIAL_STATE.character.eyeColor,
              skinTone: ch.skin_tone ?? INITIAL_STATE.character.skinTone,
              hairstyle: ch.hairstyle ?? "short",
              interests: ch.interests ?? [],
              city: ch.city ?? "",
            };
          }
        } catch {
          // ignore — the parent types it in
        }
      }
      setState({
        ...INITIAL_STATE,
        character,
        selectedTemplate: templateParam ?? null,
        currentStep: character.name.trim() ? 2 : 1,
      });
      // Clean URL so a reload resumes the draft instead of re-applying the prefill
      router.replace("/crear");
      setPrefillReady(true);
    })();
  }, [prefillReady, setState, router]);

  // ── Navigation ─────────────────────────────────────────────────────────────

  const setStep = useCallback(
    (step: number) => setState((prev) => ({ ...prev, currentStep: Math.min(Math.max(step, 1), CREATE_PAGE_STEPS) })),
    [setState],
  );

  const goBack = useCallback(() => {
    if (state.currentStep <= 1) {
      router.push("/");
      return;
    }
    setStep(state.currentStep - 1);
  }, [state.currentStep, router, setStep]);

  const hasName = state.character.name.trim().length > 0;
  const canNavigate = useCallback(
    (step: number) => {
      if (step === 1) return true;
      if (step === 2 || step === 3) return hasName;
      // Screens 4–6 exist once the book was created from this exact draft
      return !!state.createdStory && state.createdStory.snapshot === storyInputSnapshot(state, locale);
    },
    [hasName, state, locale],
  );
  const onStepClick = useCallback(
    (step: number) => {
      if (!canNavigate(step)) return;
      if (step <= CREATE_PAGE_STEPS) setStep(step);
      else if (state.createdStory) router.push(`/crear/${state.createdStory.id}/generar`);
    },
    [canNavigate, setStep, state.createdStory, router],
  );

  // New screen → start at the top
  const firstStepRender = useRef(true);
  useEffect(() => {
    if (!hydrated) return;
    if (firstStepRender.current) {
      firstStepRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
  }, [state.currentStep, hydrated]);

  // ── State updaters ─────────────────────────────────────────────────────────

  const updateCharacter = useCallback(
    (updates: Partial<CharacterData>) => {
      setState((prev) => {
        const character = { ...prev.character, ...updates };
        // Keep the hairstyle valid for the chosen gender
        if (updates.gender && !HAIRSTYLES[updates.gender].some((h) => h.id === character.hairstyle)) {
          character.hairstyle = HAIRSTYLES[updates.gender][0].id;
        }
        return { ...prev, character };
      });
    },
    [setState],
  );

  const setMode = useCallback(
    (protagonistMode: ProtagonistMode) => setState((prev) => ({ ...prev, protagonistMode })),
    [setState],
  );
  const setPhoto = useCallback(
    (photoPath: string | null) => setState((prev) => ({ ...prev, photoPath })),
    [setState],
  );

  const setTemplate = useCallback(
    (templateId: string) =>
      setState((prev) =>
        prev.selectedTemplate === templateId
          ? prev
          : { ...prev, selectedTemplate: templateId, decisions: {}, ending: null },
      ),
    [setState],
  );
  const setTreePath = useCallback(
    (treePath: TreeChoice[]) => setState((prev) => ({ ...prev, decisions: { treePath } })),
    [setState],
  );

  // ── Screen 2 → 3: start the character sheet in the background ──────────────

  const prepInFlight = useRef<string | null>(null);
  const startCharacterPrep = useCallback(
    (snapshotState: CreateBookState) => {
      const snapshot = protagonistSnapshot(snapshotState);
      if (snapshotState.characterPrepSnapshot === snapshot && snapshotState.characterPrepId) return;
      if (prepInFlight.current === snapshot) return;
      prepInFlight.current = snapshot;
      const c = snapshotState.character;
      const usePhoto = snapshotState.protagonistMode === "photo" && !!snapshotState.photoPath;
      void (async () => {
        try {
          await ensureGuestSession();
          const res = await fetch("/api/characters/prepare", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              character: {
                name: c.name.trim(),
                gender: c.gender,
                age: c.age,
                skinTone: c.skinTone,
                hairColor: c.hairColor,
                hairstyle: c.hairstyle,
                eyeColor: c.eyeColor,
                glasses: c.glasses,
                freckles: c.freckles,
              },
              ...(usePhoto ? { photoPath: snapshotState.photoPath } : {}),
              locale,
            }),
          });
          if (res.status === 410) {
            // The photo was already used and deleted — ask for it again.
            setState((prev) => ({ ...prev, photoPath: null }));
            setError(t("photo.errors.photo_unavailable"));
            return;
          }
          if (!res.ok) throw new Error(`prepare_${res.status}`);
          const data = (await res.json()) as { characterPrepId?: string };
          if (!data.characterPrepId) return;
          setState((prev) =>
            protagonistSnapshot(prev) === snapshot
              ? { ...prev, characterPrepId: data.characterPrepId!, characterPrepSnapshot: snapshot }
              : prev,
          );
        } catch (err) {
          // Best effort: without a prep id the book pipeline builds the sheet itself.
          console.warn("[crear] character prep not started:", err);
        } finally {
          if (prepInFlight.current === snapshot) prepInFlight.current = null;
        }
      })();
    },
    [locale, setState, t],
  );

  const handleProtagonistNext = useCallback(() => {
    startCharacterPrep(state);
    setStep(3);
  }, [startCharacterPrep, state, setStep]);

  // ── Screen 3 → 4: create the story, land on the painting/dedication screen ──

  const handleCreate = useCallback(async () => {
    if (saving) return;
    const snapshot = storyInputSnapshot(state, locale);
    // Back → Create with nothing changed: reuse the book already being painted.
    if (state.createdStory?.snapshot === snapshot) {
      setNavigating(true);
      router.push(`/crear/${state.createdStory.id}/generar`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await ensureGuestSession();
      const name = state.character.name.trim();
      const dedication = state.dedication.trim() ? state.dedication : t("dedication.default", { name });
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character: { ...state.character, name },
          templateId: state.selectedTemplate,
          creationMode: state.mode ?? "solo",
          decisions: state.decisions,
          dedication,
          senderName: state.senderName,
          characterPrepId: state.characterPrepId ?? undefined,
          locale,
        }),
      });
      if (!res.ok) {
        console.warn("[crear] saving story failed:", res.status, await res.text().catch(() => ""));
        throw new Error("save_failed");
      }
      const { storyId } = (await res.json()) as { storyId: string };
      setState((prev) => ({ ...prev, dedication, createdStory: { id: storyId, snapshot } }));
      setNavigating(true);
      router.push(`/crear/${storyId}/generar`);
    } catch (err) {
      console.warn("[crear] create failed:", err);
      setError(t("errors.saveFailed"));
      setSaving(false);
    }
  }, [saving, state, locale, router, setState, t]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!hydrated || !prefillReady) {
    return <div className="min-h-[100dvh] bg-create-bg" />;
  }

  if (navigating) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-create-bg" role="status">
        <div className="flex flex-col items-center gap-4">
          <span aria-hidden className="material-symbols-outlined animate-spin text-5xl text-create-primary">
            progress_activity
          </span>
          <p className="text-lg font-medium text-create-text-sub">{t("preparing")}</p>
        </div>
      </div>
    );
  }

  const step = hasName ? state.currentStep : 1;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-create-bg font-sans text-create-text">
      <CreationHeader
        currentStep={step}
        onBack={goBack}
        onStepClick={onStepClick}
        canStepNavigate={canNavigate}
      />

      {step === 1 && (
        <StepName
          character={state.character}
          selectedTemplate={state.selectedTemplate}
          onUpdateCharacter={updateCharacter}
          onNext={() => hasName && setStep(2)}
        />
      )}
      {step === 2 && (
        <StepProtagonist
          character={state.character}
          protagonistMode={state.protagonistMode}
          photoPath={state.photoPath}
          onUpdateCharacter={updateCharacter}
          onSetMode={setMode}
          onPhotoChange={setPhoto}
          onNext={handleProtagonistNext}
          onBack={goBack}
        />
      )}
      {step === 3 && (
        <StepAdventure
          character={state.character}
          selectedTemplate={state.selectedTemplate}
          decisions={state.decisions}
          saving={saving}
          onSelectTemplate={setTemplate}
          onSetTreePath={setTreePath}
          onCreate={() => void handleCreate()}
          onBack={goBack}
        />
      )}

      {error && (
        <div
          role="alert"
          className="fixed bottom-24 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-lg"
        >
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label={t("errors.dismiss")} className="font-bold hover:text-red-900">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
