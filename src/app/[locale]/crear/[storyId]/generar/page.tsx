"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
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
const STUCK_TIMEOUT_MS = 180_000; // 3 minutes without text = stuck
const ILLUSTRATION_TIMEOUT_MS = 360_000; // 6 minutes for illustrations (12 images)
const AUTO_CONFIRM_SECONDS = 30;

// ── Types ──────────────────────────────────────────────────────────────────

// Phase flow:
//   starting → generating_text → picking_title → done
//                                      ↓ (illustrations finish while picking)
//   Any phase → error
type GenerationPhase =
  | "starting"            // mount: check DB state
  | "generating_text"     // POST fired, polling for generated_text
  | "picking_title"       // generated_text ready, title picker shown
  | "done"                // status === "preview" → redirect
  | "error";

// ── Component ──────────────────────────────────────────────────────────────

export default function GenerarPage() {
  const t = useTranslations("crear.generar");
  const { storyId } = useParams<{ storyId: string }>();
  const router = useRouter();

  const [phase, setPhase] = useState<GenerationPhase>("starting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  // Title picker state
  const [titleOptions, setTitleOptions] = useState<string[]>([]);
  const [selectedTitle, setSelectedTitle] = useState<string>("");
  const [customTitle, setCustomTitle] = useState<string>("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [titleConfirmed, setTitleConfirmed] = useState(false);
  const [illustrationsDone, setIllustrationsDone] = useState(false);
  const [autoConfirmSeconds, setAutoConfirmSeconds] = useState(AUTO_CONFIRM_SECONDS);
  const [autoConfirmPaused, setAutoConfirmPaused] = useState(false);

  // Refs for cleanup + guards
  const postFired = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoConfirmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseStartedAt = useRef<number>(Date.now());
  const mountedRef = useRef(true);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const stopAutoConfirm = useCallback(() => {
    if (autoConfirmIntervalRef.current) {
      clearInterval(autoConfirmIntervalRef.current);
      autoConfirmIntervalRef.current = null;
    }
  }, []);

  const resetAutoConfirm = useCallback(() => {
    setAutoConfirmSeconds(AUTO_CONFIRM_SECONDS);
  }, []);

  const initializeTitlePicker = useCallback((data: {
    title?: string;
    generated_text?: { titleOptions?: string[]; bookTitle?: string };
  }) => {
    const options = data.generated_text?.titleOptions ?? [];
    const fallback = data.generated_text?.bookTitle ?? "";
    const normalized = options.length > 0 ? options.slice(0, 4) : [fallback].filter(Boolean);
    setTitleOptions(normalized);
    // Use the already-saved title (first option saved by generate route) as default selection
    setSelectedTitle(data.title ?? normalized[0] ?? "");
  }, []);

  const confirmTitle = useCallback(async (titleToSave: string) => {
    if (savingTitle || titleConfirmed || !titleToSave.trim()) return;
    setSavingTitle(true);
    stopAutoConfirm();

    try {
      await fetch(`/api/stories/${storyId}/title`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleToSave.trim() }),
      });
      // We don't fail the flow if PATCH fails — the default title is already saved
    } finally {
      if (mountedRef.current) {
        setSavingTitle(false);
        setTitleConfirmed(true);
      }
    }
  }, [savingTitle, titleConfirmed, storyId, stopAutoConfirm]);

  // ── Polling logic ─────────────────────────────────────────────────────────

  const pollOnce = useCallback(async (): Promise<{
    status: string;
    hasText: boolean;
    data: Record<string, unknown>;
  }> => {
    // Use ?light=true to skip expensive JOINs (characters, illustrations).
    // Polling only needs status + generated_text presence.
    const res = await fetch(`/api/stories/${storyId}?light=true`);
    if (!res.ok) throw new Error("Failed to fetch story status");
    const data = await res.json();
    return {
      status: data.status as string,
      hasText: !!data.generated_text,
      data,
    };
  }, [storyId]);

  // Poll until status === "preview" (with timeout to avoid infinite hang)
  const startPollingForDone = useCallback(() => {
    stopPolling();
    const startedAt = Date.now();
    pollIntervalRef.current = setInterval(async () => {
      if (!mountedRef.current) return;
      try {
        const { status } = await pollOnce();
        if (status === "preview" || status === "ready" || status === "ordered" || status === "shipped") {
          stopPolling();
          if (mountedRef.current) setIllustrationsDone(true);
          return;
        }
        // Timeout: illustrations took too long
        if (Date.now() - startedAt > ILLUSTRATION_TIMEOUT_MS) {
          stopPolling();
          if (mountedRef.current) {
            setErrorMessage(t("errorStuck"));
            setPhase("error");
          }
        }
      } catch {
        // Transient network error — keep polling
      }
    }, POLL_INTERVAL_MS);
  }, [pollOnce, stopPolling, t]);

  // Poll until generated_text appears in DB
  const startPollingForText = useCallback(() => {
    stopPolling();
    phaseStartedAt.current = Date.now();

    pollIntervalRef.current = setInterval(async () => {
      if (!mountedRef.current) return;
      try {
        const { status, hasText, data } = await pollOnce();

        // Story completed while we were polling
        if (status === "preview" || status === "ready" || status === "ordered" || status === "shipped") {
          stopPolling();
          if (mountedRef.current) {
            if (hasText) initializeTitlePicker(data as never);
            setIllustrationsDone(true);
            setPhase("picking_title");
          }
          return;
        }

        // Text is now available — switch to title picker
        if (hasText && status === "generating") {
          stopPolling();
          if (mountedRef.current) {
            initializeTitlePicker(data as never);
            setPhase("picking_title");
            startPollingForDone();
          }
          return;
        }

        // Status reverted to "draft" = generation failed on the backend
        // (catch handler reverts status to "draft" on error)
        if (status === "draft") {
          stopPolling();
          if (mountedRef.current) {
            setErrorMessage(t("errorDefault"));
            setPhase("error");
          }
          return;
        }

        // Stuck detection: 3 minutes with no text
        if (Date.now() - phaseStartedAt.current > STUCK_TIMEOUT_MS) {
          stopPolling();
          if (mountedRef.current) {
            setErrorMessage(t("errorStuck"));
            setPhase("error");
          }
        }
      } catch {
        // Transient error — keep polling
      }
    }, POLL_INTERVAL_MS);
  }, [pollOnce, stopPolling, initializeTitlePicker, startPollingForDone, t]);

  // ── Mount: check initial state ────────────────────────────────────────────

  const checkAndStart = useCallback(async () => {
    try {
      const { status, hasText, data } = await pollOnce();

      if (!mountedRef.current) return;

      // Already done — redirect immediately
      if (status === "preview" || status === "ready" || status === "ordered" || status === "shipped") {
        router.replace(`/crear/${storyId}/preview`);
        return;
      }

      // Text is ready, illustrations still in progress
      if (status === "generating" && hasText) {
        initializeTitlePicker(data as never);
        setPhase("picking_title");
        startPollingForDone();
        return;
      }

      // Generating but no text — POST may still be running, or stuck from a previous crash.
      if (status === "generating" && !hasText) {
        setPhase("generating_text");
        startPollingForText();
        return;
      }

      // Draft: fire generation POST
      if (status === "draft") {
        if (postFired.current) return;
        postFired.current = true;
        setPhase("generating_text");

        // Fire POST (don't await body — we poll independently for progress)
        fetch(`/api/stories/${storyId}/generate`, { method: "POST" })
          .then(async (res) => {
            if (!mountedRef.current) return;
            if (!res.ok) {
              // POST returned error — show error state
              const body = await res.json().catch(() => ({}));
              if (mountedRef.current) {
                setErrorMessage(body.details || body.error || t("errorDefault"));
                setPhase("error");
              }
            }
            // On success: the poll already detected status=preview — no action needed
          })
          .catch((err) => {
            if (mountedRef.current) {
              setErrorMessage(err instanceof Error ? err.message : t("errorDefault"));
              setPhase("error");
            }
          });

        // Start polling for text (independent of POST)
        startPollingForText();
        return;
      }

      // Unexpected status
      setErrorMessage(t("errorDefault"));
      setPhase("error");
    } catch (err) {
      if (mountedRef.current) {
        setErrorMessage(err instanceof Error ? err.message : t("errorDefault"));
        setPhase("error");
      }
    }
  }, [pollOnce, router, storyId, initializeTitlePicker, startPollingForText, startPollingForDone, t]);

  useEffect(() => {
    mountedRef.current = true;
    checkAndStart();
    return () => {
      mountedRef.current = false;
      stopPolling();
      stopAutoConfirm();
    };
  }, [checkAndStart, stopPolling, stopAutoConfirm]);

  // ── Whimsical message rotation (during generating_text phase) ─────────────

  useEffect(() => {
    if (phase !== "generating_text" && phase !== "starting") return;
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % WHIMSICAL_MESSAGE_KEYS.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [phase]);

  // ── Progress bar (during generating_text) ────────────────────────────────

  useEffect(() => {
    if (phase !== "generating_text" && phase !== "starting") return;
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 85) return prev;
        return prev + (85 - prev) * 0.03;
      });
    }, 500);
    return () => clearInterval(interval);
  }, [phase]);

  // ── Auto-confirm countdown (during picking_title) ────────────────────────

  useEffect(() => {
    if (phase !== "picking_title" || titleConfirmed || autoConfirmPaused) return;

    autoConfirmIntervalRef.current = setInterval(() => {
      setAutoConfirmSeconds((prev) => {
        if (prev <= 1) {
          // Time's up — auto-confirm with currently selected title
          const titleToUse = customTitle.trim() || selectedTitle;
          if (titleToUse) confirmTitle(titleToUse);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => stopAutoConfirm();
  }, [phase, titleConfirmed, autoConfirmPaused, confirmTitle, customTitle, selectedTitle, stopAutoConfirm]);

  // ── Redirect when illustrations done + title confirmed ───────────────────

  useEffect(() => {
    if (illustrationsDone) {
      // If title not yet confirmed, auto-confirm default before redirecting
      if (!titleConfirmed) {
        const titleToUse = customTitle.trim() || selectedTitle;
        confirmTitle(titleToUse).then(() => {
          if (mountedRef.current) {
            setPhase("done");
            router.replace(`/crear/${storyId}/preview`);
          }
        });
      } else {
        setPhase("done");
        router.replace(`/crear/${storyId}/preview`);
      }
    }
  }, [illustrationsDone, titleConfirmed, customTitle, selectedTitle, confirmTitle, router, storyId]);

  const currentMessage = WHIMSICAL_MESSAGE_KEYS[messageIndex];
  const effectiveTitle = customTitle.trim() || selectedTitle;

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === "done") {
    return null; // redirect in flight
  }

  if (phase === "error") {
    return (
      <div className="flex min-h-screen flex-col bg-create-bg">
        <CreationHeader rightAction="none" />
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <div className="max-w-md">
            <div className="mb-6 inline-flex h-24 w-24 items-center justify-center rounded-full bg-red-100">
              <span className="material-symbols-outlined text-5xl text-red-500">error</span>
            </div>
            <h1 className="font-display text-2xl font-bold text-secondary">{t("errorTitle")}</h1>
            <p className="mt-4 text-sm leading-relaxed text-text-muted">
              {errorMessage || t("errorDefault")}
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <Link href="/crear" className="rounded-full bg-create-primary px-8 py-3 text-sm font-bold text-white transition-all hover:bg-create-primary-hover">
                {t("goBack")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "picking_title") {
    return (
      <div className="flex min-h-screen flex-col bg-create-bg">
        <CreationHeader rightAction="none" />

        <div className="flex flex-1 flex-col items-center justify-start px-4 py-10">
          <div className="w-full max-w-md">
            {/* Heading */}
            <div className="text-center mb-8">
              <span className="material-symbols-outlined text-4xl text-create-primary mb-4 block">menu_book</span>
              <h1 className="font-display text-2xl font-bold text-secondary">
                {t("titlePickerHeading")}
              </h1>
              <p className="mt-2 text-sm text-text-muted">{t("titlePickerSubheading")}</p>
            </div>

            {/* Title option cards */}
            <div className="space-y-3">
              {titleOptions.map((option, i) => {
                const isSelected = selectedTitle === option && !customTitle.trim();
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={titleConfirmed}
                    onClick={() => {
                      setCustomTitle("");
                      setSelectedTitle(option);
                      resetAutoConfirm();
                    }}
                    className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                      isSelected
                        ? "border-create-primary bg-create-primary/5 shadow-md shadow-create-primary/10"
                        : "border-border-light bg-white hover:border-border-medium hover:shadow-sm"
                    } disabled:opacity-60 disabled:cursor-default`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                          isSelected
                            ? "border-create-primary bg-create-primary"
                            : "border-border-medium"
                        }`}
                      >
                        {isSelected && (
                          <span className="material-symbols-outlined text-[10px] text-white">check</span>
                        )}
                      </div>
                      <span className="font-display text-sm font-semibold text-text-main leading-snug">
                        {option}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom title input */}
            <div className="mt-4">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-base text-text-muted">
                  edit
                </span>
                <input
                  type="text"
                  disabled={titleConfirmed}
                  value={customTitle}
                  onChange={(e) => {
                    setCustomTitle(e.target.value);
                    setSelectedTitle("");
                    resetAutoConfirm();
                  }}
                  onFocus={() => setAutoConfirmPaused(true)}
                  onBlur={() => {
                    // Only resume countdown if user left the input empty
                    if (!customTitle.trim()) {
                      setAutoConfirmPaused(false);
                      resetAutoConfirm();
                    }
                  }}
                  placeholder={t("titlePickerCustomPlaceholder")}
                  maxLength={120}
                  className={`w-full rounded-xl border-2 bg-white py-3.5 pl-9 pr-4 text-sm text-text-main placeholder:text-text-muted transition-colors focus:outline-none disabled:opacity-60 ${
                    customTitle.trim()
                      ? "border-create-primary bg-create-primary/5"
                      : "border-border-light focus:border-border-medium"
                  }`}
                />
              </div>
            </div>

            {/* Confirm button */}
            <div className="mt-6">
              {titleConfirmed ? (
                <div className="flex items-center justify-center gap-2 py-4">
                  <span className="material-symbols-outlined text-success text-xl">check_circle</span>
                  <span className="text-sm font-semibold text-success">
                    &ldquo;{effectiveTitle}&rdquo;
                  </span>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={savingTitle || !effectiveTitle}
                    onClick={() => confirmTitle(effectiveTitle)}
                    className="w-full rounded-xl bg-create-primary px-6 py-4 text-base font-bold text-white transition-all hover:bg-create-primary-hover active:scale-[0.98] disabled:opacity-60 shadow-lg shadow-create-primary/20"
                  >
                    {savingTitle ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                        {t("titlePickerSaving")}
                      </span>
                    ) : (
                      t("titlePickerConfirm")
                    )}
                  </button>
                  {autoConfirmSeconds > 0 && (
                    <p className="mt-2 text-center text-xs text-text-muted">
                      {t("titlePickerAutoConfirmHint", { seconds: autoConfirmSeconds })}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Illustrations progress indicator */}
            <div className="mt-8 flex items-center justify-center gap-2 py-3 rounded-xl bg-white border border-border-light">
              {illustrationsDone ? (
                <>
                  <span className="material-symbols-outlined text-success text-base">check_circle</span>
                  <span className="text-xs text-success font-medium">{t("viewStoryButton")}</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined animate-spin text-create-primary text-base">
                    progress_activity
                  </span>
                  <span className="text-xs text-text-muted">{t("illustrationsGenerating")}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── generating_text + starting: animation screen ──────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-create-bg relative overflow-hidden">
      <CreationHeader rightAction="none" />
      {/* Background star pattern */}
      <div className="absolute inset-0 create-star-pattern opacity-30 pointer-events-none" />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 text-center">
        <div className="max-w-lg w-full">
          {/* Animated icon */}
          <div className="mb-8 relative">
            <div className="inline-flex h-32 w-32 items-center justify-center rounded-full bg-white shadow-lg shadow-create-primary/10">
              <span className="material-symbols-outlined text-7xl text-create-primary animate-pulse">
                {currentMessage.icon}
              </span>
            </div>
            {/* Floating decorative elements */}
            <div className="absolute -top-2 -right-4 animate-create-float">
              <span className="material-symbols-outlined text-2xl text-create-gold opacity-60">star</span>
            </div>
            <div className="absolute -bottom-1 -left-6 animate-create-float-delay-1">
              <span className="material-symbols-outlined text-xl text-create-primary opacity-40">auto_awesome</span>
            </div>
            <div className="absolute top-4 -left-2 animate-create-float-delay-2">
              <span className="material-symbols-outlined text-lg text-indigo-400 opacity-50">star</span>
            </div>
          </div>

          {/* Title */}
          <h1 className="font-display text-3xl font-bold text-secondary">
            {t("creatingStory")}
          </h1>

          {/* Rotating message */}
          <div className="mt-4 h-8">
            <p key={messageIndex} className="text-base text-text-muted animate-fade-in">
              {t(`messages.${currentMessage.key}` as Parameters<typeof t>[0])}
            </p>
          </div>

          {/* Progress bar */}
          <div className="mt-8 w-full max-w-sm mx-auto">
            <div className="rounded-full bg-create-neutral h-3 w-full overflow-hidden shadow-inner">
              <div
                className="h-full rounded-full bg-create-primary transition-all duration-700 ease-out"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-text-muted">{Math.round(progress)}%</p>
          </div>

          {/* Info text */}
          <p className="mt-8 text-sm text-text-muted leading-relaxed max-w-xs mx-auto">
            {t("waitMessage")}
          </p>
        </div>
      </div>
    </div>
  );
}
