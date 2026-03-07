"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "meapica_create_state";

/**
 * Like useState but persists to localStorage.
 * Hydrates from storage on mount, writes on every update.
 */
export function usePersistedState<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [state, setStateRaw] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);
  const initialValueRef = useRef(initialValue);

  // Hydrate from localStorage on mount (client only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        setStateRaw(JSON.parse(stored));
      }
    } catch {
      // Ignore parse errors — use initial value
    }
    setHydrated(true);
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

  return [state, setState, clearState];
}

export { STORAGE_KEY };
