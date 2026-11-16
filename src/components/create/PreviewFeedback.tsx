"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PREVIEW_FEEDBACK_DELAY_S, PREVIEW_FEEDBACK_REASONS, type PreviewFeedbackReason } from "@/lib/preview-feedback";

const seenKey = (storyId: string) => `meapica_feedback_${storyId}`;

/**
 * "¿Qué te frena?": one optional, one-tap question on the book preview for a parent who has
 * looked at the book for a while without pressing a pay button. Shown once per story and
 * device, never while `paused` (reveal, edit sheets, consent sheet, checkout in progress) and
 * never after a pay click (`suppressed`). Sits above the phone's sticky buy bar and never
 * covers a buy button. Answers: POST /api/stories/{id}/feedback (preview_feedback table).
 */
export default function PreviewFeedback({ storyId, name, paused, suppressed }: { storyId: string; name: string; paused: boolean; suppressed: boolean }) {
  const t = useTranslations("crear.preview.feedback");
  const locale = useLocale();
  const [stage, setStage] = useState<"waiting" | "asking" | "thanks" | "closed">("waiting");

  // Visible seconds on the page (a hidden tab or a paused screen does not count).
  useEffect(() => {
    if (stage !== "waiting" || suppressed) return;
    try {
      if (localStorage.getItem(seenKey(storyId))) return;
    } catch {
      // storage blocked: the question may show again on a reload, never twice per visit
    }
    let seconds = 0;
    const tick = setInterval(() => {
      if (paused || document.visibilityState === "hidden") return;
      if (++seconds >= PREVIEW_FEEDBACK_DELAY_S) setStage("asking");
    }, 1000);
    return () => clearInterval(tick);
  }, [stage, suppressed, paused, storyId]);

  const remember = () => {
    try {
      localStorage.setItem(seenKey(storyId), "1");
    } catch {
      // see above
    }
  };

  useEffect(() => {
    if (stage !== "thanks") return;
    const close = setTimeout(() => setStage("closed"), 2500);
    return () => clearTimeout(close);
  }, [stage]);

  if (suppressed || paused || (stage !== "asking" && stage !== "thanks")) return null;

  const answer = (reason: PreviewFeedbackReason) => {
    remember();
    setStage("thanks");
    // Best effort: an unsent answer must never get in the parent's way.
    void fetch(`/api/stories/${storyId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, locale }),
      keepalive: true,
    }).catch(() => {});
  };

  return (
    <aside
      aria-label={t("title")}
      data-testid="preview-feedback"
      className="step-in fixed inset-x-3 bottom-[calc(var(--cookie-banner-h,0px)+6.5rem)] z-30 mx-auto max-w-sm rounded-2xl bg-white p-4 shadow-[0_12px_32px_-10px_rgba(44,24,16,0.35)] ring-1 ring-create-neutral sm:inset-x-auto sm:bottom-6 sm:left-6 sm:mx-0"
    >
      {stage === "thanks" ? (
        <p role="status" className="py-2 text-center text-sm font-semibold text-create-text-dark">
          {t("thanks")}
        </p>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <p className="font-display text-base font-bold leading-tight text-create-text-dark">{t("title")}</p>
            <button
              type="button"
              onClick={() => {
                remember();
                setStage("closed");
              }}
              aria-label={t("close")}
              className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-create-text-sub transition-colors hover:bg-create-neutral"
            >
              <span aria-hidden className="material-symbols-outlined text-xl" data-icon="close" />
            </button>
          </div>
          <p className="text-xs text-create-text-sub">{t("hint")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PREVIEW_FEEDBACK_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => answer(reason)}
                className="min-h-11 rounded-full border-2 border-line bg-white px-3.5 text-sm font-semibold text-create-text-dark transition-colors hover:border-create-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-create-primary"
              >
                {t(`reasons.${reason}`, { name })}
              </button>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
