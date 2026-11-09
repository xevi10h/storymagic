"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { buttonClass } from "@/components/ui";
import s from "./PhotoCreateOverlay.module.css";

const LOADING_MESSAGES = ["loading1", "loading2", "loading3", "loading4", "loading5"] as const;
const MESSAGE_MS = 3200;

/**
 * Photo mode, step B (the drawing is being painted: the page goes dark, the Meapica mark draws
 * itself over the faded photo, short rotating messages) and step C (the reveal: the drawing
 * blooms in, "¡Aquí está {name}!", continue / try another photo). One full-screen dialog so
 * the dark state flows straight into the reveal.
 *
 * Keyboard: focus stays inside (step B: the dialog itself; step C: its two buttons, Tab cycles),
 * Esc in step C = continue. Step B cannot be dismissed (the drawing takes ~15–30 s and ends
 * either in the reveal or in an error shown in the panel). Reduced motion: no animations.
 */
export default function PhotoCreateOverlay({
  name,
  drawing,
  revealOpen,
  preview,
  portraitUrl,
  onContinue,
  onTryAnother,
}: {
  name: string;
  drawing: boolean;
  revealOpen: boolean;
  preview: string | null;
  portraitUrl: string | null;
  onContinue: () => void;
  onTryAnother: () => void;
}) {
  const t = useTranslations("crear.photoUi");
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const continueRef = useRef<HTMLButtonElement | null>(null);
  const [message, setMessage] = useState(0);
  const open = drawing || revealOpen;
  const reveal = !drawing && revealOpen && !!portraitUrl;
  const onContinueRef = useRef(onContinue);
  useEffect(() => {
    onContinueRef.current = onContinue;
  }, [onContinue]);

  // Rotating messages while painting.
  useEffect(() => {
    if (!drawing) return;
    const id = window.setInterval(() => setMessage((m) => (m + 1) % LOADING_MESSAGES.length), MESSAGE_MS);
    return () => {
      window.clearInterval(id);
      setMessage(0);
    };
  }, [drawing]);

  // Scroll lock + focus handling while open; focus returns where it was on close.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => (reveal ? continueRef.current : dialogRef.current)?.focus());
  }, [open, reveal]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && reveal) {
        e.preventDefault();
        onContinueRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = dialogRef.current ? [...dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled])")] : [];
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, reveal]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-8" data-testid="photo-overlay">
      <div aria-hidden className={`${s.backdrop} absolute inset-0`} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`${s.stage} relative flex w-full max-w-md flex-col items-center text-center outline-none`}
        data-testid={reveal ? "photo-reveal" : "photo-loading"}
      >
        {reveal ? (
          <>
            <div className="relative aspect-square w-[min(72vw,320px)]">
              <svg aria-hidden viewBox="0 0 200 200" className="absolute -inset-3 h-[calc(100%+1.5rem)] w-[calc(100%+1.5rem)]">
                {/* a slightly irregular hand-drawn circle */}
                <path className={s.ring} d="M100 6 C152 5 195 46 194 101 C193 154 151 195 99 194 C46 193 6 152 7 99 C8 47 49 7 100 6 Z" pathLength={1000} />
              </svg>
              <div className={`${s.portrait} absolute inset-0 overflow-hidden rounded-full bg-[#fbeee2]`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- signed URL of a private image */}
                <img src={portraitUrl!} alt={t("portraitAlt", { name })} className="h-full w-full object-cover" data-testid="photo-reveal-image" />
              </div>
            </div>
            <h2 id={titleId} className={`${s.title} mt-8 font-display text-3xl font-bold leading-tight text-[#fff8f0] sm:text-4xl`}>
              {t("revealTitle", { name })}
            </h2>
            <p className={`${s.title} mt-2 max-w-xs text-sm leading-relaxed text-[#fff8f0]/75`}>{t("revealHint")}</p>
            <div className={`${s.actions} mt-7 flex w-full flex-col gap-2.5 sm:w-auto sm:min-w-[300px]`}>
              <button ref={continueRef} type="button" onClick={onContinue} className={buttonClass({ size: "lg" })} data-testid="photo-reveal-continue">
                {t("revealContinue")}
              </button>
              <button
                type="button"
                onClick={onTryAnother}
                className="rounded-full px-5 py-3 text-base font-bold text-[#fff8f0]/85 underline-offset-4 transition-colors hover:text-[#fff8f0] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fff8f0]"
                data-testid="photo-reveal-try-another"
              >
                {t("tryAnother")}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="relative flex aspect-square w-[min(64vw,260px)] items-center justify-center overflow-hidden rounded-full bg-black/30 ring-1 ring-[#fff8f0]/10">
              {preview && (
                // eslint-disable-next-line @next/next/no-img-element -- local object URL
                <img src={preview} alt="" aria-hidden className={`${s.ghost} absolute inset-0 h-full w-full object-cover`} />
              )}
              <BrandLoader size="lg" label={t("loadingTitle", { name })} className="relative text-[#fff8f0]!" />
            </div>
            <h2 id={titleId} className="mt-8 font-display text-2xl font-bold text-[#fff8f0] sm:text-3xl">
              {t("loadingTitle", { name })}
            </h2>
            <p key={message} role="status" aria-live="polite" className={`${s.message} mt-2 min-h-6 text-base text-[#fff8f0]/75`}>
              {t(LOADING_MESSAGES[message])}
            </p>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
