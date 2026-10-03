"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { normaliseHairstyle } from "@/lib/avatar/manifest";
import {
  GLASSES_OPTIONS,
  INITIAL_STATE,
  type CharacterData,
  type CreateBookState,
  type Gender,
  type ProtagonistMode,
  type TreeChoice,
} from "@/lib/create-store";
import {
  CREATE_PAGE_STEPS,
  MAX_NAME_LENGTH,
  characterPrepareBody,
  firstName,
  migrateCreateState,
  storyCharacterBody,
  protagonistSnapshot,
  readStoredDraft,
  storyInputSnapshot,
} from "@/lib/creation-flow";
import { usePersistedState, STORAGE_KEY } from "@/hooks/usePersistedState";
import { ensureGuestSession } from "@/lib/guest-session";
import { isCaptchaError } from "@/lib/captcha/turnstile";
import CreationHeader from "@/components/create/CreationHeader";
import StepName from "@/components/create/StepName";
import { formatChildName } from "@/lib/child-name";
import StepProtagonist from "@/components/create/StepProtagonist";
import StepAdventure from "@/components/create/StepAdventure";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { Spinner } from "@/components/ui/Spinner";
import { trackEvent } from "@/lib/tracking/consent";
import { capturePosthog } from "@/lib/tracking/posthog";

const CREATE_STEP_NAMES = ["name", "protagonist", "adventure"] as const;

/** POST /api/stories answers in < 1 s; past this the connection is considered stalled. */
const CREATE_TIMEOUT_MS = 30_000;

export default function CrearPage() {
  return (
    <Suspense>
      <CrearPageContent />
    </Suspense>
  );
}

function CrearPageContent() {
  const t = useTranslations("crear");
  const tAuth = useTranslations("auth");
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
  /** The error came from creating the book: the alert offers a retry. */
  const [createFailed, setCreateFailed] = useState(false);

  // Entry links can pre-fill the draft: ?template= (catalog/SEO: world pre-chosen),
  // ?characterId= (dashboard: reuse a saved character) and ?name= (landing hero:
  // the name typed on the live cover). Hold rendering until applied so a stale
  // draft never flashes.
  // useSearchParams, not window.location: on a client-side <Link>/router.push the
  // URL is not committed yet on the first render of this page.
  const searchParams = useSearchParams();
  const [prefillReady, setPrefillReady] = useState(
    () => !searchParams.has("template") && !searchParams.has("characterId") && !searchParams.has("name"),
  );
  const prefillApplied = useRef(false);
  useEffect(() => {
    if (prefillApplied.current || prefillReady) return;
    prefillApplied.current = true;
    const p = searchParams;
    const templateParam = p.get("template");
    const characterIdParam = p.get("characterId");
    const nameParam = formatChildName((p.get("name") ?? "").slice(0, MAX_NAME_LENGTH));

    // ?name= alone: same child as the saved draft → resume it; empty → nothing to apply.
    if (!templateParam && !characterIdParam) {
      const draft = readStoredDraft();
      if (!nameParam || (draft && formatChildName(draft.character.name) === nameParam)) {
        router.replace("/create");
        setPrefillReady(true);
        return;
      }
    }

    void (async () => {
      let character: CharacterData = nameParam ? { ...INITIAL_STATE.character, name: nameParam } : INITIAL_STATE.character;
      // A saved character carries its own age/gender; anything else asks for them on screen 1.
      const basicsConfirmed = { ...INITIAL_STATE.basicsConfirmed };
      if (characterIdParam) {
        try {
          const res = await fetch(`/api/characters/${characterIdParam}`);
          if (res.ok) {
            const { character: ch } = await res.json();
            basicsConfirmed.age = typeof ch.age === "number";
            basicsConfirmed.gender = ch.gender === "boy" || ch.gender === "girl" || ch.gender === "neutral";
            character = {
              ...INITIAL_STATE.character,
              name: formatChildName(ch.name ?? ""),
              gender: ch.gender ?? "boy",
              age: ch.age ?? 6,
              hairColor: ch.hair_color ?? INITIAL_STATE.character.hairColor,
              eyeColor: ch.eye_color ?? INITIAL_STATE.character.eyeColor,
              skinTone: ch.skin_tone ?? INITIAL_STATE.character.skinTone,
              hairstyle: ch.hairstyle ?? "short",
              glasses: GLASSES_OPTIONS.includes(ch.glasses) ? ch.glasses : "none",
              freckles: ch.freckles === true,
              interests: ch.interests ?? [],
              city: ch.city ?? "",
              favoriteColor: ch.favorite_color ?? "",
            };
          }
        } catch {
          // ignore — the parent types it in
        }
      }
      setState({
        ...INITIAL_STATE,
        character,
        basicsConfirmed,
        selectedTemplate: templateParam ?? null,
        // A saved character is complete (skip to step 2); a typed name still needs age + gender.
        currentStep: characterIdParam && character.name.trim() && basicsConfirmed.age && basicsConfirmed.gender ? 2 : 1,
      });
      // Clean URL so a reload resumes the draft instead of re-applying the prefill
      router.replace("/create");
      setPrefillReady(true);
    })();
  }, [prefillReady, setState, router, searchParams]);

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
  // Screen 1 is complete only with a name and an explicit age + gender (never defaults).
  const basicsDone = hasName && state.basicsConfirmed.age && state.basicsConfirmed.gender;
  const canNavigate = useCallback(
    (step: number) => {
      if (step === 1) return true;
      if (step === 2 || step === 3) return basicsDone;
      // Screens 4–6 exist once the book was created from this exact draft
      return !!state.createdStory && state.createdStory.snapshot === storyInputSnapshot(state, locale);
    },
    [basicsDone, state, locale],
  );
  const onStepClick = useCallback(
    (step: number) => {
      if (!canNavigate(step)) return;
      if (step <= CREATE_PAGE_STEPS) setStep(step);
      else if (state.createdStory) router.push(`/create/${state.createdStory.id}/generate`);
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

  // Funnel step for PostHog (no-op without analytics consent).
  useEffect(() => {
    if (hydrated) capturePosthog("create_step", { step: state.currentStep, step_name: CREATE_STEP_NAMES[state.currentStep - 1] });
  }, [state.currentStep, hydrated]);

  // ── State updaters ─────────────────────────────────────────────────────────

  const updateCharacter = useCallback(
    (updates: Partial<CharacterData>) => {
      setState((prev) => {
        const character = { ...prev.character, ...updates };
        // Keep the hairstyle valid for the chosen gender (and rendered in the avatar matrix)
        if (updates.gender) character.hairstyle = normaliseHairstyle(updates.gender, character.hairstyle);
        return { ...prev, character };
      });
    },
    [setState],
  );

  const pickAge = useCallback(
    (age: number) => {
      updateCharacter({ age });
      setState((prev) => ({ ...prev, basicsConfirmed: { ...prev.basicsConfirmed, age: true } }));
    },
    [updateCharacter, setState],
  );
  const pickGender = useCallback(
    (gender: Gender) => {
      updateCharacter({ gender });
      setState((prev) => ({ ...prev, basicsConfirmed: { ...prev.basicsConfirmed, gender: true } }));
    },
    [updateCharacter, setState],
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
    (templateId: string) => {
      trackEvent("ViewContent", { content_ids: [templateId], content_type: "product" });
      setState((prev) =>
        prev.selectedTemplate === templateId
          ? prev
          : { ...prev, selectedTemplate: templateId, decisions: {}, ending: null },
      );
    },
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
      void (async () => {
        try {
          await ensureGuestSession({ prompt: tAuth("captcha.prompt"), cancel: tAuth("captcha.cancel"), locale });
          const res = await fetch("/api/characters/prepare", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // Same look payload as POST /api/stories (characterLookPayload), so the
            // generate route can reuse this sheet.
            body: JSON.stringify(characterPrepareBody(snapshotState)),
          });
          if (res.status === 410) {
            // The photo was already used and deleted — ask for it again.
            setState((prev) => ({ ...prev, photoPath: null }));
            setCreateFailed(false);
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
          console.warn("[create] character prep not started:", err);
        } finally {
          if (prepInFlight.current === snapshot) prepInFlight.current = null;
        }
      })();
    },
    [setState, t, tAuth, locale],
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
      router.push(`/create/${state.createdStory.id}/generate`);
      return;
    }
    setSaving(true);
    setError(null);
    setCreateFailed(false);
    try {
      await ensureGuestSession({ prompt: tAuth("captcha.prompt"), cancel: tAuth("captcha.cancel"), locale });
      const name = state.character.name.trim();
      // Pre-filled, editable on the next screen; addressed to the first name only.
      const dedication = state.dedication.trim() ? state.dedication : t("dedication.default", { name: firstName(name) });
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Normally < 1 s. A stalled connection must end in the retry alert, never an
        // endless spinner; the server reuses the draft if the first try landed anyway.
        signal: AbortSignal.timeout(CREATE_TIMEOUT_MS),
        body: JSON.stringify({
          ...storyCharacterBody(state),
          templateId: state.selectedTemplate,
          creationMode: state.mode ?? "solo",
          decisions: state.decisions,
          dedication,
          senderName: state.senderName,
          // Only a prep made for this exact look (the server re-checks the Bible hash anyway).
          characterPrepId:
            state.characterPrepId && state.characterPrepSnapshot === protagonistSnapshot(state)
              ? state.characterPrepId
              : undefined,
          locale,
        }),
      });
      if (!res.ok) {
        console.warn("[create] saving story failed:", res.status, await res.text().catch(() => ""));
        throw new Error("save_failed");
      }
      const { storyId } = (await res.json()) as { storyId: string };
      setState((prev) => ({ ...prev, dedication, createdStory: { id: storyId, snapshot } }));
      setNavigating(true);
      router.push(`/create/${storyId}/generate`);
    } catch (err) {
      console.warn("[create] create failed:", err);
      setError(isCaptchaError(err) ? t("errors.captchaFailed") : t("errors.saveFailed"));
      setCreateFailed(true);
      setSaving(false);
    }
  }, [saving, state, locale, router, setState, t, tAuth]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!hydrated || !prefillReady) {
    return <div className="min-h-[100dvh] bg-create-bg" />;
  }

  if (navigating) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-create-bg px-4">
        <BrandLoader size="lg" caption={t("preparing")} />
      </div>
    );
  }

  const step = basicsDone ? state.currentStep : 1;

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
          basicsConfirmed={state.basicsConfirmed}
          selectedTemplate={state.selectedTemplate}
          onUpdateCharacter={updateCharacter}
          onPickAge={pickAge}
          onPickGender={pickGender}
          onNext={() => {
            if (!basicsDone) return;
            // Enter submits without a blur: normalise here too (lib/child-name)
            updateCharacter({ name: formatChildName(state.character.name) });
            setStep(2);
          }}
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
          <div className="flex-1">
            <p>{error}</p>
            {createFailed && (
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={saving}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
              >
                {saving ? (
                  <Spinner className="text-base" />
                ) : (
                  <span aria-hidden className="material-symbols-outlined text-base">refresh</span>
                )}
                {t("errors.retry")}
              </button>
            )}
          </div>
          <button type="button" onClick={() => { setError(null); setCreateFailed(false); }} aria-label={t("errors.dismiss")} className="font-bold hover:text-red-900">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
