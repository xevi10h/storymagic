"use client";

// Photo mode on /create: turns an uploaded photo into the child's illustrated portrait
// (POST /api/characters/photo-portrait) and keeps the draft consistent around it.
// Lives at page level (not in the photo panel) so the drawing survives switching tabs
// or screens while it is being painted.

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { CreateBookState, Gender } from "@/lib/create-store";
import { isPhotoUploadEnabled } from "@/lib/creation-flow";
import { parsePhotoTraits } from "@/lib/photo-traits";
import { ensureGuestSession } from "@/lib/guest-session";
import { trackEvent } from "@/lib/tracking/consent";

/** Parent-facing error codes (crear.photo.errors.*). */
export type PhotoPortraitError =
  | "photo_unavailable"
  | "rate_limited"
  | "provider_unavailable"
  | "daily_cap_reached"
  | "generation_failed"
  | "interrupted";

/** Portrait (~15–25 s) + traits read; past this the request is considered lost. */
const DRAW_TIMEOUT_MS = 100_000;

function mapError(code: unknown, status: number): PhotoPortraitError {
  if (code === "photo_unavailable" || status === 410) return "photo_unavailable";
  if (code === "daily_cap_reached") return "daily_cap_reached";
  if (code === "rate_limited" || status === 429) return "rate_limited";
  if (code === "provider_unavailable" || status === 503) return "provider_unavailable";
  return "generation_failed";
}

/** Best effort: the photo is gone server-side after any drawing, and the hourly purge is the backstop. */
function deletePhoto(photoPath: string) {
  void fetch("/api/characters/photo", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ photoPath }),
  }).catch(() => {});
}

export function usePhotoPortrait(
  state: CreateBookState,
  setState: Dispatch<SetStateAction<CreateBookState>>,
  hydrated: boolean,
) {
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState<PhotoPortraitError | null>(null);
  const inFlight = useRef(false);

  const draw = useCallback(
    async (photoPath: string, child: { gender: Gender; age: number; favoriteColor: string }) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setDrawing(true);
      setError(null);
      setState((prev) => ({ ...prev, photoPath, photoCharacter: null }));
      try {
        await ensureGuestSession();
        const res = await fetch("/api/characters/photo-portrait", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(DRAW_TIMEOUT_MS),
          body: JSON.stringify({ photoPath, gender: child.gender, age: child.age, favoriteColor: child.favoriteColor || undefined }),
        });
        const data = (await res.json().catch(() => ({}))) as { portraitUrl?: unknown; portraitPath?: unknown; traits?: unknown; error?: unknown };
        const traits = res.ok ? parsePhotoTraits(data.traits, child.gender) : null;
        if (res.ok && traits && typeof data.portraitUrl === "string" && typeof data.portraitPath === "string") {
          const photoCharacter = { portraitUrl: data.portraitUrl, portraitPath: data.portraitPath, traits, gender: child.gender };
          // The server deleted the photo: from now on only the drawing exists.
          setState((prev) => (prev.photoPath === photoPath ? { ...prev, photoPath: null, photoCharacter } : prev));
          trackEvent("photo_portrait_ready");
          return;
        }
        const code = res.ok ? "generation_failed" : mapError(data.error, res.status);
        if (code === "photo_unavailable") setState((prev) => (prev.photoPath === photoPath ? { ...prev, photoPath: null } : prev));
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

  /** "Probar con otra foto": back to a fresh consent + upload; any leftover photo is deleted. */
  const reset = useCallback(() => {
    if (inFlight.current) return;
    setError(null);
    setState((prev) => {
      if (prev.photoPath) deletePhoto(prev.photoPath);
      return { ...prev, photoPath: null, photoCharacter: null };
    });
  }, [setState]);

  // A photo left in a restored draft means its drawing never arrived (reload or tab closed
  // mid-drawing): delete it and ask for the photo again, once per page load.
  const restoredChecked = useRef(false);
  const restoredPhoto = state.photoPath;
  useEffect(() => {
    if (!hydrated || restoredChecked.current) return;
    restoredChecked.current = true;
    if (!restoredPhoto || inFlight.current) return;
    deletePhoto(restoredPhoto);
    setState((prev) => (prev.photoPath === restoredPhoto ? { ...prev, photoPath: null } : prev));
    if (isPhotoUploadEnabled()) setError("interrupted");
    // Only the draft as restored on load matters, not later uploads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  return { drawing, error, draw, reset };
}
