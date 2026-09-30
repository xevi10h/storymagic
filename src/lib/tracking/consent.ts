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

/** Pixel id configured = ads tracking exists = the banner is needed at all. */
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";

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
    // ponytail: host-only + apex domain covers how the Pixel sets _fbp/_fbc.
    for (const name of ["_fbp", "_fbc", UTM_COOKIE]) {
      document.cookie = `${name}=; Path=/; Max-Age=0`;
      document.cookie = `${name}=; Path=/; Max-Age=0; Domain=.${location.hostname.replace(/^www\./, "")}`;
    }
  }
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: consent }));
}

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

/** Last-touch UTMs → first-party cookie (30 days), read by /api/checkout into Stripe metadata. */
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

/**
 * Browser event for the Meta Pixel. No-op without consent (the Pixel isn't
 * loaded). `eventId` must match the server (CAPI) event for deduplication.
 */
export function trackEvent(name: string, params?: Record<string, unknown>, eventId?: string, attempt = 0) {
  if (!META_PIXEL_ID || getConsent() !== "granted") return;
  const fbq = (window as unknown as { fbq?: Fbq }).fbq;
  if (!fbq) {
    // ponytail: the Pixel <Script> runs after hydration, so a mount-time event can
    // beat it; poll up to ~5 s instead of a queue.
    if (attempt < 20) setTimeout(() => trackEvent(name, params, eventId, attempt + 1), 250);
    return;
  }
  fbq("track", name, params ?? {}, eventId ? { eventID: eventId } : undefined);
}

/** Shared by the success page (Pixel) and the Stripe webhook (CAPI). */
export const purchaseEventId = (checkoutSessionId: string) => `purchase_${checkoutSessionId}`;
