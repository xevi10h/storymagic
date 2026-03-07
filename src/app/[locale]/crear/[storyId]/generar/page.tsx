"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import CreationHeader from "@/components/crear/CreationHeader";

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

type GenerationStatus = "starting" | "generating" | "ready" | "error";

export default function GenerarPage() {
  const t = useTranslations("crear.generar");
  const { storyId } = useParams<{ storyId: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<GenerationStatus>("starting");
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const generationStarted = useRef(false);

  // Rotate whimsical messages
  useEffect(() => {
    if (status !== "generating" && status !== "starting") return;

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % WHIMSICAL_MESSAGE_KEYS.length);
    }, 3500);

    return () => clearInterval(interval);
  }, [status]);

  // Smooth progress bar — slows down asymptotically toward 85%
  useEffect(() => {
    if (status !== "generating" && status !== "starting") return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 85) return prev;
        // Slow down as we approach 85% — feels natural
        const remaining = 85 - prev;
        return prev + remaining * 0.03;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [status]);

  const startGeneration = useCallback(async () => {
    setStatus("generating");

    try {
      // Check story status before attempting generation
      const storyRes = await fetch(`/api/stories/${storyId}`);
      if (storyRes.ok) {
        const storyData = await storyRes.json();
        if (storyData.status === "preview" || storyData.status === "ready" || storyData.status === "ordered") {
          // Already generated — skip to preview
          router.replace(`/crear/${storyId}/preview`);
          return;
        }
        if (storyData.status === "generating") {
          // Another tab/request is generating — wait and redirect
          setStatus("generating");
          return;
        }
      }

      const res = await fetch(`/api/stories/${storyId}/generate`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.details || data.error || "Generation failed");
      }

      setProgress(100);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorDefault"));
      setStatus("error");
    }
  }, [storyId, router]);

  // Start generation on mount
  useEffect(() => {
    if (generationStarted.current) return;
    generationStarted.current = true;
    startGeneration();
  }, [startGeneration]);

  const currentMessage = WHIMSICAL_MESSAGE_KEYS[messageIndex];

  // Ready state
  if (status === "ready") {
    return (
      <div className="flex min-h-screen flex-col bg-create-bg">
        <CreationHeader rightAction="none" />
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <div className="max-w-md">
          <div className="mb-6 inline-flex h-24 w-24 items-center justify-center rounded-full bg-success/10">
            <span className="material-symbols-outlined text-5xl text-success">
              check_circle
            </span>
          </div>
          <h1 className="font-display text-3xl font-bold text-secondary">
            {t("readyTitle")}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-text-muted">
            {t("readyDescription")}
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <button
              onClick={() => router.push(`/crear/${storyId}/preview`)}
              className="rounded-full bg-create-primary px-8 py-4 text-base font-bold text-white transition-all hover:bg-create-primary-hover hover:-translate-y-0.5 shadow-lg shadow-create-primary/20"
            >
              {t("viewStory")}
            </button>
            <Link
              href="/crear"
              className="text-sm text-text-muted hover:text-text-soft"
            >
              {t("createAnother")}
            </Link>
          </div>
        </div>
        </div>
      </div>
    );
  }

  // Error state
  if (status === "error") {
    return (
      <div className="flex min-h-screen flex-col bg-create-bg">
        <CreationHeader rightAction="none" />
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <div className="max-w-md">
          <div className="mb-6 inline-flex h-24 w-24 items-center justify-center rounded-full bg-red-100">
            <span className="material-symbols-outlined text-5xl text-red-500">
              error
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold text-secondary">
            {t("errorTitle")}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-text-muted">
            {error || t("errorDefault")}
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <button
              onClick={() => {
                setStatus("starting");
                setProgress(0);
                setError(null);
                generationStarted.current = false;
                startGeneration();
              }}
              className="rounded-full bg-create-primary px-8 py-3 text-sm font-bold text-white transition-all hover:bg-create-primary-hover"
            >
              {t("retry")}
            </button>
            <Link
              href="/dashboard"
              className="text-sm text-text-muted hover:text-text-soft"
            >
              {t("goBack")}
            </Link>
          </div>
        </div>
        </div>
      </div>
    );
  }

  // Generating state (main animation)
  return (
    <div className="flex min-h-screen flex-col bg-create-bg relative overflow-hidden">
      <CreationHeader rightAction="none" />
      {/* Background star pattern */}
      <div className="absolute inset-0 create-star-pattern opacity-30 pointer-events-none" />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 text-center">
      <div className="max-w-lg w-full">
        {/* Animated book icon */}
        <div className="mb-8 relative">
          <div className="inline-flex h-32 w-32 items-center justify-center rounded-full bg-white shadow-lg shadow-create-primary/10">
            <span className="material-symbols-outlined text-7xl text-create-primary animate-pulse">
              {currentMessage.icon}
            </span>
          </div>
          {/* Floating decorative elements */}
          <div className="absolute -top-2 -right-4 animate-create-float">
            <span className="material-symbols-outlined text-2xl text-create-gold opacity-60">
              star
            </span>
          </div>
          <div className="absolute -bottom-1 -left-6 animate-create-float-delay-1">
            <span className="material-symbols-outlined text-xl text-create-primary opacity-40">
              auto_awesome
            </span>
          </div>
          <div className="absolute top-4 -left-2 animate-create-float-delay-2">
            <span className="material-symbols-outlined text-lg text-indigo-400 opacity-50">
              star
            </span>
          </div>
        </div>

        {/* Title */}
        <h1 className="font-display text-3xl font-bold text-secondary">
          {t("creatingStory")}
        </h1>

        {/* Rotating message */}
        <div className="mt-4 h-8">
          <p
            key={messageIndex}
            className="text-base text-text-muted animate-fade-in"
          >
            {t(`messages.${currentMessage.key}`)}
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
          <p className="mt-2 text-xs text-text-muted">
            {t("completed")}
          </p>
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
