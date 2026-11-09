"use client";

// Photo mode on /create: upload (step A) → "Crear su personaje" → drawing (step B, dark
// loading overlay) → reveal (step C, modal) via POST /api/characters/photo-portrait.
// Lives at page level (not in the photo panel) so a drawing in progress survives switching
// tabs or screens.

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { CreateBookState, Gender } from "@/lib/create-store";
import { parsePhotoTraits } from "@/lib/photo-traits";
import { ensureGuestSession } from "@/lib/guest-session";
import { trackEvent } from "@/lib/tracking/consent";

/** Parent-facing error codes (crear.photo.errors.*). */
export type PhotoPortraitError = "photo_unavailable" | "rate_limited" | "provider_unavailable" | "daily_cap_reached" | "generation_failed";

/** Portrait (~15–25 s) + traits read; past this the request is considered lost. */
const DRAW_TIMEOUT_MS = 100_000;

function mapError(code: unknown, status: number): PhotoPortraitError {
  if (code === "photo_unavailable" || status === 410) return "photo_unavailable";
  if (code === "daily_cap_reached") return "daily_cap_reached";
  if (code === "rate_limited" || status === 429) return "rate_limited";
  if (code === "provider_unavailable" || status === 503) return "provider_unavailable";
  return "generation_failed";
}

/** Best effort: a photo never drawn is also removed by the hourly purge (≤ 24 h). */
function deletePhoto(photoPath: string) {
  void fetch("/api/characters/photo", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ photoPath }),
  }).catch(() => {});
}

export function usePhotoPortrait(state: CreateBookState, setState: Dispatch<SetStateAction<CreateBookState>>) {
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState<PhotoPortraitError | null>(null);
  /** Step C: the drawing made in this visit, shown in the reveal modal until the parent continues. */
  const [revealOpen, setRevealOpen] = useState(false);
  /** Local thumbnail of the uploaded photo (object URL, never persisted nor sent anywhere). */
  const [preview, setPreview] = useState<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  /** Step A: the photo is stored; nothing is drawn until the parent asks for it. */
  const uploaded = useCallback(
    (photoPath: string, thumbnail: Blob | null) => {
      setError(null);
      setPreview(thumbnail ? URL.createObjectURL(thumbnail) : null);
      setState((prev) => ({ ...prev, photoPath, photoCharacter: null }));
    },
    [setState],
  );

  /** Step B: draw. One request at a time (double clicks, retries). */
  const draw = useCallback(
    async (photoPath: string, child: { gender: Gender; age: number; favoriteColor: string }) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setDrawing(true);
      setError(null);
      try {
        await ensureGuestSession();
        const res = await fetch("/api/characters/photo-portrait", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(DRAW_TIMEOUT_MS),
          body: JSON.stringify({ photoPath, gender: child.gender, age: child.age, favoriteColor: child.favoriteColor || undefined }),
        });
        const data = (await res.json().catch(() => ({}))) as { portraitUrl?: unknown; portraitPath?: unknown; traits?: unknown; error?: unknown };
        // null = the server could not read the traits: neutral look (explicit, see protagonistLook).
        const traits = data.traits === null ? null : parsePhotoTraits(data.traits, child.gender);
        const traitsOk = data.traits === null || traits !== null;
        if (res.ok && traitsOk && typeof data.portraitUrl === "string" && typeof data.portraitPath === "string") {
          const photoCharacter = { portraitUrl: data.portraitUrl, portraitPath: data.portraitPath, traits, gender: child.gender };
          // The server deleted the photo: from now on only the drawing exists.
          setState((prev) => (prev.photoPath === photoPath ? { ...prev, photoPath: null, photoCharacter } : prev));
          setPreview(null);
          setRevealOpen(true);
          trackEvent("photo_portrait_ready");
          return;
        }
        const code = res.ok ? "generation_failed" : mapError(data.error, res.status);
        if (code === "photo_unavailable") {
          setState((prev) => (prev.photoPath === photoPath ? { ...prev, photoPath: null } : prev));
          setPreview(null);
        }
        setError(code);
      } catch (err) {
        console.warn("[create] photo portrait failed:", err);
        setError("generation_failed");
      } finally {
        inFlight.current = false;
        setDrawing(false);
      }
    },
    [setState],
  );

  /** "Quitar la foto" / "Probar con otra foto": back to a fresh consent + upload; a stored photo is deleted now. */
  const reset = useCallback(() => {
    if (inFlight.current) return;
    setError(null);
    setRevealOpen(false);
    setPreview(null);
    if (state.photoPath) deletePhoto(state.photoPath);
    setState((prev) => ({ ...prev, photoPath: null, photoCharacter: null }));
  }, [setState, state.photoPath]);

  const closeReveal = useCallback(() => setRevealOpen(false), []);

  return { drawing, error, revealOpen, preview, uploaded, draw, reset, closeReveal };
}
