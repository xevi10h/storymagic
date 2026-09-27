"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import CreationHeader from "@/components/crear/CreationHeader";

interface OrderDetails {
  format: string;
  bookTitle: string | null;
  characterName: string | null;
  storyId: string;
}

type CompletionStatus = "verifying" | "completing" | "processing" | "ready" | "error";

// When /complete answers 202 the book keeps being produced in the background
// (cron) and the customer is emailed when it's ready. We poll the story status
// (cheap, not rate-limited like /complete) so an open tab still flips to ready.
const PROCESSING_POLL_MS = 15_000;
const PROCESSING_POLL_MAX_MS = 20 * 60_000;
const READY_STORY_STATUSES = new Set(["ready", "ordered", "shipped"]);

const COMPLETION_MESSAGES = [
  { key: "palette", icon: "palette" },
  { key: "brush", icon: "brush" },
  { key: "autoStories", icon: "auto_stories" },
  { key: "forest", icon: "forest" },
  { key: "star", icon: "star" },
  { key: "inkPen", icon: "ink_pen" },
  { key: "menuBook", icon: "menu_book" },
  { key: "autoAwesome", icon: "auto_awesome" },
];

export interface SuccessClientProps {
  sessionId: string | null;
  /** Payment confirmed server-side against Stripe (never trust the URL alone). */
  verified: boolean;
  /** Email Stripe collected at checkout — where the confirmation goes. */
  customerEmail: string | null;
  /** Format from the Stripe session metadata (fallback if order lookup fails). */
  format: string | null;
  /** Guest (anonymous) buyer: no account email, confirmation goes to checkout email. */
  isGuest: boolean;
}

export default function SuccessClient({
  sessionId,
  verified,
  customerEmail,
  format,
  isGuest,
}: SuccessClientProps) {
  const t = useTranslations("checkout.success");

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [completionStatus, setCompletionStatus] = useState<CompletionStatus>(
    verified ? "verifying" : "error",
  );
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const completionStarted = useRef(false);
  const [processingStoryId, setProcessingStoryId] = useState<string | null>(null);

  // Background production: poll the story until it's ready (or give up quietly;
  // the customer gets an email either way).
  useEffect(() => {
    if (completionStatus !== "processing" || !processingStoryId) return;
    const startedAt = Date.now();
    const id = setInterval(async () => {
      if (Date.now() - startedAt > PROCESSING_POLL_MAX_MS) {
        clearInterval(id);
        return;
      }
      try {
        const res = await fetch(`/api/stories/${processingStoryId}?light=true`);
        if (!res.ok) return;
        const data = await res.json();
        if (READY_STORY_STATUSES.has(data.status)) {
          clearInterval(id);
          setProgress(100);
          setCompletionStatus("ready");
        }
      } catch {
        // transient — keep polling
      }
    }, PROCESSING_POLL_MS);
    return () => clearInterval(id);
  }, [completionStatus, processingStoryId]);

  // Rotate messages during completion
  useEffect(() => {
    if (completionStatus !== "completing") return;

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % COMPLETION_MESSAGES.length);
    }, 3500);

    return () => clearInterval(interval);
  }, [completionStatus]);

  // Smooth progress bar during completion
  useEffect(() => {
    if (completionStatus !== "completing") return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        const remaining = 90 - prev;
        return prev + remaining * 0.025;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [completionStatus]);

  // Trigger story completion (generate remaining illustrations)
  const triggerCompletion = useCallback(async (storyId: string) => {
    setCompletionStatus("completing");

    try {
      const res = await fetch(`/api/stories/${storyId}/complete`, {
        method: "POST",
      });

      if (res.status === 202) {
        setCompletionStatus("processing");
        setProcessingStoryId(storyId);
        return;
      }
      if (!res.ok) {
        throw new Error(`complete_${res.status}`);
      }

      setProgress(100);
      setCompletionStatus("ready");
    } catch (err) {
      // Never show backend text to the parent; the localized copy explains it.
      console.warn("[checkout/success] Completion failed:", err);
      setCompletionStatus("error");
    }
  }, []);

  // Step 1: Verify payment, then trigger completion if needed
  useEffect(() => {
    if (!verified || !sessionId || completionStarted.current) return;
    completionStarted.current = true;

    async function verifyAndComplete() {
      try {
        // Poll for payment verification (webhook might take a moment)
        let order: OrderDetails | null = null;
        for (let attempt = 0; attempt < 10; attempt++) {
          const res = await fetch(`/api/checkout/verify?session_id=${sessionId}`);
          if (res.ok) {
            order = await res.json();
            break;
          }
          if (res.status === 402) {
            // Not yet paid — wait and retry
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          // Other error — break
          break;
        }

        if (order) {
          setOrder(order);
          // Trigger completion of remaining illustrations
          await triggerCompletion(order.storyId);
        } else {
          // Stripe confirmed the payment server-side, but the order row isn't
          // readable yet (webhook lag) — show the confirmed-payment state.
          setCompletionStatus("ready");
        }
      } catch {
        setCompletionStatus("ready");
      }
    }

    verifyAndComplete();
  }, [verified, sessionId, triggerCompletion]);

  const currentMessage = COMPLETION_MESSAGES[messageIndex];

  // ── Verifying / Completing state ──────────────────────────────────────

  if (completionStatus === "verifying" || completionStatus === "completing") {
    return (
      <div className="flex min-h-screen flex-col bg-create-bg relative overflow-hidden">
        <CreationHeader rightAction="none" />
        <div className="absolute inset-0 create-star-pattern opacity-30 pointer-events-none" />

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 text-center">
          <div className="max-w-lg w-full">
            {/* Animated icon */}
            <div className="mb-8 relative">
              <div className="inline-flex h-32 w-32 items-center justify-center rounded-full bg-white shadow-lg shadow-create-primary/10">
                <span className="material-symbols-outlined text-7xl text-create-primary animate-pulse">
                  {completionStatus === "verifying" ? "verified" : currentMessage.icon}
                </span>
              </div>
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
            </div>

            <h1 className="font-display text-3xl font-bold text-secondary">
              {completionStatus === "verifying"
                ? t("verifyingPayment")
                : t("completingBook")}
            </h1>

            {completionStatus === "completing" && (
              <div className="mt-4 h-8">
                <p
                  key={messageIndex}
                  className="text-base text-text-muted animate-fade-in"
                >
                  {t(`completionMessages.${currentMessage.key}`)}
                </p>
              </div>
            )}

            {completionStatus === "completing" && (
              <div className="mt-8 w-full max-w-sm mx-auto">
                <div className="rounded-full bg-create-neutral h-3 w-full overflow-hidden shadow-inner">
                  <div
                    className="h-full rounded-full bg-create-primary transition-all duration-700 ease-out"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-text-muted">
                  {t("completingHint")}
                </p>
              </div>
            )}

            {completionStatus === "verifying" && (
              <p className="mt-4 text-sm text-text-muted">
                {t("verifyingDescription")}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────

  // ── Paid, book still being produced in the background ─────────────────

  if (verified && completionStatus === "processing") {
    const processingIsDigital = (order?.format ?? format) === "digital_pdf";
    return (
      <div className="flex min-h-[100dvh] flex-col bg-create-bg">
        <CreationHeader rightAction="close" />
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <div className="w-full max-w-md">
            <div className="mb-6 inline-flex h-24 w-24 items-center justify-center rounded-full bg-success/10">
              <span className="material-symbols-outlined text-5xl text-success">check_circle</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-secondary">
              {t("processingTitle")}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-text-muted">
              {order?.characterName
                ? t("processingDescriptionNamed", { name: order.characterName })
                : t("processingDescription")}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-text-muted">
              {processingIsDigital ? t("processingEmailDigital") : t("processingEmailPhysical")}
            </p>
            {customerEmail && (
              <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs text-text-soft shadow-sm">
                <span className="material-symbols-outlined text-sm text-create-primary">mail</span>
                {t("confirmationEmail", { email: customerEmail })}
              </p>
            )}
            {isGuest && <p className="mt-2 text-xs text-text-muted">{t("guestNote")}</p>}
            <p className="mt-6 flex items-center justify-center gap-2 text-xs text-text-muted">
              <span className="material-symbols-outlined animate-spin text-base text-create-primary">progress_activity</span>
              {t("processingSafeToLeave")}
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <Link
                href="/dashboard"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border-light px-6 py-3 text-sm font-medium text-text-soft transition-colors hover:bg-cream hover:text-text-main"
              >
                <span className="material-symbols-outlined text-lg">auto_stories</span>
                {t("viewOrders")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Payment not confirmed (bogus / unpaid / expired session) ─────────────

  if (!verified) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-create-bg">
        <CreationHeader rightAction="close" />
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <div className="max-w-md">
            <div className="mb-6 inline-flex h-24 w-24 items-center justify-center rounded-full bg-amber-100">
              <span className="material-symbols-outlined text-5xl text-amber-600">help</span>
            </div>
            <h1 className="font-display text-2xl font-bold text-secondary">
              {t("notVerifiedTitle")}
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-text-muted">
              {t("notVerifiedDescription")}
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <Link
                href="/dashboard"
                className="rounded-full bg-create-primary px-8 py-3 text-sm font-bold text-white transition-all hover:bg-create-primary-hover"
              >
                {t("goToDashboard")}
              </Link>
              <a href="mailto:hola@meapica.com" className="text-sm text-text-muted hover:text-text-soft">
                {t("contactUs")}
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (completionStatus === "error") {
    return (
      <div className="flex min-h-screen flex-col bg-create-bg">
        <CreationHeader rightAction="close" />
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <div className="max-w-md">
            <div className="mb-6 inline-flex h-24 w-24 items-center justify-center rounded-full bg-amber-100">
              <span className="material-symbols-outlined text-5xl text-amber-600">
                warning
              </span>
            </div>
            <h1 className="font-display text-2xl font-bold text-secondary">
              {t("completionErrorTitle")}
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-text-muted">
              {t("completionErrorDescription")}
            </p>
            <div className="mt-8 flex flex-col gap-3">
              {order && (
                <button
                  onClick={() => {
                    setCompletionStatus("completing");
                    setProgress(0);
                    completionStarted.current = false;
                    triggerCompletion(order.storyId);
                  }}
                  className="rounded-full bg-create-primary px-8 py-3 text-sm font-bold text-white transition-all hover:bg-create-primary-hover"
                >
                  {t("retryCompletion")}
                </button>
              )}
              <Link
                href="/dashboard"
                className="text-sm text-text-muted hover:text-text-soft"
              >
                {t("goToDashboard")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Ready state (book complete) ───────────────────────────────────────

  const effectiveFormat = order?.format ?? format;
  const isDigital = effectiveFormat === "digital_pdf";

  return (
    <div className="flex min-h-screen flex-col bg-create-bg">
      <CreationHeader rightAction="close" />
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          {/* Success icon */}
          <div className="mb-6 inline-flex h-24 w-24 items-center justify-center rounded-full bg-success/10">
            <span className="material-symbols-outlined text-5xl text-success">
              check_circle
            </span>
          </div>

          <h1 className="font-display text-3xl font-bold text-secondary">
            {t("title")}
          </h1>

          <p className="mt-4 text-base leading-relaxed text-text-muted">
            {order?.bookTitle && order.characterName
              ? t("descriptionWithOrder", { title: order.bookTitle, name: order.characterName })
              : t("descriptionGeneric")}
          </p>

          {customerEmail && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs text-text-soft shadow-sm">
              <span className="material-symbols-outlined text-sm text-create-primary">mail</span>
              {t("confirmationEmail", { email: customerEmail })}
            </p>
          )}
          {isGuest && (
            <p className="mt-2 text-xs text-text-muted">{t("guestNote")}</p>
          )}

          {/* Order info card */}
          <div className="mt-8 rounded-xl border border-border-light bg-white p-6 text-left">
            {/* PDF download — available for all formats */}
            {order && (
              <div className="flex items-center gap-3 text-text-soft">
                <span className="material-symbols-outlined text-xl text-create-primary">
                  download
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-main">
                    {t("pdfReady")}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {t("pdfReadyDescription")}
                  </p>
                </div>
                <Link
                  href={`/crear/${order.storyId}/preview`}
                  className="shrink-0 rounded-lg bg-create-primary px-3 py-1.5 text-xs font-bold text-white transition-all hover:bg-create-primary-hover"
                >
                  {t("viewBook")}
                </Link>
              </div>
            )}

            {/* Shipping info — only for physical formats */}
            {!isDigital && (
              <>
                <div className="mt-4 flex items-center gap-3 text-text-soft">
                  <span className="material-symbols-outlined text-xl text-create-primary">
                    local_shipping
                  </span>
                  <div>
                    <p className="text-sm font-medium text-text-main">
                      {t("nextStepsTitle")}
                    </p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {t("nextStepsDescription")}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3 text-text-soft">
                  <span className="material-symbols-outlined text-xl text-create-primary">
                    schedule
                  </span>
                  <div>
                    <p className="text-sm font-medium text-text-main">
                      {t("deliveryTitle")}
                    </p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {t("deliveryDescription")}
                    </p>
                  </div>
                </div>
              </>
            )}

            {effectiveFormat && (
              <div className="mt-4 flex items-center gap-3 text-text-soft">
                <span className="material-symbols-outlined text-xl text-create-primary">
                  {isDigital ? "download" : effectiveFormat === "hardcover" ? "book" : "menu_book"}
                </span>
                <div>
                  <p className="text-sm font-medium text-text-main">
                    {t("formatLabel", {
                      format: isDigital
                        ? t("formatDigital")
                        : effectiveFormat === "hardcover"
                          ? t("formatHardcover")
                          : t("formatSoftcover"),
                    })}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {isDigital ? t("instantDownload") : t("premiumPrint")}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-8 flex flex-col gap-3">
            <Link
              href="/crear"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-create-primary px-6 py-3.5 text-sm font-bold text-white transition-all hover:bg-create-primary-hover active:scale-[0.98] shadow-lg shadow-create-primary/20"
            >
              <span className="material-symbols-outlined text-lg">
                add_circle
              </span>
              {t("createAnother")}
            </Link>
            <Link
              href="/dashboard"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border-light px-6 py-3 text-sm font-medium text-text-soft transition-colors hover:bg-cream hover:text-text-main"
            >
              <span className="material-symbols-outlined text-lg">
                auto_stories
              </span>
              {t("viewOrders")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
