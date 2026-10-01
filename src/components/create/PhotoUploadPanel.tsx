"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PHOTO_CONSENT_VERSION, PHOTO_MAX_EDGE, PHOTO_MAX_UPLOAD_BYTES } from "@/lib/creation-flow";
import { ensureGuestSession } from "@/lib/guest-session";
import { isCaptchaError } from "@/lib/captcha/turnstile";
import { buttonClass } from "@/components/ui";
import Sheet from "./Sheet";
import { Spinner } from "@/components/ui/Spinner";

interface PhotoUploadPanelProps {
  name: string;
  photoPath: string | null;
  onPhotoChange: (photoPath: string | null) => void;
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
  "captcha_failed",
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
 * POST /api/characters/photo and can be withdrawn at any time (DELETE).
 */
export default function PhotoUploadPanel({ name, photoPath, onPhotoChange }: PhotoUploadPanelProps) {
  const t = useTranslations("crear.photo");
  const tu = useTranslations("crear.photoUi");
  const tAuth = useTranslations("auth");
  const locale = useLocale();
  const uid = useId();
  const [consent, setConsent] = useState(!!photoPath);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);

  // Release the local thumbnail URL (never persisted, never uploaded as-is)
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function upload(file: File) {
    setError(null);
    if (!consent) return setError("consent_required");
    setBusy("upload");
    try {
      let jpeg: Blob;
      try {
        jpeg = await toUploadJpeg(file);
      } catch (err) {
        console.warn("[create] photo decode failed:", err);
        setError(err instanceof Error && err.message === "still_too_large" ? "too_large" : "unsupported_type");
        return;
      }
      await ensureGuestSession({ prompt: tAuth("captcha.prompt"), cancel: tAuth("captcha.cancel"), locale });
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
      setPreviewUrl(URL.createObjectURL(jpeg));
      onPhotoChange(data.photoPath);
    } catch (err) {
      console.warn("[create] photo upload failed:", err);
      setError(isCaptchaError(err) ? "captcha_failed" : "upload_failed");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!photoPath) return;
    setError(null);
    setBusy("remove");
    try {
      const res = await fetch("/api/characters/photo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoPath }),
      });
      // 404/410: already gone server-side — the outcome the parent wants anyway
      if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`photo_delete_${res.status}`);
      setPreviewUrl(null);
      setConsent(false); // withdrawal: a new upload needs fresh consent
      onPhotoChange(null);
    } catch (err) {
      console.warn("[create] photo delete failed:", err);
      setError("remove_failed");
    } finally {
      setBusy(null);
    }
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // the same file can be picked again after a removal
    if (file) void upload(file);
  };

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

      {photoPath ? (
        <div className="flex items-center gap-4 rounded-xl bg-create-bg p-3" data-testid="photo-uploaded">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL
            <img src={previewUrl} alt={tu("uploadedAlt", { name })} className="h-16 w-16 rounded-lg object-cover" />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-create-neutral">
              <span aria-hidden className="material-symbols-outlined text-2xl text-create-text-sub">photo</span>
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-create-text-dark">{tu("uploaded")}</p>
            <p className="text-xs text-create-text-sub">{tu("uploadedHint", { name })}</p>
          </div>
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy !== null}
            className="shrink-0 rounded-full border-2 border-create-neutral px-3 py-1.5 text-xs font-bold text-create-text transition-colors hover:border-red-300 hover:text-red-700 disabled:opacity-50"
          >
            {busy === "remove" ? tu("removing") : t("remove")}
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
              disabled={!consent || busy !== null}
              onClick={() => galleryRef.current?.click()}
              className={`${buttonBase} bg-create-primary text-white hover:bg-create-primary-hover`}
            >
              {busy === "upload" ? (
                <Spinner className="text-lg" />
              ) : (
                <span aria-hidden className="material-symbols-outlined text-lg">photo_library</span>
              )}
              {busy === "upload" ? tu("uploading") : tu("choosePhoto")}
            </button>
            <button
              type="button"
              disabled={!consent || busy !== null}
              onClick={() => cameraRef.current?.click()}
              className={`${buttonBase} border-2 border-create-primary/30 bg-white text-brand-text hover:border-create-primary sm:hidden`}
            >
              <span aria-hidden className="material-symbols-outlined text-lg">photo_camera</span>
              {tu("takePhoto")}
            </button>
          </div>
          {!consent && <p className="text-xs text-create-text-sub">{tu("consentFirst")}</p>}
        </>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error === "remove_failed" ? tu("removeFailed") : t(`errors.${error}`)}
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
