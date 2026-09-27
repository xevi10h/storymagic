"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { patchStoredDraft } from "@/lib/creation-flow";

export type SaveState = "idle" | "saving" | "saved" | "error";

interface Values {
  dedication: string;
  senderName: string;
}

const DEBOUNCE_MS = 700;

/**
 * Local dedication state with debounced autosave to PATCH /api/stories/{id}/dedication.
 * The creation draft (localStorage) is mirrored too, so Back to /crear keeps it.
 * `flush()` saves any pending change immediately (call before navigating away).
 */
export function useDedicationAutosave(storyId: string, onSaved?: (v: Values) => void) {
  const [values, setValues] = useState<Values | null>(null);
  const valuesRef = useRef<Values | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Values | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  const save = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (inFlight.current) await inFlight.current;
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    setSaveState("saving");
    const run = (async () => {
      try {
        const res = await fetch(`/api/stories/${storyId}/dedication`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        if (!res.ok) throw new Error(`dedication_${res.status}`);
        setSaveState(pending.current ? "saving" : "saved");
        onSavedRef.current?.(next);
      } catch (err) {
        console.warn("[dedication] save failed:", err);
        pending.current = pending.current ?? next; // retry on next flush/change
        setSaveState("error");
      }
    })();
    inFlight.current = run;
    await run;
    inFlight.current = null;
  }, [storyId]);

  /** Set initial values from the server without triggering a save. */
  const init = useCallback((v: Values) => {
    if (valuesRef.current) return;
    valuesRef.current = v;
    setValues(v);
  }, []);

  const update = useCallback(
    (patch: Partial<Values>) => {
      const next = { dedication: "", senderName: "", ...valuesRef.current, ...patch };
      valuesRef.current = next;
      pending.current = next;
      patchStoredDraft(next, storyId);
      setValues(next);
      setSaveState("idle");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(), DEBOUNCE_MS);
    },
    [save, storyId],
  );

  const flush = useCallback(async () => {
    await save();
  }, [save]);

  // Best effort on tab close
  useEffect(() => {
    const onHide = () => {
      const next = pending.current;
      if (!next) return;
      try {
        void fetch(`/api/stories/${storyId}/dedication`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
          keepalive: true,
        });
        pending.current = null;
      } catch {
        // ignore
      }
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [storyId]);

  return { values, init, update, flush, saveState };
}
