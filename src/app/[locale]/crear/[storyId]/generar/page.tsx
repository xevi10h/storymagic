"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import CreationHeader from "@/components/crear/CreationHeader";
import CreationFooterNav from "@/components/crear/CreationFooterNav";
import LiveCover from "@/components/crear/LiveCover";
import DedicationEditor from "@/components/crear/DedicationEditor";
import { useDedicationAutosave } from "@/hooks/useDedicationAutosave";
import { deName, patchStoredDraft } from "@/lib/creation-flow";

// Screen 4 — "Mientras se pinta": real preview progress (cover first, then
// scenes as they are painted) while the parent writes the dedication.

const POLL_INTERVAL_MS = 3000;
// A real backend failure reverts status to "draft" (handled immediately), so
// this only guards a true hang.
const STUCK_TIMEOUT_MS = 480_000; // 8 min
const SLOW_NOTICE_MS = 180_000; // 3 min: say honestly that it's taking longer

const DONE_STATUSES = new Set(["preview", "ready", "ordered", "shipped"]);

type FailureKind = "failed" | "stuck" | "rate_limited" | "network";
type GenerationPhase = "starting" | "generating" | "done" | "error";

interface PreviewProgress {
  coverUrl: string | null;
  scenes: { index: number; url: string }[];
  total: number;
}

/** Defensive parse of stories.preview_progress (written by the preview pipeline). */
function parseProgress(raw: unknown): PreviewProgress | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const scenes = Array.isArray(r.scenes)
    ? r.scenes
        .filter(
          (s): s is { index: number; url: string } =>
            !!s && typeof s === "object" &&
            typeof (s as { index?: unknown }).index === "number" &&
            typeof (s as { url?: unknown }).url === "string",
        )
        .sort((a, b) => a.index - b.index)
    : [];
  return {
    coverUrl: typeof r.coverUrl === "string" && r.coverUrl ? r.coverUrl : null,
    scenes,
    total: typeof r.total === "number" && r.total > 0 ? Math.round(r.total) : 0,
  };
}

function startedAtKey(storyId: string) {
  return `meapica_gen_started_${storyId}`;
}
function readStartedAt(storyId: string): number | null {
  try {
    const v = sessionStorage.getItem(startedAtKey(storyId));
    return v ? Number(v) || null : null;
  } catch {
    return null;
  }
}
function writeStartedAt(storyId: string, ts: number | null) {
  try {
    if (ts == null) sessionStorage.removeItem(startedAtKey(storyId));
    else sessionStorage.setItem(startedAtKey(storyId), String(ts));
  } catch {
    // storage unavailable — elapsed time restarts on reload
  }
}
function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default function GenerarPage() {
  const t = useTranslations("crear.generar");
  const locale = useLocale();
  const { storyId } = useParams<{ storyId: string }>();
  const router = useRouter();

  const [phase, setPhase] = useState<GenerationPhase>("starting");
  const [failure, setFailure] = useState<FailureKind | null>(null);
  const [progress, setProgress] = useState<PreviewProgress | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [retrying, setRetrying] = useState(false);
  const [childName, setChildName] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [finalCover, setFinalCover] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const dedication = useDedicationAutosave(storyId);
  const { init: initDedication } = dedication;

  const postInFlight = useRef(false);
  const autoPostFired = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // ── Story details (name, world, dedication) ───────────────────────────────

  const loadDetails = useCallback(async () => {
    try {
      const res = await fetch(`/api/stories/${storyId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!mountedRef.current) return;
      setChildName(data.characters?.name ?? "");
      setTemplateId(data.template_id ?? null);
      if (data.cover_image_url && DONE_STATUSES.has(data.status)) setFinalCover(data.cover_image_url);
      initDedication({ dedication: data.dedication_text ?? "", senderName: data.sender_name ?? "" });
    } catch {
      // the screen still works without it (name-less copy)
    }
  }, [storyId, initDedication]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  // ── Generation state machine (same guarantees as before: idempotent POST,
  //    409 recovery, polling decides the real outcome) ──────────────────────

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const fail = useCallback(
    (kind: FailureKind) => {
      stopPolling();
      if (!mountedRef.current) return;
      setFailure(kind);
      setPhase("error");
      setRetrying(false);
    },
    [stopPolling],
  );

  const finish = useCallback(() => {
    stopPolling();
    if (!mountedRef.current) return;
    writeStartedAt(storyId, null);
    setPhase("done");
    void loadDetails(); // real cover for the ready state
  }, [stopPolling, storyId, loadDetails]);

  const pollOnce = useCallback(async () => {
    const res = await fetch(`/api/stories/${storyId}?light=true`);
    if (!res.ok) throw new Error(`status_${res.status}`);
    const data = await res.json();
    const parsed = parseProgress(data.preview_progress);
    if (parsed && mountedRef.current) setProgress(parsed);
    return { status: data.status as string };
  }, [storyId]);

  const ensureStartedAt = useCallback(
    (reset: boolean) => {
      const ts = (reset ? null : readStartedAt(storyId)) ?? Date.now();
      writeStartedAt(storyId, ts);
      setStartedAt(ts);
    },
    [storyId],
  );

  const startPolling = useCallback(() => {
    stopPolling();
    const pollStartedAt = Date.now();
    pollIntervalRef.current = setInterval(async () => {
      if (!mountedRef.current) return;
      try {
        const { status } = await pollOnce();
        if (DONE_STATUSES.has(status)) return finish();
        // The generate route reverts to "draft" on failure; trust it only
        // once our own POST is no longer in flight.
        if (status === "draft" && !postInFlight.current) return fail("failed");
        if (Date.now() - pollStartedAt > STUCK_TIMEOUT_MS) fail("stuck");
      } catch {
        // transient network error — keep polling
      }
    }, POLL_INTERVAL_MS);
  }, [pollOnce, stopPolling, finish, fail]);

  const firePost = useCallback(
    async (allowRecoveryRetry = true): Promise<void> => {
      if (postInFlight.current) return;
      postInFlight.current = true;
      try {
        const res = await fetch(`/api/stories/${storyId}/generate`, { method: "POST" });
        postInFlight.current = false;
        if (!mountedRef.current) return;
        if (res.ok) return finish();
        if (res.status === 409 && allowRecoveryRetry) return firePost(false);
        if (res.status === 429) return fail("rate_limited");
        if (res.status === 400) return; // already generating/done elsewhere: polling decides
        fail("failed");
      } catch {
        postInFlight.current = false;
        // request cut (network/platform timeout) while the server keeps working
      }
    },
    [storyId, finish, fail],
  );

  const run = useCallback(
    async (isRetry: boolean) => {
      try {
        const { status } = await pollOnce();
        if (!mountedRef.current) return;
        if (DONE_STATUSES.has(status)) return finish();
        setFailure(null);
        setPhase("generating");
        if (status === "generating") {
          ensureStartedAt(false);
          startPolling();
          if (isRetry) void firePost();
          return;
        }
        if (status === "draft") {
          ensureStartedAt(isRetry);
          startPolling();
          if (isRetry || !autoPostFired.current) {
            autoPostFired.current = true;
            void firePost();
          }
          return;
        }
        fail("failed");
      } catch {
        fail("network");
      } finally {
        if (mountedRef.current) setRetrying(false);
      }
    },
    [pollOnce, finish, ensureStartedAt, startPolling, firePost, fail],
  );

  useEffect(() => {
    mountedRef.current = true;
    void run(false);
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [run, stopPolling]);

  useEffect(() => {
    if (phase !== "generating" && phase !== "starting") return;
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(clock);
  }, [phase]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleRetry = () => {
    setRetrying(true);
    void run(true);
  };

  /** Back to the adventure screen; the draft (and this story) are kept. */
  const handleBack = useCallback(async () => {
    await dedication.flush();
    patchStoredDraft({ currentStep: 3 }, storyId);
    router.push("/crear");
  }, [dedication, storyId, router]);

  const openBook = useCallback(async () => {
    setLeaving(true);
    await dedication.flush();
    try {
      sessionStorage.setItem("meapica_fresh_book", storyId); // one-shot reveal on the preview
    } catch {
      // private mode — reveal skipped
    }
    router.push(`/crear/${storyId}/preview`);
  }, [dedication, storyId, router]);

  const goToCreateStep = useCallback(
    async (step: number) => {
      if (step === 5 && phase === "done") return void openBook();
      if (step > 3) return;
      await dedication.flush();
      patchStoredDraft({ currentStep: step }, storyId);
      router.push("/crear");
    },
    [dedication, storyId, router, phase, openBook],
  );

  // ── Derived ───────────────────────────────────────────────────────────────

  const elapsedMs = startedAt ? now - startedAt : 0;
  const isSlow = elapsedMs > SLOW_NOTICE_MS;
  const coverUrl = finalCover ?? progress?.coverUrl ?? null;
  const total = progress?.total ?? 0;
  const scenesDone = progress?.scenes.length ?? 0;
  const done = phase === "done";
  // Determinate only with real numbers: cover counts as one step.
  const known = total > 0;
  const completed = (coverUrl ? 1 : 0) + Math.min(scenesDone, total);
  const pct = known ? Math.round((completed / (total + 1)) * 100) : null;
  const name = childName;
  const nameArgs = { name, deName: deName(name, locale) };

  // ── Error state ─────────────────────────────────────────────────────────────

  if (phase === "error") {
    const errorText =
      failure === "rate_limited"
        ? t("errorRateLimited")
        : failure === "stuck"
          ? t("errorStuck")
          : failure === "network"
            ? t("errorNetwork")
            : t("errorDefault");
    return (
      <div className="flex min-h-[100dvh] flex-col bg-create-bg">
        <CreationHeader currentStep={4} onBack={() => void handleBack()} onStepClick={(s) => void goToCreateStep(s)} canStepNavigate={(s) => s <= 3} />
        <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center" role="alert">
          <div className="max-w-md">
            <span aria-hidden className="material-symbols-outlined mb-4 text-5xl text-create-primary">
              {failure === "rate_limited" ? "schedule" : "auto_stories"}
            </span>
            <h1 className="font-display text-2xl font-bold text-create-text-dark">
              {name ? t("errorTitleNamed", nameArgs) : t("errorTitle")}
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-create-text-sub">{errorText}</p>
            <p className="mt-2 text-sm leading-relaxed text-create-text-sub">{t("errorInputSafe")}</p>
            <div className="mt-8 flex flex-col gap-3">
              <button
                type="button"
                onClick={handleRetry}
                disabled={retrying}
                className="flex items-center justify-center gap-2 rounded-full bg-create-primary px-8 py-3 text-sm font-bold text-white transition-colors hover:bg-create-primary-hover disabled:opacity-60"
              >
                <span aria-hidden className={`material-symbols-outlined text-lg ${retrying ? "animate-spin" : ""}`}>
                  {retrying ? "progress_activity" : "refresh"}
                </span>
                {t("retry")}
              </button>
              <button
                type="button"
                onClick={() => void handleBack()}
                className="rounded-full px-8 py-3 text-sm font-bold text-create-text-sub transition-colors hover:text-create-text"
              >
                {t("goBackToForm")}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Painting + dedication ─────────────────────────────────────────────────

  const statusLine = done
    ? t("statusReady")
    : coverUrl
      ? known
        ? t("statusScenes", { done: Math.min(scenesDone, total), total })
        : t("statusCoverReady")
      : t("statusStarting");

  return (
    <div className="flex min-h-[100dvh] flex-col bg-create-bg">
      <CreationHeader
        currentStep={4}
        onBack={() => void handleBack()}
        onStepClick={(s) => void goToCreateStep(s)}
        canStepNavigate={(s) => s <= 3 || (s === 5 && done)}
      />

      <main className="step-in mx-auto grid w-full max-w-[1120px] flex-1 gap-6 px-4 pb-10 pt-4 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:pt-8">
        {/* Real progress */}
        <section aria-labelledby="painting-title" className="flex flex-col gap-4">
          <div className="flex items-center gap-4 lg:flex-col lg:items-stretch lg:gap-5">
            <div className="relative w-[112px] shrink-0 sm:w-[150px] lg:mx-auto lg:w-[340px]" data-testid="progress-cover">
              <LiveCover name={name} templateId={templateId} imageUrl={coverUrl} sizes="(max-width:1024px) 150px, 340px" />
              {!coverUrl && (
                <span className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-create-text shadow-sm lg:inset-x-auto lg:left-1/2 lg:-translate-x-1/2 lg:px-3 lg:text-xs">
                  <span aria-hidden className="material-symbols-outlined animate-spin text-sm text-create-primary">progress_activity</span>
                  <span className="truncate">{t("paintingCover")}</span>
                </span>
              )}
            </div>
            <div className="min-w-0 lg:text-center">
              <h1 id="painting-title" className="font-display text-xl font-bold leading-tight text-create-text-dark sm:text-2xl lg:text-3xl">
                {done ? t("readyTitle", nameArgs) : name ? t("paintingTitle", nameArgs) : t("paintingTitleNoName")}
              </h1>
              <p className="mt-1 text-sm text-create-text-sub" aria-live="polite" data-testid="progress-status">
                {statusLine}
              </p>
            </div>
          </div>

          {!done && (
            <div className="rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(58,36,24,.08)]">
              {known ? (
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct ?? 0}
                  aria-label={t("progressLabel")}
                  className="h-2 w-full overflow-hidden rounded-full bg-create-neutral"
                >
                  <div className="h-full rounded-full bg-create-primary transition-[width] duration-700" style={{ width: `${pct}%` }} />
                </div>
              ) : (
                <div role="progressbar" aria-label={t("progressLabel")} aria-valuetext={t("statusStarting")} className="h-2 w-full overflow-hidden rounded-full bg-create-neutral">
                  <div className="progress-indeterminate h-full w-1/3 rounded-full bg-create-primary/70" />
                </div>
              )}
              <div className="mt-2 flex items-center justify-between text-xs tabular-nums text-create-text-sub">
                <span>{isSlow ? t("slowMessage") : t("waitMessage")}</span>
                <span>{formatElapsed(elapsedMs)}</span>
              </div>

              {known && (
                <ol className="mt-3 grid grid-cols-4 gap-2" aria-label={t("scenesLabel")} data-testid="progress-scenes">
                  {Array.from({ length: total }, (_, i) => {
                    const scene = progress?.scenes[i];
                    return (
                      <li key={i} className="relative aspect-square overflow-hidden rounded-lg bg-create-neutral">
                        {scene ? (
                          <Image src={scene.url} alt={t("sceneAlt", { n: i + 1 })} fill sizes="120px" className="cover-art-in object-cover" />
                        ) : (
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-create-text-sub/50">{i + 1}</span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          )}
          {done && (
            <button
              type="button"
              onClick={() => void openBook()}
              className="hidden items-center justify-center gap-2 rounded-full bg-create-primary px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-create-primary/25 transition-colors hover:bg-create-primary-hover lg:flex"
            >
              {t("viewBook", nameArgs)}
              <span aria-hidden className="material-symbols-outlined text-lg">arrow_forward</span>
            </button>
          )}
        </section>

        {/* Dedication */}
        <section aria-labelledby="dedication-title" className="flex flex-col gap-3">
          <div>
            <h2 id="dedication-title" className="font-display text-xl font-bold text-create-text-dark sm:text-2xl">
              {t("dedicationTitle")}
            </h2>
            <p className="mt-1 text-sm text-create-text-sub">{t("dedicationSubtitle")}</p>
          </div>
          {dedication.values ? (
            <DedicationEditor
              name={name}
              dedication={dedication.values.dedication}
              senderName={dedication.values.senderName}
              saveState={dedication.saveState}
              onChange={dedication.update}
            />
          ) : (
            <div className="h-64 animate-pulse rounded-2xl bg-white/70" aria-hidden />
          )}
        </section>
      </main>

      <CreationFooterNav
        onBack={() => void handleBack()}
        onNext={() => void openBook()}
        nextLabel={t("viewBookShort")}
        nextDisabled={!done}
        nextLoading={leaving}
        nextDisabledTooltip={t("waitHint")}
      />
    </div>
  );
}
