// Advertising consent (LSSI art. 22.2 + AEPD cookie guide): nothing that is not
// strictly necessary (Meta Pixel, UTM attribution) runs before "Aceptar".
// Shared by client and server — no server-only imports here.

export const CONSENT_COOKIE = "meapica_consent";
export const UTM_COOKIE = "meapica_utm";
export const CONSENT_OPEN_EVENT = "meapica:consent-open";
export const CONSENT_CHANGE_EVENT = "meapica:consent-change";

export type Consent = "granted" | "denied";

// AEPD: re-ask at most every 24 months; 12 is the common practice.
const MAX_AGE_S = 60 * 60 * 24 * 365;

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";
export const TIKTOK_PIXEL_ID = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID ?? "";
/** A pixel id configured = ads tracking exists = the banner is needed at all. */
export const ADS_TRACKING_ENABLED = META_PIXEL_ID !== "" || TIKTOK_PIXEL_ID !== "";

export function parseConsent(value: string | undefined | null): Consent | null {
  return value === "granted" || value === "denied" ? value : null;
}

function readCookie(name: string): string | null {
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

function writeCookie(name: string, value: string, maxAge: number) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

export function getConsent(): Consent | null {
  return parseConsent(readCookie(CONSENT_COOKIE));
}

export function setConsent(consent: Consent) {
  writeCookie(CONSENT_COOKIE, consent, MAX_AGE_S);
  if (consent === "denied") {
    // Withdrawal: drop what was stored under the previous "granted".
    // ponytail: host-only + apex domain covers how the pixels set their cookies.
    for (const name of ["_fbp", "_fbc", "_ttp", "ttclid", "_tt_enable_cookie", UTM_COOKIE]) {
      document.cookie = `${name}=; Path=/; Max-Age=0`;
      document.cookie = `${name}=; Path=/; Max-Age=0; Domain=.${location.hostname.replace(/^www\./, "")}`;
    }
  }
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: consent }));
}

// ttclid: TikTok's click id, sent back with the server-side purchase.
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ttclid"] as const;

/** Last-touch UTMs (+ ttclid) → first-party cookie (30 days), read by /api/checkout into Stripe metadata. */
export function captureUtm(search: string) {
  const params = new URLSearchParams(search);
  const utm: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const v = params.get(key);
    if (v) utm[key] = v.slice(0, 100);
  }
  if (Object.keys(utm).length > 0) writeCookie(UTM_COOKIE, JSON.stringify(utm), 60 * 60 * 24 * 30);
}

type Fbq = (...args: unknown[]) => void;
type Ttq = { track: (event: string, params?: Record<string, unknown>, options?: { event_id?: string }) => void };

// Our (Meta standard) event names → TikTok standard events.
const TIKTOK_EVENT: Record<string, string> = {
  ViewContent: "ViewContent",
  Lead: "SubmitForm",
  InitiateCheckout: "InitiateCheckout",
  Purchase: "CompletePayment",
};

/** Meta-style params → TikTok's (`contents` instead of `content_ids`). */
function toTikTokParams(params: Record<string, unknown> = {}): Record<string, unknown> {
  const { content_ids, ...rest } = params;
  return Array.isArray(content_ids) ? { ...rest, contents: content_ids.map((id) => ({ content_id: id })) } : rest;
}

/**
 * Browser event for the Meta and TikTok pixels. No-op without consent (the
 * pixels aren't loaded). `eventId` must match the server event for deduplication.
 */
export function trackEvent(name: string, params?: Record<string, unknown>, eventId?: string) {
  if (!ADS_TRACKING_ENABLED || getConsent() !== "granted") return;
  if (META_PIXEL_ID) {
    whenLoaded("fbq", (fbq: Fbq) => fbq("track", name, params ?? {}, eventId ? { eventID: eventId } : undefined));
  }
  const tiktokEvent = TIKTOK_EVENT[name];
  if (TIKTOK_PIXEL_ID && tiktokEvent) {
    whenLoaded("ttq", (ttq: Ttq) => ttq.track(tiktokEvent, toTikTokParams(params), eventId ? { event_id: eventId } : undefined));
  }
}

// ponytail: the pixel <Script>s run after hydration, so a mount-time event can
// beat them; poll up to ~5 s instead of a queue.
function whenLoaded<T>(global: "fbq" | "ttq", send: (api: T) => void, attempt = 0) {
  const api = (window as unknown as Record<string, T | undefined>)[global];
  if (api) return send(api);
  if (attempt < 20) setTimeout(() => whenLoaded(global, send, attempt + 1), 250);
}

/** Shared by the success page (Pixel) and the Stripe webhook (CAPI). */
export const purchaseEventId = (checkoutSessionId: string) => `purchase_${checkoutSessionId}`;
