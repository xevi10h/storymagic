"use client";

import { useMemo, useSyncExternalStore } from "react";
import { carriedParams } from "@/lib/tracking/attribution";

// The name typed on the landing hero, shared with the mobile sticky CTA so both
// read "Crear el libro de Lucía" and open /create with it filled in. In-memory only:
// the creation draft (localStorage) is written by /create once the parent arrives.
//
// The name never goes in a URL our code builds: the ad pixels (TikTok, Meta), GA4 and PostHog
// report page URLs, referrers and link targets, and a child's name must not reach them.
// A CTA hands the name over in memory (handOffHeroName) and /create takes it once
// (takeHandedOffName). /create?name= still works for a hard load (the no-JS form GET, old links):
// Tracking holds every tracker until /create has removed it from the address bar.

let heroName = "";
/** The name a CTA passed to /create, consumed once by the creation page. */
let handedOff = "";
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

/** A CTA is opening /create: pass the typed name along (in memory, never in the URL). */
export function handOffHeroName(name: string): void {
  handedOff = name.trim();
}

/** Whether a CTA handed a name over (read on the creation page's first render, not consumed). */
export function hasHandedOffName(): boolean {
  return handedOff !== "";
}

/** The handed-over name, once: a later visit to /create (header link, back button) gets "". */
export function takeHandedOffName(): string {
  const name = handedOff;
  handedOff = "";
  return name;
}

/** /create entry link with the landing's attribution params (`carry`, from carriedParams()) so /create keeps utm_source=meta. */
export function createPageHref(carry: Record<string, string> = {}): { pathname: "/create"; query?: Record<string, string> } {
  return Object.keys(carry).length > 0 ? { pathname: "/create", query: carry } : { pathname: "/create" };
}

/** Browser: the current page's attribution params to carry into /create (read when submitting). */
export function currentCarriedParams(): Record<string, string> {
  return typeof window === "undefined" ? {} : carriedParams(window.location.search);
}

const noop = () => () => {};

/** createPageHref for a rendered link: no params on the server and the first render, the page's once hydrated. */
export function useCreatePageHref() {
  const search = useSyncExternalStore(
    noop,
    () => window.location.search,
    () => "",
  );
  return useMemo(() => createPageHref(carriedParams(search)), [search]);
}

/**
 * onClick for a rendered /create link: hands the name over when the link opens in this tab.
 * A modified click (new tab / window) leaves nothing behind for a later visit to consume.
 */
export function handOffOnClick(name: string) {
  return (e: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    handOffHeroName(name);
  };
}
