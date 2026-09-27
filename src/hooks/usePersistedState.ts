"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// Creation-draft key. Kept here (not in lib/creation-flow) so light importers such
// as the home page's DevResetCreateState don't pull the template catalog into
// their bundle; lib/creation-flow re-exports it as CREATE_STORAGE_KEY.
const STORAGE_KEY = "meapica_create_state";

/**
 * Like useState but persists to localStorage.
 * Hydrates from storage on mount, writes on every update.
 * `migrate` upgrades any older stored shape (and rejects garbage) on hydration.
 */
export function usePersistedState<T>(
  key: string,
  initialValue: T,
  migrate?: (raw: unknown) => T
): [T, (value: T | ((prev: T) => T)) => void, () => void, boolean] {
  const [state, setStateRaw] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);
  const initialValueRef = useRef(initialValue);

  // Hydrate from localStorage on mount (client only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        setStateRaw(migrate ? migrate(parsed) : (parsed as T));
      }
    } catch {
      // Ignore parse errors — use initial value
    }
    setHydrated(true);
    // migrate is a pure module-level function; hydrate once per key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Persist to localStorage on every change (after hydration)
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Ignore quota errors
    }
  }, [key, state, hydrated]);

  const setState = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStateRaw(value);
    },
    []
  );

  const clearState = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore
    }
    setStateRaw(initialValueRef.current);
  }, [key]);

  return [state, setState, clearState, hydrated];
}

export { STORAGE_KEY };
