"use client";

import { useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PHOTO_CONSENT_VERSION, PHOTO_MAX_EDGE, PHOTO_MAX_UPLOAD_BYTES } from "@/lib/creation-flow";
import { ensureGuestSession } from "@/lib/guest-session";
import { trackEvent } from "@/lib/tracking/consent";
import { buttonClass } from "@/components/ui";
import Sheet from "./Sheet";
import { Spinner } from "@/components/ui/Spinner";
import type { PhotoCharacter } from "@/lib/create-store";
import type { PhotoPortraitError } from "@/hooks/usePhotoPortrait";

interface PhotoUploadPanelProps {
  name: string;
  /** Uploaded photo still waiting for (or after a failed) drawing; null once drawn. */
  photoPath: string | null;
  photoCharacter: PhotoCharacter | null;
  drawing: boolean;
  drawError: PhotoPortraitError | null;
  /** The photo is stored: the page draws the portrait from it. */
  onUploaded: (photoPath: string) => void;
  /** Draw again from the same photo (it is kept when a drawing fails). */
  onRetry: () => void;
  /** "Probar con otra foto": drops the drawing (and any leftover photo). */
  onReset: () => void;
}

/** Server error codes with a parent-facing message (crear.photo.errors.*). */
const KNOWN_ERRORS = new Set([
  "consent_required",
  "too_large",
  "unsupported_type",
  "invalid_image",
  "too_small",
  "photo_unavailable",
  "rate_limited",
  "upload_failed",
  "consent_version_mismatch",
]);

function mapServerError(code: unknown, status: number): string {
  if (typeof code === "string" && KNOWN_ERRORS.has(code)) return code;
  if (status === 413) return "too_large";
  if (status === 415) return "unsupported_type";
  if (status === 422) return "invalid_image";
  if (status === 429) return "rate_limited";
  if (status === 410) return "photo_unavailable";
  return "upload_failed";
}

/** Decode any browser-readable image (incl. HEIC on Safari) into a drawable source. */
async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // fall through to <img> decoding (older Safari, HEIC)
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/**
 * Re-encode to JPEG with the long edge ≤ PHOTO_MAX_EDGE so large or HEIC phone
 * photos upload fine and the body stays under the 4 MB server limit.
 * Re-encoding also drops EXIF (location) before anything leaves the device.
 */
async function toUploadJpeg(file: File): Promise<Blob> {
  const img = await decode(file);
  try {
    const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas_unavailable");
    ctx.drawImage(img.source, 0, 0, w, h);
    for (const quality of [0.88, 0.78, 0.65]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= PHOTO_MAX_UPLOAD_BYTES) return blob;
    }
    throw new Error("still_too_large");
  } finally {
    img.close();
  }
}

/**
 * "Sube una foto" tab. Consent is an explicit, unchecked checkbox; nothing is
 * uploaded before it is ticked. The photo goes to a private bucket via
 * POST /api/characters/photo, the page then draws the child from it
 * (POST /api/characters/photo-portrait, which deletes the photo) and this panel
 * shows the result. "Probar con otra foto" starts over with a fresh consent.
 */
export default function PhotoUploadPanel({
  name,
  photoPath,
  photoCharacter,
  drawing,
  drawError,
  onUploaded,
  onRetry,
  onReset,
}: PhotoUploadPanelProps) {
  const t = useTranslations("crear.photo");
  const tu = useTranslations("crear.photoUi");
  const locale = useLocale();
  const uid = useId();
  const [consent, setConsent] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);

  async function upload(file: File) {
    setError(null);
    if (!consent) return setError("consent_required");
    if (uploading || drawing) return;
    setUploading(true);
    try {
      let jpeg: Blob;
      try {
        jpeg = await toUploadJpeg(file);
      } catch (err) {
        console.warn("[create] photo decode failed:", err);
        setError(err instanceof Error && err.message === "still_too_large" ? "too_large" : "unsupported_type");
        return;
      }
      await ensureGuestSession();
      const body = new FormData();
      body.append("photo", jpeg, "photo.jpg");
      body.append("consent", "true");
      body.append("consentVersion", PHOTO_CONSENT_VERSION);
      body.append("locale", locale);
      const res = await fetch("/api/characters/photo", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { photoPath?: string; error?: string };
      if (!res.ok || !data.photoPath) {
        setError(mapServerError(data.error, res.status));
        return;
      }
      trackEvent("photo_uploaded");
      onUploaded(data.photoPath);
    } catch (err) {
      console.warn("[create] photo upload failed:", err);
      setError("upload_failed");
    } finally {
      setUploading(false);
    }
  }

  function startOver() {
    setError(null);
    setConsent(false); // a new photo needs a fresh consent
    onReset();
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // the same file can be picked again
    if (file) void upload(file);
  };

  const shownError = error ?? drawError;
  // A drawing failed but the photo is still stored: offer to try again with it.
  const canRetry = !drawing && !!photoPath && !!drawError && drawError !== "photo_unavailable";

  const buttonBase =
    "flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[19px] leading-tight font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-create-primary disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex flex-col gap-4 rounded-2xl border-2 border-create-neutral bg-white p-4 sm:p-5" data-testid="photo-panel">
      <p className="text-sm leading-relaxed text-create-text">
        {t("explainer")}{" "}
        <button
          type="button"
          onClick={() => setInfoOpen(true)}
          className="font-bold text-brand-text underline-offset-2 hover:underline"
        >
          {t("moreInfo")}
        </button>
      </p>

      {photoCharacter ? (
        <div className="flex flex-col gap-3 rounded-xl bg-create-bg p-4 sm:flex-row sm:items-center" data-testid="photo-ready">
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold text-create-text-dark">{tu("readyTitle", { name })}</p>
            <p className="mt-0.5 text-sm text-create-text-sub">{tu("readyHint")}</p>
          </div>
          <button
            type="button"
            onClick={startOver}
            className="shrink-0 rounded-full border-2 border-create-neutral bg-white px-4 py-2 text-sm font-bold text-create-text transition-colors hover:border-create-primary/50"
            data-testid="photo-try-another"
          >
            {tu("tryAnother")}
          </button>
        </div>
      ) : drawing ? (
        <div className="flex items-center gap-4 rounded-xl bg-create-bg p-4" role="status" data-testid="photo-drawing">
          <Spinner className="shrink-0 text-2xl text-create-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-create-text-dark">{tu("drawing", { name })}</p>
            <p className="text-xs text-create-text-sub">{tu("drawingHint")}</p>
          </div>
        </div>
      ) : canRetry ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={onRetry} className={`${buttonBase} bg-create-primary text-white hover:bg-create-primary-hover`} data-testid="photo-retry">
            {tu("retry")}
          </button>
          <button
            type="button"
            onClick={startOver}
            className={`${buttonBase} border-2 border-create-primary/30 bg-white text-brand-text hover:border-create-primary`}
          >
            {tu("tryAnother")}
          </button>
        </div>
      ) : (
        <>
          <label htmlFor={`${uid}-consent`} className="flex cursor-pointer items-start gap-3 rounded-xl bg-create-bg p-3">
            <input
              id={`${uid}-consent`}
              type="checkbox"
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                if (e.target.checked && error === "consent_required") setError(null);
              }}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--create-primary)]"
            />
            <span className="text-sm leading-snug text-create-text">{t("checkbox")}</span>
          </label>

          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={onFile}
            data-testid="photo-input"
          />
          <input ref={cameraRef} type="file" accept="image/*" capture="user" className="sr-only" tabIndex={-1} aria-hidden onChange={onFile} />

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={!consent || uploading}
              onClick={() => galleryRef.current?.click()}
              className={`${buttonBase} bg-create-primary text-white hover:bg-create-primary-hover`}
            >
              {uploading ? (
                <Spinner className="text-lg" />
              ) : (
                <span aria-hidden className="material-symbols-outlined text-lg" data-icon="photo_library" />
              )}
              {uploading ? tu("uploading") : tu("choosePhoto")}
            </button>
            <button
              type="button"
              disabled={!consent || uploading}
              onClick={() => cameraRef.current?.click()}
              className={`${buttonBase} border-2 border-create-primary/30 bg-white text-brand-text hover:border-create-primary sm:hidden`}
            >
              <span aria-hidden className="material-symbols-outlined text-lg" data-icon="photo_camera" />
              {tu("takePhoto")}
            </button>
          </div>
          {!consent && <p className="text-xs text-create-text-sub">{tu("consentFirst")}</p>}
        </>
      )}

      {shownError && !drawing && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {t(`errors.${shownError}`)}
        </p>
      )}

      <Sheet
        open={infoOpen}
        title={t("modalTitle")}
        onClose={() => setInfoOpen(false)}
        closeLabel={t("modalClose")}
        footer={
          <div className="flex items-center justify-between gap-3">
            <Link href="/legal" className="text-sm font-bold text-brand-text hover:underline">
              {t("privacyLink")}
            </Link>
            <button
              type="button"
              onClick={() => setInfoOpen(false)}
              className={buttonClass({ size: "sm" })}
            >
              {t("modalClose")}
            </button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-create-text">{t("modalText")}</p>
      </Sheet>
    </div>
  );
}
