"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { STORAGE_KEY } from "@/hooks/usePersistedState";
import CreationHeader from "@/components/crear/CreationHeader";

// ── Constants ──────────────────────────────────────────────────────────────

const WHIMSICAL_MESSAGE_KEYS = [
  { key: "backpack", icon: "backpack" },
  { key: "palette", icon: "palette" },
  { key: "autoStories", icon: "auto_stories" },
  { key: "groups", icon: "groups" },
  { key: "star", icon: "star" },
  { key: "forest", icon: "forest" },
  { key: "brush", icon: "brush" },
  { key: "inkPen", icon: "ink_pen" },
  { key: "menuBook", icon: "menu_book" },
  { key: "autoAwesome", icon: "auto_awesome" },
];

const POLL_INTERVAL_MS = 3000;
// The generation pipeline saves generated_text only at the END of the request
// (architect → refs → screenplay → previews → cover, ~4-5 min), so "no text yet"
// is normal for the whole run. A real backend failure reverts status to "draft"
// (handled immediately), so this only guards a true hang.
const STUCK_TIMEOUT_MS = 480_000; // 8 min
// After this, tell the parent honestly that it's taking longer than usual.
const SLOW_NOTICE_MS = 360_000; // 6 min
// Progress curve time constant: ~80% at 5 min, keeps creeping up afterwards,
// never reaches the cap until a real milestone arrives.
const PROGRESS_TAU_S = 190;
const PROGRESS_TIME_CAP = 92;
const PROGRESS_TEXT_READY = 96;

const DONE_STATUSES = new Set(["preview", "ready", "ordered", "shipped"]);

/** Parent-facing failure kinds. Raw backend/provider text is never shown. */
type FailureKind = "failed" | "stuck" | "rate_limited" | "network";

type GenerationPhase = "starting" | "generating" | "done" | "error";

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
    // storage unavailable — elapsed time just restarts on reload
  }
}

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function GenerarPage() {
  const t = useTranslations("crear.generar");
  const td = useTranslations("data");
  const { storyId } = useParams<{ storyId: string }>();
  const router = useRouter();

  const [phase, setPhase] = useState<GenerationPhase>("starting");
  const [failure, setFailure] = useState<FailureKind | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [textReady, setTextReady] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [childName, setChildName] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);

  const postInFlight = useRef(false);
  // Guards the automatic first POST against effect re-runs (StrictMode, remounts).
  const autoPostFired = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // ── Helpers ───────────────────────────────────────────────────────────────

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
    // The story exists and is viewable → the creation draft is no longer needed.
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    writeStartedAt(storyId, null);
    // Flag the preview to play the one-shot "book is born" reveal
    try {
      sessionStorage.setItem("meapica_fresh_book", storyId);
    } catch {
      // storage unavailable (private mode) — reveal is skipped, no harm
    }
    setPhase("done");
    router.replace(`/crear/${storyId}/preview`);
  }, [router, storyId, stopPolling]);

  const pollOnce = useCallback(async (): Promise<{ status: string; hasText: boolean }> => {
    // ?light=true skips the expensive JOINs; polling only needs status + text presence.
    const res = await fetch(`/api/stories/${storyId}?light=true`);
    if (!res.ok) throw new Error(`status_${res.status}`);
    const data = await res.json();
    return { status: data.status as string, hasText: !!data.generated_text };
  }, [storyId]);

  const ensureStartedAt = useCallback(
    (reset: boolean) => {
      const existing = reset ? null : readStartedAt(storyId);
      const ts = existing ?? Date.now();
      writeStartedAt(storyId, ts);
      setStartedAt(ts);
    },
    [storyId],
  );

  // Poll until the story reaches `preview` (or fails / hangs)
  const startPolling = useCallback(() => {
    stopPolling();
    const pollStartedAt = Date.now();
    pollIntervalRef.current = setInterval(async () => {
      if (!mountedRef.current) return;
      try {
        const { status, hasText } = await pollOnce();
        if (DONE_STATUSES.has(status)) {
          finish();
          return;
        }
        if (hasText) setTextReady(true);
        // The generate route reverts to "draft" when it fails — only trust this
        // when our own POST is no longer in flight (avoids a race right after
        // retry, before the route has claimed draft → generating).
        if (status === "draft" && !postInFlight.current) {
          fail("failed");
          return;
        }
        if (Date.now() - pollStartedAt > STUCK_TIMEOUT_MS) {
          fail("stuck");
        }
      } catch {
        // Transient network error — keep polling
      }
    }, POLL_INTERVAL_MS);
  }, [pollOnce, stopPolling, finish, fail]);

  /**
   * Fire POST /generate on this SAME storyId. The route only claims `draft`
   * stories; on failure it reverts to `draft`, so retrying is always safe.
   * 409 = it recovered a crashed run back to draft → fire once more.
   */
  const firePost = useCallback(
    async (allowRecoveryRetry = true): Promise<void> => {
      if (postInFlight.current) return;
      postInFlight.current = true;
      try {
        const res = await fetch(`/api/stories/${storyId}/generate`, { method: "POST" });
        postInFlight.current = false;
        if (!mountedRef.current) return;
        if (res.ok) {
          finish();
          return;
        }
        if (res.status === 409 && allowRecoveryRetry) {
          await firePost(false);
          return;
        }
        if (res.status === 429) {
          fail("rate_limited");
          return;
        }
        if (res.status === 400) {
          // Not in draft (already generating from another tab / already done):
          // let polling decide.
          return;
        }
        fail("failed");
      } catch {
        postInFlight.current = false;
        // The request may have been cut (network, platform timeout) while the
        // server keeps working — polling decides the real outcome.
      }
    },
    [storyId, finish, fail],
  );

  /** Check the current DB state and start/resume/redirect accordingly. */
  const run = useCallback(
    async (isRetry: boolean) => {
      try {
        const { status, hasText } = await pollOnce();
        if (!mountedRef.current) return;

        if (DONE_STATUSES.has(status)) {
          finish();
          return;
        }

        setFailure(null);
        setPhase("generating");
        setTextReady(hasText);

        if (status === "generating") {
          // A run is already in progress (reload / other tab) → just follow it.
          // On an explicit retry also POST: if that run crashed (>5 min idle) the
          // route recovers it to draft (409) and firePost re-claims it; if it's
          // still alive the route answers 400 and we keep following it.
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

  // ── Mount ────────────────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    void run(false);
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [run, stopPolling]);

  // Child name + chosen world for the wait screen (one full fetch).
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stories/${storyId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setChildName(data.characters?.name ?? null);
        setTemplateId(data.template_id ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [storyId]);

  // ── Tickers (messages + clock) ───────────────────────────────────────────

  useEffect(() => {
    if (phase !== "generating" && phase !== "starting") return;
    const msg = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % WHIMSICAL_MESSAGE_KEYS.length);
    }, 3500);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(msg);
      clearInterval(clock);
    };
  }, [phase]);

  const handleRetry = () => {
    setRetrying(true);
    void run(true);
  };

  // "Volver" → the creation form, still filled (draft is kept until preview).
  const handleBack = () => router.push("/crear");

  // ── Derived ──────────────────────────────────────────────────────────────

  const elapsedMs = startedAt ? now - startedAt : 0;
  const timeProgress = PROGRESS_TIME_CAP * (1 - Math.exp(-elapsedMs / 1000 / PROGRESS_TAU_S));
  const progress = Math.max(3, textReady ? Math.max(timeProgress, PROGRESS_TEXT_READY) : timeProgress);
  const isSlow = elapsedMs > SLOW_NOTICE_MS;

  const worldKey = templateId ? `templates.${templateId}.title` : null;
  const worldName = worldKey && td.has(worldKey as Parameters<typeof td.has>[0])
    ? td(worldKey as Parameters<typeof td>[0])
    : null;

  const currentMessage = WHIMSICAL_MESSAGE_KEYS[messageIndex];

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === "done") {
    return null; // redirect in flight
  }

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
        <CreationHeader rightAction="none" />
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <div className="max-w-md">
            <div className="mb-6 inline-flex h-24 w-24 items-center justify-center rounded-full bg-amber-100">
              <span className="material-symbols-outlined text-5xl text-amber-600">
                {failure === "rate_limited" ? "schedule" : "auto_stories"}
              </span>
            </div>
            <h1 className="font-display text-2xl font-bold text-secondary">
              {childName ? t("errorTitleNamed", { name: childName }) : t("errorTitle")}
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-text-muted">{errorText}</p>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">{t("errorInputSafe")}</p>
            <div className="mt-8 flex flex-col gap-3">
              <button
                type="button"
                onClick={handleRetry}
                disabled={retrying}
                className="flex items-center justify-center gap-2 rounded-full bg-create-primary px-8 py-3 text-sm font-bold text-white transition-all hover:bg-create-primary-hover disabled:opacity-60"
              >
                <span className={`material-symbols-outlined text-lg ${retrying ? "animate-spin" : ""}`}>
                  {retrying ? "progress_activity" : "refresh"}
                </span>
                {t("retry")}
              </button>
              <button
                type="button"
                onClick={handleBack}
                className="rounded-full px-8 py-3 text-sm font-bold text-text-muted transition-colors hover:text-text-main"
              >
                {t("goBackToForm")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── starting + generating: wait screen ───────────────────────────────────
  return (
    <div className="flex min-h-[100dvh] flex-col bg-create-bg relative overflow-hidden">
      <CreationHeader rightAction="none" />
      {/* Background star pattern */}
      <div className="absolute inset-0 create-star-pattern opacity-30 pointer-events-none" />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
        <div className="max-w-lg w-full">
          {/* Animated icon */}
          <div className="mb-8 relative inline-block">
            <div className="inline-flex h-32 w-32 items-center justify-center rounded-full bg-white shadow-lg shadow-create-primary/10">
              <span className="material-symbols-outlined text-7xl text-create-primary animate-pulse">
                {currentMessage.icon}
              </span>
            </div>
            <div className="absolute -top-2 -right-4 animate-create-float">
              <span className="material-symbols-outlined text-2xl text-create-gold opacity-60">star</span>
            </div>
            <div className="absolute top-4 -left-6 animate-create-float-delay-2">
              <span className="material-symbols-outlined text-lg text-indigo-400 opacity-50">star</span>
            </div>
          </div>

          {/* Title: child's name + chosen world */}
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-secondary">
            {childName ? t("creatingStoryFor", { name: childName }) : t("creatingStory")}
          </h1>
          {worldName && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-sm font-semibold text-create-primary shadow-sm">
              <span className="material-symbols-outlined text-base">public</span>
              {worldName}
            </p>
          )}

          {/* Rotating message */}
          <div className="mt-4 min-h-8">
            <p key={messageIndex} className="text-base text-text-muted animate-fade-in">
              {t(`messages.${currentMessage.key}` as Parameters<typeof t>[0])}
            </p>
          </div>

          {/* Progress bar: time-based asymptotic curve + real milestones */}
          <div className="mt-6 w-full max-w-sm mx-auto">
            <div
              className="rounded-full bg-create-neutral h-3 w-full overflow-hidden shadow-inner"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
              aria-label={t("progressLabel")}
            >
              <div
                className="h-full rounded-full bg-create-primary transition-all duration-1000 ease-linear"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-text-muted tabular-nums">
              <span>{textReady ? t("milestoneFinishing") : t("milestoneWriting")}</span>
              <span>{formatElapsed(elapsedMs)}</span>
            </div>
          </div>

          {/* Honest estimate */}
          <p className="mt-8 text-sm text-text-muted leading-relaxed max-w-sm mx-auto">
            {isSlow ? t("slowMessage") : t("waitMessage")}
          </p>
        </div>
      </div>
    </div>
  );
}
