// Vercel Web Analytics: cookieless page views + a handful of funnel events, so we can see where
// ad visitors drop (landing → CTA → creator steps → preview → checkout) for EVERY visitor, not only
// the ones who accept cookies. Loaded regardless of the cookie choice because nothing is stored on
// the device: Vercel counts visitors with a hash of the request that it discards after 24 hours
// (vercel.com/docs/analytics/privacy-policy). We never call identify()/enableCookie, the only
// paths in Vercel's script that write to the device. Our funnel source comes from
// lib/tracking/attribution.ts (JS memory, no storage).
//
// Privacy rules enforced here, before anything leaves the browser:
// - URLs keep only utm_source / utm_campaign / utm_content (no names, emails, tokens, ids);
// - story ids (UUIDs) and referral codes in paths become placeholders;
// - capability URLs (shared preview, gift voucher card) send nothing at all.
// Pro plan: 2 properties per custom event, so every event is `source` + at most one more.
// Shared by client and server — the client `track()` is only called in the browser.

import { track } from "@vercel/analytics";
import type { BeforeSendEvent } from "@vercel/analytics";
import { getFirstTouchSource } from "./attribution";

export type FunnelEvent =
  | "landing_view"
  | "cta_click"
  | "create_step"
  | "photo_uploaded"
  | "preview_requested"
  | "preview_shown"
  | "checkout_started";

type FunnelValue = string | number | boolean;

/** Query parameters that survive; everything else (session_id, token, name, email…) is dropped. */
const KEPT_QUERY = ["utm_source", "utm_campaign", "utm_content"] as const;
/** Capability URLs: the token in the path grants access, so the page is not measured. Locale prefix optional. */
const NO_TRACK_PATH = /^(\/(es|ca|en|fr))?\/(preview|gift-voucher\/card)\//;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const REFERRAL_PATH = /^((\/(es|ca|en|fr))?\/r\/)[^/]+/;

/** Pure: a path with no ids in it, or null when the page must not be measured. */
export function redactPath(pathname: string): string | null {
  if (NO_TRACK_PATH.test(pathname)) return null;
  return pathname.replace(UUID, "[id]").replace(REFERRAL_PATH, "$1[code]");
}

/** Pure: the URL Vercel receives (allowed UTMs only, no hash), or null to send nothing. */
export function sanitizeUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const path = redactPath(url.pathname);
  if (path === null) return null;
  const kept = new URLSearchParams();
  for (const key of KEPT_QUERY) {
    const value = url.searchParams.get(key)?.trim();
    if (value) kept.set(key, value.slice(0, 100));
  }
  url.pathname = path;
  url.search = kept.toString();
  url.hash = "";
  return url.toString();
}

/** `beforeSend` of <Analytics />: runs for page views and custom events alike. */
export function beforeSend<E extends BeforeSendEvent>(event: E): E | null {
  const url = sanitizeUrl(event.url);
  return url ? { ...event, url } : null;
}

/** Our existing event names (trackEvent in consent.ts) → the funnel event and its one extra property. */
const FUNNEL: Record<string, { name: FunnelEvent; pick?: (p: Record<string, unknown>) => [string, unknown] }> = {
  landing_view: { name: "landing_view", pick: (p) => ["page", p.page] },
  cta_click: { name: "cta_click", pick: (p) => ["placement", p.placement] },
  create_step: { name: "create_step", pick: (p) => ["step", p.step] },
  photo_uploaded: { name: "photo_uploaded" },
  generation_start: { name: "preview_requested", pick: (p) => ["retry", p.retry] },
  preview_ready: { name: "preview_shown" },
  InitiateCheckout: {
    name: "checkout_started",
    pick: (p) => ["format", Array.isArray(p.content_ids) ? p.content_ids[0] : undefined],
  },
};

const isValue = (v: unknown): v is FunnelValue =>
  (typeof v === "string" && v.length > 0 && v.length <= 100) || typeof v === "number" || typeof v === "boolean";

/**
 * An event can fire before <Analytics /> has mounted (it sits in a Suspense boundary). Create the
 * same queue the package would, with `beforeSend` FIRST: Vercel's script replays the queue in
 * order, so an event queued ahead of it would leave unredacted.
 */
function ensureQueue() {
  if (window.va) return;
  window.va = (...args) => {
    (window.vaq ??= []).push(args as [string, unknown?]);
  };
  window.va("beforeSend", beforeSend);
}

/** Browser: the Vercel side of trackEvent(). No-op for names outside the funnel. Never throws. */
export function trackFunnel(eventName: string, params: Record<string, unknown> = {}): void {
  const funnel = FUNNEL[eventName];
  if (!funnel || typeof window === "undefined") return;
  try {
    const data: Record<string, FunnelValue> = { source: getFirstTouchSource() };
    const [key, value] = funnel.pick?.(params) ?? [];
    if (key && isValue(value)) data[key] = value;
    ensureQueue();
    track(funnel.name, data);
  } catch {
    // analytics must never break the page
  }
}
