"use client";

import { useSyncExternalStore } from "react";

// The name typed on the landing hero, shared with the mobile sticky CTA so both
// read "Crear el libro de Lucía" and deep-link to /create with it. In-memory only:
// the creation draft (localStorage) is written by /create once the parent arrives.

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

/** /create entry link, with ?name= when there is one (read by the creation page's prefill). */
export function createPageHref(name: string): { pathname: "/create"; query?: { name: string } } {
  const trimmed = name.trim();
  return trimmed ? { pathname: "/create", query: { name: trimmed } } : { pathname: "/create" };
}
