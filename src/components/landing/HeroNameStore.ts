"use client";

import { useMemo, useSyncExternalStore } from "react";
import { carriedParams } from "@/lib/tracking/attribution";

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

/**
 * /create entry link, with ?name= when there is one (read by the creation page's prefill) and the
 * landing's attribution params (`carry`, from carriedParams()) so /create keeps utm_source=meta.
 */
export function createPageHref(
  name: string,
  carry: Record<string, string> = {},
): { pathname: "/create"; query?: Record<string, string> } {
  const trimmed = name.trim();
  const query = trimmed ? { ...carry, name: trimmed } : carry;
  return Object.keys(query).length > 0 ? { pathname: "/create", query } : { pathname: "/create" };
}

/** Browser: the current page's attribution params to carry into /create (read when submitting). */
export function currentCarriedParams(): Record<string, string> {
  return typeof window === "undefined" ? {} : carriedParams(window.location.search);
}

const noop = () => () => {};

/** createPageHref for a rendered link: no params on the server and the first render, the page's once hydrated. */
export function useCreatePageHref(name: string) {
  const search = useSyncExternalStore(
    noop,
    () => window.location.search,
    () => "",
  );
  return useMemo(() => createPageHref(name, carriedParams(search)), [name, search]);
}
