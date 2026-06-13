"use client";

import { useEffect } from "react";
import { STORAGE_KEY } from "@/hooks/usePersistedState";

/**
 * DEV-ONLY: wipes the persisted book-creation draft (`meapica_create_state`)
 * when the home page mounts, so local testing always starts from a clean slate.
 *
 * Compiled away in production: `process.env.NODE_ENV` is statically replaced at
 * build time, so the body becomes dead code and is tree-shaken out — a real user
 * who returns to the home mid-creation keeps their draft.
 */
export default function DevResetCreateState() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);
  return null;
}
