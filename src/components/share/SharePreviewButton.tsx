"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { deName } from "@/lib/creation-flow";

export interface SharePreviewButtonProps {
  storyId: string;
  childName: string;
  /** Classes for the button (defaults to a small outlined pill). */
  className?: string;
  /** Show the "anyone with the link…" hint under the button. */
  showHint?: boolean;
  /** Stretch to the width of its column (the "¿Lo decides más tarde?" options). */
  fullWidth?: boolean;
  /** Called after a successful share/copy (analytics hook). */
  onShared?: (method: "native" | "clipboard") => void;
}

type Status = "idle" | "loading" | "copied" | "manual" | "error";

const DEFAULT_CLASS =
  "inline-flex items-center justify-center gap-1.5 rounded-full border-2 border-border-light bg-white px-4 py-2 text-sm font-bold text-secondary transition-colors hover:border-create-primary hover:text-create-primary disabled:opacity-60";

/** Mobile/tablet (touch-first) → native share sheet (WhatsApp etc.); desktop → copy link. */
function prefersNativeShare(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

/**
 * "Compartir" for the owner's preview: mints a read-only share link
 * (POST /api/stories/[storyId]/share) and hands it to the OS share sheet on
 * mobile or copies it on desktop. The link shows only the preview pages.
 */
export default function SharePreviewButton({ storyId, childName, className, showHint = false, fullWidth = false, onShared }: SharePreviewButtonProps) {
  const t = useTranslations("sharePreview.share");
  const locale = useLocale();
  const [status, setStatus] = useState<Status>("idle");
  const [manualUrl, setManualUrl] = useState<string | null>(null);
  const cachedUrl = useRef<string | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  const getUrl = useCallback(async (): Promise<string> => {
    if (cachedUrl.current) return cachedUrl.current;
    const res = await fetch(`/api/stories/${storyId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    });
    const data = (await res.json().catch(() => ({}))) as { path?: string };
    if (!res.ok || !data.path) throw new Error(`share_${res.status}`);
    cachedUrl.current = new URL(data.path, window.location.origin).toString();
    return cachedUrl.current;
  }, [storyId, locale]);

  // Mint the link ahead of the tap: iOS Safari only opens the share sheet while the
  // tap's user activation is fresh, which an await on the network can outlive.
  useEffect(() => {
    getUrl().catch(() => {
      // Retried on click (and reported there).
    });
  }, [getUrl]);

  const flash = useCallback((next: Status) => {
    setStatus(next);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setStatus("idle"), 2500);
  }, []);

  const handleClick = useCallback(async () => {
    setManualUrl(null);
    if (!cachedUrl.current) setStatus("loading");
    let url: string;
    try {
      url = await getUrl();
    } catch (err) {
      console.warn("[share] Creating the share link failed:", err);
      setStatus("error");
      return;
    }

    if (prefersNativeShare()) {
      try {
        await navigator.share({
          title: t("shareTitle", { name: childName, deName: deName(childName, locale) }),
          text: t("shareText", { name: childName }),
          url,
        });
        setStatus("idle");
        onShared?.("native");
        return;
      } catch (err) {
        // User closed the sheet: nothing to do. Any other failure falls back to copying.
        if (err instanceof DOMException && err.name === "AbortError") {
          setStatus("idle");
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      flash("copied");
      onShared?.("clipboard");
    } catch {
      // Clipboard blocked (permissions / insecure context): show the link to copy by hand.
      setManualUrl(url);
      setStatus("manual");
    }
  }, [getUrl, flash, t, childName, locale, onShared]);

  return (
    <div className={fullWidth ? "flex w-full flex-col items-stretch" : "inline-flex flex-col items-center"} data-testid="share-preview">
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "loading"}
        className={className ?? DEFAULT_CLASS}
        data-testid="share-preview-button"
      >
        <span aria-hidden className={`material-symbols-outlined text-lg ${status === "loading" ? "animate-spin" : ""}`}>
          {status === "loading" ? "progress_activity" : status === "copied" ? "check" : "ios_share"}
        </span>
        {status === "loading" ? t("sharing") : status === "copied" ? t("copied") : t("button")}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {status === "copied" ? t("copied") : ""}
      </span>
      {status === "error" && (
        <p className="mt-2 text-center text-xs text-red-600" role="alert">{t("error")}</p>
      )}
      {status === "manual" && manualUrl && (
        <label className={`mt-2 block w-full text-left text-xs text-text-muted ${fullWidth ? "" : "max-w-xs"}`}>
          {t("copyManually")}
          <input
            readOnly
            value={manualUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-1 w-full rounded-lg border border-border-light bg-white px-2 py-1.5 text-xs text-text-main"
            data-testid="share-preview-url"
          />
        </label>
      )}
      {showHint && <p className="mt-2 max-w-xs text-center text-xs text-text-muted">{t("hint")}</p>}
    </div>
  );
}
