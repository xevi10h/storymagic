"use client";

import { useSyncExternalStore } from "react";

// The name typed on the landing hero, shared with the mobile sticky CTA so both
// read "Crear el libro de Lucía" and deep-link to /crear with it. In-memory only:
// the creation draft (localStorage) is written by /crear once the parent arrives.

let heroName = "";
const listeners = new Set<() => void>();

export function setHeroName(name: string): void {
  if (name === heroName) return;
  heroName = name;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Current hero name ("" before the parent types, and on the server). */
export function useHeroName(): string {
  return useSyncExternalStore(
    subscribe,
    () => heroName,
    () => "",
  );
}

/** /crear entry link, with ?name= when there is one (read by the creation page's prefill). */
export function crearHref(name: string): { pathname: "/crear"; query?: { name: string } } {
  const trimmed = name.trim();
  return trimmed ? { pathname: "/crear", query: { name: trimmed } } : { pathname: "/crear" };
}
